// myextasyclub-backend/routes/paymentRoutes.js

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const pagbankService = require('./pagbankService'); 
const { createPagBankCharge } = pagbankService;

const router = express.Router();
const prisma = new PrismaClient();

// ===================================================================================
// NOVA ROTA GENÉRICA (O FUTURO DO SEU SISTEMA DE PAGAMENTOS)
// ===================================================================================
router.post('/create-order', authMiddleware, async (req, res) => {
    const { productId, productType } = req.body;
    const userId = req.user.userId;

    if (!productId || !productType) {
        return res.status(400).json({ message: 'productId e productType são obrigatórios.' });
    }

    let product;
    try {
        if (productType === 'SUBSCRIPTION') {
            product = await prisma.subscriptionPlan.findUnique({ where: { id: productId } });
        } else if (productType === 'PIMENTA') {
            product = await prisma.pimentaPackage.findUnique({ where: { id: parseInt(productId) } });
        } else {
            return res.status(400).json({ message: 'productType inválido. Use "SUBSCRIPTION" ou "PIMENTA".' });
        }

        if (!product) {
            return res.status(404).json({ message: 'Produto não encontrado.' });
        }
        
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        const transaction = await prisma.transaction.create({
            data: {
                userId: userId,
                productId: productId.toString(),
                productType: productType,
                productName: product.name,
                amountInCents: product.priceInCents,
                status: 'PENDING',
            },
        });

        const pagbankOrder = await createPagBankCharge(transaction, user, req.body);
        
        // No createPagBankCharge, a resposta do pagbank pode não ter o ID no root do objeto.
        // O ID da cobrança normalmente está dentro de `charges`. Vamos assumir o ID do pedido.
        const pagbankId = pagbankOrder.id || (pagbankOrder.charges && pagbankOrder.charges[0].id);

        await prisma.transaction.update({
            where: { id: transaction.id },
            data: { pagbankChargeId: pagbankId },
        });

        // Adicionando nosso ID de transação interno na resposta para o frontend
        const responseForFrontend = {
            ...pagbankOrder,
            internalTransactionId: transaction.id
        };

        res.status(201).json(responseForFrontend);

    } catch (error) {
        console.error("Erro ao criar ordem de pagamento genérica:", error.response ? error.response.data : error.message);
        res.status(500).json({ 
            message: 'Erro interno do servidor.',
            details: error.response ? error.response.data : error.message
        });
    }
});

// ===================================================================================
// <-- ADICIONADO NESTA ETAPA: ROTA PARA VERIFICAR O STATUS DE UMA TRANSAÇÃO
// ===================================================================================
router.get('/payment-status/:transactionId', authMiddleware, async (req, res) => {
    const { transactionId } = req.params;
    const userId = req.user.userId;

    try {
        const transaction = await prisma.transaction.findFirst({
            where: {
                id: transactionId,
                userId: userId, // Garante que o usuário só pode consultar suas próprias transações
            },
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transação não encontrada.' });
        }

        if (transaction.status === 'COMPLETED') {
            return res.status(200).json({ status: 'approved' });
        } else {
            return res.status(200).json({ status: 'pending' });
        }
    } catch (error) {
        console.error("Erro ao verificar status da transação:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// ===================================================================================
// ROTAS ANTIGAS (ESPECÍFICAS PARA PIMENTAS) - MANTIDAS PARA COMPATIBILIDADE
// ⚠️ ATENÇÃO: ESTAS ROTAS VÃO DAR ERRO SE CHAMADAS, POIS O ARQUIVO 'pagbankService.js' MUDOU.
// ===================================================================================
router.post('/create-pix-order', authMiddleware, async (req, res) => {
    const { packageId, holderDocument } = req.body;
    const userId = req.user.userId;
    if (!packageId || !holderDocument) {
        return res.status(400).json({ message: 'O ID do pacote e o documento são obrigatórios.' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const pimentaPackage = await prisma.pimentaPackage.findUnique({ where: { id: packageId } });
        if (!user || !pimentaPackage) {
            return res.status(404).json({ message: 'Usuário ou pacote não encontrado.' });
        }
        const orderPayload = pagbankService.buildBaseOrderPayload(user, pimentaPackage, holderDocument);
        orderPayload.qr_codes = [{ amount: { value: pimentaPackage.priceInCents }, expiration_date: new Date(new Date().getTime() + 30 * 60 * 1000).toISOString() }];
        const pagbankResponse = await pagbankService.createPagbankOrder(orderPayload);
        res.status(201).json(pagbankResponse);
    } catch (error) {
        console.error("Erro ao criar ordem PIX:", error.response ? error.response.data : error.message);
        res.status(500).json({ message: 'Erro interno ao criar ordem PIX.', details: error.response ? error.response.data : error.message });
    }
});

const processCardPayment = async (req, res, cardType) => {
    // SEU CÓDIGO ORIGINAL COMPLETO AQUI
};

router.post('/process-credit-card', authMiddleware, (req, res) => {
    processCardPayment(req, res, 'CREDIT');
});

router.post('/process-debit-card', authMiddleware, (req, res) => {
    processCardPayment(req, res, 'DEBIT');
});

// ===================================================================================
// NOVA ROTA DE WEBHOOK (ESSENCIAL PARA CONFIRMAR PAGAMENTOS)
// ===================================================================================
router.post('/webhook', async (req, res) => {
    const notification = req.body;
    console.log('--- WEBHOOK DO PAGBANK RECEBIDO ---');
    console.log(JSON.stringify(notification, null, 2));
    try {
        const charge = notification.charges[0];
        const transactionId = notification.reference_id;
        const chargeStatus = charge.status;
        if (chargeStatus === 'PAID') {
            const internalTransaction = await prisma.transaction.findFirst({
                where: { id: transactionId, status: 'PENDING' },
            });
            if (internalTransaction) {
                console.log(`Processando transação PENDENTE encontrada: ${internalTransaction.id}`);
                await prisma.$transaction(async (tx) => {
                    if (internalTransaction.productType === 'SUBSCRIPTION') {
                        const plan = await tx.subscriptionPlan.findUnique({ where: { id: internalTransaction.productId } });
                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + plan.durationInDays);
                        await tx.user.update({
                            where: { id: internalTransaction.userId },
                            data: { subscriptionPlanId: plan.id, subscriptionExpiresAt: expiresAt },
                        });
                        console.log(`Plano '${plan.name}' ativado para o usuário ${internalTransaction.userId}.`);
                    } else if (internalTransaction.productType === 'PIMENTA') {
                        const pimentaPackage = await tx.pimentaPackage.findUnique({ where: { id: parseInt(internalTransaction.productId) } });
                        await tx.user.update({
                            where: { id: internalTransaction.userId },
                            data: { pimentaBalance: { increment: pimentaPackage.pimentaAmount } },
                        });
                        console.log(`${pimentaPackage.pimentaAmount} pimentas adicionadas para o usuário ${internalTransaction.userId}.`);
                    }
                    await tx.transaction.update({
                        where: { id: internalTransaction.id },
                        data: { status: 'COMPLETED' },
                    });
                });
            } else {
                console.log(`Transação ${transactionId} não encontrada ou já processada. Ignorando webhook.`);
            }
        }
        res.status(200).send('Webhook recebido com sucesso.');
    } catch (error) {
        console.error('--- ERRO NO PROCESSAMENTO DO WEBHOOK ---', error);
        res.status(200).send('Erro interno, mas webhook recebido.');
    }
});

module.exports = router;