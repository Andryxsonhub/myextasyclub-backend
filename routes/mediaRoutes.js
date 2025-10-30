// myextasyclub-backend/routes/mediaRoutes.js
// --- CÓDIGO 100% CORRIGIDO ---

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
// --- CORREÇÃO APLICADA AQUI ---
const { checkAuth } = require('../middleware/authMiddleware');

// =================================================================
// ROTA FEED (H01/H02): Feed da Home Page (Mídia Mista)
// =================================================================
/**
 * GET /api/media/feed
 * @param {Request} req
 * @param {Response} res
 */
// Esta rota é pública, mas tenta pegar o usuário logado se ele existir
// (Não precisa do checkAuth aqui, pois o req.user?.userId lida com isso)
router.get('/feed', async (req, res) => {
    // Tenta pegar o ID do usuário logado
    const loggedInUserId = req.user?.userId;

    try {
        const photos = await prisma.photo.findMany({
            take: 20, orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
                _count: { select: { likes: true } },
                likes: { where: { likerId: loggedInUserId || -1 }, select: { id: true } },
            },
        });
        const videos = await prisma.video.findMany({
            take: 20, orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
                _count: { select: { likes: true } },
                likes: { where: { likerId: loggedInUserId || -1 }, select: { id: true } },
            },
        });

        const formattedPhotos = photos.map(photo => ({
            id: photo.id, media_type: 'photo', media_url: photo.url,
            thumbnail_url: null,
            content: photo.description, createdAt: photo.createdAt.toISOString(),
            author: { id: photo.author.id, name: photo.author.name || 'Usuário', profilePictureUrl: photo.author.profile?.avatarUrl },
            likeCount: parseInt(String(photo._count?.likes ?? 0), 10),
            isLikedByMe: photo.likes.length > 0,
        }));
        const formattedVideos = videos.map(video => ({
            id: video.id, media_type: 'video', media_url: video.url,
            thumbnail_url: video.thumbnailUrl || null,
            content: video.description, createdAt: video.createdAt.toISOString(),
            author: { id: video.author.id, name: video.author.name || 'Usuário', profilePictureUrl: video.author.profile?.avatarUrl },
            likeCount: parseInt(String(video._count?.likes ?? 0), 10),
            isLikedByMe: video.likes.length > 0,
        }));

        const combinedFeed = [...formattedPhotos, ...formattedVideos];
        combinedFeed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.status(200).json(combinedFeed.slice(0, 30));
    } catch (/** @type {Error} */ error) {
        console.error("Erro ao buscar o feed de mídia:", error);
        res.status(500).json({ message: "Erro interno ao buscar o feed." });
    }
});


// =================================================================
// ROTA BUSCAR FOTO INDIVIDUAL POR ID
// =================================================================
// (Pública, não precisa de checkAuth)
router.get('/photos/:id', async (req, res) => {
    const photoId = parseInt(req.params.id, 10);
    const loggedInUserId = req.user?.userId;

    if (isNaN(photoId)) {
        return res.status(400).json({ error: 'ID da foto inválido.' });
    }

    try {
        const photo = await prisma.photo.findUnique({
            where: { id: photoId },
            include: {
                author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
                _count: { select: { likes: true } },
                likes: { where: { likerId: loggedInUserId || -1 }, select: { id: true } },
            },
        });

        if (!photo) {
            return res.status(404).json({ error: 'Foto não encontrada.' });
        }

        const formattedPhoto = {
            id: photo.id, media_type: 'photo', media_url: photo.url,
            thumbnail_url: null,
            content: photo.description, createdAt: photo.createdAt.toISOString(),
            author: { id: photo.author.id, name: photo.author.name || 'Usuário', profilePictureUrl: photo.author.profile?.avatarUrl },
            likeCount: parseInt(String(photo._count?.likes ?? 0), 10),
            isLikedByMe: photo.likes.length > 0,
        };

        res.status(200).json(formattedPhoto);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar foto ${photoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar foto.' });
        S
    }
});


// =================================================================
// ROTA BUSCAR VÍDEO INDIVIDUAL POR ID
// =================================================================
// (Pública, não precisa de checkAuth)
router.get('/videos/:id', async (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    const loggedInUserId = req.user?.userId;

    if (isNaN(videoId)) {
        return res.status(400).json({ error: 'ID do vídeo inválido.' });
    }

    try {
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            include: {
                author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
                _count: { select: { likes: true } },
                likes: { where: { likerId: loggedInUserId || -1 }, select: { id: true } },
            },
        });

        if (!video) {
            return res.status(404).json({ error: 'Vídeo não encontrado.' });
        }

        const formattedVideo = {
            id: video.id, media_type: 'video', media_url: video.url,
            thumbnail_url: video.thumbnailUrl || null,
            content: video.description, createdAt: video.createdAt.toISOString(),
            author: { id: video.author.id, name: video.author.name || 'Usuário', profilePictureUrl: video.author.profile?.avatarUrl },
            likeCount: parseInt(String(video._count?.likes ?? 0), 10),
            isLikedByMe: video.likes.length > 0,
        };

        res.status(200).json(formattedVideo);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar vídeo ${videoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar vídeo.' });
    }
});


