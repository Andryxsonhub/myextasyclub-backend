// myextasyclub-backend/routes/userRoutes.js
// --- CÓDIGO 100% COMPLETO (Adiciona rotas /followers, /following, /likers) ---

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const router = express.Router();

// --- CONFIGURAÇÃO S3 --- (Sem alteração)
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});
// --- CONFIGURAÇÃO DO MULTER --- (Sem alteração)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// --- FUNÇÕES AUXILIARES PARA MARCA D'ÁGUA --- (Sem alteração)
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
    if (!originalImageBuffer || originalImageBuffer.length === 0) {
        throw new Error("Buffer de imagem original inválido ou vazio.");
    }
    try {
        const metadata = await sharp(originalImageBuffer).metadata();
        const imageWidth = metadata.width;
        if (!imageWidth) {
            throw new Error("Não foi possível obter a largura da imagem.");
        }
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
    } catch (sharpError) {
        console.error("Erro no Sharp ao adicionar marca d'água:", sharpError);
        throw sharpError;
    }
};
const uploadToS3 = async (file, folder, user) => {
    const userNameForWatermark = user?.name || `user-${user.userId || 'unknown'}`;
    let bufferToUpload = file.buffer;
    if (file.mimetype.startsWith('image/')) {
        try {
            bufferToUpload = await addWatermark(file.buffer, userNameForWatermark);
        } catch (watermarkError) {
            console.error(`Falha ao adicionar marca d'água no arquivo ${file.originalname}:`, watermarkError);
            throw new Error("Falha ao processar imagem para marca d'água.");
        }
    }
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `${folder}-${user?.userId || 'unknown'}-${uniqueSuffix}${path.extname(file.originalname)}`;
    const s3Key = `${folder}/${filename}`;
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: bufferToUpload,
        ContentType: file.mimetype,
    });
    await s3Client.send(command);
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    return { fileUrl, s3Key };
};
const deleteFromS3 = async (s3Key) => {
    if (!s3Key) {
        console.warn("Tentativa de deletar do S3 sem uma key.");
        return;
    }
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
        });
        await s3Client.send(deleteCommand);
        console.log(`Arquivo ${s3Key} deletado do S3.`);
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            console.warn(`Arquivo ${s3Key} não encontrado no S3 para deleção.`);
        } else {
            console.error(`Erro ao deletar ${s3Key} do S3:`, error);
        }
    }
};

// --- ROTAS DO USUÁRIO ---

// Upload de fotos (Sem alteração)
router.post('/photos', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
        const { fileUrl, s3Key } = await uploadToS3(req.file, 'photos', { userId: req.user.userId, name: req.user.name });
        const newPhoto = await prisma.photo.create({
            data: { url: fileUrl, key: s3Key, description: req.body.description, authorId: req.user.userId }
        });
        res.status(201).json(newPhoto);
    } catch (error) {
        console.error("Erro no upload da foto:", error);
        res.status(500).json({ message: "Erro interno do servidor ao fazer upload da foto." });
    }
});

// Upload/Update de Avatar (Sem alteração)
router.put('/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
     try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        const currentProfile = await prisma.profile.findUnique({ where: { userId: req.user.userId }, select: { avatarKey: true } });
        if (currentProfile?.avatarKey) { await deleteFromS3(currentProfile.avatarKey); }
        const { fileUrl, s3Key } = await uploadToS3(req.file, 'avatars', { userId: req.user.userId, name: req.user.name });
        const updatedProfile = await prisma.profile.upsert({
            where: { userId: req.user.userId },
            update: { avatarUrl: fileUrl, avatarKey: s3Key },
            create: { userId: req.user.userId, avatarUrl: fileUrl, avatarKey: s3Key },
            include: { user: { select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true } } }
        });
        const userData = { ...updatedProfile.user, profilePictureUrl: updatedProfile.avatarUrl, coverPhotoUrl: updatedProfile.coverPhotoUrl, bio: updatedProfile.bio, location: updatedProfile.location, gender: updatedProfile.gender };
        res.json(userData);
    } catch (error) {
        console.error("Erro no upload do avatar:", error);
        res.status(500).json({ message: "Erro interno do servidor ao fazer upload do avatar." });
    }
});

