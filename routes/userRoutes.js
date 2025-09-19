// routes/userRoutes.js (Versão Final com mais dados no Profile)

const express = require('express');
// ... (todos os outros imports continuam iguais)
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
//   ROTA DE REGISTRO (CORRIGIDA E COMPLETA)
// ==========================================================
router.post('/register', async (req, res) => {
    // ... (código de registro continua o mesmo, sem alterações)
    try {
        const { email, password, username: name, interests, desires, fetishes, location, favoritedSuggestions } = req.body;
        if (!email || !password || !name) {
          return res.status(400).json({ message: 'E-mail, senha e nome de usuário são obrigatórios.' });
        }
        const existingUser = await prisma.user.findFirst({ where: { OR: [{ email: email }, { name: name }] } });
        if (existingUser) {
          return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrado.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = await prisma.user.create({
          data: {
            name: name,
            email: email,
            password: hashedPassword,
            location: location || null,
            interests: interests && interests.length > 0 ? interests.join(',') : null,
            desires: desires && desires.length > 0 ? desires.join(',') : null,
            fetishes: fetishes && fetishes.length > 0 ? fetishes.join(',') : null,
            favorited_suggestions: favoritedSuggestions && favoritedSuggestions.length > 0 ? favoritedSuggestions.join(',') : null,
          },
        });
        const userResponse = { id: newUser.id, name: newUser.name, email: newUser.email };
        console.log(`Perfil do usuário '${userResponse.name}' cadastrado com sucesso!`);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: userResponse });
      } catch (error) {
        console.error('Erro no registro do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
      }
});

// ===============================================================
//                      ROTA DE LOGIN
// ===============================================================
router.post('/login', async (req, res) => {
    // ... (código de login continua o mesmo, sem alterações)
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }
    try {
      const user = await prisma.user.findUnique({ where: { email: email } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
      }
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.status(200).json({ token: token });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// =======================================================================
//            ROTA DO PERFIL (ATUALIZADA PARA ENVIAR MAIS DADOS)
// =======================================================================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userFromDb = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        profile_picture_url: true,
        location: true,
        // --- CAMPOS NOVOS ADICIONADOS À RESPOSTA ---
        gender: true,
        createdAt: true, // Para calcular "Membro há..."
        lastSeenAt: true, // Para "Último acesso"
      }
    });

    if (!userFromDb) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    
    const userProfile = {
      ...userFromDb,
      profilePictureUrl: userFromDb.profile_picture_url
    };

    res.status(200).json(userProfile);

  } catch (error) {
    console.error("Erro ao buscar perfil do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

// ... (O restante das suas rotas continua o mesmo) ...

module.exports = router;