// --- Rotas de Like (requerem authMiddleware) ---
/**
 * POST /api/media/photos/:id/like
 */
// --- CORREÇÃO APLICADA AQUI ---
router.post('/photos/:id/like', checkAuth, async (req, res) => {
    const likerId = req.user.userId;
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId) || !likerId) return res.status(400).json({ error: 'Requisição inválida.' });
    try {
        const existingLike = await prisma.like.findUnique({ where: { likerId_likedPhotoId: { likerId, likedPhotoId: photoId } } });
        if (existingLike) {
            await prisma.like.delete({ where: { id: existingLike.id } });
            const count = await prisma.like.count({ where: { likedPhotoId: photoId } });
            res.status(200).json({ isLikedByMe: false, likeCount: count });
        } else {
            await prisma.like.create({ data: { likerId, likedPhotoId: photoId } });
            const count = await prisma.like.count({ where: { likedPhotoId: photoId } });
            res.status(201).json({ isLikedByMe: true, likeCount: count });
        }
    } catch (/** @type {Error} */ error) {
        console.error('Erro no toggle de curtir foto:', error);
        if (error.code === 'P2003' || error.code === 'P2025') {
            return res.status(404).json({ error: 'Foto não encontrada.' });
        }
        res.status(500).json({ error: 'Erro interno.' });
    }
});

/**
 * POST /api/media/videos/:id/like
 */
// --- CORREÇÃO APLICADA AQUI ---
router.post('/videos/:id/like', checkAuth, async (req, res) => {
    const likerId = req.user.userId;
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId) || !likerId) return res.status(400).json({ error: 'Requisição inválida.' });
    try {
        const existingLike = await prisma.like.findUnique({ where: { likerId_likedVideoId: { likerId, likedVideoId: videoId } } });
        if (existingLike) {
            await prisma.like.delete({ where: { id: existingLike.id } });
            const count = await prisma.like.count({ where: { likedVideoId: videoId } });
            res.status(200).json({ isLikedByMe: false, likeCount: count });
        } else {
            await prisma.like.create({ data: { likerId, likedVideoId: videoId } });
            const count = await prisma.like.count({ where: { likedVideoId: videoId } });
            res.status(201).json({ isLikedByMe: true, likeCount: count });
            a
        }
    } catch (/** @type {Error} */ error) {
        console.error('Erro no toggle de curtir vídeo:', error);
        if (error.code === 'P2003' || error.code === 'P2025') {
            return res.status(404).json({ error: 'Vídeo não encontrado.' });
        }
        res.status(500).json({ error: 'Erro interno.' });
        nbsp;
    }
});

// ROTA LISTAR LIKERS DE FOTO
/**
 * GET /api/media/photos/:id/likers
 */
// --- CORREÇÃO APLICADA AQUI ---
router.get('/photos/:id/likers', checkAuth, async (req, res) => {
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId)) { return res.status(400).json({ error: 'ID da foto inválido.' }); }
    try {
        const likes = await prisma.like.findMany({
            where: { likedPhotoId: photoId },
            orderBy: { createdAt: 'desc' },
            include: { liker: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } } }
        });
        const likers = likes.map(/** @param {any} like */(like) => ({
            id: like.liker.id, name: like.liker.name || 'Usuário', profilePictureUrl: like.liker.profile?.avatarUrl ?? null
        }));
        res.status(200).json(likers);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar likers da foto ${photoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar curtidas.' });
    }
});

// ROTA LISTAR LIKERS DE VÍDEO
/**
 * GET /api/media/videos/:id/likers
 */
// --- CORREÇÃO APLICADA AQUI ---
router.get('/videos/:id/likers', checkAuth, async (req, res) => {
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId)) { return res.status(400).json({ error: 'ID do vídeo inválido.' }); }
    try {
        const likes = await prisma.like.findMany({
            where: { likedVideoId: videoId },
            orderBy: { createdAt: 'desc' },
            include: { liker: { select: { id: true, name: true, profile: { select: { avatarUrl: true } } } } }
        });
        const likers = likes.map(/** @param {any} like */(like) => ({
            id: like.liker.id, name: like.liker.name || 'Usuário', profilePictureUrl: like.liker.profile?.avatarUrl ?? null
        }));
        res.status(200).json(likers);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar likers do vídeo ${videoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar curtidas.' });
    }
});


module.exports = router;