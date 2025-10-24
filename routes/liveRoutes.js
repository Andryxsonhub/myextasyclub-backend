// myextasyclub-backend/routes/liveRoutes.js
// --- CÓDIGO CORRIGIDO E OTIMIZADO ---

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/authMiddleware');
const { AccessToken } = require('livekit-server-sdk');

module.exports = function (io) {
    const router = express.Router();

    // ============================================================
    // 🟢 1. INICIAR UMA LIVE
    // ============================================================
    router.post('/start', authMiddleware, async (req, res) => {
        const userId = req.user.userId;
        const roomName = `live-${userId}`;

        try {
            const existingLive = await prisma.liveStream.findFirst({
                where: { hostId: userId, isActive: true },
            });

            if (existingLive) {
                console.log(`⚠️ Usuário ${userId} já tem uma live ativa (${existingLive.roomName})`);
                return res.status(409).json({ message: 'Você já tem uma live ativa.' });
            }

            const liveStream = await prisma.liveStream.upsert({
                where: { roomName },
                update: { isActive: true },
                create: { hostId: userId, roomName, isActive: true },
                include: {
                    host: {
                        select: {
                            id: true,
                            name: true,
                            profile: { select: { avatarUrl: true } },
                        },
                    },
                },
            });

            console.log(`✅ Live iniciada para usuário ${userId} na sala ${roomName}`);

            const liveUserData = {
                id: liveStream.host.id,
                name: liveStream.host.name,
                profilePictureUrl: liveStream.host.profile?.avatarUrl ?? null,
                roomName: liveStream.roomName,
            };

            io.emit('live_started', liveUserData);

            res.status(200).json({
                message: 'Live iniciada com sucesso!',
                roomName: liveStream.roomName,
            });
        } catch (error) {
            console.error(`❌ Erro ao iniciar live do usuário ${userId}:`, error);
            res.status(500).json({ message: 'Erro interno do servidor ao iniciar a live.' });
        }
    });

    // ============================================================
    // 🟡 2. GERAR TOKEN DO LIVEKIT (PRINCIPAL CORREÇÃO)
    // ============================================================
    router.get('/token/:roomName', authMiddleware, async (req, res) => {
        const { roomName } = req.params;
        const userId = req.user.userId;
        const userName = req.user.name || `User_${userId}`;

        try {
            // 🔍 Verifica se a live existe e está ativa
            const liveStream = await prisma.liveStream.findUnique({
                where: { roomName },
                select: { isActive: true, hostId: true },
            });

            if (!liveStream || !liveStream.isActive) {
                return res.status(404).json({ message: 'Live não encontrada ou não está ativa.' });
            }

            // 🔑 Permissões
            const canPublish = liveStream.hostId === userId;
            const canSubscribe = true;

            // ============================================================
            // 🚨 CORREÇÃO 1: Use .toJwt() com await (é assíncrono!)
            // ============================================================
            console.log('--- DEBUG LIVEKIT ---');
            console.log('API Key:', process.env.LIVEKIT_API_KEY);
            console.log('Secret (início):', process.env.LIVEKIT_API_SECRET?.slice(0, 5) + '...');
            console.log('URL:', process.env.LIVEKIT_URL);
            console.log('---------------------');

            const at = new AccessToken(
                process.env.LIVEKIT_API_KEY,
                process.env.LIVEKIT_API_SECRET,
                {
                    identity: `user-${userId}`,
                    name: userName,
                }
            );

            at.addGrant({
                room: roomName,
                roomJoin: true,
                canPublish,
                canSubscribe,
                canPublishData: true,
            });

            // ⚠️ Importante: `toJwt()` é uma Promise — precisa de await!
            const token = await at.toJwt();
            const wsUrl = process.env.LIVEKIT_URL;

            console.log(`🎫 Token gerado para user ${userId} -> sala ${roomName} | publish=${canPublish}`);

            res.json({ token, wsUrl });
        } catch (error) {
            console.error('❌ Erro ao gerar token do LiveKit:', error);
            res.status(500).json({ message: 'Erro ao gerar token do LiveKit.' });
        }
    });

    // ============================================================
    // 🔴 3. PARAR UMA LIVE
    // ============================================================
    router.post('/stop', authMiddleware, async (req, res) => {
        const userId = req.user.userId;
        const roomName = `live-${userId}`;

        try {
            const stoppedStream = await prisma.liveStream.update({
                where: { roomName },
                data: { isActive: false },
            });

            console.log(`🛑 Live parada para usuário ${userId} na sala ${roomName}`);

            io.emit('live_stopped', { userId, roomName });
            res.status(200).json({ message: 'Live parada com sucesso.' });
        } catch (error) {
            if (error.code === 'P2025') {
                console.log(`⚠️ Nenhuma live ativa encontrada para o usuário ${userId}`);
                return res.status(404).json({ message: 'Nenhuma live ativa encontrada para parar.' });
            }
            console.error('❌ Erro ao parar live:', error);
            res.status(500).json({ message: 'Erro interno ao parar a live.' });
        }
    });

    // ============================================================
    // 🔵 4. LISTAR LIVES ATIVAS
    // ============================================================
    router.get('/active', authMiddleware, async (req, res) => {
        try {
            const activeStreams = await prisma.liveStream.findMany({
                where: { isActive: true },
                select: {
                    hostId: true,
                    roomName: true,
                    host: {
                        select: {
                            id: true,
                            name: true,
                            profile: { select: { avatarUrl: true } },
                        },
                    },
                },
            });

            const liveUsers = activeStreams.map(stream => ({
                id: stream.hostId,
                name: stream.host.name,
                profilePictureUrl: stream.host.profile?.avatarUrl ?? null,
                roomName: stream.roomName,
            }));

            res.status(200).json(liveUsers);
        } catch (error) {
            console.error('❌ Erro ao listar lives ativas:', error);
            res.status(500).json({ message: 'Erro ao listar lives ativas.' });
        }
    });

    return router;
};
