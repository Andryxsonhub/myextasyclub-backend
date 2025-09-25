const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// URL: /api/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    // 1. Procura o usuário no banco de dados
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    // ==========================================================
    // CORREÇÃO APLICADA AQUI
    // Se o usuário NÃO for encontrado, OU se a senha for inválida,
    // retorna o mesmo erro genérico para não dar dicas a hackers.
    // ==========================================================
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    // 7. Se tudo estiver correto, cria um Token JWT
    const token = jwt.sign(
      { userId: user.id, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 8. Envia a resposta de sucesso com o token
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
