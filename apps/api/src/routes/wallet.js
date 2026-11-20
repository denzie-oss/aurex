const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');

async function ensureWallet(userId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO ledger_accounts
       (account_code, name, account_type, normal_balance, owner_user_id, currency)
       VALUES ($1, $2, 'liability', 'credit', $3, 'NGN')
       ON CONFLICT (owner_user_id) DO NOTHING`,
      [`WALLET-${userId}`, 'Customer NGN Wallet', userId]
    );

    const account = await client.query(
      'SELECT id FROM ledger_accounts WHERE owner_user_id = $1',
      [userId]
    );

    if (!account.rowCount) {
      throw new Error('Could not provision wallet ledger account');
    }

    await client.query(
      `INSERT INTO wallets (user_id, account_id, currency)
       VALUES ($1, $2, 'NGN')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, account.rows[0].id]
    );

    const result = await client.query(
      `SELECT id, user_id, account_id, currency, status, created_at
       FROM wallets WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getBalance(walletId) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(e.credit_kobo - e.debit_kobo), 0)::text
       AS balance_kobo
     FROM ledger_entries e
     JOIN wallet_transactions t ON t.id = e.transaction_id
     JOIN wallets w ON w.account_id = e.account_id
     WHERE w.id = $1 AND t.status = 'posted'`,
    [walletId]
  );

  return result.rows[0].balance_kobo;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchStatement(wallet, userId, from, to, limit, offset) {
  const openingResult = await pool.query(
    `SELECT COALESCE(SUM(e.credit_kobo - e.debit_kobo), 0)::text
       AS opening_balance
     FROM ledger_entries e
     JOIN wallet_transactions t ON t.id = e.transaction_id
     WHERE e.account_id = $1
       AND t.wallet_id = $2
       AND t.user_id = $3
       AND t.status = 'posted'
       AND t.created_at < $4::date`,
    [wallet.account_id, wallet.id, userId, from]
  );

  const openingBalance = openingResult.rows[0].opening_balance;

  const summaryResult = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COALESCE(SUM(
         CASE WHEN t.status = 'posted'
           THEN COALESCE(e.balance_change, 0)
           ELSE 0
         END
       ), 0)::text AS period_net_change
     FROM wallet_transactions t
     LEFT JOIN LATERAL (
       SELECT SUM(le.credit_kobo - le.debit_kobo) AS balance_change
       FROM ledger_entries le
       WHERE le.transaction_id = t.id
         AND le.account_id = $1
     ) e ON true
     WHERE t.wallet_id = $2
       AND t.user_id = $3
       AND t.created_at >= $4::date
       AND t.created_at < ($5::date + INTERVAL '1 day')`,
    [wallet.account_id, wallet.id, userId, from, to]
  );

  const summary = summaryResult.rows[0];

  const rowsResult = await pool.query(
    `WITH transaction_rows AS (
       SELECT
         t.id,
         t.reference,
         t.transaction_type,
         t.amount_kobo::text AS amount_kobo,
         t.currency,
         t.status,
         t.description,
         t.created_at,
         CASE WHEN t.status = 'posted'
           THEN COALESCE(SUM(e.credit_kobo - e.debit_kobo), 0)
           ELSE 0
         END AS balance_change_kobo
       FROM wallet_transactions t
       LEFT JOIN ledger_entries e
         ON e.transaction_id = t.id
        AND e.account_id = $1
       WHERE t.wallet_id = $2
         AND t.user_id = $3
         AND t.created_at >= $4::date
         AND t.created_at < ($5::date + INTERVAL '1 day')
       GROUP BY t.id
     ),
     running_rows AS (
       SELECT *,
         (
           $6::numeric +
           SUM(balance_change_kobo) OVER (
             ORDER BY created_at ASC, id ASC
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           )
         )::text AS running_balance_kobo
       FROM transaction_rows
     )
     SELECT *
     FROM running_rows
     ORDER BY created_at DESC, id DESC
     LIMIT $7 OFFSET $8`,
    [
      wallet.account_id,
      wallet.id,
      userId,
      from,
      to,
      openingBalance,
      limit,
      offset
    ]
  );

  const closingBalance = (
    BigInt(openingBalance) + BigInt(summary.period_net_change)
  ).toString();

  return {
    openingBalanceKobo: openingBalance,
    periodNetChangeKobo: summary.period_net_change,
    closingBalanceKobo: closingBalance,
    total: summary.total,
    rows: rowsResult.rows
  };
}

// GET /api/v1/wallet
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.sub);
    const balanceKobo = await getBalance(wallet.id);

    res.json({
      data: {
        id: wallet.id,
        currency: wallet.currency,
        status: wallet.status,
        balanceKobo
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/wallet/transactions
router.get('/transactions', requireAuth, async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.sub);

    const result = await pool.query(
      `SELECT reference, transaction_type, amount_kobo::text,
              currency, status, description, created_at
       FROM wallet_transactions
       WHERE wallet_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [wallet.id, req.user.sub]
    );

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/wallet/statement
router.get('/statement', requireAuth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const from = req.query.from || '1970-01-01';
    const to = req.query.to || today;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);

    if (
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      !validDate(from) ||
      !validDate(to) ||
      from > to
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'Use valid YYYY-MM-DD dates. The start date must not be after the end date.'
        }
      });
    }

    if (
      !Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100
    ) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Page must be positive and limit must be between 1 and 100.'
        }
      });
    }

    const wallet = await ensureWallet(req.user.sub);
    const offset = (page - 1) * limit;

    if (!Number.isSafeInteger(offset)) {
      return res.status(400).json({
        error: { code: 'INVALID_PAGINATION' }
      });
    }

    const statement = await fetchStatement(
      wallet, req.user.sub, from, to, limit, offset
    );

    res.json({
      data: {
        currency: wallet.currency,
        period: { from, to },
        page,
        limit,
        total: statement.total,
        openingBalanceKobo: statement.openingBalanceKobo,
        periodNetChangeKobo: statement.periodNetChangeKobo,
        closingBalanceKobo: statement.closingBalanceKobo,
        transactions: statement.rows
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/wallet/statement.csv
router.get('/statement.csv', requireAuth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const from = req.query.from || '1970-01-01';
    const to = req.query.to || today;

    if (
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      !validDate(from) ||
      !validDate(to) ||
      from > to
    ) {
      return res.status(400).json({
        error: { code: 'INVALID_DATE_RANGE' }
      });
    }

    const wallet = await ensureWallet(req.user.sub);

    const statement = await fetchStatement(
      wallet, req.user.sub, from, to, 10000, 0
    );

    const header = [
      'created_at',
      'reference',
      'transaction_type',
      'amount_kobo',
      'currency',
      'status',
      'balance_change_kobo',
      'running_balance_kobo'
    ];

    const lines = [header.map(csvCell).join(',')];

    for (const row of statement.rows) {
      lines.push([
        row.created_at.toISOString(),
        row.reference,
        row.transaction_type,
        row.amount_kobo,
        row.currency,
        row.status,
        row.balance_change_kobo,
        row.running_balance_kobo
      ].map(csvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="aurex-wallet-statement.csv"'
    );

    if (statement.total > statement.rows.length) {
      res.setHeader('X-Export-Truncated', 'true');
    }

    res.send(lines.join('\r\n') + '\r\n');
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/wallet/transactions/:reference/receipt
router.get('/transactions/:reference/receipt', requireAuth, async (req, res, next) => {
  try {
    const wallet = await ensureWallet(req.user.sub);

    const result = await pool.query(
      `SELECT
         reference,
         transaction_type,
         amount_kobo::text,
         currency,
         status,
         description,
         created_at,
         updated_at
       FROM wallet_transactions
       WHERE reference = $1
         AND wallet_id = $2
         AND user_id = $3`,
      [req.params.reference, wallet.id, req.user.sub]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'The requested transaction was not found.'
        }
      });
    }

    const transaction = result.rows[0];

    res.json({
      data: {
        ...transaction,
        amountKobo: transaction.amount_kobo,
        receiptStatus: transaction.status === 'posted'
          ? 'confirmed'
          : transaction.status === 'pending'
            ? 'pending'
            : transaction.status
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/wallet/deposit-requests
// This creates a pending request only. It does not credit a wallet.
router.post('/deposit-requests', requireAuth, async (req, res, next) => {
  try {
    const parsed = z.object({
      amountKobo: z.number().int().positive().max(1000000000000)
    }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() }
      });
    }

    const idempotencyKey = req.get('Idempotency-Key');

    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Provide a unique Idempotency-Key header.'
        }
      });
    }

    const wallet = await ensureWallet(req.user.sub);

    if (wallet.status !== 'active') {
      return res.status(403).json({
        error: { code: 'WALLET_UNAVAILABLE' }
      });
    }

    const amountKobo = parsed.data.amountKobo;
    const reference = `AUX-DEP-${randomUUID()}`;

    const inserted = await pool.query(
      `INSERT INTO wallet_transactions
       (wallet_id, user_id, reference, idempotency_key,
        transaction_type, amount_kobo, currency, status, description)
       VALUES ($1, $2, $3, $4, 'deposit', $5, 'NGN', 'pending',
               'Customer deposit request')
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING reference, transaction_type, amount_kobo::text,
                 currency, status, created_at`,
      [wallet.id, req.user.sub, reference, idempotencyKey, amountKobo]
    );

    if (inserted.rowCount) {
      return res.status(201).json({
        data: inserted.rows[0],
        message: 'Deposit request created. Payment has not been confirmed.'
      });
    }

    const existing = await pool.query(
      `SELECT reference, transaction_type, amount_kobo::text,
              currency, status, created_at
       FROM wallet_transactions
       WHERE user_id = $1 AND idempotency_key = $2`,
      [req.user.sub, idempotencyKey]
    );

    if (
      !existing.rowCount ||
      existing.rows[0].transaction_type !== 'deposit' ||
      existing.rows[0].amount_kobo !== String(amountKobo)
    ) {
      return res.status(409).json({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'This idempotency key was already used for another request.'
        }
      });
    }

    return res.json({
      data: existing.rows[0],
      message: 'Existing deposit request returned.'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
