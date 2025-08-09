const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safeOriginal = file.originalname.replace(/\s+/g, '_');
    cb(null, `${ts}_${safeOriginal}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Permitimos PDF/JPG/PNG (ajusta si necesitas más)
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido (usa PDF/JPG/PNG)'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Campos esperados: dpi, diploma, cv (máx 1 cada uno)
module.exports = upload.fields([
  { name: 'dpi', maxCount: 1 },
  { name: 'diploma', maxCount: 1 },
  { name: 'cv', maxCount: 1 }
]);
