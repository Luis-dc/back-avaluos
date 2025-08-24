const pool = require('../config/db');
const { sendMail } = require('../utils/mailer');

exports.listarSolicitudes = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, profesion, correo, celular, dpi_numero,
             rol, estado_solicitud, dpi_archivo, diploma_archivo, cv_archivo, creado_en
      FROM usuarios ORDER BY creado_en DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('listarSolicitudes:', e.message);
    res.status(500).json({ message: 'Error listando solicitudes' });
  }
};

exports.cambiarEstadoSolicitud = async (req, res) => {
  const { id } = req.params;
  const { estado, rol } = req.body;
  if (!['aprobado','rechazado','pendiente'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido' });
  }
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (rol) {
      await pool.query('UPDATE usuarios SET estado_solicitud=$1, rol=$2 WHERE id=$3', [estado, rol, id]);
    } else {
      await pool.query('UPDATE usuarios SET estado_solicitud=$1 WHERE id=$2', [estado, id]);
    }

    if (!process.env.DISABLE_EMAIL) {
      try {
        await sendMail({
          to: rows[0].correo,
          subject: `Actualización de solicitud: ${estado}`,
          html: `<p>Hola ${rows[0].nombre},</p><p>Tu solicitud ha sido <b>${estado}</b>${rol?` con rol <b>${rol}</b>`:''}.</p>`
        });
      } catch(e){ console.warn('Aviso email estado:', e.message); }
    }

    res.json({ message: `Solicitud del usuario ${id} actualizada a "${estado}"${rol?` (rol ${rol})`:''}.` });
  } catch (e) {
    console.error('cambiarEstadoSolicitud:', e.message);
    res.status(500).json({ message: 'Error actualizando estado' });
  }
};
