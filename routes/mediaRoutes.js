// myextasyclub-backend/routes/mediaRoutes.js
// --- ATUALIZADO (Links corrigidos para o padrão do Frontend /photo/:id) ---

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { checkAuth } = require('../middleware/authMiddleware');

// =================================================================
// ROTA FEED (H01/H02): Feed da Home Page (Mídia Mista)
// =================================================================
router.get('/feed', async (req, res) => {
    const loggedInUserId = req.user?.userId;
    try {
        const photos = await prisma.photo.findMany({
            take: 20, orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, username: true, profile: { select: { avatarUrl: true } } } },
                _count: { select: { likes: true, comments: true } }, 
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
            commentCount: parseInt(String(photo._count?.comments ?? 0), 10),
            isLikedByMe: photo.likes.length > 0,
        }));
        const formattedVideos = videos.map(video => ({
            id: video.id, media_type: 'video', media_url: video.url,
            thumbnail_url: video.thumbnailUrl || null,
            content: video.description, createdAt: video.createdAt.toISOString(),
            author: { id: video.author.id, name: video.author.name || 'Usuário', profilePictureUrl: video.author.profile?.avatarUrl },
            likeCount: parseInt(String(video._count?.likes ?? 0), 10),
            commentCount: 0, 
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
                _count: { select: { likes: true, comments: true } },
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
            commentCount: parseInt(String(photo._count?.comments ?? 0), 10),
            isLikedByMe: photo.likes.length > 0,
        };

        res.status(200).json(formattedPhoto);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar foto ${photoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar foto.' });
    }
});


// =================================================================
// ROTA BUSCAR VÍDEO INDIVIDUAL POR ID
// =================================================================
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
            commentCount: 0,
            isLikedByMe: video.likes.length > 0,
        };

        res.status(200).json(formattedVideo);
    } catch (/** @type {Error} */ error) {
        console.error(`Erro ao buscar vídeo ${videoId}:`, error);
        res.status(500).json({ error: 'Erro interno ao buscar vídeo.' });
    }
});


// =================================================================
// ★★★ ROTAS DE LIKES (COM NOTIFICAÇÕES) ★★★
// =================================================================

