const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { pool } = require('./config/db');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || env.webOrigins.includes(origin) ? cb(null, true) : cb(null, false))
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

app.get('/api/v1/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'aurex-api', database: 'connected', mode: env.providerMode });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'aurex-api', database: 'unavailable' });
  }
});

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/catalog', require('./routes/catalog'));
app.use('/api/v1/trades', require('./routes/trades'));
app.use('/api/v1/wallet', require('./routes/wallet'));

app.use('/api/', (_req, res) =>
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } }));

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
});

module.exports = app;
