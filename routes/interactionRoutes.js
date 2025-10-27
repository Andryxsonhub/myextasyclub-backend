// myextasyclub-backend/routes/interactionRoutes.js
// --- VERSÃO FINAL CORRIGIDA (Calcula Likes Recebidos Totais) ---

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// ROTA 1: Seguir / Deixar de Seguir (Toggle)
// POST /api/interactions/:id/follow
router.post('/:id/follow', async (req, res) => {
  // ... (código mantido sem alterações)
  const followerId = req.user.userId;
  const followingId = parseInt(req.params.id, 10);
  if (isNaN(followingId) || followerId === followingId) { /*...*/ }
  try {
    const existingFollow = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } } });
    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      res.status(200).json({ isFollowing: false });
    } else {
      await prisma.follow.create({ data: { followerId, followingId } });
      res.status(201).json({ isFollowing: true });
    }
  } catch (error) { /*...*/ }
});

// ROTA 2: Curtir / Descurtir Perfil (Toggle)
// POST /api/interactions/profile/:id/like
router.post('/profile/:id/like', async (req, res) => {
  // ... (código mantido sem alterações)
  const likerId = req.user.userId;
  const likedUserId = parseInt(req.params.id, 10);
  if (isNaN(likedUserId) || likerId === likedUserId) { /*...*/ }
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
  } catch (error) { /*...*/ }
});

// -----------------------------------------------------------------
// ROTA 3: Buscar estatísticas (ATUALIZADA)
// -----------------------------------------------------------------
// GET /api/interactions/me/stats
router.get('/me/stats', async (req, res) => {
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
    // 1. Likes no Perfil
    const profileLikesCount = await prisma.like.count({
      where: { likedUserId: userId }
    });

    // 2. IDs das Mídias do Usuário
    const userPhotos = await prisma.photo.findMany({ where: { authorId: userId }, select: { id: true } });
    const userPhotoIds = userPhotos.map(p => p.id);
    const userVideos = await prisma.video.findMany({ where: { authorId: userId }, select: { id: true } });
    const userVideoIds = userVideos.map(v => v.id);

    // 3. Likes nas Fotos
    const photoLikesCount = await prisma.like.count({
      where: { likedPhotoId: { in: userPhotoIds } }
    });

    // 4. Likes nos Vídeos
    const videoLikesCount = await prisma.like.count({
      where: { likedVideoId: { in: userVideoIds } }
    });

    // 5. Soma Total de Likes Recebidos
    const totalLikesReceived = profileLikesCount + photoLikesCount + videoLikesCount;
    // --- Fim do Cálculo de Likes ---

    // --- Seguidores/Seguindo (sem alteração) ---
    const followersCount = await prisma.follow.count({ where: { followingId: userId } });
    const followingCount = await prisma.follow.count({ where: { followerId: userId } });

    res.status(200).json({
      visitsReceived: visitsReceived,
      commentsReceived: 0, // Placeholder
      commentsMade: 0,     // Placeholder
      likesReceived: totalLikesReceived, // <-- VALOR ATUALIZADO
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
router.post('/:id/denounce', async (req, res) => {
  // ... (código mantido sem alterações)
  try {
    const reporterId = req.user.userId;
    const reportedUserId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (reporterId === reportedUserId || !reason || reason.length < 10) { /*...*/ }
    await prisma.report.create({ data: { reason, reportedUserId, reporterId } });
    res.status(201).json({ message: "Denúncia enviada com sucesso." });
  } catch (error) { /*...*/ }
});

// ROTA 5: Bloquear / Desbloquear um usuário (F04 - Toggle)
// POST /api/interactions/:id/block
router.post('/:id/block', async (req, res) => {
  // ... (código mantido sem alterações)
  try {
    const blockerId = req.user.userId;
    const blockedUserId = parseInt(req.params.id, 10);
    if (blockerId === blockedUserId) { /*...*/ }
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
  } catch (error) { /*...*/ }
});

module.exports = router;