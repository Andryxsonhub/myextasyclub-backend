// myextasyclub-backend/services/pagbankService.js

const axios = require('axios');

const PAGBANK_API_URL = 'https://sandbox.api.pagseguro.com';
const PAGBANK_API_TOKEN = process.env.PAGBANK_API_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

console.log('TOKEN QUE O BACKEND ESTÁ LENDO DO .ENV:', PAGBANK_API_TOKEN);

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
      // --- ALTERAÇÃO AQUI: Adicionamos um CPF de testes ---
      // O CPF precisa ser válido no formato, mas não precisa ser real. Usamos um gerado.
      tax_id: '12345678909' 
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
      amount: { value: transaction.amountInCents },
      expiration_date: new Date(new Date().getTime() + 30 * 60 * 1000).toISOString(), 
    }];
  } 
  else if (paymentDetails.method === 'CREDIT_CARD') {
    // Lógica do cartão (sem alterações)
    if (!paymentDetails.card) {
        throw new Error('Detalhes do cartão são obrigatórios para pagamento com Cartão de Crédito.');
    }
    orderPayload.charges = [{
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
    }];
  } 
  else {
    throw new Error('Método de pagamento inválido. Use "PIX" ou "CREDIT_CARD".');
  }

  try {
    console.log("--- ENVIANDO PARA PAGBANK (SANDBOX) ---");
    console.log(JSON.stringify(orderPayload, null, 2));
    
    const response = await pagbankAPI.post('/orders', orderPayload);
    
    console.log("--- RESPOSTA DO PAGBANK (SANDBOX) ---");
    console.log(JSON.stringify(response.data, null, 2));
    
    const responseForFrontend = {
        ...response.data,
        internalTransactionId: transaction.id
    };
    
    return responseForFrontend;

  } catch (error) {
    console.error("--- ERRO NA API DO PAGBANK (SANDBOX) ---");
    console.error(JSON.stringify(error.response ? error.response.data : error.message, null, 2));
    throw error;
  }
}

module.exports = { createPagBankCharge };