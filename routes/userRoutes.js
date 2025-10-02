// backend/routes/userRoutes.js (com a nova rota de upload de fotos)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
// CONFIGURAÇÃO 1: Multer para a FOTO DE PERFIL (AVATAR)
// ==========================================================
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/'); // Salva na pasta de avatares
  },
  filename: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// ==========================================================
// ALTERAÇÃO 1: NOVA CONFIGURAÇÃO para as FOTOS DA GALERIA
// ==========================================================
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/photos/'); // Salva na nova pasta de fotos
  },
  filename: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `photo-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado! Envie apenas imagens.'), false);
  }
};

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
// ALTERAÇÃO 2: Criamos um novo "uploader" para as fotos da galeria
const uploadPhoto = multer({ storage: photoStorage, fileFilter: fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // Limite maior para fotos da galeria

// --- ROTAS EXISTENTES (PERFIL) ---
router.get('/profile', authMiddleware, async (req, res) => { /* ...código da rota... */ });
router.put('/profile', authMiddleware, async (req, res) => { /* ...código da rota... */ });
// Usamos o 'uploadAvatar' aqui
router.put('/profile/avatar', authMiddleware, uploadAvatar.single('avatar'), async (req, res) => { /* ...código da rota... */ });


// ==========================================================
// ALTERAÇÃO 3: NOVA ROTA PARA UPLOAD DE FOTOS DA GALERIA
// ==========================================================
router.post('/photos', authMiddleware, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.userId;

    // Verifica se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
    }

    // Pega o caminho do arquivo salvo e formata para URL
    const filePath = req.file.path.replace(/\\/g, "/");
    const photoUrl = `/${filePath}`;

    // Cria o registro da nova foto no banco de dados, ligando ao usuário
    const newPhoto = await prisma.photo.create({
      data: {
        url: photoUrl,
        description: description,
        authorId: userId,
      },
    });

    // Retorna a foto recém-criada como confirmação
    res.status(201).json(newPhoto);

  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload da foto." });
  }
});

module.exports = router;