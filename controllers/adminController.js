// controllers/adminController.js
const pool = require('../config/db');
const { sendMail } = require('../utils/mailer');

exports.listarSolicitudes = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id, nombre, profesion, correo, celular, dpi_numero, rol, estado_solicitud,
        dpi_archivo, diploma_archivo, cv_archivo, creado_en
      FROM usuarios
      ORDER BY creado_en DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar solicitudes:', error);
    res.status(500).json({ message: 'Error al listar solicitudes' });
  }
};

exports.cambiarEstadoSolicitud = async (req, res) => {
  const { id } = req.params;
  const { estado, rol } = req.body;

  if (!['aprobado', 'rechazado'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }

  try {
    // 1) Traer usuario para correo
    const [rows] = await pool.query('SELECT correo, nombre FROM usuarios WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    const usuario = rows[0];

    // 2) Actualizar estado (y rol si vino)
    if (rol) {
      if (!['tecnico', 'valuador', 'admin'].includes(rol)) {
        return res.status(400).json({ message: 'Rol inválido' });
      }
      await pool.query('UPDATE usuarios SET estado_solicitud = ?, rol = ? WHERE id = ?', [estado, rol, id]);
    } else {
      await pool.query('UPDATE usuarios SET estado_solicitud = ? WHERE id = ?', [estado, id]);
    }

    // 3) Intentar enviar correo — NO romper si falla
    try {
      await sendMail({
        to: usuario.correo,
        subject: `Estado de tu solicitud: ${estado}`,
        html: `<p>Hola ${usuario.nombre},</p>
               <p>Tu solicitud ha sido <strong>${estado}</strong>${
                 estado === 'aprobado' ? ' y ya puedes iniciar sesión.' : '.'
               }</p>`
      });
    } catch (e) {
      console.warn('Aviso: error enviando correo:', e.message);
    }

    return res.json({
      message: `Solicitud del usuario ${id} actualizada a "${estado}"${rol ? ` (rol ${rol})` : ''}.`
    });
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    return res.status(500).json({ message: 'Error al cambiar el estado' });
  }
};
