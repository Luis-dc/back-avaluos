const multer = require('multer');
const path = require('path');
const fs = require('fs');

const LEGAL_DIR = path.join(__dirname, '..', 'uploads', 'legal');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(LEGAL_DIR, { recursive: true }); 
    cb(null, LEGAL_DIR);
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${ts}-${safeName}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['application/pdf','image/jpeg','image/png'];
  cb(allowed.includes(file.mimetype) ? null : new Error('Tipo no permitido'), allowed.includes(file.mimetype));
};

module.exports = multer({ storage, fileFilter }).single('file');