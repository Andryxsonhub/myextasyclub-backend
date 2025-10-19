// myextasyclub-backend/routes/postRoutes.js
// --- CÓDIGO COMPLETO E CORRIGIDO (profilePictureUrl -> profile.avatarUrl) ---

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ----------------------------------------------------
// ROTA PARA CRIAR UM NOVO POST
// ----------------------------------------------------
// POST /api/posts
router.post('/', authMiddleware, async (req, res) => {
    const { content } = req.body;
    const authorId = req.user.userId; // Vem do authMiddleware

    if (!content) {
        return res.status(400).json({ message: 'O conteúdo do post não pode estar vazio.' });
    }

    try {
        const newPost = await prisma.post.create({
            data: {
                content,
                authorId: authorId,
            },
            // Incluir dados do autor para retornar ao frontend, se necessário
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        // --- CORREÇÃO APLICADA AQUI TAMBÉM ---
                        profile: {
                            select: { avatarUrl: true }
                        }
                    }
                }
            }
        });
        
        // Formata o retorno para incluir profilePictureUrl
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
// ROTA PARA BUSCAR OS POSTS DO USUÁRIO LOGADO (PARA A PÁGINA "MEU PERFIL")
// ----------------------------------------------------
// GET /api/posts
router.get('/', authMiddleware, async (req, res) => {
    try {
        const posts = await prisma.post.findMany({
            where: {
                // --- CORREÇÃO IMPORTANTE: Usar o ID do usuário logado ---
                // O código anterior estava fixo com authorId: 1
                authorId: req.user.userId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                author: {
                    select: {
                        name: true,
                        // --- CORREÇÃO APLICADA AQUI ---
                        profile: { // Busca dentro do profile
                            select: { avatarUrl: true } // Pega o avatarUrl
                        }
                    }
                }
            }
        });

        // Formata os posts para incluir profilePictureUrl no nível esperado pelo frontend
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
// ROTA PARA BUSCAR POSTS DE UM USUÁRIO ESPECÍFICO (PELO ID)
// ----------------------------------------------------
// GET /api/posts/user/:userId
router.get('/user/:userId', authMiddleware, async (req, res) => {
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
                         // --- CORREÇÃO APLICADA AQUI ---
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
// ROTA PARA BUSCAR O FEED (POSTS DE QUEM O USUÁRIO SEGUE - EXEMPLO)
// ----------------------------------------------------
// GET /api/posts/feed
router.get('/feed', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    try {
        // 1. Encontra quem o usuário logado segue
        const following = await prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true } // Pega apenas os IDs
        });

        // Extrai apenas os IDs para uma lista
        const followingIds = following.map(f => f.followingId);

        // 2. Busca os posts dessas pessoas (e os posts do próprio usuário, opcional)
        const posts = await prisma.post.findMany({
            where: {
                authorId: {
                    in: [...followingIds, userId] // Inclui posts do próprio usuário no feed
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: 20, // Limita a quantidade de posts no feed
            include: {
                author: {
                    select: {
                        name: true,
                        // --- CORREÇÃO APLICADA AQUI ---
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
// ROTA PARA DELETAR UM POST (OPCIONAL)
// ----------------------------------------------------
// DELETE /api/posts/:postId
router.delete('/:postId', authMiddleware, async (req, res) => {
    try {
        const postId = parseInt(req.params.postId, 10);
        const userId = req.user.userId;

        if (isNaN(postId)) {
            return res.status(400).json({ message: 'ID do post inválido.' });
        }

        // Verifica se o post existe e pertence ao usuário logado
        const post = await prisma.post.findUnique({
            where: { id: postId }
        });

        if (!post) {
            return res.status(404).json({ message: 'Post não encontrado.' });
        }

        if (post.authorId !== userId) {
            return res.status(403).json({ message: 'Você não tem permissão para deletar este post.' });
        }

        // Deleta o post
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