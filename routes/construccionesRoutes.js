const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const construccionesController = require('../controllers/construccionesController');

// Crear construcción
router.post(
  '/documentos/:id',
  authMiddleware,
  construccionesController.crearConstruccion
);

// Listar construcciones por documento
router.get(
  '/documentos/:id',
  authMiddleware,
  construccionesController.listarConstruccionesPorDocumento
);

// Eliminar construcción
router.delete(
  '/:id',
  authMiddleware,
  construccionesController.eliminarConstruccion
);

module.exports = router;
