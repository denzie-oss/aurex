const router = require('express').Router();
const { pool } = require('../config/db');
router.get('/brands', async (_req, res, next) => {
  try {
    const result = await pool.query('SELECT slug,name FROM gift_card_brands WHERE enabled=true ORDER BY name');
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});
router.get('/rates', async (_req, res) => {
  // Display-only illustrative rates. Not live quotes and not valid for trading.
  res.json({ data: [], notice: 'Live rates are not connected yet. No indicative rate is a guaranteed payout.' });
});
module.exports = router;
