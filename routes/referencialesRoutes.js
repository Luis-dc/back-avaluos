const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const referencialesController = require("../controllers/referencialesController");
const multer = require("multer");
const path = require("path");

// Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/referenciales"),
  filename: (req, file, cb) => {
    const unique = Date.now() + path.extname(file.originalname);
    cb(null, unique);
  },
});
const upload = multer({ storage });

// Rutas
router.post(
  "/documentos/:id",
  authMiddleware,
  upload.single("foto"), // 🔹 Aquí permitimos enviar la imagen
  referencialesController.crearReferencial
);

router.get(
  "/documentos/:id",
  authMiddleware,
  referencialesController.listarReferencialesPorDocumento
);

router.delete(
  "/:id",
  authMiddleware,
  referencialesController.eliminarReferencial
);

module.exports = router;
