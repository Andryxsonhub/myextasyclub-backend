const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const router = express.Router();

// --- CONFIGURAÇÃO S3 ---
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

// --- CONFIGURAÇÃO DO MULTER ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// --- FUNÇÕES AUXILIARES PARA MARCA D'ÁGUA INTELIGENTE ---
const createWatermarkSvg = (username, date) => {
    const svgText = `
    <svg width="400" height="100">
      <style>
      .title { fill: rgba(255, 255, 255, 0.5); font-size: 24px; font-family: Arial, sans-serif; font-weight: bold; }
      </style>
      <text x="10" y="40" class="title">${username}</text>
      <text x="10" y="70" class="title">${date}</text>
    </svg>
    `;
    return Buffer.from(svgText);
};

const addWatermark = async (originalImageBuffer, username) => {
    const formattedDate = new Date().toLocaleDateString('pt-BR');
    const metadata = await sharp(originalImageBuffer).metadata();
    const imageWidth = metadata.width;
    const watermarkSvg = createWatermarkSvg(username, formattedDate);
    const resizedWatermarkBuffer = await sharp(watermarkSvg)
        .resize({ width: Math.round(imageWidth * 0.5) })
        .toBuffer();
    return sharp(originalImageBuffer)
        .composite([{
            input: resizedWatermarkBuffer,
            gravity: 'southwest',
        }])
        .toBuffer();
};

const uploadToS3 = async (file, folder, user) => {
    const watermarkedBuffer = await addWatermark(file.buffer, user.name);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${folder}-${user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`;
    const s3Key = `${folder}/${filename}`;
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: watermarkedBuffer,
        ContentType: file.mimetype,
    });
    await s3Client.send(command);
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
};


// --- ROTAS DO USUÁRIO ---
router.post('/photos', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        const photoUrl = await uploadToS3(req.file, 'photos', req.user);
        const newPhoto = await prisma.photo.create({
            data: { url: photoUrl, description: req.body.description, authorId: req.user.userId }
        });
        res.status(201).json(newPhoto);
    } catch (error) {
        console.error("Erro no upload da foto:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

router.put('/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        const avatarUrl = await uploadToS3(req.file, 'avatars', req.user);
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { profilePictureUrl: avatarUrl },
            select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true }
        });
        res.json(updatedUser);
    } catch (error) {
        console.error("Erro no upload do avatar:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

router.post('/profile/cover', authMiddleware, upload.single('cover'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        const coverUrl = await uploadToS3(req.file, 'covers', req.user);
        const updatedUser = await prisma.user.update({
            where: { id: req.user.userId },
            data: { coverPhotoUrl: coverUrl },
            select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true }
        });
        res.json(updatedUser);
    } catch (error) {
        console.error("Erro no upload da capa:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

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
            data: { viewedProfileId: viewedProfileId, viewerId: viewerId }
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
            select: { id: true, name: true, profilePictureUrl: true, gender: true },
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
        select: { id: true, email: true, name: true, bio: true, location: true, gender: true, profilePictureUrl: true, coverPhotoUrl: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true }
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
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { bio: { contains: q, mode: 'insensitive' } }],
      } : {};
      const foundUsers = await prisma.user.findMany({
        where: whereClause,
        select: { id: true, name: true, profilePictureUrl: true, location: true, gender: true, bio: true }
      });
      res.status(200).json(foundUsers);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro interno do servidor ao realizar a busca." });
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

router.get('/videos', authMiddleware, async (req, res) => {
  try {
    const videos = await prisma.video.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Erro ao buscar os vídeos do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos." });
  }
});

// --- NOVAS ROTAS PARA BUSCAR DADOS DE OUTROS USUÁRIOS ---
router.get('/user/:userId/photos', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID de usuário inválido." });
        const photos = await prisma.photo.findMany({ 
            where: { authorId: userId }, 
            orderBy: { createdAt: 'desc' } 
        });
        res.status(200).json(photos);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar fotos do usuário." });
    }
});

router.get('/user/:userId/videos', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID de usuário inválido." });
        const videos = await prisma.video.findMany({ 
            where: { authorId: userId }, 
            orderBy: { createdAt: 'desc' } 
        });
        res.status(200).json(videos);
    } catch (error) {
        res.status(500).json({ message: "Erro ao buscar vídeos do usuário." });
    }
});

router.post('/videos', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de vídeo enviado.' });
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `video-${req.user.userId}-${uniqueSuffix}${path.extname(req.file.originalname)}`;
    const s3Key = `videos/${filename}`;
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
    });
    await s3Client.send(command);
    const videoUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    const newVideo = await prisma.video.create({ data: { url: videoUrl, description: req.body.description, authorId: req.user.userId } });
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Erro ao fazer upload do vídeo:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload do vídeo." });
  }
});

router.delete('/photos/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const photoId = parseInt(id, 10);
        const userId = req.user.userId;
        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) { return res.status(404).json({ message: 'Foto não encontrada.' }); }
        if (photo.authorId !== userId) { return res.status(403).json({ message: 'Acesso negado.' }); }
        const s3Key = new URL(photo.url).pathname.substring(1);
        const deleteCommand = new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key });
        await s3Client.send(deleteCommand);
        await prisma.photo.delete({ where: { id: photoId } });
        res.status(200).json({ message: 'Foto apagada com sucesso.' });
    } catch (error) {
        console.error("Erro ao apagar a foto:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

module.exports = router;