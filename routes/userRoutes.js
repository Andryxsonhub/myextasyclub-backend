// myextasyclub-backend/routes/userRoutes.js (VERSÃO COMPLETA COM VÍDEOS)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();
const router = express.Router();

// --- CONFIGURAÇÃO DO MULTER (UPLOAD DE ARQUIVOS) ---

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/avatars/'); },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/photos/'); },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `photo-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// NOVA CONFIGURAÇÃO PARA VÍDEOS
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'uploads/videos/'); },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});


const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado! Envie apenas imagens.'), false);
  }
};

// NOVO FILTRO PARA VÍDEOS
const videoFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado! Envie apenas vídeos.'), false);
    }
};

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
const uploadPhoto = multer({ storage: photoStorage, fileFilter: imageFileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
const uploadVideo = multer({ storage: videoStorage, fileFilter: videoFileFilter, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB Limite para vídeos


// ==========================================================
// --- ROTAS DE PERFIL DO USUÁRIO ---
// ==========================================================
// (As rotas de perfil continuam exatamente iguais)

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId },
      select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, },
    });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    res.json(user);
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, location, gender } = req.body;
    const updatedUser = await prisma.user.update({ where: { id: req.user.userId }, data: { name, bio, location, gender },
      select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, }
    });
    res.json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar o perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor ao atualizar perfil." });
  }
});

router.put('/profile/avatar', authMiddleware, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        const filePath = req.file.path.replace(/\\/g, "/");
        const avatarUrl = `/${filePath}`;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId }, data: { profilePictureUrl: avatarUrl },
            select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, }
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
// (As rotas de fotos continuam exatamente iguais)

router.get('/photos', authMiddleware, async (req, res) => {
    try {
      const photos = await prisma.photo.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).json(photos);
    } catch (error) {
      console.error("Erro ao buscar as fotos do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar fotos." });
    }
});

router.post('/photos', authMiddleware, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const { description } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
    const filePath = req.file.path.replace(/\\/g, "/");
    const photoUrl = `/${filePath}`;
    const newPhoto = await prisma.photo.create({ data: { url: photoUrl, description: description, authorId: req.user.userId, } });
    res.status(201).json(newPhoto);
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload da foto." });
  }
});


// ==========================================================
// --- !!! NOVAS ROTAS DE GALERIA DE VÍDEOS !!! ---
// ==========================================================

// ROTA PARA BUSCAR TODOS OS VÍDEOS DO USUÁRIO LOGADO
router.get('/videos', authMiddleware, async (req, res) => {
  try {
    const videos = await prisma.video.findMany({
      where: { authorId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Erro ao buscar os vídeos do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos." });
  }
});

// ROTA PARA FAZER UPLOAD DE UM NOVO VÍDEO
router.post('/videos', authMiddleware, uploadVideo.single('video'), async (req, res) => {
  try {
    const { description } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo de vídeo enviado.' });
    }
    const filePath = req.file.path.replace(/\\/g, "/");
    const videoUrl = `/${filePath}`;

    const newVideo = await prisma.video.create({
      data: {
        url: videoUrl,
        description: description,
        authorId: req.user.userId,
      },
    });
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Erro ao fazer upload do vídeo:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload do vídeo." });
  }
});


module.exports = router;