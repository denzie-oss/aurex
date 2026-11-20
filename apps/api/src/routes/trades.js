const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { submitTrade } = require('../services/providers');

const tradeSchema = z.object({
  direction: z.enum(['buy','sell']),
  brandSlug: z.string().min(2).max(60),
  cardCountry: z.string().length(2).optional(),
  cardType: z.enum(['ecode','physical','digital_receipt']).optional(),
  cardCurrency: z.string().length(3),
  cardAmount: z.number().positive().max(1000000)
});

router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const parsed = tradeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const input = parsed.data;
    const brand = await client.query('SELECT slug FROM gift_card_brands WHERE slug=$1 AND enabled=true', [input.brandSlug]);
    if (!brand.rowCount) return res.status(400).json({ error: { code: 'UNSUPPORTED_BRAND' } });
    const clientReference = randomUUID();
    const providerResult = await submitTrade({ ...input, clientReference });
    const saved = await client.query(
      `INSERT INTO trades(user_id,client_reference,provider,provider_reference,direction,brand_slug,card_country,card_type,card_currency,card_amount,payout_currency,status,status_detail)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'NGN',$11,$12)
       RETURNING id,client_reference,provider,direction,brand_slug,card_currency,card_amount,payout_currency,status,status_detail,created_at`,
      [req.user.sub, clientReference, providerResult.provider, providerResult.providerReference, input.direction,
       input.brandSlug, input.cardCountry || null, input.cardType || null, input.cardCurrency.toUpperCase(),
       input.cardAmount, providerResult.status, providerResult.message]
    );
    res.status(201).json({ data: saved.rows[0] });
  } catch (err) { next(err); }
  finally { client.release(); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id,client_reference,direction,brand_slug,card_currency,card_amount,payout_currency,status,status_detail,created_at
       FROM trades WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.user.sub]
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});
module.exports = router;
