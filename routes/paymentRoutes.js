// backend/routes/paymentRoutes.js (VERSÃO FINAL COM CORREÇÃO DE PARCELAS)

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const axios = require('axios');

const router = express.Router();
const prisma = new PrismaClient();

// SOLUÇÃO TEMPORÁRIA: Colando a URL do ngrok diretamente aqui
const NGROK_URL = "https://6495c71fff12.ngrok-free.app"; 

const PAGBANK_API_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_TOKEN = process.env.PAGBANK_TOKEN;

// ROTA 1: Listar pacotes
router.get('/packages', authMiddleware, async (req, res) => {
  try {
    const packages = await prisma.pimentaPackage.findMany({
      orderBy: { priceInCents: 'asc' },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error("Erro ao buscar pacotes de pimentas:", error);
    res.status(500).json({ message: 'Erro ao buscar pacotes.' });
  }
});

// ROTA 2: Criar ordem PIX
router.post('/create-pix-order', authMiddleware, async (req, res) => {
  const { packageId } = req.body;
  const userId = req.user.userId;

  if (!packageId) {
    return res.status(400).json({ message: 'O ID do pacote é obrigatório.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const pimentaPackage = await prisma.pimentaPackage.findUnique({ where: { id: packageId } });

    if (!user || !pimentaPackage) {
      return res.status(404).json({ message: 'Usuário ou pacote não encontrado.' });
    }

    const orderData = {
      customer: {
        name: user.name,
        email: user.email,
        tax_id: '12345678909',
      },
      items: [{
        name: pimentaPackage.name,
        quantity: 1,
        unit_amount: pimentaPackage.priceInCents,
      }],
      qr_codes: [{
        amount: { value: pimentaPackage.priceInCents },
        expiration_date: new Date(new Date().getTime() + 30 * 60 * 1000).toISOString(),
      }],
      notification_urls: [`${NGROK_URL}/api/payments/webhook`],
    };

    console.log("\n\n--- [INÍCIO LOG HOMOLOGAÇÃO PIX] ---");
    console.log("REQUEST ENVIADO PARA PAGBANK (PIX):");
    console.log(JSON.stringify(orderData, null, 2));

    const response = await axios.post(`${PAGBANK_API_URL}/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${PAGBANK_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const pagbankOrder = response.data;
    
    console.log("\nRESPONSE RECEBIDO DO PAGBANK (PIX):");
    console.log(JSON.stringify(pagbankOrder, null, 2));
    console.log("--- [FIM LOG HOMOLOGAÇÃO PIX] ---\n\n");

    await prisma.transaction.create({
      data: {
        pagbankChargeId: pagbankOrder.charges[0].id,
        userId: user.id,
        packageId: String(pimentaPackage.id),
        packageName: pimentaPackage.name,
        pimentaAmount: pimentaPackage.pimentaAmount,
        amountInCents: pimentaPackage.priceInCents,
        status: 'PENDING',
      }
    });

    res.status(201).json(pagbankOrder);

  } catch (error) {
    console.error("Erro ao criar ordem PIX no PagBank:", error.response ? error.response.data.error_messages : error.message);
    res.status(500).json({ message: 'Erro ao se comunicar com o provedor de pagamento.' });
  }
});

// ROTA 3: Cartão de Crédito
router.post('/process-card', authMiddleware, async (req, res) => {
    const { packageId, encryptedCard, holderName, holderDocument } = req.body;
    const userId = req.user.userId;

    const selectedPackage = await prisma.pimentaPackage.findUnique({ where: { id: packageId } });
    if (!selectedPackage) {
        return res.status(400).json({ message: 'Pacote inválido ou não encontrado.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const pagbankOrderPayload = {
        customer: {
            name: user.name,
            email: user.email,
            tax_id: holderDocument,
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
                installments: 1, // <-- CAMPO CORRIGIDO
                capture: true,   // <-- CAMPO CORRIGIDO
                card: {
                    encrypted: encryptedCard,
                    holder: { name: holderName }
                }
            }
        }]
    };

    try {
        console.log("\n\n--- [INÍCIO LOG HOMOLOGAÇÃO CARTÃO] ---");
        console.log("REQUEST ENVIADO PARA PAGBANK (CARTÃO):");
        console.log(JSON.stringify(pagbankOrderPayload, null, 2));

        const pagbankResponse = await axios.post(
            `${PAGBANK_API_URL}/orders`,
            pagbankOrderPayload,
            {
                headers: {
                    'Authorization': `Bearer ${PAGBANK_TOKEN}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        
        console.log("\nRESPONSE RECEBIDO DO PAGBANK (CARTÃO):");
        console.log(JSON.stringify(pagbankResponse.data, null, 2));
        console.log("--- [FIM LOG HOMOLOGAÇÃO CARTÃO] ---\n\n");

        const charge = pagbankResponse.data.charges[0];

        if (charge.status === 'PAID') {
            const [updatedUser] = await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { pimentaBalance: { increment: selectedPackage.pimentaAmount } },
                }),
                prisma.transaction.create({
                    data: {
                        userId: userId,
                        packageId: String(selectedPackage.id),
                        packageName: selectedPackage.name,
                        pimentaAmount: selectedPackage.pimentaAmount,
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