// Upload/Update de Capa (Sem alteração)
router.post('/profile/cover', authMiddleware, upload.single('cover'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
        const currentProfile = await prisma.profile.findUnique({ where: { userId: req.user.userId }, select: { coverPhotoKey: true } });
        if (currentProfile?.coverPhotoKey) { await deleteFromS3(currentProfile.coverPhotoKey); }
        const { fileUrl, s3Key } = await uploadToS3(req.file, 'covers', { userId: req.user.userId, name: req.user.name });
        const updatedProfile = await prisma.profile.upsert({
            where: { userId: req.user.userId },
            update: { coverPhotoUrl: fileUrl, coverPhotoKey: s3Key },
            create: { userId: req.user.userId, coverPhotoUrl: fileUrl, coverPhotoKey: s3Key },
            include: { user: { select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true } } }
        });
        const userData = { ...updatedProfile.user, profilePictureUrl: updatedProfile.avatarUrl, coverPhotoUrl: updatedProfile.coverPhotoUrl, bio: updatedProfile.bio, location: updatedProfile.location, gender: updatedProfile.gender };
        res.json(userData);
    } catch (error) {
        console.error("Erro no upload da capa:", error);
        res.status(500).json({ message: "Erro interno do servidor ao fazer upload da capa." });
    }
});

// Buscar perfil do usuário logado (Sem alteração)
router.get('/profile', authMiddleware, async (req, res) => {
    try {
      const loggedInUserId = req.user.userId;
      const userWithProfile = await prisma.user.findUnique({
        where: { id: loggedInUserId },
        select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true, profile: { select: { id: true, bio: true, avatarUrl: true, coverPhotoUrl: true, location: true, gender: true } } },
      });
      if (!userWithProfile) { return res.status(404).json({ message: 'Usuário não encontrado.' }); }
      let visitCount = 0;
      if (userWithProfile.profile?.id) {
          const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          visitCount = await prisma.profileView.count({ where: { viewedProfileId: userWithProfile.profile.id, createdAt: { gte: thirtyDaysAgo } } });
      }
      let completionScore = 0;
      if (userWithProfile.profile?.avatarUrl) completionScore += 25; if (userWithProfile.profile?.bio) completionScore += 25; if (userWithProfile.interests) completionScore += 25; if (userWithProfile.profile?.location) completionScore += 25;
      const monthlyStats = { visits: visitCount, commentsReceived: 0, commentsMade: 0 };
      const profileData = { id: userWithProfile.id, email: userWithProfile.email, name: userWithProfile.name, createdAt: userWithProfile.createdAt, lastSeenAt: userWithProfile.lastSeenAt, pimentaBalance: userWithProfile.pimentaBalance, interests: userWithProfile.interests, desires: userWithProfile.desires, fetishes: userWithProfile.fetishes, profilePictureUrl: userWithProfile.profile?.avatarUrl ?? null, coverPhotoUrl: userWithProfile.profile?.coverPhotoUrl ?? null, bio: userWithProfile.profile?.bio ?? null, location: userWithProfile.profile?.location ?? null, gender: userWithProfile.profile?.gender ?? null, certificationLevel: completionScore, monthlyStats: monthlyStats };
      res.json(profileData);
    } catch (error) {
      console.error("Erro ao buscar perfil do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar perfil." });
    }
});


// Buscar perfil público de outro usuário (GET /api/users/profile/:id) (Sem alteração nesta parte)
router.get('/profile/:id', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const loggedInUserId = req.user.userId;

        if (isNaN(userId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }

        const userWithProfile = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true, name: true, createdAt: true, interests: true, desires: true, fetishes: true,
                profile: { select: { bio: true, avatarUrl: true, coverPhotoUrl: true, location: true, gender: true } },
                _count: { select: { likesReceived: true } },
                likesReceived: { where: { likerId: loggedInUserId }, select: { id: true } }
            }
        });

        if (!userWithProfile) { return res.status(404).json({ message: "Usuário não encontrado." }); }

        const publicProfileData = {
            id: userWithProfile.id, name: userWithProfile.name, createdAt: userWithProfile.createdAt, interests: userWithProfile.interests, desires: userWithProfile.desires, fetishes: userWithProfile.fetishes,
            profilePictureUrl: userWithProfile.profile?.avatarUrl ?? null, coverPhotoUrl: userWithProfile.profile?.coverPhotoUrl ?? null, bio: userWithProfile.profile?.bio ?? null, location: userWithProfile.profile?.location ?? null, gender: userWithProfile.profile?.gender ?? null,
            likeCount: userWithProfile._count.likesReceived, isLikedByMe: userWithProfile.likesReceived.length > 0
        };
        res.json(publicProfileData);
    } catch (error) {
        console.error("Erro ao buscar perfil público:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar perfil público." });
    }
});


