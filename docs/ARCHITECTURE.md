# AUREX architecture

## Trust boundaries
- Browser/PWA: presentation only. Never holds provider secrets.
- API: authentication, validation, authorization and provider orchestration.
- PostgreSQL: authoritative user/trade metadata.
- Provider adapters: isolated external API clients.
- Webhook ingress (next milestone): verify raw-body HMAC/signature before parsing or changing transaction state.
- Ledger (future milestone): append-only, double-entry journal; no direct balance edits.

## Trade state
A provider acknowledgement is not settlement. `pending`, `processing`, `held` and `DEMO_PENDING` must never credit a withdrawable balance. Only verified provider final events plus reconciliation may transition a trade into a financially settled state.

## Production requirements not yet implemented
Refresh-token rotation, email/phone OTP, KYC/KYB, admin RBAC UI, audit log, idempotency persistence, webhook inbox/outbox, secure secret vault, encrypted short-lived card intake, double-entry ledger, reconciliation, payout partner, monitoring and backups.
