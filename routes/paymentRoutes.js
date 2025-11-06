// backend/routes/paymentRoutes.js
// --- ATUALIZADO (Adicionado DEBUG V3 dentro do IF 'mensal') ---

const express = require('express');
const prisma = require('../lib/prisma');
const { checkAuth } = require('../middleware/authMiddleware');

const { MercadoPagoConfig, Preference, PreApproval } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const preapproval = new PreApproval(client);
const preference = new Preference(client);

const router = express.Router();

// ===============================================================
// ROTA PARA BUSCAR PACOTES DE PIMENTA
// ===============================================================
router.get('/packages', checkAuth, async (_req, res) => {
  try {
    const packages = await prisma.pimentaPackage.findMany({
      orderBy: { priceInCents: 'asc' },
    });
    res.status(200).json(packages);
  } catch (error) {
    console.error('Erro ao buscar pacotes de pimenta:', error);
    res.status(500).json({ message: 'Erro ao buscar pacotes de pimenta.' });
  }
});

// ===============================================================
// ROTA PARA CRIAR PAGAMENTO DE PIMENTAS (Checkout Pro)
// ===============================================================
router.post('/create-pimenta-checkout', checkAuth, async (req, res) => {
  const { packageId } = req.body;
  const userId = req.user.userId;
  try {
    const tokenInUse = process.env.MERCADOPAGO_ACCESS_TOKEN;
    // console.log('===============================================================');
    // console.log('[MERCADOPAGO - PIMENTA] DEBUG DO TOKEN EM USO (DO ENV):');
    // console.log(`Token: ${tokenInUse ? tokenInUse.slice(0, 15) + '...' + tokenInUse.slice(-4) : 'NENHUM TOKEN NO ENV'}`);
    // console.log('===============================================================');
    const [user, pimentaPackage] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.pimentaPackage.findUnique({ where: { id: Number(packageId) } }),
    ]);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!pimentaPackage) {
      return res.status(404).json({ message: 'Pacote de pimentas não encontrado.' });
    }
    const internalTransaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        productId: pimentaPackage.id,
        productType: 'PIMENTA_PACKAGE',
        productName: pimentaPackage.name,
        amountInCents: pimentaPackage.priceInCents,
        status: 'PENDING',
      },
    });
    const isTestUser = user.email.endsWith('@testuser.com');
    const payerName = isTestUser ? "Usuário Teste" : (user.name || `Usuário ${user.id}`);
    const preferenceData = {
      body: {
        items: [
          {
            id: pimentaPackage.id.toString(),
            title: pimentaPackage.name,
            description: `Pacote de ${pimentaPackage.pimentaAmount} pimentas`,
            quantity: 1,
            unit_price: pimentaPackage.priceInCents / 100,
          },
        ],
        payer: {
          name: payerName,
          email: user.email,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=pimenta`,
          failure: `${process.env.FRONTEND_URL}/pagamento-falha`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },
        external_reference: internalTransaction.id,
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago`,
      },
    };
    const result = await preference.create(preferenceData);
    res.status(201).json({
      checkoutUrl: result.init_point,
      transactionId: internalTransaction.id,
    });
  } catch (error) {
    console.error('[MERCADOPAGO - PIMENTA] ERRO AO CRIAR CHECKOUT:', error);
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar pagamento.';
    res.status(500).json({ message: mpErrorMessage });
  }
});


// ===============================================================
// ROTA PARA BUSCAR PLANOS DE ASSINATURA (COM DEBUG V3)
// ===============================================================
router.get('/subscription-plans', checkAuth, async (_req, res) => {

  console.log('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  console.log('!!! DEBUG V3: ROTA /subscription-plans FOI CHAMADA !!!');
  console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');

  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInCents: 'asc' },
    });

    const plansWithFeatures = plans.map(plan => {
      const planNameLower = plan.name.toLowerCase();
      let features = [];
      let durationInDays = 0;
      let isRecommended = false;
      let isBlackFriday = false;
      let oldPrice = null;

      if (planNameLower.includes('semanal')) {
        features = [
          "Ver perfis completos",
          "Fotos Ilimitadas",
          "Enviar 10 mensagens por dia",
          "Acesso a galerias públicas",
          "Suporte via e-mail"
        ];
        durationInDays = 7;
      } else if (planNameLower.includes('mensal')) {
        features = [
          "Todos os benefícios do Semanal",
          "Mensagens ilimitadas",
          "Oportunidade de migração de plano com desconto",
          "Chance de participar de sorteios futuros",
          "Participar de lives exclusivas"
        ];
        durationInDays = 30;
        isRecommended = true; 
        isBlackFriday = true; // <-- DESCOMENTADO
        oldPrice = "39,90";    // <-- DESCOMENTADO
        
        // --- ★★★ NOVO DEBUG AQUI ★★★ ---
        console.log('!!! DEBUG V3: Entrou no IF "mensal"');
        console.log('!!! isBlackFriday foi setado para:', isBlackFriday);
        console.log('!!! oldPrice foi setado para:', oldPrice);
        // --- ★★★ FIM DO DEBUG ★★★ ---

      } else if (planNameLower.includes('anual')) {
        features = [
          "Todos os benefícios do Mensal",
          "Garantia de participação em sorteios futuros",
          "Chance de ganhar pimentas adicionais",
          "Acesso antecipado a eventos",
          "Suporte prioritário 24/7"
        ];
      	 durationInDays = 365;
  	 } else {
    	 features = ['Benefícios básicos', 'Acesso limitado'];
    	 durationInDays = 30; 
  	 }

    	 return {
      	 ...plan, 
      	 features: features, 
      	 durationInDays: durationInDays, 
    	   isRecommended: isRecommended, 
      	 isBlackFriday: isBlackFriday,
      	 oldPrice: oldPrice
  	   };
  	 });
  	 
    res.status(200).json(plansWithFeatures);

  } catch (error) {
  	 console.error('Erro ao buscar planos de assinatura:', error);
  	 res.status(500).json({ message: 'Erro ao buscar planos de assinatura.' });
  }
});

