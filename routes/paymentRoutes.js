// backend/routes/paymentRoutes.js
const express = require('express');
const prisma = require('../lib/prisma');
const authMiddleware = require('../middleware/authMiddleware');
const { createPagBankCharge } = require('../services/pagbankService');

const router = express.Router();

/** GET /api/payments/packages */
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

/**
 * POST /api/payments/checkout
 * body: { packageId, method: 'PIX' | 'CREDIT_CARD', card?: {encryptedCard, holderName}, customerTaxId? }
 */
router.post('/checkout', authMiddleware, async (req, res) => {
  const { packageId, method, card, customerTaxId } = req.body;
  const userId = req.user.userId;

  if (!packageId || !method) {
    return res.status(400).json({ message: 'Dados insuficientes: informe o pacote e o método.' });
  }

  try {
    const [pkg, user] = await Promise.all([
      prisma.pimentaPackage.findUnique({ where: { id: Number(packageId) } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!pkg || !user) return res.status(404).json({ message: 'Usuário ou pacote não encontrado.' });

    // CPF/CNPJ — obrigatório em produção
    const rawTaxFromFront = customerTaxId || '';
    const rawTaxFromUser = user.cpf || user.taxId || user.tax_id || '';
    const taxIdDigits = String(rawTaxFromFront || rawTaxFromUser).replace(/\D/g, '');

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !(taxIdDigits.length === 11 || taxIdDigits.length === 14)) {
      return res.status(400).json({
        message: 'CPF/CNPJ obrigatório para concluir o pagamento.',
        code: 'CUSTOMER_TAX_ID_REQUIRED',
      });
    }

    // cria transação interna
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        productId: String(pkg.id),
        productType: 'PIMENTA_PACKAGE',
        productName: pkg.name,
        amountInCents: pkg.priceInCents,
        status: 'PENDING',
      },
    });

    // cria cobrança no PagBank
    const paymentResponse = await createPagBankCharge(
      { id: transaction.id, productName: pkg.name, amountInCents: pkg.priceInCents },
      { name: user.name, email: user.email, taxId: taxIdDigits || undefined },
      { method, card }
    );

    res.status(201).json(paymentResponse);
  } catch (error) {
    console.error('Erro ao criar checkout:', error?.response?.data || error.message);
    res.status(500).json({ message: 'Erro ao processar pagamento.' });
  }
});

/** Compat: POST /api/payments/create-pix-order */
router.post('/create-pix-order', authMiddleware, async (req, res, next) => {
  try {
    const { packageId, customerTaxId } = req.body;
    if (!packageId) return res.status(400).json({ message: 'O ID do pacote é obrigatório.' });
    req.body = { packageId, method: 'PIX', customerTaxId: customerTaxId || undefined };
    // reusa o handler /checkout
    req.url = '/checkout';
    next();
  } catch (e) {
    console.error('CREATE_PIX_ORDER_COMPAT_ERR', e?.response?.data || e.message);
    res.status(500).json({ message: 'Erro ao criar ordem PIX.' });
  }
});

module.exports = router;
