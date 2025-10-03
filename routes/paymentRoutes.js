// routes/paymentRoutes.js (CÓDIGO COMPLETO E SIMPLIFICADO)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const axios = require('axios'); // Usaremos o axios para chamar a API do PagBank

const prisma = new PrismaClient();
const router = express.Router();

// Objeto de segurança com os pacotes e preços (em centavos).
const AVAILABLE_PACKAGES = {
    '1000_PIMENTAS': { id: '1000_PIMENTAS', name: 'Pacote 1000 Pimentas', pimentas: 1000, priceInCents: 990 },
    '7500_PIMENTAS': { id: '7500_PIMENTAS', name: 'Pacote 7500 Pimentas', pimentas: 7500, priceInCents: 4999 },
    '15000_PIMENTAS': { id: '15000_PIMENTAS', name: 'Pacote 15000 Pimentas', pimentas: 15000, priceInCents: 9990 },
};

// Endpoint para processar um pagamento de pimentas com CARTÃO DE CRÉDITO
router.post('/payments/process-card', authMiddleware, async (req, res) => {
    // 1. Receber os dados do frontend
    const { packageId, encryptedCard, holderName, holderDocument } = req.body;
    const userId = req.user.userId;

    // 2. Validar se o pacote solicitado existe na nossa lista segura
    const selectedPackage = AVAILABLE_PACKAGES[packageId];
    if (!selectedPackage) {
        return res.status(400).json({ message: 'Pacote inválido ou não encontrado.' });
    }

    // 3. Buscar os dados do usuário logado no banco
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    // 4. Montar o objeto de dados para a API do PagBank
    const pagbankOrderPayload = {
        customer: {
            name: user.name,
            email: user.email,
            tax_id: holderDocument, // CPF do titular do cartão
        },
        items: [{
            name: selectedPackage.name,
            quantity: 1,
            unit_amount: selectedPackage.priceInCents,
        }],
        charges: [{
            amount: {
                value: selectedPackage.priceInCents,
                currency: 'BRL',
            },
            payment_method: {
                type: 'CREDIT_CARD',
                card: {
                    encrypted: encryptedCard, // O "token" do cartão que virá do frontend
                    holder: {
                        name: holderName, // Nome do titular como está no cartão
                    }
                }
            }
        }]
    };

    try {
        // 5. Enviar a requisição para a API do PagBank
        const pagbankResponse = await axios.post(
            'https://sandbox.api.pagseguro.com/orders',
            pagbankOrderPayload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PAGBANK_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const charge = pagbankResponse.data.charges[0];

        // 6. Verificar se o PagBank aprovou o pagamento
        if (charge.status === 'PAID') {
            const [updatedUser] = await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { pimentaBalance: { increment: selectedPackage.pimentas } },
                }),
                prisma.transaction.create({
                    data: {
                        userId: userId,
                        packageId: selectedPackage.id,
                        packageName: selectedPackage.name,
                        pimentaAmount: selectedPackage.pimentas,
                        amountInCents: selectedPackage.priceInCents,
                        pagbankChargeId: charge.id,
                        status: 'PAID',
                    }
                })
            ]);

            return res.status(200).json({ 
                message: 'Pagamento aprovado com sucesso!', 
                newPimentaBalance: updatedUser.pimentaBalance 
            });

        } else {
            return res.status(400).json({ message: `Pagamento não aprovado. Status: ${charge.status}` });
        }

    } catch (error) {
        console.error("Erro ao processar pagamento com PagBank:", error.response?.data || error.message);
        return res.status(500).json({ message: 'Erro de comunicação ao processar o pagamento.' });
    }
});

module.exports = router;