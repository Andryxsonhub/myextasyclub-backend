// backend/routes/liveRoutes.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { AccessToken } = require('livekit-server-sdk');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const prisma = new PrismaClient();

// Puxa as credenciais do LiveKit do arquivo .env
const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const livekitUrl = process.env.LIVEKIT_URL;

// ROTA 1: GERAR O TOKEN DE ACESSO PARA O LIVEKIT
router.get('/token', authMiddleware, (req, res) => {
  // O nome da sala será único para cada usuário (ex: 'user-123')
  const roomName = `user-${req.user.userId}`;
  // O nome do participante será o nome do usuário logado
  const participantName = req.user.name;

  if (!apiKey || !apiSecret || !livekitUrl) {
    console.error('LiveKit API Keys ou URL não configuradas no servidor.');
    return res.status(500).json({ message: 'Configuração do servidor de live incompleta.' });
  }

  // Cria um novo token de acesso
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    // TTL (Time-to-live): Define por quanto tempo o token é válido. 10 minutos.
    ttl: '10m', 
  });

  // Define as permissões do usuário no token
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,      // Permite que o usuário transmita vídeo/áudio
    canSubscribe: true,  // Permite que o usuário assista a outros
  });

  // Retorna o token gerado para o frontend
  console.log(`Token gerado para ${participantName} na sala ${roomName}`);
  res.json({ token: at.toJwt(), roomName: roomName, livekitUrl: livekitUrl });
});

// ROTA 2: INICIAR UMA LIVE (REGISTRAR NO BANCO)
router.post('/start', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const roomName = `user-${userId}`;

    try {
        // Verifica se já não existe uma live para este usuário
        const existingLive = await prisma.live.findUnique({ where: { userId } });
        if (existingLive) {
            return res.status(409).json({ message: 'Você já está em uma live.' });
        }

        // Cria o registro da live no banco de dados
        await prisma.live.create({
            data: {
                userId: userId,
                roomName: roomName,
            }
        });
        console.log(`Live iniciada e registrada para o usuário ${userId}`);
        res.status(201).json({ message: 'Live iniciada com sucesso.' });

    } catch (error) {
        console.error("Erro ao iniciar a live:", error);
        res.status(500).json({ message: 'Erro interno ao iniciar a live.' });
    }
});

// ROTA 3: PARAR UMA LIVE (REMOVER DO BANCO)
router.post('/stop', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    try {
        // Deleta o registro da live do usuário logado
        await prisma.live.delete({ where: { userId } });
        
        console.log(`Live parada e registro removido para o usuário ${userId}`);
        res.status(200).json({ message: 'Live parada com sucesso.' });
    } catch (error) {
        // Prisma lança um erro se não encontrar o registro para deletar, o que é ok.
        console.error("Erro ao parar a live (pode ser que ela já não existisse):", error.code);
        res.status(500).json({ message: 'Erro interno ao parar a live.' });
    }
});


// ROTA 4: LISTAR TODAS AS LIVES ATIVAS
router.get('/active', authMiddleware, async (req, res) => {
    try {
        const activeLives = await prisma.live.findMany({
            // Inclui os dados do usuário que está fazendo a live
            select: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profilePictureUrl: true,
                    }
                }
            }
        });

        // O resultado é um array de { user: { id, name, ... } }. Vamos simplificar.
        const usersInLive = activeLives.map(live => live.user);

        res.status(200).json(usersInLive);
    } catch (error) {
        console.error("Erro ao buscar lives ativas:", error);
        res.status(500).json({ message: 'Erro ao buscar lives ativas.' });
    }
});


module.exports = router;