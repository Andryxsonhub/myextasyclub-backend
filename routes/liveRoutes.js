// myextasyclub-backend/routes/liveRoutes.js
// --- CÓDIGO COMPLETO E CORRIGIDO (Usa LiveStream model) ---

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');
const { AccessToken } = require('livekit-server-sdk');

// Função que recebe o 'io' do server.js para emitir eventos
module.exports = function(io) {
    const router = express.Router();

    // ==========================================
    // ROTA PARA INICIAR UMA LIVE (CORRIGIDA)
    // ==========================================
    // POST /api/lives/start
    router.post('/start', authMiddleware, async (req, res) => {
        const userId = req.user.userId; // ID do usuário logado
        const roomName = `live-${userId}`; // Nome único da sala baseado no ID do host

        try {
            // 1. Verifica se já existe uma live ativa para este usuário
            const existingLive = await prisma.liveStream.findFirst({
                where: {
                    hostId: userId,
                    isActive: true,
                },
            });

            // 2. Se já estiver ativa, retorna erro 409 (Conflito)
            if (existingLive) {
                console.log(`Usuário ${userId} tentou iniciar live, mas já está ativo na sala ${existingLive.roomName}`);
                return res.status(409).json({ message: 'Você já tem uma live ativa.' });
            }

            // 3. Cria ou Atualiza o registro da LiveStream para este usuário
            // Usamos 'upsert' para criar se não existir, ou atualizar se existir mas estiver inativa
            const liveStream = await prisma.liveStream.upsert({
                where: {
                    // Tenta encontrar pela combinação hostId/roomName se roomName fosse @unique no model LiveStream
                    // Como roomName JÁ É @unique, podemos usar só ele OU hostId se garantirmos um por host
                     roomName: roomName, // Usar roomName como chave única aqui
                     // Ou, se garantirmos que um host só tem UM registro LiveStream:
                     // hostId: userId,
                },
                update: { // Se encontrar (estava inativa), apenas reativa
                    isActive: true,
                },
                create: { // Se não encontrar, cria uma nova
                    hostId: userId,
                    roomName: roomName,
                    isActive: true,
                },
                // Seleciona dados do host para emitir no socket
                include: {
                    host: {
                        select: { id: true, name: true, profile: { select: { avatarUrl: true } } }
                    }
                }
            });

            console.log(`Live iniciada com sucesso para usuário ${userId} na sala ${roomName}`);

            // 4. Emite um evento via Socket.IO para notificar outros usuários
            const liveUserData = {
                id: liveStream.host.id,
                name: liveStream.host.name,
                profilePictureUrl: liveStream.host.profile?.avatarUrl ?? null,
                roomName: liveStream.roomName // Inclui o roomName no evento
            };
            io.emit('live_started', liveUserData); // Emite para todos os conectados

            res.status(200).json({ message: 'Live iniciada com sucesso!', roomName: liveStream.roomName });

        } catch (error) {
            console.error(`Erro ao iniciar a live para usuário ${userId}:`, error);
            res.status(500).json({ message: 'Erro interno do servidor ao iniciar a live.' });
        }
    });

    // ==========================================
    // ROTA PARA OBTER TOKEN DO LIVEKIT (CORRIGIDA)
    // ==========================================
    // GET /api/lives/token/:roomName
    router.get('/token/:roomName', authMiddleware, async (req, res) => {
        const roomName = req.params.roomName;
        const userId = req.user.userId;
        const userName = req.user.name || `User_${userId}`; // Pega o nome do payload do token ou cria um

        // Verifica se a live existe e está ativa
        const liveStream = await prisma.liveStream.findUnique({
            where: { roomName: roomName },
            select: { isActive: true, hostId: true } // Verifica se está ativa e quem é o host
        });

        // Se a live não existe ou não está ativa, nega o token
        if (!liveStream || !liveStream.isActive) {
            return res.status(404).json({ message: 'Live não encontrada ou não está ativa.' });
        }

        // Define as permissões: host pode publicar, outros não
        const canPublish = (liveStream.hostId === userId);
        const canSubscribe = true; // Todos podem assistir

        // Cria o Access Token do LiveKit
        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: `user-${userId}`, // Identidade única para o LiveKit
                name: userName, // Nome a ser exibido
            }
        );

        // Adiciona as permissões ao token
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: canPublish,
            canSubscribe: canSubscribe,
            canPublishData: true, // Permite enviar dados pelo DataChannel (útil para chat ou reações)
        });

        // Gera o token JWT
        const token = at.toJwt();
        const wsUrl = process.env.LIVEKIT_WS_URL; // URL do seu servidor LiveKit

        console.log(`Token gerado para usuário ${userId} entrar na sala ${roomName}. Permissões: publish=${canPublish}`);

        res.json({ token, wsUrl });
    });

    // ==========================================
    // ROTA PARA PARAR UMA LIVE (EXISTENTE - Sem alteração crítica)
    // ==========================================
    // POST /api/lives/stop
    router.post('/stop', authMiddleware, async (req, res) => {
        const userId = req.user.userId;
        const roomName = `live-${userId}`; // Assume que a sala do host é sempre essa

        try {
            // Encontra a live do usuário e marca como inativa
            const stoppedStream = await prisma.liveStream.update({
                where: {
                    roomName: roomName,
                    // Garante que só o host pode parar e que só para se estiver ativa
                    hostId: userId,
                    isActive: true,
                },
                data: {
                    isActive: false,
                },
            });

            console.log(`Live parada com sucesso para usuário ${userId} na sala ${roomName}`);

            // Emite evento via Socket.IO para notificar que a live parou
            io.emit('live_stopped', { userId: userId, roomName: roomName });

            res.status(200).json({ message: 'Live parada com sucesso.' });

        } catch (error) {
             // Código P2025 significa que o 'where' não encontrou a live (ou não pertencia ao user, ou já estava inativa)
            if (error.code === 'P2025') {
                 console.log(`Usuário ${userId} tentou parar live ${roomName}, mas ela não foi encontrada ou não pertence a ele/já inativa.`);
                 return res.status(404).json({ message: 'Nenhuma live ativa encontrada para parar.' });
            }
            console.error(`Erro ao parar a live para usuário ${userId}:`, error);
            res.status(500).json({ message: 'Erro interno do servidor ao parar a live.' });
        }
    });

    // ==========================================
    // ROTA PARA LISTAR LIVES ATIVAS (EXISTENTE - Com correção no select)
    // ==========================================
    // GET /api/lives/active
    router.get('/active', authMiddleware, async (req, res) => {
        try {
            const activeStreams = await prisma.liveStream.findMany({
                where: { isActive: true },
                select: {
                    hostId: true, // Pega o ID do host
                    roomName: true,
                    host: { // Inclui dados do host
                        select: {
                            id: true,
                            name: true,
                            // --- CORREÇÃO: Busca avatar do Profile ---
                            profile: {
                                select: { avatarUrl: true }
                            }
                        }
                    }
                }
            });

            // Formata a resposta para o frontend
            const liveUsers = activeStreams.map(stream => ({
                id: stream.hostId, // Usa o hostId como id principal
                name: stream.host.name,
                profilePictureUrl: stream.host.profile?.avatarUrl ?? null, // Usa o avatarUrl
                roomName: stream.roomName // Inclui o roomName se precisar no frontend
            }));

            res.status(200).json(liveUsers);
        } catch (error) {
            console.error("Erro ao buscar lives ativa:", error);
            res.status(500).json({ message: 'Erro interno do servidor ao buscar lives.' });
        }
    });

    return router; // Retorna o router configurado
};