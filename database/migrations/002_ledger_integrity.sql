BEGIN;

-- A transaction can only be posted when its journal is balanced.
CREATE OR REPLACE FUNCTION aurex_validate_transaction_posting()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  total_debits NUMERIC;
  total_credits NUMERIC;
  entry_count BIGINT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'posted' THEN
    SELECT
      COALESCE(SUM(debit_kobo), 0),
      COALESCE(SUM(credit_kobo), 0),
      COUNT(*)
    INTO total_debits, total_credits, entry_count
    FROM ledger_entries
    WHERE transaction_id = NEW.id;

    IF entry_count = 0 OR total_debits = 0 OR total_credits = 0
       OR total_debits <> total_credits THEN
      RAISE EXCEPTION
        'Cannot post transaction %: ledger entries are missing or unbalanced',
        NEW.reference
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF OLD.status = 'pending'
     AND NEW.status NOT IN ('pending', 'posted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid wallet transaction status transition'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.status <> 'pending' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION
      'A completed wallet transaction cannot change status; create a separate reversal transaction'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_transaction_posting_guard
ON wallet_transactions;

CREATE TRIGGER wallet_transaction_posting_guard
BEFORE UPDATE OF status ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION aurex_validate_transaction_posting();


-- Posted/rejected/reversed transactions cannot be edited or deleted.
CREATE OR REPLACE FUNCTION aurex_protect_wallet_transactions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION
      'Only pending wallet transactions may be edited or deleted'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_transaction_immutability_guard
ON wallet_transactions;

CREATE TRIGGER wallet_transaction_immutability_guard
BEFORE UPDATE OR DELETE ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION aurex_protect_wallet_transactions();


-- Journal entries cannot be added, edited, or deleted after posting.
CREATE OR REPLACE FUNCTION aurex_protect_posted_ledger_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_transaction_id UUID;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    SELECT id INTO target_transaction_id
    FROM wallet_transactions
    WHERE id = OLD.transaction_id
      AND status <> 'pending';

    IF target_transaction_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Ledger entries belonging to completed transactions are immutable'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT id INTO target_transaction_id
    FROM wallet_transactions
    WHERE id = NEW.transaction_id
      AND status <> 'pending';

    IF target_transaction_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Cannot add ledger entries to a completed transaction'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posted_ledger_entry_guard
ON ledger_entries;

CREATE TRIGGER posted_ledger_entry_guard
BEFORE INSERT OR UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION aurex_protect_posted_ledger_entries();


-- Operational view for checking journal balance per transaction.
CREATE OR REPLACE VIEW wallet_ledger_reconciliation AS
SELECT
  t.id AS transaction_id,
  t.reference,
  t.status,
  COUNT(e.id) AS entry_count,
  COALESCE(SUM(e.debit_kobo), 0)::NUMERIC AS total_debits_kobo,
  COALESCE(SUM(e.credit_kobo), 0)::NUMERIC AS total_credits_kobo,
  (
    COUNT(e.id) > 0
    AND COALESCE(SUM(e.debit_kobo), 0) > 0
    AND COALESCE(SUM(e.credit_kobo), 0) > 0
    AND COALESCE(SUM(e.debit_kobo), 0)
        = COALESCE(SUM(e.credit_kobo), 0)
  ) AS is_balanced
FROM wallet_transactions t
LEFT JOIN ledger_entries e ON e.transaction_id = t.id
GROUP BY t.id, t.reference, t.status;

COMMIT;
