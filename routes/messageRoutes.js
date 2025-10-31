// routes/messageRoutes.js
// --- NOVO ARQUIVO PARA O SISTEMA DE CHAT ---

const express = require('express');
const prisma = require('../lib/prisma');
const { checkAuth, checkMessageQuota } = require('../middleware/authMiddleware');

// Este arquivo, assim como o liveRoutes, precisa do 'io' do Socket.IO
// para enviar mensagens em tempo real.
module.exports = function (io) {
    const router = express.Router();

    // ============================================================
    // 1. ROTA PARA ENVIAR UMA MENSAGEM (A ROTA PRINCIPAL)
    // ============================================================
    router.post(
        '/send',
        checkAuth,          // Porteiro 1: O usuário está logado?
        checkMessageQuota,  // Porteiro 3: O usuário PODE enviar esta msg?
        async (req, res) => {
            
            const authorId = req.user.userId;
            const { receiverId, content } = req.body;

            // --- Validação ---
            if (!receiverId || !content) {
                return res.status(400).json({ message: 'Destinatário e conteúdo são obrigatórios.' });
            }

            const receiverIdNum = parseInt(receiverId, 10);
            if (isNaN(receiverIdNum)) {
                return res.status(400).json({ message: 'ID do destinatário inválido.' });
            }

            if (authorId === receiverIdNum) {
                return res.status(400).json({ message: 'Você não pode enviar uma mensagem para si mesmo.' });
            }

            // --- Lógica de Cobrança e Envio (Transação) ---
            try {
                // Vamos usar uma transação do Prisma. Isso garante que
                // ou a MENSAGEM é criada E a PIMENTA é cobrada, ou NADA acontece.
                // Isso impede que a gente cobre por uma mensagem que falhou.
                
                const operations = [];

                // Operação 1: Sempre criar a mensagem
                const createMessage = prisma.message.create({
                    data: {
                        content: content,
                        authorId: authorId,
                        receiverId: receiverIdNum,
                    },
                    // Incluímos o autor para mandar de volta ao chat (Socket.IO)
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
                operations.push(createMessage);

                let newPimentaBalance = null;

                // Operação 2: Cobrar 1 pimenta (SE o porteiro 3 mandou)
                if (req.messageChargeType === 'pimenta') {
                    console.log(`[Chat] Cobrando 1 pimenta do usuário ${authorId} para enviar mensagem.`);
                    
                    const chargePimenta = prisma.user.update({
                        where: { id: authorId },
                        data: {
                            // Decrementa 1 do saldo. O Prisma é inteligente e
                            // vai falhar se o saldo_pimentas for 0.
                            saldo_pimentas: { decrement: 1 }
                        },
                        select: { saldo_pimentas: true } // Pega o novo saldo
                    });
                    operations.push(chargePimenta);
                }

                // Executa a transação
                const results = await prisma.$transaction(operations);

                // Prepara a resposta
                const newMessage = results[0];
                
                // Pega o novo saldo SÓ SE a pimenta foi cobrada
                if (req.messageChargeType === 'pimenta' && results[1]) {
                    newPimentaBalance = results[1].saldo_pimentas;
                }
                
                // Formata a mensagem para o frontend (incluindo avatar)
                const formattedMessage = {
                    id: newMessage.id,
                    content: newMessage.content,
                    createdAt: newMessage.createdAt,
                    authorId: newMessage.authorId,
                    receiverId: newMessage.receiverId,
                    read: newMessage.read,
                    author: {
                        id: newMessage.author.id,
                        name: newMessage.author.name,
                        profilePictureUrl: newMessage.author.profile?.avatarUrl ?? null
                    }
                };
                
                // --- EMITIR VIA SOCKET.IO (Tempo Real) ---
                // Criamos um nome de sala "privada" para os dois usuários
                const roomName = `chat_${Math.min(authorId, receiverIdNum)}_${Math.max(authorId, receiverIdNum)}`;
                // Emite a mensagem para todos na sala (ou seja, o destinatário)
                io.to(roomName).emit('new_message', formattedMessage);

                // Responde ao REMETENTE via API
                res.status(201).json({
                    message: formattedMessage,
                    newPimentaBalance: newPimentaBalance // Manda o novo saldo para o frontend atualizar
                });

            } catch (error) {
                // Erro mais comum: O usuário não tinha pimentas (saldo_pimentas era 0)
                if (error.code === 'P2025' || (error.meta?.cause && error.meta.cause.includes('constraint'))) {
                     console.warn(`[Chat] Falha na transação. Usuário ${authorId} provavelmente sem pimentas.`);
                     return res.status(403).json({ 
                        message: "Você não tem pimentas suficientes para enviar esta mensagem.",
                        code: "INSUFFICIENT_PIMENTAS"
                     });
                }
                
                console.error("Erro na transação de mensagem:", error);
                res.status(500).json({ message: 'Erro interno ao enviar a mensagem.' });
            }
        }
    );

    // ============================================================
    // 2. ROTA PARA BUSCAR UM HISTÓRICO DE CONVERSA
    // ============================================================
    router.get(
        '/conversation/:otherUserId',
        checkAuth, // Apenas precisa estar logado
        async (req, res) => {
            
            const loggedInUserId = req.user.userId;
            const otherUserId = parseInt(req.params.otherUserId, 10);

            if (isNaN(otherUserId)) {
                return res.status(400).json({ message: 'ID de usuário inválido.' });
            }

            try {
                // 1. Busca todas as mensagens ENTRE estes dois usuários
                const messages = await prisma.message.findMany({
                    where: {
                        OR: [
                            // Mensagens que EU enviei para ELE
                            { authorId: loggedInUserId, receiverId: otherUserId },
                            // Mensagens que ELE enviou para MIM
                            { authorId: otherUserId, receiverId: loggedInUserId }
                        ]
                    },
                    include: {
                        author: { 
                            select: { 
                                id: true, 
                                name: true, 
                                profile: { select: { avatarUrl: true } } 
                            } 
                        }
                    },
                    orderBy: {
                        createdAt: 'asc' // Ordena da mais antiga para a mais nova
                    }
                });

                // 2. "Marcar como Lidas": Assim que eu peço a conversa,
                //    marcamos todas as mensagens que ELE me enviou como 'lidas'.
                //    Fazemos isso em segundo plano (sem "await") para não atrasar a resposta.
                prisma.message.updateMany({
                    where: {
                        authorId: otherUserId,
                        receiverId: loggedInUserId,
                        read: false // Só atualiza as não lidas
                    },
                    data: { read: true }
                }).catch(err => {
                    // Se isso falhar, não é crítico, apenas logamos
                    console.error("Erro ao marcar mensagens como lidas:", err);
                });

                // 3. Formata as mensagens para o frontend
                const formattedMessages = messages.map(msg => ({
                    id: msg.id,
                    content: msg.content,
                    createdAt: msg.createdAt,
                    authorId: msg.authorId,
                    receiverId: msg.receiverId,
                    read: msg.read,
                    author: {
                        id: msg.author.id,
                        name: msg.author.name,
                        profilePictureUrl: msg.author.profile?.avatarUrl ?? null
                    }
                }));
                
                res.status(200).json(formattedMessages);

            } catch (error) {
                console.error("Erro ao buscar conversa:", error);
                res.status(500).json({ message: 'Erro interno ao buscar a conversa.' });
            }
        }
    );

    // (Futuramente: Adicionar rota para 'GET /api/messages/unread-count')
    
    return router;
};