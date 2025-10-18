// backend/services/pagbankService.js
const axios = require('axios');

const isProduction = process.env.NODE_ENV === 'production';

const baseURL = isProduction
  ? (process.env.PAGBANK_PROD_URL || 'https://api.pagseguro.com')
  : (process.env.PAGBANK_API_URL || 'https://sandbox.api.pagseguro.com');

const authToken = isProduction
  ? process.env.PAGBANK_PROD_TOKEN
  : process.env.PAGBANK_API_TOKEN;

const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log(`AMBIENTE ATUAL: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
console.log('TOKEN QUE O BACKEND ESTÁ USANDO:', authToken ? 'Token Carregado' : 'ERRO: TOKEN NÃO ENCONTRADO');

const pagbankAPI = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  },
});

/**
 * createPagBankCharge(transaction, user, paymentDetails)
 * - PIX: cria order com qr_codes
 * - CREDIT_CARD: cria order com charges[0].payment_method.type='CREDIT_CARD'
 */
async function createPagBankCharge(transaction, user, paymentDetails) {
  const orderPayload = {
    reference_id: transaction.id,
    customer: {
      name: user.name,
      email: user.email,
      // CPF/CNPJ — OBRIGATÓRIO em produção
      tax_id: user.taxId || undefined,
    },
    items: [
      {
        name: transaction.productName,
        quantity: 1,
        unit_amount: transaction.amountInCents,
      },
    ],
    notification_urls: WEBHOOK_URL ? [WEBHOOK_URL] : [],
  };

  if (paymentDetails.method === 'PIX') {
    orderPayload.qr_codes = [
      {
        amount: { value: transaction.amountInCents },
        expiration_date: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      },
    ];
  } else if (paymentDetails.method === 'CREDIT_CARD') {
    if (!paymentDetails.card?.encryptedCard) {
      throw new Error('Detalhes do cartão ausentes.');
    }
    orderPayload.charges = [
      {
        amount: { value: transaction.amountInCents },
        payment_method: {
          type: 'CREDIT_CARD',
          installments: 1,
          capture: true,
          card: {
            encrypted: paymentDetails.card.encryptedCard,
            holder: {
              name: paymentDetails.card.holderName,
            },
          },
        },
      },
    ];
  } else {
    throw new Error('Método de pagamento inválido. Use "PIX" ou "CREDIT_CARD".');
  }

  try {
    console.log(`--- ENVIANDO PARA PAGBANK (${isProduction ? 'PRODUÇÃO' : 'SANDBOX'}) ---`);
    console.log(JSON.stringify(orderPayload, null, 2));

    const response = await pagbankAPI.post('/orders', orderPayload);

    console.log(`--- RESPOSTA DO PAGBANK (${isProduction ? 'PRODUÇÃO' : 'SANDBOX'}) ---`);
    console.log(JSON.stringify(response.data, null, 2));

    return {
      ...response.data,
      internalTransactionId: transaction.id,
    };
  } catch (error) {
    console.error(`--- ERRO NA API DO PAGBANK (${isProduction ? 'PRODUÇÃO' : 'SANDBOX'}) ---`);
    console.error(JSON.stringify(error.response ? error.response.data : error.message, null, 2));
    throw error;
  }
}

module.exports = { createPagBankCharge };
