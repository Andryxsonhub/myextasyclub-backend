// routes/authRoutes.js (versão robusta)
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();

// saúde opcional
router.get('/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV, db: Boolean(process.env.DATABASE_URL) });
});

/**
 * POST /api/login
 * body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    // 1) valida body
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Informe e-mail e senha.' });
    }

    // 2) busca usuário
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // não revela se o email existe
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // 3) confere senha
    // Se sua base tem senhas em texto (não recomendado), troque para "password === user.password"
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // 4) gera token
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // 5) devolve dados essenciais
    const { password: _, ...safeUser } = user;
    return res.status(200).json({ token, user: safeUser });
  } catch (err) {
    console.error('[LOGIN_ERR]', err?.message || err);
    return res.status(500).json({ message: 'Erro interno ao efetuar login.' });
  }
});

module.exports = router;
