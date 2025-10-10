// middleware/uploadCover.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define o diretório onde as imagens de capa serão salvas
const uploadDir = 'uploads/covers';

// Garante que o diretório de upload exista
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Salva os arquivos na pasta 'uploads/covers'
  },
  filename: function (req, file, cb) {
    // Cria um nome de arquivo único para evitar conflitos
    // Ex: cover-IDdoUsuario-timestamp.jpg
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `cover-${userId}-${uniqueSuffix}${extension}`);
  }
});

const uploadCover = multer({ storage: storage });

module.exports = uploadCover;