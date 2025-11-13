const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { obtenerResumen, finalizarAvaluo } = require('../controllers/avaluoResumenController');

// Obtener resumen del documento
router.get('/documentos/:id', authMiddleware, obtenerResumen);

// Marcar documento como completado (avaluado)
router.post('/documentos/:id/finalizar', authMiddleware, finalizarAvaluo);

module.exports = router;
