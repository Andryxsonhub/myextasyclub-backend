// backend/routes/paymentRoutes.js
// --- ATUALIZADO (Correção Semanal/Mensal + Industry Data) ---

const express = require('express');
const prisma = require('../lib/prisma');
const { checkAuth } = require('../middleware/authMiddleware'); 

const { MercadoPagoConfig, Preference, PreApproval } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

const preapproval = new PreApproval(client);
const preference = new Preference(client); // Instancia o Preference aqui

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
// ROTA PARA CRIAR PAGAMENTO DE PIMENTAS (COM INDUSTRY_DATA)
// ===============================================================
router.post('/create-pimenta-checkout', checkAuth, async (req, res) => {
  const { packageId } = req.body;
  const userId = req.user.userId;

  if (!packageId) {
    return res.status(400).json({ message: 'O ID do pacote é obrigatório.' });
  }

  try {
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
          name: user.name || `Usuário ${user.id}`,
          email: user.email, // Usa o email do usuário logado (deve ser o @testuser.com)
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=pimenta`,
          failure: `${process.env.FRONTEND_URL}/pagamento-falha`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },
        external_reference: internalTransaction.id,
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago`,
        // --- CORREÇÃO 2/3: Adicionando o campo 'industry_data' ---
        industry_data: {
          type: "applications_and_online_platforms"
        }
      },
    };

    console.log('===============================================================');
    console.log('[MERCADOPAGO - PIMENTA] ENVIANDO ESTES DADOS PARA A API:');
    console.log(JSON.stringify(preferenceData.body, null, 2)); // Loga só o body
    console.log('===============================================================');

    const result = await preference.create(preferenceData);
    res.status(201).json({
      checkoutUrl: result.init_point,
      transactionId: internalTransaction.id,
    });

  } catch (error) {
    console.error('===============================================================');
    console.error('[MERCADOPAGO - PIMENTA] ERRO AO CRIAR CHECKOUT:');
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    console.error('===============================================================');
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar pagamento.';
    res.status(500).json({ message: mpErrorMessage });
  }
});

// ===============================================================
// ROTA PARA BUSCAR PLANOS DE ASSINATURA
// ===============================================================
router.get('/subscription-plans', checkAuth, async (_req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInCents: 'asc' }, 
    });
    const plansWithFeatures = plans.map(plan => ({
        ...plan,
        // (A lógica de features e isRecommended continua a mesma)
        features: plan.name === 'Plano Mensal'
            ? ['Ver perfis completos', 'Mensagens ilimitadas', 'Selo VIP', 'Ver visitas', 'Lives exclusivas']
            : plan.name === 'Plano Trimestral'
            ? ['Todos os benefícios do Mensal', 'Destaque nas buscas', 'Selo Premium', 'Acesso antecipado', 'Suporte prioritário']
            : plan.name === 'Plano Semanal' // Adicionado para clareza
            ? ['Acesso por 7 dias', 'Ver perfis', 'Mensagens']
            : ['Benefícios básicos', 'Acesso limitado'],
        durationInDays: plan.name === 'Plano Mensal' ? 30 : plan.name === 'Plano Trimestral' ? 90 : plan.name === 'Plano Semanal' ? 7 : 365,
        isRecommended: plan.name === 'Plano Trimestral'
    }));

    res.status(200).json(plansWithFeatures); 
  } catch (error) {
    console.error('Erro ao buscar planos de assinatura:', error);
    res.status(500).json({ message: 'Erro ao buscar planos de assinatura.' });
  }
});


// ===============================================================
// ROTA PARA CRIAR CHECKOUT DE ASSINATURA (COM CORREÇÕES)
// ===============================================================
router.post('/create-subscription-checkout', checkAuth, async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.userId;

  if (!planId) {
    return res.status(400).json({ message: 'O ID do plano é obrigatório.' });
  }

  try {
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } }),
    ]);

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!plan) return res.status(404).json({ message: 'Plano de assinatura não encontrado.' });

    // --- CORREÇÃO 1/3: Lógica para 'Semanal' ---
    let frequency_type = 'months';
    let frequency = 1;
    const planNameLower = plan.name.toLowerCase();

    if (planNameLower.includes('semanal')) {
        frequency_type = 'days'; // MP usa 'dias' para semanal
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
      payer_email: user.email, // Usa o email do usuário logado (@testuser.com)
      // --- CORREÇÃO 2/3: Adicionando o campo 'industry_data' ---
      industry_data: {
        type: "applications_and_online_platforms"
      }
    };

    console.log('===============================================================');
    console.log('[MERCADOPAGO - ASSINATURA] ENVIANDO ESTES DADOS PARA A API:');
    console.log(JSON.stringify(subscriptionData, null, 2));
    console.log('===============================================================');

    const result = await preapproval.create({ body: subscriptionData });

    console.log("MP Subscription Result:", result); 

    // (O resto do código para salvar no DB continua o mesmo)
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
  // ... (A lógica do webhook permanece a mesma) ...
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
    res.sendStatus(500); 
  }
});

module.exports = router;