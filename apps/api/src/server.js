const env = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');

const server = app.listen(env.port, '0.0.0.0', () =>
  console.log(`AUREX API listening on http://0.0.0.0:${env.port}`));

function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
