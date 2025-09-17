const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// --- ROTAS DE AUTENTICAÇÃO ---
app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: 'http://localhost:3000/entrar' }),
  function(req, res) {
    res.redirect('http://localhost:3000/auth/github/callback');
  });

app.get('/api/auth/profile', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: 'Usuário não autenticado.' });
    }
});

// --- NOVA ROTA DE LOGOUT ---
// Esta rota é chamada pelo botão "Sair" no novo Header
app.post('/api/auth/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    req.session.destroy(() => {
      res.clearCookie('connect.sid'); // Limpa o cookie da sessão
      res.status(200).json({ message: 'Logout bem-sucedido.' });
    });
  });
});

// --- SUAS OUTRAS ROTAS ---
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// --- Iniciar o Servidor ---
app.listen(port, () => {
  console.log(`Servidor backend rodando na porta ${port}`);
});