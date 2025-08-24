// config/db.js
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.connect()
  .then(c => c.query('SELECT NOW()').then(r => {
    console.log('Conexión a PostgreSQL OK:', r.rows[0].now);
    c.release();
  }).catch(e => { c.release(); console.error('Error verificación PostgreSQL:', e.message); }))
  .catch(e => console.error('Error conectando a PostgreSQL:', e.message));

module.exports = pool;
