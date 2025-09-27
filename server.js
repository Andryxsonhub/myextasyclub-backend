// === 1. CARREGA AS VARIÁVEIS DE AMBIENTE (.env) ===
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// === 2. IMPORTAÇÕES ===
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken'); // Importação adicionada

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// === 3. CONFIGURAÇÃO DO EXPRESS ===
const app = express();
const port = process.env.PORT || 3333;
const prisma = new PrismaClient();

// === 4. CORS (Permitir comunicação com o frontend) ===
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5173'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions));

// === 5. PARSE JSON + ARQUIVOS ESTÁTICOS ===
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// ==========================================================
//  !!! ROTA DE EMERGÊNCIA PARA O REGISTO (CORRIGIDA) !!!
//  Agora ela devolve o token corretamente, como a rota de login.
// ==========================================================
app.post('/register', async (req, res) => {
    console.log("ROTA DE EMERGÊNCIA /register ATIVADA!");
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ message: 'E-mail, senha e nome de utilizador são obrigatórios.' });
    }

    try {
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }] },
        });
        if (existingUser) {
            return res.status(409).json({ message: 'E-mail já registado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            },
        });

        // Após o registo, criamos o token
        const token = jwt.sign(
            { userId: newUser.id, name: newUser.name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Devolvemos a resposta no formato que o frontend espera
        res.status(201).json({
            message: 'Utilizador criado com sucesso!',
            token: token, // <-- A CHAVE ESTÁ AQUI
            user: { id: newUser.id, name: newUser.name, email: newUser.email }
        });

    } catch (error) {
        console.error('Erro na rota de emergência /register:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});
// ==========================================================


// === 6. SESSION E PASSPORT (Login com GitHub) ===
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  }
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("Utilizador autenticado pelo GitHub:", profile.username);
    return done(null, profile);
  }
));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// === 8. ROTAS DE AUTENTICAÇÃO (GitHub) ===
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/entrar` }),
  (req, res) => {
    res.redirect(`${process.env.FRONTEND_URL}/auth/github/callback`);
  }
);
app.get('/api/auth/profile', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Utilizador não autenticado.' });
  }
});
app.post('/api/auth/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
  });
});


// === 9. OUTRAS ROTAS DA APLICAÇÃO ===
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);

// === 10. INICIA O SERVIDOR ===
app.listen(port, () => {
  console.log(`✅ Servidor backend a rodar na porta ${port}`);
});

