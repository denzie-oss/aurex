const { verifyToken } = require('../utils/token');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in required.' } });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Session expired or invalid.' } });
  }
}

function requireRole(...roles) {
  return (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this action.' } });
}

module.exports = { requireAuth, requireRole };
