// backend/webhooks/mercadopagoWebhook.js
// --- VERSÃO DE DEBUG ---
// Adicionamos mais console.logs para investigar por que as pimentas não são creditadas.

const express = require('express');
const prisma = require('../lib/prisma');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});
const payment = new Payment(client);

const router = express.Router();

router.post('/webhook-mercadopago', async (req, res) => {
  console.log('🔔 Webhook MercadoPago Recebido!');

  const notification = req.body;
  console.log('Corpo da Notificação (RAW):', JSON.stringify(notification, null, 2));

  try {
    if (notification.type === 'payment' && notification.data && notification.data.id) {
      const paymentId = notification.data.id;
      console.log(`Notificação para Pagamento ID (MP): ${paymentId}`);

      // --- ETAPA 1: BUSCANDO DADOS DO PAGAMENTO ---
      console.log('...Buscando detalhes do pagamento no MercadoPago...');
      const paymentDetails = await payment.get({ id: paymentId });
      
      console.log('✅ (Etapa 1) Detalhes recebidos do MP.');
      // Vamos logar as partes mais importantes:
      const paymentStatus = paymentDetails.status;
      const externalReference = paymentDetails.external_reference;
      
      console.log('   Status (MP):', paymentStatus); // Ex: 'approved', 'pending'
      console.log('   Referência Externa (Nosso ID):', externalReference);
      console.log('   Valor Pago:', paymentDetails.transaction_amount);


      if (!externalReference) {
        console.warn('❌ (Etapa 1) Pagamento sem "external_reference". Ignorando.');
        return res.status(200).send('OK (sem external_reference)');
      }

      // --- ETAPA 2: BUSCANDO TRANSAÇÃO INTERNA ---
      console.log('...Buscando transação interna no nosso banco...');
      const transaction = await prisma.transaction.findUnique({
        where: { id: externalReference }, // externalReference é o ID da nossa transação
      });

      if (!transaction) {
        console.warn(`❌ (Etapa 2) Transação interna ${externalReference} não encontrada. Ignorando.`);
        return res.status(200).send('OK (transação não encontrada)');
      }

      console.log(`✅ (Etapa 2) Transação interna encontrada. Status atual: ${transaction.status}`);

      // --- ETAPA 3: VERIFICANDO CONDIÇÕES ---
      console.log('...Verificando condições para dar as pimentas...');
      console.log(`Condição 1 (Status MP == 'approved'): ${paymentStatus === 'approved'}`);
      console.log(`Condição 2 (Status Interno == 'PENDING'): ${transaction.status === 'PENDING'}`);

      if (paymentStatus === 'approved' && transaction.status === 'PENDING') {
        console.log('✅ (Etapa 3) Condições VÁLIDAS. Iniciando processo de crédito.');

        // --- ETAPA 4: BUSCANDO PACOTE ---
        console.log('...Buscando pacote de pimentas...');
        const pkg = await prisma.pimentaPackage.findUnique({
          where: { id: transaction.productId },
        });

        if (!pkg) {
          console.error(`❌ (Etapa 4) ERRO CRÍTICO: Pacote ID ${transaction.productId} não encontrado!`);
          return res.status(500).send('Erro interno (pacote não encontrado)');
        }
        console.log(`✅ (Etapa 4) Pacote encontrado: ${pkg.name} (${pkg.pimentaAmount} pimentas).`);

        // --- ETAPA 5: ATUALIZANDO BANCO (TRANSACTION) ---
        console.log('...Iniciando transação do banco de dados (Prisma)...');
        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: 'APPROVED',
              mercadopagoPaymentId: paymentId.toString(),
              updatedAt: new Date(),
            },
          }),
          prisma.user.update({
            where: { id: transaction.userId },
            data: {
              pimentaBalance: {
                increment: pkg.pimentaAmount,
              },
            },
          }),
        ]);
        
        console.log('==================================================================');
        console.log(`✅✅✅ SUCESSO! Transação ${transaction.id} aprovada.`);
        console.log(`   ${pkg.pimentaAmount} pimentas adicionadas ao usuário ${transaction.userId}.`);
        console.log('==================================================================');

      } else if (transaction.status !== 'PENDING') {
         console.log('...Transação interna já foi processada anteriormente. Ignorando.');
      } else {
         console.log('...Status do MP não é "approved". Pagamento pendente ou falhou. Nada a fazer.');
      }

    } else {
      console.log('Tipo de notificação não é "payment". Ignorando.');
    }

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌❌❌ ERRO NO WEBHOOK DO MERCADOPAGO ❌❌❌');
    console.error(error?.response?.data || error.message);
    res.status(500).send('Erro interno no servidor');
  }
});

module.exports = router;