// myextasyclub-backend/routes/postRoutes.js
// --- CÓDIGO 100% CORRIGIDO ---

const express = require('express');
const prisma = require('../lib/prisma');
// --- CORREÇÃO APLICADA AQUI ---
const { checkAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ----------------------------------------------------
// ROTA PARA CRIAR UM NOVO POST
// ----------------------------------------------------
// POST /api/posts
// --- CORREÇÃO APLICADA AQUI ---
router.post('/', checkAuth, async (req, res) => {
    const { content } = req.body;
    const authorId = req.user.userId;

    if (!content) {
        return res.status(400).json({ message: 'O conteúdo do post não pode estar vazio.' });
    }

    try {
        const newPost = await prisma.post.create({
            data: {
                content,
                authorId: authorId,
            },
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        profile: {
                            select: { avatarUrl: true }
                        }
                    }
                }
            }
        });

        const formattedPost = {
            ...newPost,
            author: {
                name: newPost.author.name,
                profilePictureUrl: newPost.author.profile?.avatarUrl ?? null
            }
        };

        res.status(201).json(formattedPost);
    } catch (error) {
        console.error("Erro ao criar post:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar post.' });
    }
});

// ----------------------------------------------------
// ROTA PARA BUSCAR OS POSTS DO USUÁRIO LOGADO
// ----------------------------------------------------
// GET /api/posts
// --- CORREÇÃO APLICADA AQUI ---
router.get('/', checkAuth, async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                authorId: req.user.userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: {
                    select: {
                        name: true,
                        profile: {
                            select: { avatarUrl: true }
                        }
                    }
                }
            }
        });

        const formattedPosts = posts.map(post => ({
            ...post,
            author: {
                name: post.author.name,
                profilePictureUrl: post.author.profile?.avatarUrl ?? null
            }
        }));

        res.status(200).json(formattedPosts);

    } catch (error) {
        console.error("Erro ao buscar publicações do usuário:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar publicações.' });
    }
});


// ----------------------------------------------------
// ROTA PARA BUSCAR POSTS DE UM USUÁRIO ESPECÍFICO
// ----------------------------------------------------
// GET /api/posts/user/:userId
// --- CORREÇÃO APLICADA AQUI ---
router.get('/user/:userId', checkAuth, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ message: 'ID de usuário inválido.' });
        }

        const posts = await prisma.post.findMany({
            where: {
                authorId: userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: {
                    select: {
                        name: true,
                        profile: {
                            select: { avatarUrl: true }
                        }
                    }
                }
            }
        });

        const formattedPosts = posts.map(post => ({
            ...post,
            author: {
                name: post.author.name,
                profilePictureUrl: post.author.profile?.avatarUrl ?? null
            }
        }));

        res.status(200).json(formattedPosts);
    } catch (error) {
        console.error("Erro ao buscar publicações do usuário:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar publicações.' });
    }
});

// ----------------------------------------------------
// ROTA PARA BUSCAR O FEED (POSTS DE QUEM O USUÁRIO SEGUE)
// ----------------------------------------------------
// GET /api/posts/feed
// --- CORREÇÃO APLICADA AQUI ---
router.get('/feed', checkAuth, async (req, res) => {
    const userId = req.user.userId;
    try {
        const following = await prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true }
        });

        const followingIds = following.map(f => f.followingId);

        const posts = await prisma.post.findMany({
            where: {
                authorId: {
                    in: [...followingIds, userId]
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20,
            include: {
                author: {
                    select: {
                        name: true,
                        profile: {
                            select: { avatarUrl: true }
                        }
                    }
                }
            }
        });

        const formattedPosts = posts.map(post => ({
            ...post,
            author: {
                name: post.author.name,
                profilePictureUrl: post.author.profile?.avatarUrl ?? null
            }
        }));

        res.status(200).json(formattedPosts);

    } catch (error) {
        console.error("Erro ao buscar feed:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar feed.' });
    }
});

// ----------------------------------------------------
// ROTA PARA DELETAR UM POST
// ----------------------------------------------------
// DELETE /api/posts/:postId
// --- CORREÇÃO APLICADA AQUI ---
router.delete('/:postId', checkAuth, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        const userId = req.user.userId;

        if (isNaN(postId)) {
            return res.status(400).json({ message: 'ID do post inválido.' });
        }

        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post) {
            return res.status(404).json({ message: 'Post não encontrado.' });
        }

        if (post.authorId !== userId) {
            return res.status(403).json({ message: 'Você não tem permissão para deletar este post.' });
        }

        await prisma.post.delete({
            where: { id: postId }
        });

        res.status(204).send(); // Sucesso, sem conteúdo

    } catch (error) {
        console.error("Erro ao deletar post:", error);
        res.status(500).json({ message: 'Erro interno do servidor ao deletar post.' });
    }
});

module.exports = router;