// Registrar visita no perfil (Sem alteração)
router.post('/profile/:id/view', authMiddleware, async (req, res) => {
     try {
        const viewedUserId = parseInt(req.params.id, 10); const viewerId = req.user.userId;
        if (viewedUserId === viewerId) { return res.status(200).json({ message: "Não é possível registrar visita no próprio perfil." }); }
        const viewedProfile = await prisma.profile.findUnique({ where: { userId: viewedUserId }, select: { id: true } });
        if (!viewedProfile) { return res.status(404).json({ message: "Perfil visitado não encontrado." }); }
        await prisma.profileView.create({ data: { viewedProfileId: viewedProfile.id, viewerId: viewerId } });
        res.status(201).json({ message: "Visita registrada com sucesso." });
    } catch (error) {
        console.error("Erro ao registrar visita:", error);
        res.status(500).json({ message: "Erro interno do servidor ao registrar visita." });
    }
});

// ROTA DE LIKE (TOGGLE) (Sem alteração)
router.post('/profile/:id/like', authMiddleware, async (req, res) => {
    try {
        const likedUserId = parseInt(req.params.id, 10); const likerId = req.user.userId;
        if (isNaN(likedUserId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }
        if (likerId === likedUserId) { return res.status(400).json({ message: "Você não pode curtir seu próprio perfil." }); }
        const existingLike = await prisma.like.findUnique({ where: { likerId_likedUserId: { likerId: likerId, likedUserId: likedUserId } } });
        if (existingLike) {
            await prisma.like.delete({ where: { id: existingLike.id } });
            console.log(`Usuário ${likerId} descurtiu usuário ${likedUserId}`);
            return res.status(200).json({ liked: false, message: 'Like removido.' });
        } else {
            await prisma.like.create({ data: { likerId: likerId, likedUserId: likedUserId } });
            console.log(`Usuário ${likerId} curtiu usuário ${likedUserId}`);
            return res.status(201).json({ liked: true, message: 'Like adicionado.' });
        }
    } catch (error) {
        if (error.code === 'P2003') { return res.status(404).json({ message: 'Usuário que você tentou curtir não foi encontrado.' }); }
        console.error("Erro ao processar like:", error);
        res.status(500).json({ message: "Erro interno do servidor ao processar o like." });
    }
});

// Buscar usuários online (Sem alteração)
router.get('/online', authMiddleware, async (req, res) => {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const onlineUsers = await prisma.user.findMany({
            where: { lastSeenAt: { gte: fifteenMinutesAgo }, id: { not: req.user.userId } },
            select: { id: true, name: true, profile: { select: { avatarUrl: true, gender: true } } },
            orderBy: { lastSeenAt: 'desc' }, take: 10,
        });
        const formattedUsers = onlineUsers.map(user => ({ id: user.id, name: user.name, gender: user.profile?.gender ?? null, profilePictureUrl: user.profile?.avatarUrl ?? null }));
        res.json(formattedUsers);
    } catch (error) {
        console.error("Erro ao buscar usuários online:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar usuários online." });
    }
});

// Atualizar perfil (Sem alteração)
router.put('/profile', authMiddleware, async (req, res) => {
    try {
      const { name, interests, desires, fetishes, bio, location, gender } = req.body; const userId = req.user.userId;
      const updatedUserWithProfile = await prisma.user.update({
        where: { id: userId },
        data: { name: name, interests: interests, desires: desires, fetishes: fetishes, profile: { upsert: { create: { bio: bio, location: location, gender: gender }, update: { bio: bio, location: location, gender: gender } } } },
        select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, pimentaBalance: true, interests: true, desires: true, fetishes: true, profile: { select: { bio: true, avatarUrl: true, coverPhotoUrl: true, location: true, gender: true } } }
      });
      const profileData = { id: updatedUserWithProfile.id, email: updatedUserWithProfile.email, name: updatedUserWithProfile.name, createdAt: updatedUserWithProfile.createdAt, lastSeenAt: updatedUserWithProfile.lastSeenAt, pimentaBalance: updatedUserWithProfile.pimentaBalance, interests: updatedUserWithProfile.interests, desires: updatedUserWithProfile.desires, fetishes: updatedUserWithProfile.fetishes, profilePictureUrl: updatedUserWithProfile.profile?.avatarUrl ?? null, coverPhotoUrl: updatedUserWithProfile.profile?.coverPhotoUrl ?? null, bio: updatedUserWithProfile.profile?.bio ?? null, location: updatedUserWithProfile.profile?.location ?? null, gender: updatedUserWithProfile.profile?.gender ?? null };
      res.json(profileData);
    } catch (error) {
      console.error("Erro ao atualizar o perfil:", error);
      res.status(500).json({ message: "Erro interno do servidor ao atualizar perfil." });
    }
});

