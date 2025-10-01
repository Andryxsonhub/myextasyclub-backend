// backend/routes/userRoutes.js (VERSÃO CORRIGIDA)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const prisma = new PrismaClient();
const router = express.Router();

// Configuração do Multer (upload de arquivos)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/avatars/');
  },
  filename: function (req, file, cb) {
    const userId = req.user.userId;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato de arquivo não suportado! Envie apenas imagens.'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// =======================================
// ROTA PARA BUSCAR PERFIL DO USUÁRIO LOGADO (CORRIGIDA)
// =======================================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      // REMOVEMOS O BLOCO 'select' DAQUI.
      // Agora ele busca TODOS os campos do usuário, incluindo a profilePictureUrl.
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// =======================================
// ROTA PARA ATUALIZAR DADOS DE TEXTO DO PERFIL
// =======================================
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, bio, location } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name, bio, location },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);

  } catch (error) {
    console.error("Erro ao atualizar o perfil:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar atualizar o perfil." });
  }
});

// =======================================
// ROTA PARA ATUALIZAR A FOTO DE PERFIL
// =======================================
router.put('/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo de imagem enviado.' });
    }

    // Garante que o caminho use barras normais '/'
    const filePath = req.file.path.replace(/\\/g, "/"); 
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        // Adiciona a barra inicial para formar a URL correta
        profilePictureUrl: `/${filePath}` 
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    res.status(200).json(userWithoutPassword);

  } catch (error) {
    console.error("Erro ao atualizar avatar:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar atualizar a foto de perfil." });
  }
});

module.exports = router;