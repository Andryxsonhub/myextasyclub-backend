// backend/routes/liveRoutes.js (VERSÃO COM DEBUG)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { AccessToken } = require('livekit-server-sdk');

const prisma = new PrismaClient();

module.exports = (io) => {
  const router = express.Router();

  // Carrega as variáveis no início
  const livekitHost = process.env.LIVEKIT_HOST;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // ROTA PARA GERAR O TOKEN DO LIVEKIT
  router.get('/token', authMiddleware, async (req, res) => {
    console.log('\n--- [DEBUG LIVE] 1. Rota /token foi chamada. ---');
    
    const roomName = `live-${req.user.userId}`;
    const participantIdentity = String(req.user.userId);
    const participantName = req.user.name;

    console.log(`--- [DEBUG LIVE] 2. Verificando variáveis de ambiente... ---`);
    console.log(`LIVEKIT_HOST: ${livekitHost}`);
    console.log(`LIVEKIT_API_KEY: ${apiKey ? '***ENCONTRADA***' : '!!! AUSENTE !!!'}`);
    console.log(`LIVEKIT_API_SECRET: ${apiSecret ? '***ENCONTRADA***' : '!!! AUSENTE !!!'}`);

    if (!apiKey || !apiSecret || !livekitHost) {
      console.error("ERRO CRÍTICO: As variáveis de ambiente do Livekit não estão configuradas!");
      return res.status(500).json({ message: 'Configurações do Livekit incompletas no servidor.' });
    }

    console.log(`--- [DEBUG LIVE] 3. Tentando criar o AccessToken para o usuário: ${participantName}... ---`);
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });
    console.log(`--- [DEBUG LIVE] 4. AccessToken criado. Adicionando permissões... ---`);

    at.addGrant({ room: roomName, roomJoin: true, canPublish: true, canSubscribe: true });
    console.log(`--- [DEBUG LIVE] 5. Permissões adicionadas. Gerando o token JWT... ---`);
    
    const token = await at.toJwt();
    console.log(`--- [DEBUG LIVE] 6. Token JWT gerado com sucesso! ---`);

    const wsUrl = `wss://${livekitHost}`;
    
    console.log(`--- [DEBUG LIVE] 7. Enviando resposta para o frontend. ---`);
    res.json({ token: token, wsUrl: wsUrl });
  });

  // ROTA PARA INICIAR A LIVE
  router.post('/start', authMiddleware, async (req, res) => {
    console.log("\n--- [DEBUG LIVE] Rota /start chamada. ---");
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

  // ROTA PARA PARAR A LIVE
  router.post('/stop', authMiddleware, async (req, res) => {
    console.log("\n--- [DEBUG LIVE] Rota /stop chamada. ---");
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
    console.log("\n--- [DEBUG LIVE] Rota /active chamada. ---");
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