// Rota de busca (Sem alteração)
router.get('/search', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query; let whereClause = {};
        if (q && typeof q === 'string' && q.trim()) {
            const searchTerm = q.trim(); whereClause = { OR: [ { name: { contains: searchTerm } }, { profile: { bio: { contains: searchTerm } } } ], };
        }
        const foundUsers = await prisma.user.findMany({
            where: whereClause,
            select: { id: true, name: true, profile: { select: { bio: true, avatarUrl: true, location: true, gender: true } } },
            take: 20
        });
        const formattedResults = foundUsers.map(user => ({ id: user.id, name: user.name, bio: user.profile?.bio ?? null, profilePictureUrl: user.profile?.avatarUrl ?? null, location: user.profile?.location ?? null, gender: user.profile?.gender ?? null }));
        res.status(200).json(formattedResults);
    } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        res.status(500).json({ message: "Erro interno do servidor ao realizar a busca." });
    }
});

// Buscar fotos do usuário logado (Sem alteração)
router.get('/photos', authMiddleware, async (req, res) => {
    try {
      const photos = await prisma.photo.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
      res.status(200).json(photos);
    } catch (error) {
      console.error("Erro ao buscar as fotos do usuário:", error);
      res.status(500).json({ message: "Erro interno do servidor ao buscar fotos." });
    }
});

// Buscar vídeos do usuário logado (Sem alteração)
router.get('/videos', authMiddleware, async (req, res) => {
  try {
    const videos = await prisma.video.findMany({ where: { authorId: req.user.userId }, orderBy: { createdAt: 'desc' } });
    res.status(200).json(videos);
  } catch (error) {
    console.error("Erro ao buscar os vídeos do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos." });
  }
});

// Buscar mídias de OUTROS usuários (Sem alteração)
router.get('/user/:userId/photos', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID de usuário inválido." });
        const photos = await prisma.photo.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } });
        res.status(200).json(photos);
    } catch (error) {
        console.error("Erro ao buscar fotos do usuário:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar fotos do usuário." });
    }
});
router.get('/user/:userId/videos', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID de usuário inválido." });
        const videos = await prisma.video.findMany({ where: { authorId: userId }, orderBy: { createdAt: 'desc' } });
        res.status(200).json(videos);
    } catch (error) {
        console.error("Erro ao buscar vídeos do usuário:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar vídeos do usuário." });
    }
});

// Upload de vídeo (Sem alteração)
router.post('/videos', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo de vídeo enviado.' });
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `video-${req.user.userId}-${uniqueSuffix}${path.extname(req.file.originalname)}`;
    const s3Key = `videos/${filename}`;
    const command = new PutObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key, Body: req.file.buffer, ContentType: req.file.mimetype });
    await s3Client.send(command);
    const videoUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    const newVideo = await prisma.video.create({ data: { url: videoUrl, key: s3Key, description: req.body.description, authorId: req.user.userId } });
    res.status(201).json(newVideo);
  } catch (error) {
    console.error("Erro ao fazer upload do vídeo:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar fazer upload do vídeo." });
  }
});

// Deletar foto (Sem alteração)
router.delete('/photos/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params; const photoId = parseInt(id, 10); const userId = req.user.userId;
        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) { return res.status(404).json({ message: 'Foto não encontrada.' }); }
        if (photo.authorId !== userId) { return res.status(403).json({ message: 'Acesso negado.' }); }
        await deleteFromS3(photo.key);
        await prisma.photo.delete({ where: { id: photoId } });
        res.status(200).json({ message: 'Foto apagada com sucesso.' });
    } catch (error) {
        console.error("Erro ao apagar a foto:", error);
        res.status(500).json({ message: "Erro interno do servidor ao apagar foto." });
    }
});

