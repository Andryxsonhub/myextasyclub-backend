// backend/src/routes/userRoutes.js

const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();


// =======================================
// ROTA DE REGISTRO DE NOVO USUÁRIO
// POST /api/users/register
// =======================================

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'E-mail, senha e nome de usuário são obrigatórios.' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { name }] },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrados.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: 'Usuário criado com sucesso!', userId: newUser.id });

  } catch (error) {
    console.error('Erro no registro de usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


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
        name: true,
        email: true,
        bio: true,
        profile_picture_url: true,
        location: true,
        gender: true,
        createdAt: true,
        lastSeenAt: true,
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
// NOVA ROTA: ATUALIZAR PERFIL DO USUÁRIO
// PUT /api/users/profile
// =======================================

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, location } = req.body;

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
