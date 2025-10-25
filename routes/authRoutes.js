// routes/authRoutes.js (VERSÃO COM LOGS E RESPOSTA SIMPLIFICADA)
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();

// Saúde opcional
router.get('/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV, db: Boolean(process.env.DATABASE_URL) });
});

// ==========================================================
// ROTA DE LOGIN (Existente - Sem alteração)
// ==========================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Informe e-mail e senha.' });
    }
    console.log('[LOGIN] Buscando usuário:', email); // Log
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log('[LOGIN] Usuário não encontrado:', email); // Log
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    console.log('[LOGIN] Comparando senha para:', email); // Log
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
       console.log('[LOGIN] Senha inválida para:', email); // Log
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }
    console.log('[LOGIN] Gerando token para:', user.id); // Log
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Busca com relações (sem alteração)
    console.log('[LOGIN] Buscando usuário com relações:', user.id); // Log
    const userWithRelations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          following: { select: { followingId: true } },
          likesGiven: { select: { likedUserId: true } }
        }
    });

    const { password: _, ...safeUser } = userWithRelations;
    console.log('[LOGIN] Login bem-sucedido para:', email); // Log
    return res.status(200).json({ token, user: safeUser });

  } catch (err) {
    console.error('[LOGIN_ERR]', err); // Log de erro completo
    return res.status(500).json({ message: 'Erro interno ao efetuar login.' });
  }
});

// ==========================================================
// ROTA DE REGISTRO (LOGS ADICIONADOS, RESPOSTA SIMPLIFICADA)
// ==========================================================
router.post('/register', async (req, res) => {
  try {
    console.log('[REGISTER] Recebido body:', req.body); // Log
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'E-mail, senha e nome são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    console.log('[REGISTER] Verificando se email existe:', email); // Log
    // A linha abaixo (originalmente 86) é a que o erro antigo apontava
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.log('[REGISTER] Email já existe:', email); // Log
      return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }

    console.log('[REGISTER] Criptografando senha para:', email); // Log
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('[REGISTER] Criando usuário:', email); // Log
    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: name,
        // SEM username AQUI, pois está opcional no schema correto
      },
      // NÃO FAÇA SELECT aqui para simplificar
    });
    console.log('[REGISTER] Usuário criado com ID:', newUser.id); // Log

    console.log('[REGISTER] Criando perfil para usuário:', newUser.id); // Log
    await prisma.profile.create({
        data: {
            userId: newUser.id,
        }
    });
    console.log('[REGISTER] Perfil criado para usuário:', newUser.id); // Log

    console.log('[REGISTER] Gerando token para:', newUser.id); // Log
    const payload = { userId: newUser.id, email: newUser.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // --- RESPOSTA SIMPLIFICADA ---
    // Não vamos buscar o usuário de novo aqui, só retornar o token
    console.log('[REGISTER] Registro bem-sucedido para:', email); // Log
    return res.status(201).json({ token, message: "Usuário registrado com sucesso!" }); // Só token e msg

  } catch (err) {
    // Log de erro mais detalhado
    console.error('[REGISTER_ERR]', err); // Loga o erro completo
    // Verifica se é um erro conhecido do Prisma
    if (err.code) { // Códigos de erro do Prisma geralmente têm 'code'
        console.error(`[REGISTER_ERR] Prisma Code: ${err.code}, Meta: ${JSON.stringify(err.meta)}`);
    }
    return res.status(500).json({ message: 'Erro interno ao registrar usuário.' });
  }
});

module.exports = router;