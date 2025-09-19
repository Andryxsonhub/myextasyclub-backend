// server.js (SEU CÓDIGO ATUALIZADO)

// 1. CARREGA AS VARIÁVEIS DE AMBIENTE
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });


// 2. IMPORTS
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes'); // <-- 1. LINHA ADICIONADA

// 3. CONFIGURAÇÃO DO APP
const app = express();
const port = process.env.PORT || 3001;

// 4. MIDDLEWARE
// ==========================================================
//                 CONFIGURAÇÃO DO CORS
// ==========================================================
const allowedOrigins = [
    'http://localhost:3000',
    'https://myextasyclub.com',
    'https://myextasyclub.com/'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Acesso não permitido pelo CORS'));
        }
    },
    credentials: true
}));
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
    callbackURL: "http://localhost:3001/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log("Usuário autenticado pelo GitHub:", profile.username);
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
  passport.authenticate('github', { failureRedirect: 'http://localhost:3000/entrar' }),
  function(req, res) {
    res.redirect('http://localhost:3000/auth/github/callback');
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
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
  });
});

// Rotas de Autenticação (Login) e Usuários (Registro)
app.use('/api', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes); // <-- 2. LINHA ADICIONADA

// 7. INICIAR O SERVIDOR
app.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});