// ROTA DELETAR VÍDEO (Sem alteração)
router.delete('/videos/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params; const videoId = parseInt(id, 10); const userId = req.user.userId;
        if (isNaN(videoId)) { return res.status(400).json({ message: 'ID do vídeo inválido.' }); }
        const video = await prisma.video.findUnique({ where: { id: videoId } });
        if (!video) { return res.status(404).json({ message: 'Vídeo não encontrado.' }); }
        if (video.authorId !== userId) { return res.status(403).json({ message: 'Acesso negado. Você não é o dono deste vídeo.' }); }
        if (video.key) { await deleteFromS3(video.key); } else { console.warn(`Vídeo ${videoId} não possuía S3 key registrada para deleção.`); }
        await prisma.video.delete({ where: { id: videoId } });
        res.status(200).json({ message: 'Vídeo apagado com sucesso.' });
    } catch (error) {
        console.error("Erro ao apagar o vídeo:", error);
        if (error.code === 'P2025') { return res.status(404).json({ message: 'Vídeo não encontrado.' }); }
        res.status(500).json({ message: "Erro interno do servidor ao apagar vídeo." });
    }
});

// ==========================================
// NOVAS ROTAS PARA LISTAS DE ESTATÍSTICAS
// ==========================================

// GET /api/users/:id/followers (Quem segue o usuário :id)
router.get('/:id/followers', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }

        const follows = await prisma.follow.findMany({
            where: { followingId: userId }, // Onde o usuário :id é quem ESTÁ SENDO seguido
            select: {
                follower: { // Seleciona os dados de QUEM SEGUE
                    select: {
                        id: true,
                        name: true,
                        profile: { select: { avatarUrl: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Formata a resposta
        const followers = follows.map(f => ({
            id: f.follower.id,
            name: f.follower.name,
            profilePictureUrl: f.follower.profile?.avatarUrl ?? null
        }));
        res.json(followers);
    } catch (error) {
        console.error(`Erro ao buscar seguidores para usuário ${req.params.id}:`, error);
        res.status(500).json({ message: "Erro ao buscar seguidores." });
    }
});

// GET /api/users/:id/following (Quem o usuário :id segue)
router.get('/:id/following', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }

        const follows = await prisma.follow.findMany({
            where: { followerId: userId }, // Onde o usuário :id é QUEM SEGUE
            select: {
                following: { // Seleciona os dados de QUEM ESTÁ SENDO seguido
                    select: {
                        id: true,
                        name: true,
                        profile: { select: { avatarUrl: true } }
                    }
                }
            },
             orderBy: { createdAt: 'desc' }
        });

        const following = follows.map(f => ({
            id: f.following.id,
            name: f.following.name,
            profilePictureUrl: f.following.profile?.avatarUrl ?? null
        }));
        res.json(following);
    } catch (error) {
        console.error(`Erro ao buscar quem usuário ${req.params.id} segue:`, error);
        res.status(500).json({ message: "Erro ao buscar usuários seguidos." });
    }
});

// GET /api/users/:id/likers (Quem curtiu o usuário :id)
router.get('/:id/likers', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) { return res.status(400).json({ message: "ID de usuário inválido." }); }

        const likes = await prisma.like.findMany({
            where: { likedUserId: userId }, // Onde o usuário :id é QUEM FOI curtido
            select: {
                liker: { // Seleciona os dados de QUEM CURTIU
                    select: {
                        id: true,
                        name: true,
                        profile: { select: { avatarUrl: true } }
                    }
                }
            },
             orderBy: { createdAt: 'desc' }
        });

        const likers = likes.map(l => ({
            id: l.liker.id,
            name: l.liker.name,
            profilePictureUrl: l.liker.profile?.avatarUrl ?? null
        }));
        res.json(likers);
    } catch (error) {
        console.error(`Erro ao buscar quem curtiu usuário ${req.params.id}:`, error);
        res.status(500).json({ message: "Erro ao buscar curtidas." });
    }
});

// ==========================================
// FIM DAS NOVAS ROTAS
// ==========================================

module.exports = router;