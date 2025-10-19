// myextasyclub-backend/services/pagbankService.js
// --- CÓDIGO COMPLETO E CORRIGIDO ---

const axios = require('axios');

// CORREÇÃO 1: Forçando o uso das variáveis de PRODUCÃO
const PAGBANK_API_URL = process.env.PAGBANK_PROD_URL || 'https://api.pagseguro.com';
const PAGBANK_API_TOKEN = process.env.PAGBANK_PROD_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Log para confirmar que o token de PRODUÇÃO está sendo lido
console.log('TOKEN DE PRODUÇÃO LIDO PELO BACKEND:', PAGBANK_API_TOKEN ? 'Token Carregado' : 'ERRO: Token não encontrado');

const pagbankAPI = axios.create({
  baseURL: PAGBANK_API_URL,
  headers: {
    'Authorization': `Bearer ${PAGBANK_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function createPagBankCharge(transaction, user, paymentDetails) {
  const orderPayload = {
    reference_id: transaction.id,
    customer: {
      name: user.name,
      email: user.email,
      tax_id: '32516183852' // Usando CPF genérico para o teste
    },
    items: [
      {
        name: transaction.productName,
        quantity: 1,
        unit_amount: transaction.amountInCents,
      },
    ],
    notification_urls: [WEBHOOK_URL],
  };

  if (paymentDetails.method === 'PIX') {
    orderPayload.qr_codes = [{
      amount: {
        value: transaction.amountInCents,
        currency: 'BRL' // <-- CORREÇÃO 2: Adicionando currency
      },
      expiration_date: new Date(new Date().getTime() + 30 * 60 * 1000).toISOString(),
    }];
  }
  else if (paymentDetails.method === 'CREDIT_CARD') {
    if (!paymentDetails.card) {
      throw new Error('Detalhes do cartão são obrigatórios para pagamento com Cartão de Crédito.');
    }
    orderPayload.charges = [{
      amount: {
        value: transaction.amountInCents,
        currency: 'BRL' // <-- CORREÇÃO 3: Adicionando currency
      },
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
    }];
  }
  else {
    throw new Error('Método de pagamento inválido. Use "PIX" ou "CREDIT_CARD".');
  }

  try {
    // CORREÇÃO 4: Alterando logs para refletir o ambiente de PRODUÇÃO
    console.log("--- ENVIANDO PARA PAGBANK (PRODUÇÃO) ---");
    console.log(JSON.stringify(orderPayload, null, 2));

    const response = await pagbankAPI.post('/orders', orderPayload);

    console.log("--- RESPOSTA DO PAGBANK (PRODUÇÃO) ---");
    console.log(JSON.stringify(response.data, null, 2));

    const responseForFrontend = {
      ...response.data,
      internalTransactionId: transaction.id
    };

    return responseForFrontend;

  } catch (error) {
    // CORREÇÃO 5: Alterando logs de erro para refletir o ambiente de PRODUÇÃO
    console.error("--- ERRO NA API DO PAGBANK (PRODUÇÃO) ---");
    console.error(JSON.stringify(error.response ? error.response.data : error.message, null, 2));
    throw error;
  }
}

module.exports = { createPagBankCharge };