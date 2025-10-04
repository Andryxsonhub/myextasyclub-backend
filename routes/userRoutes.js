// myextasyclub-backend/routes/userRoutes.js (VERSÃO COMPLETA E CORRIGIDA)

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

const videoFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado! Envie apenas vídeos.'), false);
    }
};

const uploadAvatar = multer({ storage: avatarStorage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadPhoto = multer({ storage: photoStorage, fileFilter: imageFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: videoStorage, fileFilter: videoFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });


// ==========================================================
// --- ROTAS DE PERFIL DO USUÁRIO ---
// ==========================================================

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
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
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId }, data: { name, bio, location, gender },
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

router.get('/photos', authMiddleware, async (req, res) => {
    try {
      // ALTERAÇÃO 1: Corrigido de 'authorId' para 'userId'
      const photos = await prisma.photo.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' } });
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
    // ALTERAÇÃO 2: Corrigido de 'authorId' para 'userId'
    const newPhoto = await prisma.photo.create({ data: { url: photoUrl, description: description, userId: req.user.userId, } });
    res.status(201).json(newPhoto);
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload da foto." });
  }
});


// ==========================================================
// --- ROTAS DE GALERIA DE VÍDEOS ---
// ==========================================================

router.get('/videos', authMiddleware, async (req, res) => {
  try {
    // ALTERAÇÃO 3: Corrigido de 'authorId' para 'userId'
    const videos = await prisma.video.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Erro ao buscar os vídeos do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos." });
  }
});

router.post('/videos', authMiddleware, uploadVideo.single('video'), async (req, res) => {
  try {
    const { description } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo de vídeo enviado.' });
    }
    const filePath = req.file.path.replace(/\\/g, "/");
    const videoUrl = `/${filePath}`;
    // ALTERAÇÃO 4: Corrigido de 'authorId' para 'userId'
    const newVideo = await prisma.video.create({
      data: {
        url: videoUrl,
        description: description,
        userId: req.user.userId,
      },
    });
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Erro ao fazer upload do vídeo:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload do vídeo." });
  }
});


// ==========================================================
// --- ROTA DE BUSCA DE PERFIS (FILTROS) - VERSÃO AVANÇADA ---
// ==========================================================

router.get('/search', authMiddleware, async (req, res) => {
  try {
    console.log("===================================");
    console.log("Filtros recebidos na API (req.query):", req.query);
    console.log("===================================");

    const { interests, fetishes, gender, location, minAge, maxAge, q } = req.query;
    
    const whereClause = {
      AND: [],
    };

    if (q && typeof q === 'string') {
      whereClause.AND.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { bio: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (location && typeof location === 'string') {
      whereClause.AND.push({ location: { contains: location, mode: 'insensitive' } });
    }

    if (gender && typeof gender === 'string') {
      const genderList = gender.split(',').map(g => g.trim());
      whereClause.AND.push({ gender: { in: genderList } });
    }

    if (minAge && maxAge && typeof minAge === 'string' && typeof maxAge === 'string') {
      const minAgeNum = parseInt(minAge, 10);
      const maxAgeNum = parseInt(maxAge, 10);
      
      if (!isNaN(minAgeNum) && !isNaN(maxAgeNum)) {
          const today = new Date();
          const maxBirthDate = new Date(today.getFullYear() - minAgeNum, today.getMonth(), today.getDate());
          const minBirthDate = new Date(today.getFullYear() - (maxAgeNum + 1), today.getMonth(), today.getDate());
      
          whereClause.AND.push({
            dateOfBirth: {
              gte: minBirthDate, 
              lte: maxBirthDate, 
            },
          });
      }
    }
    
    if (interests && typeof interests === 'string' && interests.trim() !== '') {
      const interestList = interests.split(',').map(item => item.trim());
      const interestFilters = interestList.map(item => ({ interests: { contains: item } }));
      if (interestFilters.length > 0) {
        whereClause.AND.push({ OR: interestFilters });
      }
    }

    if (fetishes && typeof fetishes === 'string' && fetishes.trim() !== '') {
      const fetishList = fetishes.split(',').map(item => item.trim());
      const fetishFilters = fetishList.map(item => ({ fetishes: { contains: item } }));
      if (fetishFilters.length > 0) {
        whereClause.AND.push({ OR: fetishFilters });
      }
    }

    console.log("Objeto 'where' final para a consulta Prisma:", JSON.stringify(whereClause, null, 2));


    const foundUsers = await prisma.user.findMany({
      where: whereClause,
      select: { 
        id: true, name: true, profilePictureUrl: true, location: true, gender: true, bio: true,
      }
    });

    res.status(200).json(foundUsers);

  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ message: "Erro interno do servidor ao realizar a busca." });
  }
});


module.exports = router;