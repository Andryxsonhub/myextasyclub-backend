// backend/routes/paymentRoutes.js
// --- ATUALIZADO PARA MERCADOPAGO (PIMENTAS + ASSINATURAS) ---
// --- [CORREÇÃO] Adicionado 'industry_data' para pimentas ---

const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');

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
router.get('/packages', authMiddleware, async (_req, res) => {
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
// ROTA PARA CRIAR PAGAMENTO DE PIMENTAS (MERCADOPAGO) (Alterado)
// ===============================================================
/**
 * POST /api/payments/create-pimenta-checkout
 * Body: { packageId: Int }
 */
router.post('/create-pimenta-checkout', authMiddleware, async (req, res) => {
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
          name: user.name || `Usuário ${user.id}`, // Adiciona fallback para nome
          email: user.email,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=pimenta`,
          failure: `${process.env.FRONTEND_URL}/pagamento-falha`,
          pending: `${process.env.FRONTEND_URL}/pagamento-pendente`,
        },
        // auto_return: 'approved', // Comentado para localhost
        external_reference: internalTransaction.id,
        notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago`,
        
        // =======================================================
        // ▼▼▼ CORREÇÃO (O que o Suporte MP pediu) ▼▼▼
        //
        industry_data: {
          type: "applications_and_online_platforms"
        },
        //
        // ▲▲▲ FIM DA CORREÇÃO ▲▲▲
        // =======================================================
      },
    };

    const result = await preference.create(preferenceData);
    res.status(201).json({
      checkoutUrl: result.init_point,
      transactionId: internalTransaction.id,
    });

  } catch (error) {
    console.error('Erro ao criar checkout de pimenta MP:', error?.response?.data || error);
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar pagamento.';
    res.status(500).json({ message: mpErrorMessage });
  }
});

// ===============================================================
// NOVA ROTA PARA BUSCAR PLANOS DE ASSINATURA
// ===============================================================
/**
 * GET /api/payments/subscription-plans
 * Busca os planos de assinatura do nosso banco de dados.
 */
router.get('/subscription-plans', authMiddleware, async (_req, res) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInCents: 'asc' }, // Ordena por preço
    });
    // Simular features (idealmente viriam do DB)
    const plansWithFeatures = plans.map(plan => ({
        ...plan,
        features: plan.name === 'Plano Mensal'
            ? ['Ver perfis completos', 'Mensagens ilimitadas', 'Selo VIP', 'Ver visitas', 'Lives exclusivas']
            : plan.name === 'Plano Trimestral'
            ? ['Todos os benefícios do Mensal', 'Destaque nas buscas', 'Selo Premium', 'Acesso antecipado', 'Suporte prioritário']
            : ['Benefícios básicos', 'Acesso limitado'], // Default features
        durationInDays: plan.name === 'Plano Mensal' ? 30 : plan.name === 'Plano Trimestral' ? 90 : 365, // Exemplo
        isRecommended: plan.name === 'Plano Trimestral' // Exemplo
    }));

    res.status(200).json(plansWithFeatures); // Retorna os planos com features adicionadas
  } catch (error) {
    console.error('Erro ao buscar planos de assinatura:', error);
    res.status(500).json({ message: 'Erro ao buscar planos de assinatura.' });
  }
});


// ===============================================================
// NOVA ROTA PARA CRIAR CHECKOUT DE ASSINATURA (MERCADOPAGO)
// ===============================================================
/**
 * POST /api/payments/create-subscription-checkout
 * Body: { planId: Int }
 * Cria a assinatura no MercadoPago e retorna a URL de checkout.
 */
