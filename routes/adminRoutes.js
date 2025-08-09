// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

console.log('[DEBUG adminRoutes]',
  'listarSolicitudes:', typeof adminController.listarSolicitudes,
  'cambiarEstadoSolicitud:', typeof adminController.cambiarEstadoSolicitud,
  'authMiddleware:', typeof authMiddleware,
  'roleMiddleware:', typeof roleMiddleware
);

// Proteger todas las rutas
router.use(authMiddleware, roleMiddleware('admin'));

// Estas líneas truenan si los handlers no son funciones:
router.get('/solicitudes', adminController.listarSolicitudes);
router.patch('/solicitudes/:id/estado', adminController.cambiarEstadoSolicitud);

module.exports = router;
