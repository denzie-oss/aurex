const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('AUREX database schema initialized.');
})().catch(err => { console.error(err.message); process.exit(1); });
