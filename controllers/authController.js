// controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const pool = require('../config/db');           // para actualizar estado en modo semilla
const { sendMail } = require('../utils/mailer'); // para notificaciones por correo



/**
 * POST /api/auth/register
 * - Flujo normal: campos + documentos (multer) -> estado 'pendiente' + correo "Solicitud recibida"
 * - Modo semilla admin (opcional): si envías rol=admin y header x-seed-secret == SEED_SECRET,
 *   crea admin aprobado sin documentos (útil una sola vez).
 */
exports.register = async (req, res) => {
  try {
    const {
      nombre,
      profesion,
      correo,
      celular,
      dpi_numero,
      contrasena,
      rol // 'valuador' | 'tecnico' | 'admin' (admin sólo en modo semilla)
    } = req.body || {};

    // Validaciones básicas
    if (!nombre || !profesion || !correo || !celular || !dpi_numero || !contrasena) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }

    // Evitar duplicados
    const existing = await userModel.findByEmail(correo);
    if (existing) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    // Hash de contraseña
    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    // ============================
    //  MODO SEMILLA ADMIN (opcional/temporal)
    // ============================
    const seedSecret = req.headers['x-seed-secret'];
    if (rol === 'admin' && seedSecret && seedSecret === process.env.SEED_SECRET) {
      const userId = await userModel.createUser({
        nombre,
        profesion,
        correo,
        celular,
        dpi_numero,
        contrasenaHash,
        rol: 'admin',
        dpi_archivo: null,
        diploma_archivo: null,
        cv_archivo: null
      });

      // forzar aprobado para que pueda iniciar sesión
      await pool.query('UPDATE usuarios SET estado_solicitud = "aprobado" WHERE id = ?', [userId]);

      return res.status(201).json({
        message: 'Administrador creado y aprobado correctamente (modo semilla).',
        userId
      });
    }
    // ============================
    //  FIN MODO SEMILLA ADMIN
    // ============================

    // Flujo normal: documentos (multer) + estado 'pendiente'
    const files = req.files || {};
    const dpi_archivo = files?.dpi?.[0]?.filename || null;
    const diploma_archivo = files?.diploma?.[0]?.filename || null;
    const cv_archivo = files?.cv?.[0]?.filename || null;

    // Sólo se permite 'valuador' | 'tecnico' en registro normal
    const rolLimpio = ['valuador', 'tecnico'].includes(rol) ? rol : 'tecnico';

    const userId = await userModel.createUser({
      nombre,
      profesion,
      correo,
      celular,
      dpi_numero,
      contrasenaHash,
      rol: rolLimpio,
      dpi_archivo,
      diploma_archivo,
      cv_archivo
    });

    // Correo: Solicitud recibida (no romper si falla SMTP)
    try {
      await sendMail({
        to: correo,
        subject: 'Solicitud recibida',
        html: `<p>Hola ${nombre},</p>
               <p>Hemos recibido tu solicitud de registro. Nuestro equipo la revisará y te notificaremos por este medio cuando sea <b>aprobada</b> o <b>rechazada</b>.</p>
               <p>Saludos,</p>`
      });
    } catch (e) {
      console.warn('Aviso: no se pudo enviar el correo de "Solicitud recibida":', e.message);
    }

    return res.status(201).json({
      message: 'Solicitud creada correctamente. Queda en estado PENDIENTE hasta revisión del administrador.',
      userId
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/auth/login
 * - Requiere correo y contrasena.
 * - Sólo si estado_solicitud = 'aprobado'.
 * - Devuelve token JWT y datos del usuario.
 */
exports.login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body || {};

    if (!correo || !contrasena) {
      return res.status(400).json({ message: 'Correo y contraseña son obligatorios' });
    }

    const user = await userModel.findByEmail(correo);
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const ok = await bcrypt.compare(contrasena, user.contrasena);
    if (!ok) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (user.estado_solicitud !== 'aprobado') {
      return res.status(403).json({
        message: `Tu solicitud está en estado "${user.estado_solicitud}". Debe estar APROBADA para iniciar sesión.`
      });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      message: 'Login exitoso',
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * POST /api/auth/estado-solicitud
 * - Consulta pública de estado por correo + dpi_numero (antes de poder iniciar sesión).
 */
exports.estadoSolicitud = async (req, res) => {
  try {
    const { correo, dpi_numero } = req.body || {};
    if (!correo || !dpi_numero) {
      return res.status(400).json({ message: 'correo y dpi_numero son obligatorios' });
    }

    const user = await userModel.findByEmail(correo);
    if (!user || user.dpi_numero !== dpi_numero) {
      return res.status(404).json({ message: 'No se encontró una solicitud con esos datos' });
    }

    return res.json({
      estado_solicitud: user.estado_solicitud,
      rol: user.rol
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
