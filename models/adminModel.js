const pool = require('../config/db');

exports.getSolicitudes = async () => {
  const [rows] = await pool.query(`
    SELECT 
      id, nombre, profesion, correo, celular, dpi_numero, rol, estado_solicitud,
      dpi_archivo, diploma_archivo, cv_archivo, creado_en
    FROM usuarios
    ORDER BY creado_en DESC
  `);
  return rows;
};

exports.updateSolicitud = async (id, estado, rol) => {
  return pool.query(
    'UPDATE usuarios SET estado_solicitud = ?, rol = ? WHERE id = ?',
    [estado, rol, id]
  );
};

exports.getUsuarioById = async (id) => {
  const [rows] = await pool.query(
    'SELECT correo, nombre FROM usuarios WHERE id = ?',
    [id]
  );
  return rows[0];
};
