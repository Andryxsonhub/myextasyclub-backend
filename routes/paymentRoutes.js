// backend/routes/paymentRoutes.js (COM VERIFICAÇÃO DE STATUS)

const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const authMiddleware = require('../middleware/authMiddleware');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

// Rota para CRIAR um pagamento (já existente)
router.post('/create-payment', authMiddleware, async (req, res) => {
  const { planName, price } = req.body;
  const userId = req.user.userId;

  if (!planName || !price) {
    return res.status(400).json({ error: 'Nome do plano e preço são obrigatórios.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const paymentInstance = new Payment(client);
    const payment_data = {
      body: {
        transaction_amount: Number(price),
        description: `Assinatura do plano: ${planName}`,
        payment_method_id: 'pix',
        payer: { email: user.email, first_name: user.name },
      }
    };

    const result = await paymentInstance.create(payment_data);
    const pixData = result.point_of_interaction.transaction_data;

    res.status(201).json({
      paymentId: result.id,
      qrCodeBase64: pixData.qr_code_base64,
      qrCode: pixData.qr_code,
    });
  } catch (error) {
    console.error('Erro ao criar pagamento PIX:', error);
    res.status(500).json({ error: 'Falha ao gerar o pagamento.' });
  }
});


// ==========================================================
//   !!! ROTA NOVA !!! - PARA VERIFICAR O STATUS DO PAGAMENTO
// ==========================================================
router.get('/payment-status/:paymentId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Cria uma instância de pagamento e usa o método 'get' para buscar os dados
    const paymentInstance = new Payment(client);
    const payment = await paymentInstance.get({ id: paymentId });

    // Envia o status do pagamento de volta para o frontend
    res.status(200).json({ status: payment.status });

  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    res.status(500).json({ error: 'Falha ao verificar o status.' });
  }
});


module.exports = router;

