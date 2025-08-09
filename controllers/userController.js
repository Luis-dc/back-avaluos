const pool = require('../config/db');

// (Si estos dos los estás usando en authController, muévelos a models/userModel.js.
// Si no, puedes dejarlos aquí. Lo importante es exportar también updateUserRole.)
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
    payload.rol,                 // 'valuador' o 'tecnico' (no admin en registro normal)
    'pendiente',
    payload.dpi_archivo || null,
    payload.diploma_archivo || null,
    payload.cv_archivo || null
  ];
  const [result] = await pool.query(sql, params);
  return result.insertId;
};

exports.findByEmail = async (correo) => {
  const [rows] = await pool.query(
    'SELECT * FROM usuarios WHERE correo = ?',
    [correo]
  );
  return rows[0];
};

// ✅ FALTA: actualizar rol (handler para router.patch('/:id/role', ...))
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    if (!['valuador', 'tecnico', 'admin'].includes(rol)) {
      return res.status(400).json({ message: 'Rol inválido' });
    }

    const [result] = await pool.query(
      'UPDATE usuarios SET rol = ? WHERE id = ?',
      [rol, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: `Rol de usuario ${id} actualizado a ${rol}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
