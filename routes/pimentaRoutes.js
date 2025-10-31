// routes/pimentaRoutes.js
// --- ATUALIZADO (Adiciona a Rota POST /transferir) ---

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
// Importa o porteiro (vamos proteger a rota de 'packages' também)
const { checkAuth } = require('../middleware/authMiddleware'); 

// ===============================================================
// ROTA 1: Buscar todos os pacotes de pimentas (Protegida)
// ===============================================================
// GET /api/pimentas/packages
router.get('/packages', checkAuth, async (req, res) => { // Protegida por checkAuth
  try {
    const packages = await prisma.pimentaPackage.findMany({
      orderBy: {
        priceInCents: 'asc', // Ordena do mais barato para o mais caro
      },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error('Erro ao buscar pacotes de pimentas:', error);
    res.status(500).json({ message: 'Erro interno do servidor ao buscar pacotes.' });
  }
});

// ===============================================================
// ROTA 2: Transferir pimentas (Dar Presente / Gorjeta) (NOVA)
// ===============================================================
// POST /api/pimentas/transferir
router.post('/transferir', checkAuth, async (req, res) => {
    
    const doadorId = req.user.userId;
    const { receptorId, valor, contexto } = req.body; // ex: contexto: 'presente_live'

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
        // Isso garante que ou TUDO funciona (debita, credita, registra) ou NADA funciona.
        
        const [doador, receptor] = await prisma.$transaction(async (tx) => {
            
            // 1. Debita (Tira) pimentas do Doador
            // (Usando 'pimentaBalance' do seu schema)
            const doadorUpdate = await tx.user.update({
                where: { 
                    id: doadorId,
                    pimentaBalance: { gte: valorInt } // Garante que ele tem saldo ANTES de debitar
                },
                data: {
                    pimentaBalance: { decrement: valorInt }
                },
                select: { id: true, pimentaBalance: true } // Retorna o novo saldo
            });

            // Se o 'update' falhou (pq não tinha saldo), o Prisma dá um erro
            // que será pego pelo 'catch' lá embaixo (P2025)

            // 2. Credita (Dá) pimentas ao Receptor
            const receptorUpdate = await tx.user.update({
                where: { id: receptorIdInt },
                data: {
                    pimentaBalance: { increment: valorInt }
                }
            });

            // 3. Registra no Extrato (para o Doador)
            // (Usando o 'ExtratoPimentas' que criamos no schema)
            await tx.extratoPimentas.create({
                data: {
                    userId: doadorId,
                    valor: -valorInt, // Valor negativo (gasto)
                    contexto: contexto || 'presente_enviado', // 'presente_live', 'destaque_comentario', etc.
                    userAlvoId: receptorIdInt
                }
            });

            // 4. Registra no Extrato (para o Receptor)
            await tx.extratoPimentas.create({
                data: {
                    userId: receptorIdInt,
                    valor: valorInt, // Valor positivo (ganho)
                    contexto: 'presente_recebido',
                    userAlvoId: doadorId
                }
            });

            return [doadorUpdate, receptorUpdate];
        });

        // Se a transação foi um sucesso
        res.status(200).json({
            message: `Transferência de ${valorInt} pimentas concluída!`,
            novoSaldoDoador: doador.pimentaBalance
        });

    } catch (error) {
        // Erro P2025: Ocorre se o 'where' do 'update' do doador falhar
        // (ou seja, ele não tinha pimentas suficientes)
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

module.exports = router;

