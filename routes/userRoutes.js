// routes/userRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
// 1. IMPORTANDO O PRISMA CLIENT
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient(); // Instanciando o Prisma
const router = express.Router();

// ==========================================================
//      ROTA DE REGISTRO DE NOVO USUÁRIO (USANDO PRISMA)
// ==========================================================
// URL: /api/users/register
router.post('/register', async (req, res) => {
  try {
    // 2. Extrai os dados do corpo da requisição
    // Note que `profileType` foi removido e `username` foi renomeado para `name`
    const {
      email,
      password,
      username: name, // <-- A MÁGICA ACONTECE AQUI
      interests,
      desires,
      fetishes,
      location,
      favoritedSuggestions,
    } = req.body;

    // 3. Validação dos campos essenciais
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'E-mail, senha e nome de usuário são obrigatórios.' });
    }

    // 4. Verifica se o usuário já existe usando Prisma
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { name: name }],
      },
    });

    if (existingUser) {
      return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrado.' });
    }

    // 5. Criptografa a senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 6. Insere o usuário no banco de dados usando Prisma
    // O Prisma já sabe os nomes das colunas pelo schema.prisma
    const newUser = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
        // Campos opcionais
        interests: interests || [],
        desires: desires || [],
        fetishes: fetishes || [],
        location: location || null,
        favorited_suggestions: favoritedSuggestions || [], // Prisma lida com o mapeamento
      },
    });

    // 7. Prepara o objeto de resposta (sem dados sensíveis)
    const userResponse = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    };

    console.log(`Perfil do usuário '${userResponse.name}' cadastrado com sucesso!`);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: userResponse });

  } catch (error) {
    console.error('Erro no registro do usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// ==========================================================
//          ROTA DE UPLOAD DE AVATAR (POST)
// ==========================================================
// (Sem alterações aqui por enquanto)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, req.user.userId + '-' + uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  // ... seu código de upload ...
});


// ==========================================================
//      ROTA PARA BUSCAR PERFIL DE USUÁRIO (GET)
// ==========================================================
// (Sem alterações aqui por enquanto)
router.get('/:id', async (req, res) => {
  // ... seu código de busca de perfil ...
});


module.exports = router;