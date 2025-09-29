// routes/authRoutes.js (VERSÃO FINAL)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username: name, email, password, profileType, interests, desires, fetishes, location } = req.body;

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
        profileType, // Agora o Prisma conhece este campo!
        interests,
        desires,
        fetishes,
        location,
      },
    });
    
    res.status(201).json({ message: 'Usuário criado com sucesso!', userId: newUser.id });

  } catch (error) {
    console.error('Erro no registro de usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// ... (o resto do arquivo de login continua igual)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login bem-sucedido!',
      token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

module.exports = router;