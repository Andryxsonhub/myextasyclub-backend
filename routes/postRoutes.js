const express = require('express');
const prisma = require('../lib/prisma'); // IMPORTA a instância única
const authMiddleware = require('../middleware/authMiddleware');

// As linhas 'PrismaClient' e 'new PrismaClient()' foram REMOVIDAS daqui
const router = express.Router();

// ROTA PARA CRIAR UMA NOVA PUBLICAÇÃO (POST DE TEXTO)
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

// ROTA PARA BUSCAR AS PUBLICAÇÕES DO USUÁRIO LOGADO
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const posts = await prisma.post.findMany({
      where: {
        authorId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json(posts);

  } catch (error) {
    console.error("Erro ao buscar publicações:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});


// ==========================================================
// --- !!! NOVA ROTA PARA O FEED DA PÁGINA EXPLORAR !!! ---
// ==========================================================
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    // 1. Buscar as últimas 20 fotos, incluindo dados do autor
    const photos = await prisma.photo.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, profilePictureUrl: true },
        },
      },
    });

    // 2. Buscar os últimos 20 vídeos, incluindo dados do autor
    const videos = await prisma.video.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, name: true, profilePictureUrl: true },
        },
      },
    });

    // 3. Formatar as fotos para o padrão do ContentCard
    const formattedPhotos = photos.map(photo => ({
      id: photo.id,
      userid: photo.author.id,
      media_type: 'image',
      media_url: photo.url,
      author_name: photo.author.name,
      author_avatar_url: photo.author.profilePictureUrl,
      likes_count: 0, // Placeholder, funcionalidade a ser criada
      createdAt: photo.createdAt
    }));

    // 4. Formatar os vídeos para o padrão do ContentCard
    const formattedVideos = videos.map(video => ({
      id: video.id,
      userid: video.author.id,
      media_type: 'video',
      media_url: video.url,
      author_name: video.author.name,
      author_avatar_url: video.author.profilePictureUrl,
      likes_count: 0, // Placeholder, funcionalidade a ser criada
      createdAt: video.createdAt
    }));

    // 5. Juntar os dois arrays e ordenar pela data de criação
    const combinedFeed = [...formattedPhotos, ...formattedVideos];
    combinedFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    // 6. Enviar a resposta final (limitada aos 40 itens mais recentes)
    res.status(200).json(combinedFeed.slice(0, 40));

  } catch (error) {
    console.error("Erro ao buscar o feed da comunidade:", error);
    res.status(500).json({ message: "Erro interno do servidor ao buscar o feed." });
  }
});


module.exports = router;