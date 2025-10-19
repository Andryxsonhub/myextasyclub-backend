// myextasyclub-backend/routes/interactionRoutes.js
// --- CÓDIGO CORRIGIDO (req.user.id -> req.user.userId) ---

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');

// -----------------------------------------------------------------
// ROTA 1: Seguir um usuário
// -----------------------------------------------------------------
// POST /api/interactions/:id/follow
router.post('/:id/follow', authMiddleware, async (req, res) => {
  // --- CORREÇÃO APLICADA AQUI ---
  const followerId = req.user.userId; // Usar userId (do payload do token)
  // --- FIM DA CORREÇÃO ---
  const followingId = parseInt(req.params.id, 10);

  if (isNaN(followingId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }
  if (!followerId) { // Verifica se o ID do usuário logado foi encontrado
      console.error('Erro: followerId não encontrado no req.user. Payload do token:', req.user);
      return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }
  if (followerId === followingId) {
    return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' });
  }

  try {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: followingId,
        },
      },
    });

    if (existingFollow) {
      return res.status(409).json({ error: 'Você já segue este usuário.' });
    }

    const newFollow = await prisma.follow.create({
      data: {
        followerId: followerId,
        followingId: followingId,
      },
    });
    res.status(201).json(newFollow);
  } catch (error) {
    console.error(`Erro ao seguir usuário (Follower: ${followerId}, Following: ${followingId}):`, error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

// -----------------------------------------------------------------
// ROTA 2: Deixar de seguir um usuário
// -----------------------------------------------------------------
// DELETE /api/interactions/:id/unfollow
router.delete('/:id/unfollow', authMiddleware, async (req, res) => {
  // --- CORREÇÃO APLICADA AQUI ---
  const followerId = req.user.userId;
  // --- FIM DA CORREÇÃO ---
  const followingId = parseInt(req.params.id, 10);

  if (isNaN(followingId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }
  if (!followerId) {
      return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }

  try {
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: followingId,
        },
      },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Você não segue este usuário.' });
    }
    console.error('Erro ao deixar de seguir:', error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

// -----------------------------------------------------------------
// ROTA 3: Curtir um perfil de usuário
// -----------------------------------------------------------------
// POST /api/interactions/:id/like
router.post('/:id/like', authMiddleware, async (req, res) => {
  // --- CORREÇÃO APLICADA AQUI ---
  const likerId = req.user.userId;
  // --- FIM DA CORREÇÃO ---
  const likedUserId = parseInt(req.params.id, 10);

  if (isNaN(likedUserId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }
   if (!likerId) {
      return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }
  if (likerId === likedUserId) {
    return res.status(400).json({ error: 'Você não pode curtir seu próprio perfil.' });
  }

  try {
    const existingLike = await prisma.like.findUnique({
      where: {
        likerId_likedUserId: {
          likerId: likerId,
          likedUserId: likedUserId,
        },
      },
    });

    if (existingLike) {
      return res.status(409).json({ error: 'Você já curtiu este perfil.' });
    }

    const newLike = await prisma.like.create({
      data: {
        likerId: likerId,
        likedUserId: likedUserId,
      },
    });
    res.status(201).json(newLike);
  } catch (error) {
    console.error('Erro ao curtir perfil:', error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

// -----------------------------------------------------------------
// ROTA 4: Descurtir um perfil de usuário
// -----------------------------------------------------------------
// DELETE /api/interactions/:id/unlike
router.delete('/:id/unlike', authMiddleware, async (req, res) => {
  // --- CORREÇÃO APLICADA AQUI ---
  const likerId = req.user.userId;
  // --- FIM DA CORREÇÃO ---
  const likedUserId = parseInt(req.params.id, 10);

   if (isNaN(likedUserId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
  }
   if (!likerId) {
      return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }

  try {
    await prisma.like.delete({
      where: {
        likerId_likedUserId: {
          likerId: likerId,
          likedUserId: likedUserId,
        },
      },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Você não curtiu este perfil.' });
    }
    console.error('Erro ao descurtir perfil:', error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

// -----------------------------------------------------------------
// ROTA 5: Buscar estatísticas do usuário logado
// -----------------------------------------------------------------
// GET /api/interactions/me/stats
router.get('/me/stats', authMiddleware, async (req, res) => {
  // --- CORREÇÃO APLICADA AQUI ---
  const userId = req.user.userId;
  // --- FIM DA CORREÇÃO ---

   if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }

  try {
    const profile = await prisma.profile.findUnique({ where: { userId: userId }, select: { id: true } });
    let visitsReceived = 0;

    if (profile) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        visitsReceived = await prisma.profileView.count({
            where: { viewedProfileId: profile.id, createdAt: { gte: thirtyDaysAgo } }
        });
    }

    const likesReceivedCount = await prisma.like.count({ where: { likedUserId: userId } });
    const followersCount = await prisma.follow.count({ where: { followingId: userId } });
    const followingCount = await prisma.follow.count({ where: { followerId: userId } });

    const commentsReceived = 0; // Placeholder
    const commentsMade = 0; // Placeholder

    res.status(200).json({
      visitsReceived: visitsReceived,
      commentsReceived: commentsReceived,
      commentsMade: commentsMade,
      likesReceived: likesReceivedCount,
      followers: followersCount,
      following: followingCount,
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar estatísticas.' });
  }
});

module.exports = router;