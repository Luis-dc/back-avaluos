const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { generarPDF } = require("../controllers/pdfAvaluoController");

router.get("/documentos/:id", authMiddleware, generarPDF);

module.exports = router;
