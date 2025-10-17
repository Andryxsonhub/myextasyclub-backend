// services/pagbankService.js — PROD/SANDBOX, PIX via qr_codes, Cartão via charges

const axios = require('axios');
const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

const BASE_URL = isProduction
  ? (process.env.PAGBANK_PROD_URL || 'https://api.pagseguro.com')
  : (process.env.PAGBANK_API_URL || 'https://sandbox.api.pagseguro.com');

const AUTH_TOKEN = isProduction
  ? process.env.PAGBANK_PROD_TOKEN
  : process.env.PAGBANK_API_TOKEN;

if (!AUTH_TOKEN) {
  throw new Error('[PagBank] Token do ambiente não encontrado.');
}

const WEBHOOK_URL = process.env.WEBHOOK_URL;
if (!WEBHOOK_URL) {
  throw new Error('[PagBank] WEBHOOK_URL não configurada.');
}

const pagbankAPI = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const newIdemKey = () => crypto.randomUUID();

/**
 * transaction: { id, productName, amountInCents }
 * user: { name, email, taxId }   // taxId deve vir sem máscaras (somente dígitos) em produção
 * paymentDetails: { method: 'PIX' | 'CREDIT_CARD', card?: { encryptedCard, holderName } }
 */
async function createPagBankCharge(transaction, user, paymentDetails) {
  const taxId =
    isProduction
      ? (user.taxId ? String(user.taxId).replace(/\D/g, '') : undefined)
      : '12345678909'; // sandbox aceita CPF dummy

  const baseOrder = {
    reference_id: String(transaction.id),
    customer: {
      name: user.name,
      email: user.email,
      ...(taxId ? { tax_id: taxId } : {}), // PRODUÇÃO precisa existir
    },
    items: [
      {
        name: transaction.productName,
        quantity: 1,
        unit_amount: Number(transaction.amountInCents),
      },
    ],
    notification_urls: [WEBHOOK_URL],
  };

  let orderPayload;

  if (paymentDetails.method === 'PIX') {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    orderPayload = {
      ...baseOrder,
      qr_codes: [
        {
          amount: { value: Number(transaction.amountInCents) },
          expiration_date: expiresAt,
        },
      ],
    };
  } else if (paymentDetails.method === 'CREDIT_CARD') {
    if (!paymentDetails.card?.encryptedCard || !paymentDetails.card?.holderName) {
      throw new Error('Cartão inválido: encryptedCard e holderName são obrigatórios.');
    }
    orderPayload = {
      ...baseOrder,
      charges: [
        {
          reference_id: `cc-${transaction.id}`,
          amount: { value: Number(transaction.amountInCents), currency: 'BRL' },
          payment_method: {
            type: 'CREDIT_CARD',
            installments: 1,
            capture: true,
            card: {
              encrypted: paymentDetails.card.encryptedCard,
              holder: { name: paymentDetails.card.holderName },
            },
          },
        },
      ],
    };
  } else {
    throw new Error('Método de pagamento inválido. Use "PIX" ou "CREDIT_CARD".');
  }

  try {
    console.info('PAGBANK_REQ', {
      env: isProduction ? 'PROD' : 'SANDBOX',
      hasQr: !!orderPayload.qr_codes,
      hasCharges: !!orderPayload.charges,
      reference: baseOrder.reference_id,
    });

    const res = await pagbankAPI.post('/orders', orderPayload, {
      headers: { 'Idempotency-Key': newIdemKey() },
    });

    const data = res.data;
    const orderId = data?.id;
    const chargeId = data?.charges?.[0]?.id;

    console.info('PAGBANK_RES', {
      env: isProduction ? 'PROD' : 'SANDBOX',
      orderId,
      chargeId,
      status: data?.charges?.[0]?.status,
      hasQr: !!data?.qr_codes,
    });

    return { ...data, internalTransactionId: transaction.id };
  } catch (err) {
    const payload = err.response?.data || err.message;
    console.error('PAGBANK_ERR', payload);
    throw err;
  }
}

module.exports = { createPagBankCharge };
