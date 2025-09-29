// ARQUIVO PRINCIPAL DO SERVIDOR (VERSÃO FINAL COM ROTA /auth/me)

// === 1. CARREGA AS VARIÁVEIS DE AMBIENTE (.env) ===
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });

// === 2. IMPORTAÇÕES ===
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const http = require('http');
const { Server } = require("socket.io");

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

// ALTERAÇÃO 1: Importamos o nosso novo middleware
const authMiddleware = require('./middleware/authMiddleware');

// === 3. CONFIGURAÇÃO DO EXPRESS ===
const app = express();
const port = process.env.PORT || 3333;

// === 4. CORS (Permitir comunicação com o frontend) ===
const corsOptions = {
  origin: process.env.FRONTEND_URL,
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
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// === 7. ROTAS DE AUTENTICAÇÃO LEGADAS (GitHub) ===
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: `${process.env.FRONTEND_URL}/entrar` }),
  (req, res) => { res.redirect(`${process.env.FRONTEND_URL}/auth/github/callback`); }
);
app.get('/api/auth/profile', (req, res) => {
  if (req.isAuthenticated()) { res.json({ user: req.user }); } 
  else { res.status(401).json({ message: 'Usuário não autenticado.' }); }
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

// === 8. ROTAS DA APLICAÇÃO ===
app.use('/api', authRoutes); // Suas rotas de /login, /register

// ALTERAÇÃO 2: Adicionamos a rota /me que o frontend precisa, protegida pelo middleware.
app.get('/api/auth/me', authMiddleware, (req, res) => {
  // O middleware já fez todo o trabalho de validação.
  // Agora só precisamos enviar os dados do usuário de volta.
  res.status(200).json(req.user);
});

app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);


// === 9. CRIAR O SERVIDOR HTTP E O SERVIDOR SOCKET.IO ===
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// === 10. LÓGICA DO CHAT (Socket.IO) ===
io.on('connection', (socket) => {
  console.log('🔌 Um usuário se conectou ao chat. ID:', socket.id);

  socket.on('chat message', (msg) => {
    console.log('💬 Mensagem recebida:', msg);
    socket.broadcast.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Um usuário se desconectou. ID:', socket.id);
  });
});

// === 11. INICIA O SERVIDOR HTTP (AGORA COM SOCKET.IO) ===
server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
  console.log(`🚀 Servidor de Chat (Socket.IO) pronto para conexões.`);
});