router.post('/create-subscription-checkout', authMiddleware, async (req, res) => {
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

    // 2. Definir a recorrência (exemplo: Mensal)
    //    Ajuste frequency_type e frequency com base no 'plan.name' ou adicione campos no DB
    let frequency_type = 'months';
    let frequency = 1;
    if (plan.name.toLowerCase().includes('trimestral')) {
        frequency = 3;
    } else if (plan.name.toLowerCase().includes('anual')) {
        frequency = 12;
    }
    // Adicionar lógica para 'semanal', 'anual', etc., se necessário

    // 3. Preparar os dados da Assinatura para o MercadoPago
    const subscriptionData = {
      reason: `Assinatura ${plan.name} - MyExtasyClub`,
      auto_recurring: {
        frequency: frequency,
        frequency_type: frequency_type,
        transaction_amount: plan.priceInCents / 100, // Preço em R$
        currency_id: 'BRL', // Moeda (Real Brasileiro)
      },
      back_url: `${process.env.FRONTEND_URL}/pagamento-sucesso?type=subscription`, // URL de retorno SUCESSO
      payer_email: user.email,
      // Opcional: Adicionar notification_url para webhooks específicos de assinatura
      // notification_url: `${process.env.BACKEND_URL}/api/payments/webhook-mercadopago-subscriptions`,
      // Opcional: external_reference para vincular ao nosso ID de usuário ou transação interna se necessário
      // external_reference: `user_sub_${userId}_${plan.id}`,
    };

    // 4. Criar a assinatura no MercadoPago
    const result = await preapproval.create({ body: subscriptionData });

    console.log("MP Subscription Result:", result); // Log para depuração

    // 5. [IMPORTANTE] Salvar/Atualizar a assinatura no nosso banco de dados
    //    Usamos 'upsert' para criar ou atualizar caso o usuário já tenha uma assinatura inativa.
    const expiresAt = new Date();
      if (frequency_type === 'months') {
          expiresAt.setMonth(expiresAt.getMonth() + frequency);
      } else if (frequency_type === 'days') { // Adicione outros tipos se necessário
          expiresAt.setDate(expiresAt.getDate() + frequency);
      }
      // Adicionar lógica para anos, etc.

    await prisma.subscription.upsert({
      where: { userId: userId }, // Chave única para encontrar a assinatura do usuário
      update: { // Se já existe, atualiza os dados
        planId: plan.id,
        mercadopagoSubscriptionId: result.id, // O ID da assinatura no MP
        status: 'PENDING', // A assinatura começa pendente até o MP confirmar o 1º pagamento
        expiresAt: expiresAt, // Define uma data de expiração inicial
      },
      create: { // Se não existe, cria
        userId: userId,
        planId: plan.id,
        mercadopagoSubscriptionId: result.id,
        status: 'PENDING',
        expiresAt: expiresAt,
      },
    });

    // 6. Enviar a URL de checkout (init_point) de volta para o frontend
    res.status(201).json({
      checkoutUrl: result.init_point, // URL para onde o usuário deve ser redirecionado
      subscriptionId: result.id, // ID da assinatura no MP
    });

  } catch (error) {
    console.error('Erro ao criar assinatura MercadoPago:');
      if (error.response) {
        console.error(JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    const mpErrorMessage = error.response?.data?.message || 'Erro ao processar assinatura.';
    res.status(500).json({ message: mpErrorMessage });
  }
});


// ===============================================================
// ROTA DE WEBHOOK (Unificada ou Separada)
// ===============================================================
/**
 * POST /api/payments/webhook-mercadopago
 * Recebe notificações do MercadoPago sobre pagamentos (Pimentas e Assinaturas).
 * PRECISA SER CONFIGURADA NO PAINEL DO MERCADOPAGO.
 */
router.post('/webhook-mercadopago', async (req, res) => {
  console.log('Webhook MercadoPago recebido:');
  console.log('Query:', req.query); // Parâmetros da URL (ex: id, topic)
  console.log('Body:', req.body);   // Corpo da requisição (se houver)

  const { id, topic, type } = req.query; // Ou req.body dependendo da config do MP

  try {
    // 1. Verificar o tipo de notificação (topic ou type)
    if (topic === 'payment' || type === 'payment') {
      const paymentId = id || req.body?.data?.id;
      if (!paymentId) {
        console.warn('Webhook de pagamento sem ID recebido.');
        return res.sendStatus(200); // Responde OK para o MP não reenviar
      }

      // 2. Buscar informações do pagamento na API do MP
      //    (Precisa importar e configurar o serviço de Pagamento do SDK)
      //    const payment = await mercadoPagoPaymentService.get({ id: paymentId });
      //    console.log('Detalhes do Pagamento MP:', payment);

      // 3. Encontrar a transação interna usando external_reference (se for Pimenta)
      //    const internalTransactionId = payment.external_reference;
      //    const transaction = await prisma.transaction.findUnique({ where: { id: internalTransactionId } });

      // 4. Atualizar o status da nossa transação interna (PAID, FAILED, etc.)
      //    await prisma.transaction.update({ where: { id: internalTransactionId }, data: { status: 'PAID', mercadopagoPaymentId: paymentId } });

      // 5. Se for Pimenta e PAID, adicionar pimentas ao saldo do usuário
      //    if (transaction.productType === 'PIMENTA_PACKAGE' && payment.status === 'approved') {
      //       const pkg = await prisma.pimentaPackage.findUnique({ where: { id: transaction.productId }});
      //       await prisma.user.update({ where: { id: transaction.userId }, data: { pimentaBalance: { increment: pkg.pimentaAmount } } });
      //       console.log(`${pkg.pimentaAmount} pimentas adicionadas ao usuário ${transaction.userId}`);
      //    }

    } else if (topic === 'preapproval' || type === 'preapproval') { // Notificação de Assinatura
        const subscriptionId = id || req.body?.data?.id;
         if (!subscriptionId) {
            console.warn('Webhook de assinatura sem ID recebido.');
            return res.sendStatus(200);
         }

        // 2. Buscar informações da assinatura na API do MP
        //    const subscriptionDetails = await preapproval.get({ id: subscriptionId });
        //    console.log('Detalhes da Assinatura MP:', subscriptionDetails);

        // 3. Encontrar a assinatura no nosso banco de dados
        //    const internalSubscription = await prisma.subscription.findUnique({ where: { mercadopagoSubscriptionId: subscriptionId } });

        // 4. Atualizar o status da nossa assinatura interna (authorized, paused, cancelled)
        //    await prisma.subscription.update({ where: { id: internalSubscription.id }, data: { status: subscriptionDetails.status }});
        //    console.log(`Status da assinatura ${subscriptionId} atualizado para ${subscriptionDetails.status}`);

        // TODO: Lógica adicional (ex: remover acesso se cancelado, notificar usuário, etc.)

    } else {
      console.log('Webhook não reconhecido:', topic || type);
    }

    // Responde 200 OK para o MercadoPago saber que recebemos
    res.sendStatus(200);

  } catch (error) {
    console.error('Erro ao processar webhook MercadoPago:', error);
    res.sendStatus(500); // Informa erro ao MP (ele pode tentar reenviar)
  }
});


module.exports = router;