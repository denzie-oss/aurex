const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALG = 'HS256';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { algorithm: ALG, expiresIn: env.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALG] });
}

module.exports = { signToken, verifyToken };
