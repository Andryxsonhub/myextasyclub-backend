// myextasyclub-backend/routes/interactionRoutes.js
// --- CÓDIGO 100% CORRIGIDO (Adicionado checkAuth) ---

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
// --- CORREÇÃO APLICADA AQUI (Importação) ---
const { checkAuth } = require('../middleware/authMiddleware');

// ROTA 1: Seguir / Deixar de Seguir (Toggle)
// POST /api/interactions/:id/follow
// --- CORREÇÃO APLICADA AQUI (checkAuth) ---
router.post('/:id/follow', checkAuth, async (req, res) => {
  const followerId = req.user.userId;
  const followingId = parseInt(req.params.id, 10);
  if (isNaN(followingId) || followerId === followingId) { 
    return res.status(400).json({ message: 'Ação inválida.' }); 
  }
  try {
    const existingFollow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      res.status(200).json({ isFollowing: false });
    } else {
      await prisma.follow.create({ data: { followerId, followingId } });
      res.status(201).json({ isFollowing: true });
    }
  } catch (error) { 
    console.error("Erro ao seguir/deseguir:", error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// ROTA 2: Curtir / Descurtir Perfil (Toggle)
// POST /api/interactions/profile/:id/like
// --- CORREÇÃO APLICADA AQUI (checkAuth) ---
router.post('/profile/:id/like', checkAuth, async (req, res) => {
  const likerId = req.user.userId;
  const likedUserId = parseInt(req.params.id, 10);
  if (isNaN(likedUserId) || likerId === likedUserId) { 
    return res.status(400).json({ message: 'Ação inválida.' }); 
  }
  try {
    const existingLike = await prisma.like.findUnique({ where: { likerId_likedUserId: { likerId, likedUserId } } });
    let count;
    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      count = await prisma.like.count({ where: { likedUserId: likedUserId } }); // Recalcula
      res.status(200).json({ isLikedByMe: false, likeCount: count });
    } else {
      await prisma.like.create({ data: { likerId, likedUserId } });
      count = await prisma.like.count({ where: { likedUserId: likedUserId } }); // Recalcula
      res.status(201).json({ isLikedByMe: true, likeCount: count });
    }
  } catch (error) { 
    console.error("Erro ao curtir/descurtir perfil:", error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// -----------------------------------------------------------------
// ROTA 3: Buscar estatísticas (ATUALIZADA)
// -----------------------------------------------------------------
// GET /api/interactions/me/stats
// --- CORREÇÃO APLICADA AQUI (checkAuth) ---
router.get('/me/stats', checkAuth, async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }

  try {
    // --- Cálculo de Visitas (sem alteração) ---
    const profile = await prisma.profile.findUnique({ where: { userId: userId }, select: { id: true } });
    let visitsReceived = 0;
    if (profile) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      visitsReceived = await prisma.profileView.count({
        where: { viewedProfileId: profile.id, createdAt: { gte: thirtyDaysAgo } }
      });
    }

    // --- Cálculo de Likes Recebidos (ATUALIZADO) ---
    const profileLikesCount = await prisma.like.count({
      where: { likedUserId: userId }
    });
    const userPhotos = await prisma.photo.findMany({ where: { authorId: userId }, select: { id: true } });
    const userPhotoIds = userPhotos.map(p => p.id);
    const userVideos = await prisma.video.findMany({ where: { authorId: userId }, select: { id: true } });
    const userVideoIds = userVideos.map(v => v.id);
    const photoLikesCount = await prisma.like.count({
      where: { likedPhotoId: { in: userPhotoIds } }
    });
    const videoLikesCount = await prisma.like.count({
      where: { likedVideoId: { in: userVideoIds } }
    });
    const totalLikesReceived = profileLikesCount + photoLikesCount + videoLikesCount;
    // --- Fim do Cálculo de Likes ---

    const followersCount = await prisma.follow.count({ where: { followingId: userId } });
    const followingCount = await prisma.follow.count({ where: { followerId: userId } });

    res.status(200).json({
      visitsReceived: visitsReceived,
      commentsReceived: 0, // Placeholder
      commentsMade: 0,     // Placeholder
      likesReceived: totalLikesReceived, 
      followers: followersCount,
      following: followingCount,
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar estatísticas.' });
  }
});

// ROTA 4: Denunciar um usuário (F03)
// POST /api/interactions/:id/denounce
// --- CORREÇÃO APLICADA AQUI (checkAuth) ---
router.post('/:id/denounce', checkAuth, async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const reportedUserId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (reporterId === reportedUserId || !reason || reason.length < 10) { 
        return res.status(400).json({ message: 'Requisição inválida.' }); 
    }
    await prisma.report.create({ data: { reason, reportedUserId, reporterId } });
    res.status(201).json({ message: "Denúncia enviada com sucesso." });
  } catch (error) { 
    console.error("Erro ao criar denúncia:", error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

// ROTA 5: Bloquear / Desbloquear um usuário (F04 - Toggle)
// POST /api/interactions/:id/block
// --- CORREÇÃO APLICADA AQUI (checkAuth) ---
router.post('/:id/block', checkAuth, async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedUserId = parseInt(req.params.id, 10);
    if (blockerId === blockedUserId) { 
        return res.status(400).json({ message: 'Você não pode bloquear a si mesmo.' }); 
    }
    const existingBlock = await prisma.blockedUser.findUnique({ where: { blockerId_blockedUserId: { blockerId, blockedUserId } } });
    let isBlocked;
    if (existingBlock) {
      await prisma.blockedUser.delete({ where: { id: existingBlock.id } });
      isBlocked = false;
    } else {
      await prisma.blockedUser.create({ data: { blockerId, blockedUserId } });
      isBlocked = true;
    }
    const updatedBlockedList = await prisma.blockedUser.findMany({ where: { blockerId }, select: { blockedUserId: true } });
    res.status(200).json({ isBlocked, updatedBlockedList });
  } catch (error) { 
    console.error("Erro ao bloquear/desbloquear:", error);
    res.status(500).json({ message: 'Erro interno.' });
  }
});

module.exports = router;