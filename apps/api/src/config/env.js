require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../../.env') });

const secret = process.env.JWT_SECRET || '';
if (secret.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in the project .env file.');
}

module.exports = {
  jwtSecret: secret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  port: Number(process.env.PORT || 4000),
  providerMode: process.env.PROVIDER_MODE || 'mock',
  // Comma-separated list, e.g. "http://localhost:5173,https://app.example.com"
  webOrigins: (process.env.WEB_ORIGIN || 'http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean)
};
