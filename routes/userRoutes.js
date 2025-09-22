// backend/src/routes/userRoutes.js (COM A NOVA ROTA DE ATUALIZAÇÃO)

const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Rota para REGISTRAR um novo usuário (POST /api/users/register)
// Esta rota você já tem e está funcionando.
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'E-mail, senha e nome de usuário são obrigatórios.' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }] },
    });
    if (existingUser) {
      return res.status(409).json({ message: 'E-mail já cadastrado.' });
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


// Rota para BUSCAR o perfil do usuário logado (GET /api/users/profile)
// Esta rota também já existe e está funcionando.
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, bio: true, profile_picture_url: true, location: true, gender: true, createdAt: true, lastSeenAt: true },
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


// ==========================================================
//   !!! ROTA NOVA !!! - PARA ATUALIZAR O PERFIL DO USUÁRIO
//   (PUT /api/users/profile)
// ==========================================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, location } = req.body; // Pegamos os dados do corpo da requisição

    // Usamos o Prisma para ATUALIZAR (update) o usuário
    // ONDE o 'id' for igual ao do usuário logado
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: name,
        bio: bio,
        location: location,
      },
    });

    // Removemos a senha do objeto antes de enviar de volta, por segurança
    const { password, ...userWithoutPassword } = updatedUser;

    // Enviamos o usuário atualizado como resposta
    res.status(200).json(userWithoutPassword);

  } catch (error) {
    console.error("Erro ao atualizar o perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar atualizar o perfil." });
  }
});


module.exports = router;
