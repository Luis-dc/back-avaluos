// models/userModel.js
const pool = require('../config/db');

exports.createUser = async (payload) => {
  const sql = `
    INSERT INTO usuarios
    (nombre, profesion, correo, celular, dpi_numero, contrasena, rol, estado_solicitud, dpi_archivo, diploma_archivo, cv_archivo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    payload.nombre,
    payload.profesion,
    payload.correo,
    payload.celular,
    payload.dpi_numero,
    payload.contrasenaHash,
    payload.rol,                 // 'valuador' | 'tecnico' | 'admin' (modo semilla)
    'pendiente',                 // el admin luego puede aprobar
    payload.dpi_archivo || null,
    payload.diploma_archivo || null,
    payload.cv_archivo || null
  ];
  const [result] = await pool.query(sql, params);
  return result.insertId;
};

exports.findByEmail = async (correo) => {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
  return rows[0];
};
