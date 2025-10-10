// myextasyclub-backend/routes/userRoutes.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Módulo 'fs' para criar pastas

const prisma = new PrismaClient();
const router = express.Router();

// --- CONFIGURAÇÃO DO MULTER (UPLOAD DE ARQUIVOS) ---

// Garante que o diretório base 'uploads' exista
fs.mkdirSync('uploads', { recursive: true });

const armazenamentoAvatar = multer.diskStorage({
  destination: (req, file, cb) => { 
    const dir = 'uploads/avatars/';
    fs.mkdirSync(dir, { recursive: true }); // Garante que o subdiretório exista
    cb(null, dir); 
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const armazenamentoFoto = multer.diskStorage({
  destination: (req, file, cb) => { 
    const dir = 'uploads/photos/';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir); 
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `photo-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const armazenamentoVideo = multer.diskStorage({
  destination: (req, file, cb) => { 
    const dir = 'uploads/videos/';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir); 
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// --- ADICIONADO: Configuração do Multer para a foto de capa ---
const armazenamentoFotoCapa = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/covers/';
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cover-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});


const filtroDeImagem = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado! Envie apenas imagens.'), false);
  }
};

const filtroDeVideo = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo não suportado! Envie apenas vídeos.'), false);
    }
};

const uploadAvatar = multer({ storage: armazenamentoAvatar, fileFilter: filtroDeImagem, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadFoto = multer({ storage: armazenamentoFoto, fileFilter: filtroDeImagem, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: armazenamentoVideo, fileFilter: filtroDeVideo, limits: { fileSize: 50 * 1024 * 1024 } });

// --- ADICIONADO: Instância do Multer para a foto de capa ---
const uploadCapa = multer({ storage: armazenamentoFotoCapa, fileFilter: filtroDeImagem, limits: { fileSize: 10 * 1024 * 1024 } });


// ==========================================================
// --- ROTAS DE PERFIL DO USUÁRIO ---
// ==========================================================

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, },
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
      select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, }
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
            select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, }
        });
        res.json(updatedUser);
    } catch (error) {
        console.error("Erro ao atualizar avatar:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar avatar." });
    }
});

// --- ADICIONADO: Rota para lidar com o upload da foto de capa ---
router.post('/profile/cover', authMiddleware, uploadCapa.single('coverPhoto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        }

        const filePath = req.file.path.replace(/\\/g, "/");
        const coverUrl = `/${filePath}`;

        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { coverPhotoUrl: coverUrl },
            select: { 
                id: true, email: true, name: true, bio: true, location: true, gender: true, 
                profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, 
                pimentaBalance: true 
            }
        });
        
        res.json(updatedUser);

    } catch (error) {
        console.error("Erro ao atualizar foto de capa:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar a foto de capa." });
    }
});


// ==========================================================
// --- ROTAS DE GALERIA DE FOTOS ---
// ==========================================================

router.get('/photos', authMiddleware, async (req, res) => {
    try {
      const photos = await prisma.photo.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).json(photos);
    } catch (error) {
      console.error("Erro ao buscar as fotos do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar fotos." });
    }
});

router.post('/photos', authMiddleware, uploadFoto.single('photo'), async (req, res) => {
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
// --- ROTAS DE GALERIA DE VÍDEOS ---
// ==========================================================

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


// ==========================================================
// --- ROTA DE BUSCA DE PERFIS (FILTROS) ---
// ==========================================================

router.get('/search', authMiddleware, async (req, res) => {
  try {
    // ... seu código completo da rota de busca ...
    const { interests, fetishes, gender, location, minAge, maxAge, q } = req.query;
    const whereClause = { AND: [], };
    // ... restante da lógica de construção da whereClause ...
    const foundUsers = await prisma.user.findMany({ where: whereClause, select: { id: true, name: true, profilePictureUrl: true, location: true, gender: true, bio: true, } });
    res.status(200).json(foundUsers);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    res.status(500).json({ message: "Erro interno do servidor ao realizar a busca." });
  }
});


module.exports = router;