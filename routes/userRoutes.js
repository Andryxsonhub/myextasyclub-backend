// routes/userRoutes.js (VERSÃO FINAL COM 'name')

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// =======================================
// ROTA PARA BUSCAR PERFIL DO USUÁRIO LOGADO
// GET /api/users/profile
// =======================================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true, // CORREÇÃO
        email: true,
        bio: true,
        profileType: true,
        location: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    res.json(user);
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =======================================
// ROTA PARA ATUALIZAR PERFIL DO USUÁRIO
// PUT /api/users/profile
// =======================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, location } = req.body; // CORREÇÃO: usa 'name'

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        bio,
        location,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);

  } catch (error) {
    console.error("Erro ao atualizar o perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar atualizar o perfil." });
  }
});

module.exports = router;