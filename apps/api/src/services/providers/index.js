// Provider-independent boundary. Real provider adapters are added only after sandbox
// credentials and the exact approved API contract are available.
async function submitTrade(input) {
  const mode = process.env.PROVIDER_MODE || 'mock';
  if (mode !== 'mock') {
    throw new Error('Live provider mode is not implemented in this milestone. Keep PROVIDER_MODE=mock.');
  }
  return {
    provider: 'mock',
    providerReference: `DEMO-${input.clientReference}`,
    status: 'DEMO_PENDING',
    message: 'Demo only: no provider was contacted and no money moved.'
  };
}
module.exports = { submitTrade };
