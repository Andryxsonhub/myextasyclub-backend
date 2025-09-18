// routes/authRoutes.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // Biblioteca para criar o token
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
//                 ROTA DE LOGIN (POST)
// ==========================================================
// URL: /api/login
router.post('/login', async (req, res) => {
  try {
    // 1. Extrai email e senha do corpo da requisição
    const { email, password } = req.body;

    // 2. Valida se os dados foram enviados
    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    // 3. Procura o usuário no banco de dados pelo email
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    // 4. Se o usuário não for encontrado, retorna erro
    if (!user) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    // 5. Compara a senha enviada com a senha criptografada no banco
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // 6. Se a senha for inválida, retorna erro
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }

    // 7. Se tudo estiver correto, cria um Token JWT
    const token = jwt.sign(
      { userId: user.id, name: user.name }, // Informações que queremos guardar no token
      process.env.JWT_SECRET, // Segredo para assinar o token (do .env)
      { expiresIn: '1h' } // Tempo de expiração do token (ex: 1 hora)
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