# Provider integration register

## Sogo Africa
- Documentation: https://developer.sogo.africa/
- Sandbox host: https://sandbox.sogo.africa
- Live host: https://api.sogo.africa
- Purchase API is documented as generally available to registered developers.
- Gift-card sell API is restricted to selected / pre-approved partners. Do not assume KYB alone grants sell access.
- Secret keys stay server-side. Use Idempotency-Key on financial write operations.
- Verify `X-Sogo-Signature-256` over the exact raw request body using the provider-issued webhook secret.
- Obtain current official API schemas, pricing, settlement wallet terms, refund rules and approval in writing before implementing live calls.

## NPay
- Docs: https://developer.npay.africa/docs
- Sandbox: https://sandbox.npay.africa/v1
- Live: https://api.npay.africa/v1
- Gift-card read/write scopes require KYB; gift-card access and selling eligibility are gated.
- Use sandbox keys only on sandbox host. Secret keys must never enter browser or Android code.
- All financial writes require Idempotency-Key. Respect rate limits and webhook event semantics.

## Eisy Global
- Gift card API: https://eisyglobal.com/gift-card-trading-api
- API docs: https://business.eisyglobal.com/docs
- Documented buy and sell settlement is in USD through the merchant business wallet.
- Merchant verification, gift-card scope enablement, funding and webhook setup are prerequisites.
- Do not assume direct NGN payout. Model FX conversion and local payout as separate, contracted services.

## Adapter policy
Each provider adapter must implement: getCatalog, getRates, createBuy, createSell, getTrade, verifyWebhook. Provider-specific statuses must be mapped to an internal state machine. Never retry a financial POST with a new idempotency key after an ambiguous timeout.
