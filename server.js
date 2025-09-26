// 1. CARREGA AS VARIÁVEIS DE AMBIENTE
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });


// 2. IMPORTS
const express = require('express');
const cors = require('cors');
const session =require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// 3. CONFIGURAÇÃO DO APP
const app = express();
const port = process.env.PORT || 3333;

// ==========================================================
//  CONFIGURAÇÃO DE CORS - A CORREÇÃO FINAL ESTÁ AQUI!
// ==========================================================
// Agora permitimos DUAS origens: o seu site em produção E o seu ambiente local.
const allowedOrigins = [
  process.env.FRONTEND_URL, // ex: https://myextasyclub.com
  'http://localhost:3000',
  'http://localhost:5173'  // Adicionamos as portas mais comuns para garantir
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requisições sem origem (como Postman ou apps mobile)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'A política de CORS para este site não permite acesso da sua Origem.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  allowedHeaders: "Content-Type,Authorization"
};

app.use(cors(corsOptions));
// ==========================================================

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 5. CONFIGURAÇÃO DE SESSÃO E PASSAPORT (AUTENTICAÇÃO)
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

passport.serializeUser(function(user, done) {
    done(null, user);
});
 
passport.deserializeUser(function(user, done) {
    done(null, user);
});

// 6. ROTAS
// Rotas de Autenticação com GitHub
app.get('/auth/github', passport.authenticate('github', { scope: [ 'user:email' ] }));
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/entrar` }),
  function(req, res) {
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
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
  });
});

// Rotas da Aplicação
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);

// 7. INICIAR O SERVIDOR
app.listen(port, () => {
  console.log(`Servidor backend a rodar e a escutar na porta ${port}`);
});
``