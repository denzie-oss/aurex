const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { signToken } = require('../utils/token');
const { z } = require('zod');
const { pool } = require('../config/db');

// Brute-force protection: 10 attempts / 15 min per IP on sign-in and sign-up.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try again in a few minutes.' } }
});
// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('aurex-timing-equaliser', 12);

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80)
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const { email, password, displayName } = parsed.data;
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name,role,created_at',
      [email.toLowerCase(), hash, displayName]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ data: { user, token } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' } });
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR' } });
    const result = await pool.query('SELECT id,email,password_hash,display_name,role,status FROM users WHERE email=$1', [parsed.data.email.toLowerCase()]);
    const user = result.rows[0];
    const ok = await bcrypt.compare(parsed.data.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok || user.status !== 'active') {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    }
    const token = signToken(user);
    delete user.password_hash;
    res.json({ data: { user, token } });
  } catch (err) { next(err); }
});
module.exports = router;
