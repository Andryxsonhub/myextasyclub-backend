// routes/pimentaRoutes.js
// --- ★★★ ATUALIZADO (Destaque agora dura 20 MINUTOS) ★★★ ---

const express = require('express');
const prisma = require('../lib/prisma');
const { checkAuth } = require('../middleware/authMiddleware');

module.exports = function (io) {
    const router = express.Router();

    // ===============================================================
    // ROTA 1: Buscar pacotes (OK)
    // ===============================================================
    router.get('/packages', checkAuth, async (req, res) => { 
      try {
        const packages = await prisma.pimentaPackage.findMany({
          orderBy: { priceInCents: 'asc' },
        });
        res.status(200).json(packages);
      } catch (error) {
        console.error('Erro ao buscar pacotes de pimentas:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar pacotes.' });
      }
    });

    // ===============================================================
    // ROTA 2: Transferir pimentas (Dar Presente) (OK)
    // ===============================================================
    router.post('/transferir', checkAuth, async (req, res) => {
        
        const doadorId = req.user.userId;
        const { receptorId, valor, contexto, roomName } = req.body; 

        // --- Validações ---
        const valorInt = parseInt(valor, 10);
        const receptorIdInt = parseInt(receptorId, 10);

        if (!receptorIdInt || !valorInt) {
            return res.status(400).json({ message: 'ID do receptor e valor são obrigatórios.' });
        }
        if (valorInt <= 0) {
            return res.status(400).json({ message: 'O valor da transferência deve ser positivo.' });
        }
        if (doadorId === receptorIdInt) {
            return res.status(400).json({ message: 'Você não pode transferir pimentas para si mesmo.' });
        }

        try {
            // --- TRANSAÇÃO SEGURA ---
            const [doador, receptor] = await prisma.$transaction(async (tx) => {
                
                // 1. Debita (Tira) pimentas do Doador
                const doadorUpdate = await tx.user.update({
                    where: { 
                        id: doadorId,
                        pimentaBalance: { gte: valorInt } // Garante saldo
                    },
                    data: {
                        pimentaBalance: { decrement: valorInt }
                    },
                    select: { id: true, pimentaBalance: true } 
                });

                // 2. Credita (Dá) pimentas ao Receptor
                const receptorUpdate = await tx.user.update({
                    where: { id: receptorIdInt },
                    data: {
                        pimentaBalance: { increment: valorInt }
                    },
                    select: { id: true, pimentaBalance: true } 
                });

                // 3. Registra no Extrato (Doador)
                await tx.extratoPimentas.create({
                    data: {
                        userId: doadorId,
                        valor: -valorInt, 
                        contexto: contexto || 'presente_enviado',
                        userAlvoId: receptorIdInt
                    }
                });

                // 4. Registra no Extrato (Receptor)
                await tx.extratoPimentas.create({
                    data: {
                        userId: receptorIdInt,
                        valor: valorInt, 
                        contexto: 'presente_recebido',
                        userAlvoId: doadorId
                    }
                });

                return [doadorUpdate, receptorUpdate];
            });

            // 5. EMITIR SINAL DO SOCKET (OK)
            if (io && roomName && contexto === 'presente_live') {
                const payload = {
                    userId: receptor.id,              
                    newBalance: receptor.pimentaBalance 
                };
                io.to(roomName).emit('balance_updated', payload);
                console.log(`[Socket Backend] Evento 'balance_updated' emitido para a sala ${roomName}`, payload);
            }

            // Resposta para o DOADOR
            res.status(200).json({
                message: `Transferência de ${valorInt} pimentas concluída!`,
                novoSaldoDoador: doador.pimentaBalance
            });

        } catch (error) {
            // Saldo insuficiente
            if (error.code === 'P2025') {
                console.warn(`[Pimentas] Falha na transferência. Usuário ${doadorId} sem saldo.`);
                return res.status(403).json({ 
                    message: "Saldo de pimentas insuficiente.",
                    code: "INSUFFICIENT_PIMENTAS"
                });
            }
            
            console.error("Erro na transferência de pimentas:", error);
            res.status(500).json({ message: 'Erro interno ao processar a transferência.' });
        }
    });

    // ===============================================================
    // ★★★ ROTA 3: COMPRAR DESTAQUE (20 MINUTOS) ★★★
    // ===============================================================
    router.post('/comprar-destaque', checkAuth, async (req, res) => {
        const userId = req.user.userId;
        const destaqueCost = 300; // Custo de 300 pimentas
        
        // ★★★ CORREÇÃO AQUI ★★★
        const destaqueDurationMinutos = 20; // Duração de 20 minutos
        // ★★★ FIM DA CORREÇÃO ★★★

        try {
            const agora = new Date();
            
            // ★★★ CORREÇÃO AQUI ★★★
            const dataExpiracao = new Date(agora.getTime() + destaqueDurationMinutos * 60 * 1000); // 20 minutos * 60s * 1000ms
            // ★★★ FIM DA CORREÇÃO ★★★

            // Transação segura: debita E define a data de expiração
            const [updatedUser] = await prisma.$transaction(async (tx) => {
                // 1. Debita as pimentas E atualiza o destaque
                const user = await tx.user.update({
                    where: {
                        id: userId,
                        pimentaBalance: { gte: destaqueCost } // Garante que tem saldo
                    },
                    data: {
                        pimentaBalance: { decrement: destaqueCost },
                        destacadoAte: dataExpiracao // Define a data de expiração
                    },
                    select: { pimentaBalance: true, destacadoAte: true }
                });

                // 2. Registra no extrato
                await tx.extratoPimentas.create({
                    data: {
                        userId: userId,
                        valor: -destaqueCost, // Gasto
                        contexto: 'compra_destaque_perfil',
                        userAlvoId: userId // Ação em si mesmo
                    }
                });

                return [user];
            });

            // Sucesso!
            res.status(200).json({
                message: 'Destaque comprado com sucesso!',
                novoSaldo: updatedUser.pimentaBalance,
                destacadoAte: updatedUser.destacadoAte
            });

        } catch (error) {
            // Saldo insuficiente
            if (error.code === 'P2025') {
                console.warn(`[Destaque] Falha na compra. Usuário ${userId} sem saldo.`);
                return res.status(403).json({ 
                    message: "Saldo de pimentas insuficiente.",
                    code: "INSUFFICIENT_PIMENTAS"
                });
            }
            
            console.error("Erro ao comprar destaque:", error);
            res.status(500).json({ message: 'Erro interno ao processar a compra.' });
        }
    });

    return router;
};