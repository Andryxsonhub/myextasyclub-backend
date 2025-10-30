// backend/routes/paymentRoutes.js
// --- ATUALIZADO COM LOGS DE DEBUG PARA O MERCADOPAGO ---

const express = require('express');
const prisma = require('../lib/prisma');
// 1. --- CORREÇÃO DA IMPORTAÇÃO DO MIDDLEWARE ---
// (Assim como fizemos no userRoutes.js, para pegar os dois porteiros)
const { checkAuth } = require('../middleware/authMiddleware'); 

// 1. Importar o SDK do MercadoPago (Cliente + Preferência para Pimentas + Assinatura)
const { MercadoPagoConfig, Preference, PreApproval } = require('mercadopago');

// 2. Configurar o Cliente (Sem alteração)
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// 3. Instanciar o serviço de Assinaturas (PreApproval)
const preapproval = new PreApproval(client);

const router = express.Router();

// ===============================================================
// ROTA PARA BUSCAR PACOTES DE PIMENTA (Sem alteração)
// ===============================================================
/**
 * GET /api/payments/packages
 */
// --- CORREÇÃO: Usando 'checkAuth' do nosso novo middleware ---
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
// ROTA PARA CRIAR PAGAMENTO DE PIMENTAS (MERCADOPAGO) (LOGS ADICIONADOS)
// ===============================================================
/**
 * POST /api/payments/create-pimenta-checkout
 * Body: { packageId: Int }
 */
// --- CORREÇÃO: Usando 'checkAuth' ---
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

    const preference = new Preference(client);
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
          email: user.email,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=pimenta`,
          failure: `${process.env.FRONTEND_URL}/pagamento-falha`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },
        // auto_return: 'approved',
        external_reference: internalTransaction.id,
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago`,
      },
    };

    // --- 1. LOG ADICIONADO (O QUE O ADRIANO QUER VER) ---
    console.log('===============================================================');
    console.log('[MERCADOPAGO - PIMENTA] ENVIANDO ESTES DADOS PARA A API:');
    console.log(JSON.stringify(preferenceData, null, 2));
    console.log('===============================================================');

    const result = await preference.create(preferenceData);
    res.status(201).json({
      checkoutUrl: result.init_point,
      transactionId: internalTransaction.id,
    });

  } catch (error) {
    // --- 2. LOG DE ERRO MELHORADO (O QUE O ADRIANO TAMBÉM QUER VER) ---
    console.error('===============================================================');
    console.error('[MERCADOPAGO - PIMENTA] ERRO AO CRIAR CHECKOUT:');
    if (error.response) {
      // Imprime o erro exato que a API do MP retornou
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      // Erro genérico
      console.error(error.message);
    }
    console.error('===============================================================');
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar pagamento.';
    res.status(500).json({ message: mpErrorMessage });
  }
});

// ===============================================================
// NOVA ROTA PARA BUSCAR PLANOS DE ASSINATURA
// ===============================================================
/**
 * GET /api/payments/subscription-plans
 */
// --- CORREÇÃO: Usando 'checkAuth' ---
router.get('/subscription-plans', checkAuth, async (_req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInCents: 'asc' }, 
    });
    // Simular features
    const plansWithFeatures = plans.map(plan => ({
        ...plan,
        features: plan.name === 'Plano Mensal'
            ? ['Ver perfis completos', 'Mensagens ilimitadas', 'Selo VIP', 'Ver visitas', 'Lives exclusivas']
            : plan.name === 'Plano Trimestral'
            ? ['Todos os benefícios do Mensal', 'Destaque nas buscas', 'Selo Premium', 'Acesso antecipado', 'Suporte prioritário']
            : ['Benefícios básicos', 'Acesso limitado'],
        durationInDays: plan.name === 'Plano Mensal' ? 30 : plan.name === 'Plano Trimestral' ? 90 : 365,
        isRecommended: plan.name === 'Plano Trimestral'
    }));

    res.status(200).json(plansWithFeatures); 
  } catch (error) {
    console.error('Erro ao buscar planos de assinatura:', error);
    res.status(500).json({ message: 'Erro ao buscar planos de assinatura.' });
  }
});


// ===============================================================
// NOVA ROTA PARA CRIAR CHECKOUT DE ASSINATURA (LOGS ADICIONADOS)
// ===============================================================
/**
 * POST /api/payments/create-subscription-checkout
 * Body: { planId: Int }
 */
// --- CORREÇÃO: Usando 'checkAuth' ---
router.post('/create-subscription-checkout', checkAuth, async (req, res) => {
  const { planId } = req.body;
  const userId = req.user.userId;

  if (!planId) {
    return res.status(400).json({ message: 'O ID do plano é obrigatório.' });
  }

  try {
    // 1. Buscar o usuário e o plano no nosso DB
    const [user, plan] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } }),
    ]);

    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });
    if (!plan) return res.status(404).json({ message: 'Plano de assinatura não encontrado.' });

    // 2. Definir a recorrência
    let frequency_type = 'months';
    let frequency = 1;
    if (plan.name.toLowerCase().includes('trimestral')) {
        frequency = 3;
    } else if (plan.name.toLowerCase().includes('anual')) {
        frequency = 12;
    }
  
    // 3. Preparar os dados da Assinatura para o MercadoPago
    const subscriptionData = {
      reason: `Assinatura ${plan.name} - MyExtasyClub`,
      auto_recurring: {
        frequency: frequency,
        frequency_type: frequency_type,
        transaction_amount: plan.priceInCents / 100, // Preço em R$
        currency_id: 'BRL', 
      },
      back_url: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=subscription`,
      payer_email: user.email,
    };

    // --- 1. LOG ADICIONADO (O QUE O ADRIANO QUER VER) ---
    console.log('===============================================================');
    console.log('[MERCADOPAGO - ASSINATURA] ENVIANDO ESTES DADOS PARA A API:');
    console.log(JSON.stringify(subscriptionData, null, 2));
    console.log('===============================================================');

    // 4. Criar a assinatura no MercadoPago
    const result = await preapproval.create({ body: subscriptionData });

    console.log("MP Subscription Result:", result); // Log para depuração

    // 5. [IMPORTANTE] Salvar/Atualizar a assinatura no nosso banco de dados
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

    // 6. Enviar a URL de checkout (init_point) de volta para o frontend
    res.status(201).json({
      checkoutUrl: result.init_point,
      subscriptionId: result.id, 
    });

  } catch (error) {
    // --- 2. LOG DE ERRO (O QUE O ADRIANO TAMBÉM QUER VER) ---
    // (O seu log aqui já estava ótimo, não mudei)
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
/**
 * POST /api/payments/webhook-mercadopago
 */
router.post('/webhook-mercadopago', async (req, res) => {
  console.log('Webhook MercadoPago recebido:');
  console.log('Query:', req.query); 
  console.log('Body:', req.body);   

  const { id, topic, type } = req.query; // Ou req.body

  try {
    // 1. Verificar o tipo de notificação (topic ou type)
    if (topic === 'payment' || type === 'payment') {
      const paymentId = id || req.body?.data?.id;
      if (!paymentId) {
        console.warn('Webhook de pagamento sem ID recebido.');
        return res.sendStatus(200); 
      }

      // ... Lógica do Webhook de Pagamento (Pimentas) ...

    } else if (topic === 'preapproval' || type === 'preapproval') { // Notificação de Assinatura
        const subscriptionId = id || req.body?.data?.id;
         if (!subscriptionId) {
            console.warn('Webhook de assinatura sem ID recebido.');
            return res.sendStatus(200);
        }
      
      // ... Lógica do Webhook de Assinatura ...

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