const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../middlewares/upload');


// Registro con archivos (multipart/form-data)
router.post('/register', upload, authController.register);
router.post('/login', authController.login);
router.post('/estado-solicitud', authController.estadoSolicitud);

module.exports = router;
