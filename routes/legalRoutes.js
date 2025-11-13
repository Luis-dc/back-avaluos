const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const ensureRole = require('../middlewares/ensureRole');
const legalController = require('../controllers/legalController');
const upload = require('../middlewares/uploadLegal');
const uploadLegal = require('../middlewares/uploadLegal');
const terrenoCtrl = require('../controllers/documentoTerrenoController');
const authMiddleware = require('../middlewares/authMiddleware');

//genere avaluo pdf
router.get('/avaluados', authMiddleware, legalController.listarAvaluados);

// Documentos
router.post('/', auth, ensureRole('valuador'), legalController.crearDocumento);
router.get('/', auth, ensureRole('valuador'), legalController.listarDocumentos);
router.get('/:id', auth, ensureRole('valuador'), legalController.obtenerDocumento);
router.patch('/:id', auth, ensureRole('valuador'), legalController.actualizarDocumento);
router.delete('/:id', auth, ensureRole('valuador'), legalController.anularDocumento);

// Archivos
router.post('/:id/archivos', auth, ensureRole('valuador'), uploadLegal, legalController.subirArchivo);
router.get('/:id/archivos', auth, ensureRole('valuador'), legalController.listarArchivos);
router.delete('/archivos/:id', auth, ensureRole('valuador'), legalController.eliminarArchivo);

// Calcular area
router.post('/:id/calcular-area', auth, ensureRole('valuador'), legalController.calcularArea);


// Terreno / Factores
router.put('/:idDocumento/documento-terreno', auth, ensureRole('valuador'), terrenoCtrl.upsert);
router.get('/:idDocumento/documento-terreno', auth, ensureRole('valuador'), terrenoCtrl.getOne);



module.exports = router;
