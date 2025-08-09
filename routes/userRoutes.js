// routes/userRoutes.js
const express = require('express');
const router = express.Router();

const { updateUserRole } = require('../controllers/userController'); // <- llaves si exportas objeto
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

// Opcional: ayuda a detectar undefined
console.log('[DEBUG userRoutes]',
  typeof updateUserRole,
  typeof authMiddleware,
  typeof roleMiddleware
);

// Cambiar rol (solo admin)
router.patch('/:id/role', authMiddleware, roleMiddleware('admin'), updateUserRole);

module.exports = router;