// ===============================================================
// ROTA PARA CRIAR CHECKOUT DE ASSINATURA (PreApproval)
// ===============================================================
router.post('/create-subscription-checkout', checkAuth, async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.userId;
  try {
    const tokenInUse = process.env.MERCADOPAGO_ACCESS_TOKEN;
    // console.log('===============================================================');
    // console.log('[MERCADOPAGO - ASSINATURA] DEBUG DO TOKEN EM USO (DO ENV):');
    // console.log(`Token: ${tokenInUse ? tokenInUse.slice(0, 15) + '...' + tokenInUse.slice(-4) : 'NENHUM TOKEN NO ENV'}`);
    // console.log('===============================================================');
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } }),
    ]);
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!plan) return res.status(404).json({ message: 'Plano de assinatura não encontrado.' });
    let frequency_type = 'months';
    let frequency = 1;
    const planNameLower = plan.name.toLowerCase();
    if (planNameLower.includes('semanal')) {
      frequency_type = 'days';
      frequency = 7;
    } else if (planNameLower.includes('trimestral')) {
      frequency = 3;
    } else if (planNameLower.includes('anual')) {
      frequency = 12;
    }
    const subscriptionData = {
      reason: `Assinatura ${plan.name} - MyExtasyClub`,
      auto_recurring: {
        frequency: frequency,
        frequency_type: frequency_type,
        transaction_amount: plan.priceInCents / 100,
        currency_id: 'BRL',
      },
      back_url: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=subscription`,
      payer_email: user.email,
    };
    // console.log('===============================================================');
    // console.log('[MERCADOPAGO - ASSINATURA] ENVIANDO ESTES DADOS (BODY) PARA A API:');
    // console.log(JSON.stringify(subscriptionData, null, 2));
    // console.log('===============================================================');
    const result = await preapproval.create({ body: subscriptionData });
    // console.log("MP Subscription Result:", result);
    const expiresAt = new Date();
    if (frequency_type === 'months') {
      expiresAt.setMonth(expiresAt.getMonth() + frequency);
    } else if (frequency_type === 'days') {
     expiresAt.setDate(expiresAt.getDate() + frequency);
    }
    await prisma.subscription.upsert({
      where: { userId: userId },
      update: {
        planId: plan.id,
        mercadopagoSubscriptionId: result.id,
       status: 'PENDING',
        expiresAt: expiresAt,
      },
      create: {
        userId: userId,
        planId: plan.id,
        mercadopagoSubscriptionId: result.id,
        status: 'PENDING',
        expiresAt: expiresAt,
      },
    });
    res.status(201).json({
     checkoutUrl: result.init_point,
      subscriptionId: result.id,
    });
  } catch (error) {
    console.error('===============================================================');
    console.error('Erro ao criar assinatura MercadoPago:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    console.error('===============================================================');
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar assinatura.';
    res.status(500).json({ message: mpErrorMessage });
  }
});

// ===============================================================
// ROTA DE WEBHOOK (Sem alteração)
// ===============================================================
router.post('/webhook-mercadopago', async (req, res) => {
console.log('Webhook MercadoPago recebido:');
  console.log('Query:', req.query);
  console.log('Body:', req.body);
  const { id, topic, type } = req.query;
  try {
    if (topic === 'payment' || type === 'payment') {
      const paymentId = id || req.body?.data?.id;
      if (!paymentId) {
    	   console.warn('Webhook de pagamento sem ID recebido.');
    	   return res.sendStatus(200);
      }
    } else if (topic === 'preapproval' || type === 'preapproval') {
      const subscriptionId = id || req.body?.data?.id;
      if (!subscriptionId) {
  	     console.warn('Webhook de assinatura sem ID recebido.');
    	     return res.sendStatus(200);
      }
  	 } else {
    	 console.log('Webhook não reconhecido:', topic || type);
  	 }
  	 res.sendStatus(200);
  } catch (error) {
  	 console.error('Erro ao processar webhook MercadoPago:', error);
  	 res.status(500);
  }
});

module.exports = router;