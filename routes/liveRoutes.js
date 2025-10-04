// backend/routes/liveRoutes.js (VERSÃO FINAL E FUNCIONAL)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { AccessToken } = require('livekit-server-sdk');

const prisma = new PrismaClient();

module.exports = (io) => {
  const router = express.Router();

  const livekitHost = process.env.LIVEKIT_HOST;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // ROTA PARA GERAR O TOKEN DO LIVEKIT
  router.get('/token', authMiddleware, async (req, res) => {
    const roomName = `live-${req.user.userId}`;
    const participantIdentity = String(req.user.userId);
    const participantName = req.user.name;

    if (!apiKey || !apiSecret || !livekitHost) {
      console.error("ERRO CRÍTICO: As variáveis de ambiente do Livekit não estão configuradas!");
      return res.status(500).json({ message: 'Configurações do Livekit incompletas no servidor.' });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    const wsUrl = `wss://${livekitHost}`;
    res.json({ token: token, wsUrl: wsUrl });
  });

  // ROTA PARA INICIAR A LIVE (COM A LÓGICA REAL)
  router.post('/start', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isLive: true },
        select: { id: true, name: true, profilePictureUrl: true }
      });

      io.emit('live_started', updatedUser);
      console.log(`>>> Live iniciada com sucesso para o usuário ${userId} <<<`);
      res.status(200).json({ message: 'Live iniciada com sucesso.' });
    } catch (error) {
      console.error('Erro ao iniciar a live:', error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });

  // ROTA PARA PARAR A LIVE (COM A LÓGICA REAL)
  router.post('/stop', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      await prisma.user.update({
        where: { id: userId },
        data: { isLive: false },
      });

      io.emit('live_stopped', { userId: userId });
      console.log(`>>> Live encerrada com sucesso para o usuário ${userId} <<<`);
      res.status(200).json({ message: 'Live encerrada com sucesso.' });
    } catch (error) {
      console.error('Erro ao encerrar a live:', error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });

  // ROTA PARA LISTAR AS LIVES ATIVAS
  router.get('/active', async (req, res) => {
    try {
      const liveUsers = await prisma.user.findMany({
        where: { isLive: true },
        select: { id: true, name: true, profilePictureUrl: true }
      });
      res.status(200).json(liveUsers);
    } catch (error) {
      console.error('Erro ao buscar lives ativas:', error);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  });

  return router;
};