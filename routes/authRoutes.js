// routes/authRoutes.js (VERSÃO COMPLETA com /register)
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
// ROTA DE LOGIN (Existente)
// ==========================================================
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
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // 4) gera token
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // 5) devolve dados essenciais (incluindo like/follow para o frontend)
    const userWithRelations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          following: { select: { followingId: true } },
          likesGiven: { select: { likedUserId: true } }
        }
    });

    const { password: _, ...safeUser } = userWithRelations;
    return res.status(200).json({ token, user: safeUser });

  } catch (err) {
    console.error('[LOGIN_ERR]', err?.message || err);
    return res.status(500).json({ message: 'Erro interno ao efetuar login.' });
  }
});

// ==========================================================
// ROTA DE REGISTRO (Nova - Adicionada)
// ==========================================================
/**
 * POST /api/register
 * body: { email, password, name } // Adicione outros campos se necessário
 */
router.post('/register', async (req, res) => {
  try {
    // 1) Valida o corpo da requisição
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'E-mail, senha e nome são obrigatórios.' });
    }

    // Validação básica de e-mail e senha (adicione mais validações se precisar)
    if (password.length < 6) {
      return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }
    // TODO: Adicionar validação de formato de email

    // 2) Verifica se o e-mail já existe
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }

    // 3) Criptografa a senha
    const hashedPassword = await bcrypt.hash(password, 10); // 10 é o número de "salt rounds"

    // 4) Cria o novo usuário no banco de dados
    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: hashedPassword,
        name: name,
        // Adicione outros campos padrão aqui se necessário
      },
    });
    
    // Cria um perfil básico para o novo usuário
    await prisma.profile.create({
        data: {
            userId: newUser.id,
            // Adicione valores padrão se quiser (bio, etc.)
        }
    });

    // 5) Gera um token JWT para o novo usuário (opcional, mas comum para logar direto)
    const payload = { userId: newUser.id, email: newUser.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // 6) Retorna os dados do novo usuário (sem a senha) e o token
    const { password: _, ...safeUser } = newUser;
    return res.status(201).json({ token, user: safeUser }); // 201 Created

  } catch (err) {
    console.error('[REGISTER_ERR]', err?.message || err);
    return res.status(500).json({ message: 'Erro interno ao registrar usuário.' });
  }
});

module.exports = router;