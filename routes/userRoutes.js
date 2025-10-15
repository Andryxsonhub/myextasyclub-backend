// backend/routes/userRoutes.js (VERSÃO COMPLETA E FINAL COM AWS SDK v3)

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const multer = require('multer');
const multerS3 = require('multer-s3');

// --- 1. NOVAS IMPORTAÇÕES PARA A AWS SDK v3 ---
const { S3Client } = require('@aws-sdk/client-s3');

const router = express.Router();

// --- 2. NOVA CONFIGURAÇÃO DA CONEXÃO COM A S3 (usando a v3) ---
// A sintaxe para criar o cliente é um pouco diferente na v3
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// Verificação de segurança para garantir que as variáveis de ambiente foram carregadas
if (!process.env.AWS_BUCKET_NAME) {
  console.error("\n!!! ERRO CRÍTICO !!! As variáveis da AWS S3 não foram encontradas. Verifique as configurações no Render.\n");
}

// --- 3. FUNÇÃO DE UPLOAD PARA A S3 (agora usando o novo cliente v3) ---
const createS3Storage = (folder) => multerS3({
  s3: s3Client, // Passamos o novo cliente v3 aqui
  bucket: process.env.AWS_BUCKET_NAME,
  //acl: 'public-read', // Permite que os arquivos sejam visualizados publicamente
  contentType: multerS3.AUTO_CONTENT_TYPE, // Detecta o tipo do arquivo automaticamente
  key: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${folder.slice(0, -1)}-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, `${folder}/${filename}`);
  }
});

// Funções de filtro (não mudam)
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) { cb(null, true); }
  else { cb(new Error('Formato de arquivo não suportado.'), false); }
};
const videoFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) { cb(null, true); }
    else { cb(new Error('Formato de arquivo não suportado.'), false); }
};

// Instâncias do Multer usando o novo armazenamento da S3 (não mudam)
const uploadAvatar = multer({ storage: createS3Storage('avatars'), fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
const uploadCover = multer({ storage: createS3Storage('covers'), fileFilter: imageFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadPhoto = multer({ storage: createS3Storage('photos'), fileFilter: imageFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadVideo = multer({ storage: createS3Storage('videos'), fileFilter: videoFileFilter, limits: { fileSize: 50 * 1024 * 1024 } });


// ==========================================================
// --- TODAS AS SUAS ROTAS (SEM ALTERAÇÕES, EXCETO UPLOAD) ---
// ==========================================================

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const loggedInUserId = req.user.userId;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const visitCount = await prisma.profileView.count({ where: { viewedProfileId: loggedInUserId, createdAt: { gte: thirtyDaysAgo } } });
    const user = await prisma.user.findUnique({
      where: { id: loggedInUserId },
      select: {
        id: true, email: true, name: true, bio: true, location: true, gender: true,
        profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true,
        pimentaBalance: true, interests: true, desires: true, fetishes: true
      },
    });
    if (!user) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
    let completionScore = 0;
    if (user.profilePictureUrl) completionScore += 25;
    if (user.bio) completionScore += 25;
    if (user.interests) completionScore += 25;
    if (user.location) completionScore += 25;
    const monthlyStats = { visits: visitCount, commentsReceived: 0, commentsMade: 0 };
    const profileData = { ...user, certificationLevel: completionScore, monthlyStats: monthlyStats };
    res.json(profileData);
  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

router.get('/profile/:id', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, name: true, bio: true, location: true, gender: true,
                profilePictureUrl: true, coverPhotoUrl: true, createdAt: true,
                interests: true, desires: true, fetishes: true,
            }
        });
        if (!user) { return res.status(404).json({ message: "Usuário não encontrado." }); }
        res.json(user);
    } catch (error) {
        console.error("Erro ao buscar perfil público:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

router.post('/profile/:id/view', authMiddleware, async (req, res) => {
    try {
        const viewedProfileId = parseInt(req.params.id, 10);
        const viewerId = req.user.userId;
        if (viewedProfileId === viewerId) {
            return res.status(200).json({ message: "Não é possível registrar visita no próprio perfil." });
        }
        const viewedProfile = await prisma.user.findUnique({ where: { id: viewedProfileId } });
        if (!viewedProfile) {
            return res.status(404).json({ message: "Perfil visitado não encontrado." });
        }
        await prisma.profileView.create({
            data: {
                viewedProfileId: viewedProfileId,
                viewerId: viewerId,
            }
        });
        res.status(201).json({ message: "Visita registrada com sucesso." });
    } catch (error) {
        console.error("Erro ao registrar visita:", error);
        res.status(500).json({ message: "Erro interno do servidor ao registrar visita." });
    }
});

router.get('/online', authMiddleware, async (req, res) => {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const onlineUsers = await prisma.user.findMany({
            where: {
                lastSeenAt: { gte: fifteenMinutesAgo },
                id: { not: req.user.userId }
            },
            select: {
                id: true,
                name: true,
                profilePictureUrl: true,
                gender: true,
            },
            orderBy: { lastSeenAt: 'desc' },
            take: 10,
        });
        res.json(onlineUsers);
    } catch (error) {
        console.error("Erro ao buscar usuários online:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

router.put('/profile', authMiddleware, async (req, res) => {
    try {
      const { name, bio, location, gender, interests, desires, fetishes } = req.body;
      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: { name, bio, location, gender, interests, desires, fetishes },
        select: {
          id: true, email: true, name: true, bio: true, location: true, gender: true,
          profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true,
          interests: true, desires: true, fetishes: true
        }
      });
      res.json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar o perfil:", error);
      res.status(500).json({ message: "Erro interno do servidor ao atualizar perfil." });
    }
});

router.get('/search', authMiddleware, async (req, res) => {
    try {
      const { q } = req.query;
      const whereClause = q ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { bio: { contains: q, mode: 'insensitive' } },
        ],
      } : {};
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
 
router.put('/profile/avatar', authMiddleware, uploadAvatar.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        const avatarUrl = req.file.location;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId }, 
            data: { profilePictureUrl: avatarUrl },
            select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true }
        });
        res.json(updatedUser);
    } catch (error) {
        console.error("Erro ao atualizar avatar:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar avatar." });
    }
});

router.post('/profile/cover', authMiddleware, uploadCover.single('cover'), async (req, res) => {
    try {
        if (!req.file) { return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' }); }
        const coverUrl = req.file.location;
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { coverPhotoUrl: coverUrl },
            select: { 
                id: true, email: true, name: true, bio: true, location: true, gender: true, 
                profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, 
                pimentaBalance: true, interests: true, desires: true, fetishes: true 
            }
        });
        res.json(updatedUser);
    } catch (error) {
        console.error("Erro ao atualizar foto de capa:", error);
        res.status(500).json({ message: "Erro interno do servidor ao atualizar a foto de capa." });
    }
});

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
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
    const { description } = req.body;
    const photoUrl = req.file.location;
    const newPhoto = await prisma.photo.create({ data: { url: photoUrl, description: description, authorId: req.user.userId, } });
    res.status(201).json(newPhoto);
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload da foto." });
  }
});

router.get('/videos', authMiddleware, async (req, res) => {
  try {
    const videos = await prisma.video.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Erro ao buscar os vídeos do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos." });
  }
});

router.post('/videos', authMiddleware, uploadVideo.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de vídeo enviado.' });
    const { description } = req.body;
    const videoUrl = req.file.location;
    const newVideo = await prisma.video.create({ data: { url: videoUrl, description: description, authorId: req.user.userId } });
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Erro ao fazer upload do vídeo:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload do vídeo." });
  }
});

module.exports = router;