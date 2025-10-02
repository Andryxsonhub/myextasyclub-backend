// myextasyclub-backend/routes/userRoutes.js (VERSÃO COMPLETA E ATUALIZADA)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();
const router = express.Router();

// --- CONFIGURAÇÃO DO MULTER (UPLOAD DE ARQUIVOS) ---

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/photos/');
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
const uploadPhoto = multer({ storage: photoStorage, fileFilter: fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });


// ==========================================================
// --- ROTAS DE PERFIL DO USUÁRIO ---
// ==========================================================

// ROTA PARA BUSCAR OS DADOS DO PERFIL DO USUÁRIO LOGADO
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        location: true,
        gender: true,
        profilePictureUrl: true,
        createdAt: true,
        lastSeenAt: true,
        pimentaBalance: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    res.json(user);

  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// ROTA PARA ATUALIZAR OS DADOS TEXTUAIS DO PERFIL
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, location, gender } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: { name, bio, location, gender },
      select: {
        id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true,
      }
    });

    res.json(updatedUser);

  } catch (error) {
    console.error("Erro ao atualizar o perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor ao atualizar perfil." });
  }
});

// ROTA PARA FAZER UPLOAD E ATUALIZAR O AVATAR
router.put('/profile/avatar', authMiddleware, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        }

        const filePath = req.file.path.replace(/\\/g, "/");
        const avatarUrl = `/${filePath}`;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { profilePictureUrl: avatarUrl },
            select: {
                id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true,
            }
        });

        res.json(updatedUser);

    } catch (error) {
        console.error("Erro ao atualizar avatar:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar avatar." });
    }
});


// ==========================================================
// --- ROTAS DE GALERIA DE FOTOS ---
// ==========================================================

// !!! ROTA NOVA ADICIONADA AQUI !!!
// ROTA PARA BUSCAR TODAS AS FOTOS DO USUÁRIO LOGADO
router.get('/photos', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
  
      const photos = await prisma.photo.findMany({
        where: {
          authorId: userId,
        },
        orderBy: {
          createdAt: 'desc', // Ordena da mais nova para a mais antiga
        },
      });
  
      res.status(200).json(photos);
  
    } catch (error) {
      console.error("Erro ao buscar as fotos do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar fotos." });
    }
});

// ROTA PARA FAZER UPLOAD DE UMA NOVA FOTO
router.post('/photos', authMiddleware, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const { description } = req.body;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
    }

    const filePath = req.file.path.replace(/\\/g, "/");
    const photoUrl = `/${filePath}`;

    const newPhoto = await prisma.photo.create({
      data: {
        url: photoUrl,
        description: description,
        authorId: userId,
      },
    });

    res.status(201).json(newPhoto);

  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload da foto." });
  }
});

module.exports = router;