router.post('/photos/:id/like', checkAuth, async (req, res) => {
    const likerId = req.user.userId;
    const photoId = parseInt(req.params.id, 10);
    if (isNaN(photoId) || !likerId) return res.status(400).json({ error: 'Requisição inválida.' });
    
    try {
        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) return res.status(404).json({ error: 'Foto não encontrada.' });

        const existingLike = await prisma.like.findUnique({ where: { likerId_likedPhotoId: { likerId, likedPhotoId: photoId } } });
        
        if (existingLike) {
            await prisma.like.delete({ where: { id: existingLike.id } });
            const count = await prisma.like.count({ where: { likedPhotoId: photoId } });
            res.status(200).json({ isLikedByMe: false, likeCount: count });
        } else {
            await prisma.like.create({ data: { likerId, likedPhotoId: photoId } });
            
            // ★ CORREÇÃO DO LINK DA FOTO ★
            if (photo.authorId !== likerId) {
                await prisma.notification.create({
                    data: {
                        userId: photo.authorId,
                        type: 'LIKE',
                        content: `${req.user.username || 'Alguém'} curtiu sua foto!`,
                        link: `/photo/${photoId}` // <-- LINK CORRIGIDO AQUI
                    }
                });
            }

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

router.post('/videos/:id/like', checkAuth, async (req, res) => {
    const likerId = req.user.userId;
    const videoId = parseInt(req.params.id, 10);
    if (isNaN(videoId) || !likerId) return res.status(400).json({ error: 'Requisição inválida.' });
    
    try {
        const video = await prisma.video.findUnique({ where: { id: videoId } });
        if (!video) return res.status(404).json({ error: 'Vídeo não encontrado.' });

        const existingLike = await prisma.like.findUnique({ where: { likerId_likedVideoId: { likerId, likedVideoId: videoId } } });
        
        if (existingLike) {
            await prisma.like.delete({ where: { id: existingLike.id } });
            const count = await prisma.like.count({ where: { likedVideoId: videoId } });
            res.status(200).json({ isLikedByMe: false, likeCount: count });
        } else {
            await prisma.like.create({ data: { likerId, likedVideoId: videoId } });

            // ★ CORREÇÃO DO LINK DO VÍDEO ★
            if (video.authorId !== likerId) {
                await prisma.notification.create({
                    data: {
                        userId: video.authorId,
                        type: 'LIKE',
                        content: `${req.user.username || 'Alguém'} curtiu seu vídeo!`,
                        link: `/video/${videoId}` // <-- LINK CORRIGIDO AQUI
                    }
                });
            }

            const count = await prisma.like.count({ where: { likedVideoId: videoId } });
            res.status(201).json({ isLikedByMe: true, likeCount: count });
        }
    } catch (/** @type {Error} */ error) {
        console.error('Erro no toggle de curtir vídeo:', error);
        if (error.code === 'P2003' || error.code === 'P2025') {
            return res.status(404).json({ error: 'Vídeo não encontrado.' });
        }
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// =================================================================
// ROTAS DE LIKERS
// =================================================================
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


// =================================================================
// ★★★ ROTAS DE COMENTÁRIOS (COM NOTIFICAÇÕES) ★★★
// =================================================================

router.get('/photos/:photoId/comments', checkAuth, async (req, res) => {
    const photoId = parseInt(req.params.photoId, 10);
    if (isNaN(photoId)) {
        return res.status(400).json({ message: 'ID de foto inválido.' });
    }

    try {
        const comments = await prisma.comment.findMany({
            where: { photoId: photoId },
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profile: { select: { avatarUrl: true } }
                    }
                }
            }
        });

        const formattedComments = comments.map(comment => ({
            id: comment.id,
            text: comment.text,
            createdAt: comment.createdAt,
            author: {
                id: comment.author.id,
                name: comment.author.name || 'Usuário',
                profilePictureUrl: comment.author.profile?.avatarUrl ?? null
            }
        }));

        res.status(200).json(formattedComments);
    } catch (error) {
        console.error("Erro ao buscar comentários:", error);
        res.status(500).json({ message: "Erro interno ao buscar comentários." });
    }
});

router.post('/photos/:photoId/comments', checkAuth, async (req, res) => {
    const photoId = parseInt(req.params.photoId, 10);
    const authorId = req.user.userId;
    const { text } = req.body;

    if (isNaN(photoId)) {
        return res.status(400).json({ message: 'ID de foto inválido.' });
    }
    if (!text || text.trim() === '') {
        return res.status(400).json({ message: 'O comentário não pode estar vazio.' });
    }

    try {
        const photo = await prisma.photo.findUnique({ where: { id: photoId } });
        if (!photo) return res.status(404).json({ message: 'Foto não encontrada.' });

        const newComment = await prisma.comment.create({
            data: {
                text: text,
                authorId: authorId,
                photoId: photoId
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profile: { select: { avatarUrl: true } }
                    }
                }
            }
        });

        // ★ CORREÇÃO DO LINK NO COMENTÁRIO ★
        if (photo.authorId !== authorId) {
            await prisma.notification.create({
                data: {
                    userId: photo.authorId,
                    type: 'COMMENT',
                    content: `${req.user.username || 'Alguém'} comentou na sua foto: "${text.substring(0, 20)}${text.length > 20 ? '...' : ''}"`,
                    link: `/photo/${photoId}` // <-- LINK CORRIGIDO AQUI
                }
            });
        }

        const formattedComment = {
            id: newComment.id,
            text: newComment.text,
            createdAt: newComment.createdAt,
            author: {
                id: newComment.author.id,
                name: newComment.author.name || 'Usuário',
                profilePictureUrl: newComment.author.profile?.avatarUrl ?? null
            }
        };

        res.status(201).json(formattedComment);
    } catch (error) {
        console.error("Erro ao criar comentário:", error);
        res.status(500).json({ message: "Erro interno ao criar comentário." });
    }
});

module.exports = router;