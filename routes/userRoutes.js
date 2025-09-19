// Arquivo: routes/userRoutes.js (Versão Completa e Corrigida)

const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
//   ROTA DE REGISTRO
// ==========================================================
router.post('/register', async (req, res) => {
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
//   ROTA DE LOGIN
// ===============================================================
router.post('/login', async (req, res) => {
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
//   ROTA PARA BUSCAR O PERFIL DO USUÁRIO LOGADO
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
        gender: true,
        createdAt: true,
        lastSeenAt: true,
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

// =======================================================================
//   ROTA PARA ATUALIZAR O PERFIL DO USUÁRIO
// =======================================================================
router.put('/profile', authMiddleware, async (req, res) => {
    try {
      // 1. Pega o ID do usuário que vem do token (garantido pelo authMiddleware)
      const userId = req.user.userId;
  
      // 2. Pega os dados que o frontend vai enviar no corpo da requisição
      const { name, location, bio, gender } = req.body;
  
      // 3. Usa o Prisma para encontrar o usuário pelo ID e atualizar seus dados
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: name,
          location: location,
          bio: bio,
          gender: gender,
          // Se quiser permitir a edição de outros campos, adicione-os aqui
        },
      });
  
      // 4. Remove a senha do objeto antes de enviar de volta como resposta
      delete updatedUser.password;
  
      // 5. Envia a resposta de sucesso com os dados atualizados
      res.status(200).json({
        message: 'Perfil atualizado com sucesso!',
        user: updatedUser,
      });
  
    } catch (error) {
      console.error("Erro ao atualizar o perfil do usuário:", error);
      // Erro comum: P2025 - Registro para atualizar não encontrado
      if (error.code === 'P2025') {
          return res.status(404).json({ message: "Usuário não encontrado." });
      }
      res.status(500).json({ message: "Erro interno do servidor." });
    }
  });

module.exports = router;