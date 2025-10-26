// myextasyclub-backend/routes/interactionRoutes.js
// --- VERSÃO FINAL COMPLETA (Com Toggles e Denúncia/Bloqueio) ---

const express = require('express');
const router = express.Router();
// NOTA: Importando 'prisma' do seu arquivo 'lib' como no 'server.js'
const prisma = require('../lib/prisma'); 
// O authMiddleware é aplicado pelo server.js, não precisamos importá-lo aqui
// const authMiddleware = require('../middleware/authMiddleware');

// -----------------------------------------------------------------
// ROTA 1: Seguir / Deixar de Seguir (Toggle)
// -----------------------------------------------------------------
// POST /api/interactions/:id/follow
router.post('/:id/follow', async (req, res) => {
  const followerId = req.user.userId;
  const followingId = parseInt(req.params.id, 10);

  if (isNaN(followingId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
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
      // --- JÁ SEGUE: Deixa de seguir (DELETE) ---
      await prisma.follow.delete({
        where: { id: existingFollow.id },
      });
      res.status(200).json({ isFollowing: false }); // Feedback para o frontend
    } else {
      // --- NÃO SEGUE: Começa a seguir (CREATE) ---
      await prisma.follow.create({
        data: {
          followerId: followerId,
          followingId: followingId,
        },
      });
      res.status(201).json({ isFollowing: true }); // Feedback para o frontend
    }
  } catch (error) {
    console.error(`Erro no toggle de seguir (Follower: ${followerId}, Following: ${followingId}):`, error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});

// -----------------------------------------------------------------
// ROTA 2: Curtir / Descurtir Perfil (Toggle)
// -----------------------------------------------------------------
// POST /api/interactions/profile/:id/like
router.post('/profile/:id/like', async (req, res) => {
  const likerId = req.user.userId;
  const likedUserId = parseInt(req.params.id, 10);

  if (isNaN(likedUserId)) {
    return res.status(400).json({ error: 'ID de usuário inválido.' });
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

    let newLikeCount;

    if (existingLike) {
      // --- JÁ CURTIU: Descurte (DELETE) ---
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      
      // Recalcula a contagem
      const count = await prisma.like.count({ where: { likedUserId: likedUserId } });
      res.status(200).json({ isLikedByMe: false, likeCount: count });
      
    } else {
      // --- NÃO CURTIU: Curte (CREATE) ---
      await prisma.like.create({
        data: {
          likerId: likerId,
          likedUserId: likedUserId,
        },
      });

      // Recalcula a contagem
      const count = await prisma.like.count({ where: { likedUserId: likedUserId } });
      res.status(201).json({ isLikedByMe: true, likeCount: count });
    }
  } catch (error) {
    console.error('Erro no toggle de curtir perfil:', error);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});


// -----------------------------------------------------------------
// ROTA 3: Buscar estatísticas (Sem alteração)
// -----------------------------------------------------------------
// GET /api/interactions/me/stats
router.get('/me/stats', async (req, res) => {
  const userId = req.user.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado corretamente.' });
  }
  // ... (Sua lógica de estatísticas existente)
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

    res.status(200).json({
      visitsReceived: visitsReceived,
      commentsReceived: 0, // Placeholder
      commentsMade: 0, // Placeholder
      likesReceived: likesReceivedCount,
      followers: followersCount,
      following: followingCount,
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno ao buscar estatísticas.' });
  }
});

// =================================================================
// NOVAS ROTAS (F03 E F04)
// =================================================================

// -----------------------------------------------------------------
// ROTA 4: Denunciar um usuário (F03)
// -----------------------------------------------------------------
// POST /api/interactions/:id/denounce
router.post('/:id/denounce', async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const reportedUserId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (reporterId === reportedUserId) {
      return res.status(400).json({ message: "Você não pode denunciar a si mesmo." });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({ message: "O motivo da denúncia deve ter pelo menos 10 caracteres." });
    }

    await prisma.report.create({
      data: {
        reason: reason,
        reportedUserId: reportedUserId,
        reporterId: reporterId,
      },
    });

    res.status(201).json({ message: "Denúncia enviada com sucesso." });
  } catch (error) {
    console.error("Erro ao denunciar usuário:", error);
    res.status(500).json({ message: "Erro interno ao processar denúncia." });
  }
});

// -----------------------------------------------------------------
// ROTA 5: Bloquear / Desbloquear um usuário (F04 - Toggle)
// -----------------------------------------------------------------
// POST /api/interactions/:id/block
router.post('/:id/block', async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedUserId = parseInt(req.params.id, 10);

    if (blockerId === blockedUserId) {
      return res.status(400).json({ message: "Você não pode bloquear a si mesmo." });
    }

    const existingBlock = await prisma.blockedUser.findUnique({
      where: {
        blockerId_blockedUserId: {
          blockerId: blockerId,
          blockedUserId: blockedUserId,
        },
      },
    });

    let isBlocked;

    if (existingBlock) {
      // --- JÁ BLOQUEADO: Desbloqueia (DELETE) ---
      await prisma.blockedUser.delete({
        where: { id: existingBlock.id },
      });
      isBlocked = false;
    } else {
      // --- NÃO BLOQUEADO: Bloqueia (CREATE) ---
      await prisma.blockedUser.create({
        data: {
          blockerId: blockerId,
          blockedUserId: blockedUserId,
        },
      });
      isBlocked = true;
    }
    
    // Resposta esperada pelo ProfileHeader.tsx
    const updatedBlockedList = await prisma.blockedUser.findMany({
      where: { blockerId: blockerId },
      select: { blockedUserId: true }, 
    });

    res.status(200).json({
      isBlocked: isBlocked,
      updatedBlockedList: updatedBlockedList,
    });

  } catch (error) {
    console.error("Erro ao bloquear/desbloquear usuário:", error);
    res.status(500).json({ message: "Erro interno ao processar bloqueio." });
  }
});


module.exports = router;