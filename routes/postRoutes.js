// Arquivo: routes/postRoutes.js (COM A NOVA ROTA DE BUSCA)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// ==========================================================
//   ROTA PARA CRIAR UMA NOVA PUBLICAÇÃO (POST)
//   (POST /api/posts) - JÁ EXISTENTE
// ==========================================================
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const authorId = req.user.userId;

    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'O conteúdo da publicação não pode estar vazio.' });
    }

    const newPost = await prisma.post.create({
      data: {
        content: content,
        authorId: authorId,
      },
    });

    res.status(201).json(newPost);

  } catch (error) {
    console.error("Erro ao criar a publicação:", error);
    res.status(500).json({ message: "Erro interno do servidor ao tentar criar a publicação." });
  }
});

// ==========================================================
//   !!! ROTA NOVA !!! - PARA BUSCAR AS PUBLICAÇÕES
//   (GET /api/posts)
// ==========================================================
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Pegamos o ID do usuário logado, que o authMiddleware nos fornece
    const userId = req.user.userId;

    // Usamos o Prisma para buscar no banco TODOS os posts
    // ONDE o 'authorId' é igual ao ID do nosso usuário
    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
      },
      orderBy: {
        createdAt: 'desc', // Ordenamos do mais novo para o mais antigo
      },
      // Opcional: Se quiséssemos incluir dados do autor em cada post
      // include: {
      //   author: {
      //     select: { name: true, profile_picture_url: true }
      //   }
      // }
    });

    // Enviamos a lista de posts encontrados como resposta
    res.status(200).json(posts);

  } catch (error) {
    console.error("Erro ao buscar publicações:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});


module.exports = router;