// === 1. CARREGA AS VARIÁVEIS DE AMBIENTE (.env) ===
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// === 2. IMPORTAÇÕES ===
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// === 3. CONFIGURAÇÃO DO EXPRESS ===
const app = express();
const port = process.env.PORT || 3333;

// === 4. CORS (Permitir comunicação com o frontend) ===
const corsOptions = {
  origin: process.env.FRONTEND_URL,  // Ex: http://localhost:5173 ou produção
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: "Content-Type,Authorization",
};

app.use(cors(corsOptions));

// === 5. PARSE JSON + ARQUIVOS ESTÁTICOS ===
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// === 6. SESSION E PASSPORT (Login com GitHub) ===
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true em produção (https), false local
    httpOnly: true,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// === 7. CONFIGURAÇÃO DO STRATEGY GITHUB ===
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`  // Ex: https://meusite.com/auth/github/callback
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("Usuário autenticado pelo GitHub:", profile.username);
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
    res.status(401).json({ message: 'Usuário não autenticado.' });
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
  console.log(`✅ Servidor backend rodando na porta ${port}`);
});
