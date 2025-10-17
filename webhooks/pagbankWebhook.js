// 🔔 PagBank Webhook — suporta CHARGES (cartão) e QR_CODES (PIX)

const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const isProduction = process.env.NODE_ENV === 'production';
const WEBHOOK_PAGBANK_PATH = process.env.WEBHOOK_PAGBANK_PATH || '/api/payments/webhook';
const AUTH_TOKEN = isProduction ? process.env.PAGBANK_PROD_TOKEN : process.env.PAGBANK_API_TOKEN;

const router = express.Router();
router.use(WEBHOOK_PAGBANK_PATH, express.raw({ type: '*/*' }));

router.post(WEBHOOK_PAGBANK_PATH, async (req, res) => {
  try {
    const raw = req.body?.toString('utf8') ?? '';
    const headerSig = req.header('x-authenticity-token') || '';
    const localSig = crypto.createHash('sha256').update(`${AUTH_TOKEN}-${raw}`, 'utf8').digest('hex');

    if (!AUTH_TOKEN || localSig !== headerSig) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    }

    const ev = JSON.parse(raw);

    // Campos possíveis
    const order = ev.order || ev.data?.order || ev; // fallback
    const referenceId =
      order?.reference_id || ev?.reference_id || ev?.data?.order?.reference_id || null;

    // fonte 1: CHARGES (cartão)
    const charge = order?.charges?.[0] || ev?.charges?.[0] || null;
    const chargeId = charge?.id || null;
    const chargeStatus = charge?.status || null;

    // fonte 2: PIX via QR_CODES
    const qr = order?.qr_codes?.[0] || ev?.qr_codes?.[0] || null;
    const qrId = qr?.id || null;
    const qrStatus = qr?.status || null; // muitas contas enviam 'PAID' aqui

    // status consolidado
    const externalStatus = chargeStatus || qrStatus || order?.status || ev?.status || null;

    if (!referenceId && !chargeId && !qrId) {
      // sem identificadores, nada a fazer
      return res.status(200).json({ ok: true, note: 'NO_IDS' });
    }

    // achar a transação
    let tx = null;
    if (referenceId) {
      tx = await prisma.transaction.findUnique({ where: { id: String(referenceId) } });
    }
    if (!tx && chargeId) {
      tx = await prisma.transaction.findFirst({ where: { pagbankChargeId: chargeId } });
    }
    if (!tx) {
      return res.status(200).json({ ok: true, note: 'TX_NOT_FOUND' });
    }

    // mapear status externo -> interno
    const map = {
      PAID: 'PAID',
      PAID_OUT: 'PAID',
      COMPLETED: 'PAID',
      AUTHORIZED: 'AUTHORIZED',
      CANCELED: 'CANCELED',
      DECLINED: 'DECLINED',
      IN_ANALYSIS: 'PENDING',
      PENDING: 'PENDING',
      WAITING: 'PENDING',
    };
    const finalStatus = map[externalStatus] || 'PENDING';

    await prisma.$transaction(async (trx) => {
      const upd = await trx.transaction.update({
        where: { id: tx.id },
        data: {
          status: finalStatus,
          // guarda chargeId se houver; para PIX pode não existir
          ...(chargeId ? { pagbankChargeId: chargeId } : {}),
        },
      });

      if (finalStatus === 'PAID' && tx.status !== 'PAID') {
        if (upd.productType === 'PIMENTA_PACKAGE') {
          const pkgId = Number(upd.productId);
          const pkg = await trx.pimentaPackage.findUnique({ where: { id: pkgId } });
          if (pkg) {
            await trx.user.update({
              where: { id: upd.userId },
              data: { pimentaBalance: { increment: pkg.pimentaAmount } },
            });
          }
        }
      }
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error('PAGBANK_WEBHOOK_ERR', err?.response?.data || err.message);
    return res.sendStatus(400);
  }
});

module.exports = router;
