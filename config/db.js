const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

(async () => {
    try {
      const connection = await pool.getConnection();
      console.log('Conexión a MySQL establecida correctamente');
      connection.release();
    } catch (error) {
      console.error('❌ Error al conectar a MySQL:', error.message);
    }
  })();

module.exports = pool;
