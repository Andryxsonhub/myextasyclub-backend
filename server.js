// === 1. CARREGA AS VARIÁVEIS DE AMBIENTE (.env) ===
require('dotenv').config();

// === 2. IMPORTAÇÕES ===
const express = require('express');
const cors = require('cors');
// ... (resto das suas importações)
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pimentaRoutes = require('./routes/pimentaRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const liveRoutes = require('./routes/liveRoutes');


// === 3. CONFIGURAÇÃO DO EXPRESS ===
const app = express();
const port = process.env.PORT || 3333;

// === 4. CORS (CORREÇÃO FINAL) ===
// Lista de endereços (origens) que têm permissão para acessar nosso backend.
const allowedOrigins = [
  process.env.FRONTEND_URL,       // A URL que está no seu .env (ex: http://localhost:3000)
  'https://myextasyclub.com',     // A URL do seu site de produção
  'https://www.myextasyclub.com'  // A URL com 'www', por segurança
];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite a conexão se a origem estiver na nossa lista VIP
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
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


// === O RESTO DO SEU SERVER.JS CONTINUA IGUAL ===
// ... (middlewares, rotas, etc.)
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', authRoutes);
app.use('/api/pimentas', pimentaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/live', liveRoutes);

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!fullUser) return res.status(404).json({ message: 'Usuário não encontrado.' });
    const { password, ...userWithoutPassword } = fullUser;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Usa a mesma lista VIP
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Um usuário se conectou ao chat. ID:', socket.id);
  socket.on('disconnect', () => {
    console.log('🔌 Um usuário se desconectou. ID:', socket.id);
  });
});

server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
});
