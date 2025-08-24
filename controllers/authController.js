const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/mailer');

exports.register = async (req, res) => {
  try {
    const { nombre, profesion, correo, celular, dpi_numero, contrasena, rol } = req.body;
    if (!nombre || !profesion || !correo || !celular || !dpi_numero || !contrasena || !rol) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    const { rows: dup } = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (dup.length) return res.status(409).json({ message: 'El correo ya está registrado' });

    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    const { rows } = await pool.query(`
      INSERT INTO usuarios
        (nombre, profesion, correo, celular, dpi_numero, contrasena, rol, estado_solicitud)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pendiente')
      RETURNING id, nombre, correo, rol, estado_solicitud
    `, [nombre, profesion, correo, celular, dpi_numero, contrasenaHash, rol]);

    if (!process.env.DISABLE_EMAIL) {
      try {
        await sendMail({
          to: correo,
          subject: 'Solicitud recibida',
          html: `<p>Hola ${nombre},</p><p>Recibimos tu solicitud. Te avisaremos cuando sea revisada.</p>`
        });
      } catch(e) { console.warn('Aviso email register:', e.message); }
    }

    res.status(201).json({ message: 'Registro enviado. Espera aprobación.', usuario: rows[0] });
  } catch (err) {
    console.error('register:', err.message);
    res.status(500).json({ message: 'Error en registro' });
  }
};

exports.login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
    if (user.estado_solicitud !== 'aprobado') {
      return res.status(403).json({ message: 'Tu cuenta aún no está aprobada' });
    }
    const ok = await bcrypt.compare(contrasena, user.contrasena);
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '10h' });
    res.json({ message: 'Login exitoso', token,
      usuario: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol }});
  } catch (err) {
    console.error('login:', err.message);
    res.status(500).json({ message: 'Error en login' });
  }
};

exports.estadoSolicitud = async (req, res) => {
  try {
    const { correo, dpi_numero } = req.body;
    if (!correo || !dpi_numero) {
      return res.status(400).json({ message: 'correo y dpi_numero son obligatorios' });
    }
    const { rows } = await pool.query(
      `SELECT id, nombre, correo, rol, estado_solicitud
         FROM usuarios WHERE correo = $1 AND dpi_numero = $2 LIMIT 1`,
      [correo, dpi_numero]
    );
    if (!rows.length) return res.status(404).json({ message: 'No se encontró la solicitud' });
    const u = rows[0];
    res.json({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, estado_solicitud: u.estado_solicitud });
  } catch (err) {
    console.error('estadoSolicitud:', err.message);
    res.status(500).json({ message: 'Error consultando estado' });
  }
};
