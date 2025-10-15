const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// --- FUNÇÃO AUXILIAR PARA FORMATAR O CONTEÚDO DO FEED ---
const formatContentForFeed = (item, media_type) => {
    return {
        id: item.id,
        userid: item.author.id,
        media_type: media_type, // 'image' ou 'video'
        media_url: item.url,
        author_name: item.author.name,
        author_avatar_url: item.author.profilePictureUrl,
        likes_count: 0, // Placeholder
        createdAt: item.createdAt
    };
};


// ===================================
// --- ROTAS DE POSTS ---
// ===================================

// ROTA PARA CRIAR UMA NOVA PUBLICAÇÃO (POST DE TEXTO)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'O conteúdo da publicação não pode estar vazio.' });
        }
        const newPost = await prisma.post.create({
            data: {
                content: content,
                authorId: req.user.userId,
            },
            include: { author: { select: { name: true, profilePictureUrl: true } } }
        });
        res.status(201).json(newPost);
    } catch (error) {
        console.error("Erro ao criar a publicação:", error);
        res.status(500).json({ message: "Erro interno do servidor." });
    }
});

// ROTA PARA BUSCAR OS POSTS DO USUÁRIO LOGADO (PARA A PÁGINA "MEU PERFIL")
router.get('/', authMiddleware, async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: { authorId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { name: true, profilePictureUrl: true } } }
        });
        res.json(posts);
    } catch (error) {
        console.error("Erro ao buscar publicações:", error);
        res.status(500).json({ message: 'Erro ao buscar posts.' });
    }
});

// ROTA PARA BUSCAR OS POSTS DE UM USUÁRIO ESPECÍFICO (PARA VISITAR OUTROS PERFIS)
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID de usuário inválido." });
        const posts = await prisma.post.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { name: true, profilePictureUrl: true } } }
        });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar posts do usuário.' });
    }
});


// ROTA PARA O FEED DA PÁGINA EXPLORAR (VERSÃO OTIMIZADA)
router.get('/feed', authMiddleware, async (req, res) => {
    try {
        const photos = await prisma.photo.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, name: true, profilePictureUrl: true } } },
        });

        const videos = await prisma.video.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, name: true, profilePictureUrl: true } } },
        });

        const formattedPhotos = photos.map(photo => formatContentForFeed(photo, 'image'));
        const formattedVideos = videos.map(video => formatContentForFeed(video, 'video'));

        const combinedFeed = [...formattedPhotos, ...formattedVideos];
        combinedFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.status(200).json(combinedFeed.slice(0, 40));

    } catch (error) {
        console.error("Erro ao buscar o feed da comunidade:", error);
        res.status(500).json({ message: "Erro interno do servidor ao buscar o feed." });
    }
});

module.exports = router;