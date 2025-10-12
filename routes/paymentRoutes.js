// backend/routes/paymentRoutes.js (VERSÃO DEFINITIVA COM TOKENS CORRETOS)

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const axios = require('axios');
const qs = require('querystring');

const router = express.Router();

// Lendo TODAS as credenciais do PagBank a partir do .env
const BASE_URL = process.env.BASE_URL || "https://seu-servidor.com";
const PAGBANK_EMAIL = process.env.PAGBANK_EMAIL;
const PAGBANK_APP_TOKEN = process.env.PAGBANK_APP_TOKEN;     // Token para PIX
const PAGBANK_SELLER_TOKEN = process.env.PAGBANK_SELLER_TOKEN; // Token para Cartão (Direct Payment)
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Rota 1: Listar pacotes
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
      customer: { name: user.name, email: user.email, tax_id: '12345678909' },
      items: [{ name: pimentaPackage.name, quantity: 1, unit_amount: pimentaPackage.priceInCents }],
      qr_codes: [{ amount: { value: pimentaPackage.priceInCents }, expiration_date: new Date(new Date().getTime() + 30 * 60 * 1000).toISOString() }],
      notification_urls: [`${BASE_URL}/api/payments/webhook`],
    };

    const ORDERS_API_URL = 'https://sandbox.api.pagseguro.com';

    const response = await axios.post(`${ORDERS_API_URL}/orders`, orderData, {
      headers: {
        // CORREÇÃO: Usando o Token de Aplicação (APP_TOKEN) para a API de Ordens
        'Authorization': `Bearer ${PAGBANK_APP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const pagbankOrder = response.data;
    
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
    console.error("Erro ao criar ordem PIX no PagBank:", error);
    res.status(500).json({ message: 'Erro ao se comunicar com o provedor de pagamento.' });
  }
});

// ROTA 3: Processar Cartão com a API Direct Payment
router.post('/process-card-v2', authMiddleware, async (req, res) => {
    const { packageId, cardToken, senderHash, holderName, holderDocument } = req.body;
    const userId = req.user.userId;

    try {
        const selectedPackage = await prisma.pimentaPackage.findUnique({ where: { id: packageId } });
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!selectedPackage || !user) {
            return res.status(404).json({ message: 'Usuário ou pacote não encontrado.' });
        }

        const paymentPayload = {
            paymentMode: 'default',
            paymentMethod: 'creditCard',
            receiverEmail: PAGBANK_EMAIL,
            currency: 'BRL',
            itemId1: selectedPackage.id,
            itemDescription1: selectedPackage.name,
            itemAmount1: (selectedPackage.priceInCents / 100).toFixed(2),
            itemQuantity1: 1,
            senderName: holderName,
            senderCPF: holderDocument,
            senderEmail: user.email,
            senderHash: senderHash,
            creditCardToken: cardToken,
            installmentQuantity: 1,
            installmentValue: (selectedPackage.priceInCents / 100).toFixed(2),
            noInterestInstallmentQuantity: 1,
            creditCardHolderName: holderName,
            creditCardHolderCPF: holderDocument,
        };

        const DIRECT_PAYMENT_API_URL = 'https://ws.sandbox.pagseguro.uol.com.br';

        const response = await axios.post(
            // CORREÇÃO: Usando o Token de Vendedor (SELLER_TOKEN) para a API Direct Payment
            `${DIRECT_PAYMENT_API_URL}/v2/transactions?email=${PAGBANK_EMAIL}&token=${PAGBANK_SELLER_TOKEN}`,
            qs.stringify(paymentPayload),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const transaction = response.data;
        const status = transaction.transaction ? transaction.transaction.status : transaction.status;

        if (status === '3' || status === '4') {
             const updatedUser = await prisma.user.update({
                where: { id: userId },
                data: { pimentaBalance: { increment: selectedPackage.pimentaAmount } },
            });
            return res.status(200).json({ newPimentaBalance: updatedUser.pimentaBalance });
        } else {
             return res.status(400).json({ message: `Pagamento não aprovado. Status: ${status}` });
        }
    } catch (error) {
        console.error("Erro na transação Direct Payment:", error.response?.data?.errors || error.message);
        return res.status(500).json({ message: 'Erro ao processar pagamento.' });
    }
});

module.exports = router;