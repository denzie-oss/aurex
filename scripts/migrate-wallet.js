require('dotenv').config({
  path: require('node:path').resolve(__dirname, '../.env')
});

const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from the project .env file');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../database/migrations/001_wallet_ledger.sql'),
      'utf8'
    );

    await pool.query(sql);
    console.log('AUREX wallet database migration completed successfully.');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'ledger_accounts',
          'wallets',
          'wallet_transactions',
          'ledger_entries'
        )
      ORDER BY table_name
    `);

    console.table(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('Wallet migration failed:', error.message);
  process.exitCode = 1;
});
