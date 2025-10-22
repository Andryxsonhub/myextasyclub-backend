// backend/routes/paymentRoutes.js
// --- ATUALIZADO PARA MERCADOPAGO (COMPRA DE PIMENTAS) ---
// --- ATUALIZAÇÃO v2: Comentado 'auto_return' para aceitar localhost ---

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');

// 1. Importar o SDK do MercadoPago
const { MercadoPagoConfig, Preference } = require('mercadopago');

// 2. Configurar o Cliente com seu Access Token (lido do .env)
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const router = express.Router();

/**
 * GET /api/payments/packages
 * (Esta rota foi mantida, pois busca os pacotes do nosso DB e é útil)
 */
router.get('/packages', authMiddleware, async (_req, res) => {
  try {
    const packages = await prisma.pimentaPackage.findMany({
      orderBy: { priceInCents: 'asc' },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error('Erro ao buscar pacotes:', error);
    res.status(500).json({ message: 'Erro ao buscar pacotes.' });
  }
});

// ===============================================================
// NOVA ROTA PARA CRIAR PAGAMENTO DE PIMENTAS (MERCADOPAGO)
// ===============================================================

/**
 * POST /api/payments/create-pimenta-checkout
 * Body: { packageId: Int }
 * O frontend chama esta rota quando o usuário clica em "comprar".
 */
router.post('/create-pimenta-checkout', authMiddleware, async (req, res) => {
  
  // Linha de teste que podemos remover depois
  console.log('VERIFICANDO A FRONTEND_URL:', process.env.FRONTEND_URL);

  const { packageId } = req.body;
  const userId = req.user.userId; // Vem do authMiddleware

  if (!packageId) {
    return res.status(400).json({ message: 'O ID do pacote é obrigatório.' });
  }

  try {
    // 1. Buscar o usuário e o pacote de pimentas no nosso DB
    const [user, pimentaPackage] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.pimentaPackage.findUnique({ where: { id: Number(packageId) } }),
    ]);

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!pimentaPackage) {
      return res.status(404).json({ message: 'Pacote de pimentas não encontrado.' });
    }

    // 2. Criar a transação "PENDENTE" no nosso banco de dados
    //    Isso é crucial para rastrear o pagamento
    const internalTransaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        productId: pimentaPackage.id,
        productType: 'PIMENTA_PACKAGE',
        productName: pimentaPackage.name,
        amountInCents: pimentaPackage.priceInCents,
        status: 'PENDING',
        // O campo 'mercadopagoPaymentId' ficará nulo por enquanto
      },
    });

    // 3. Preparar a "Preferência de Pagamento" para o MercadoPago
    const preference = new Preference(client);

    const preferenceData = {
      body: {
        items: [
          {
            id: pimentaPackage.id.toString(),
            title: pimentaPackage.name,
            description: `Pacote de ${pimentaPackage.pimentaAmount} pimentas`,
            quantity: 1,
            // O MP espera o preço em 'float' (R$), não centavos.
            unit_price: pimentaPackage.priceInCents / 100,
          },
        ],
        payer: {
          name: user.name,
          email: user.email,
        },
        back_urls: {
          // URLs para onde o usuário será enviado após o pagamento
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso`,
          failure: `${process.env.FRONTEND_URL}/pagamento-falha`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },

        // --- ALTERAÇÃO AQUI ---
        // Comentado pois o MP não aceita 'localhost' com auto_return
        // auto_return: 'approved', 

        // O ID da nossa transação interna. É assim que o webhook
        // saberá qual transação atualizar.
        external_reference: internalTransaction.id,

        // A URL do webhook que o MercadoPago vai chamar
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago`,
      },
    };

    const result = await preference.create(preferenceData);

    // 4. Enviar a URL de checkout de volta para o frontend
    // O frontend vai redirecionar o usuário para este link
    res.status(201).json({
      checkoutUrl: result.init_point,
      transactionId: internalTransaction.id,
    });

  } catch (error) {
    // Tratamento de erro melhorado
    console.error('Erro ao criar checkout MercadoPago:');
    if (error.response) {
      // Erro veio da API do MercadoPago
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      // Erro interno
      console.error(error.message);
    }
    // Retorna a mensagem de erro da API do MP se existir
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar pagamento.';
    res.status(500).json({ message: mpErrorMessage });
  }
});


/*
// ===============================================================
// AS ROTAS ABAIXO FORAM DESATIVADAS (COMENTADAS)
// Elas pertenciam à integração antiga do PagBank.
// ===============================================================

/**
 * POST /api/payments/checkout
 * body: { packageId, method: 'PIX' | 'CREDIT_CARD', card?: {encryptedCard, holderName}, customerTaxId? }
 */
/*
router.post('/checkout', authMiddleware, async (req, res) => {
  // ... (código antigo do pagbank) ...
});
*/

/** Compat: POST /api/payments/create-pix-order */
/*
router.post('/create-pix-order', authMiddleware, async (req, res, next) => {
  // ... (código antigo do pagbank) ...
});
*/

module.exports = router;