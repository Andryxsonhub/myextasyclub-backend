// myextasyclub-backend/server.js

// === 1. CARREGA AS VARIÁVEIS DE AMBIENTE (.env) ===
require('dotenv').config();

// === 2. IMPORTAÇÕES ===
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');

// Importações das Rotas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pimentaRoutes = require('./routes/pimentaRoutes');
const liveRoutes = require('./routes/liveRoutes');
const productRoutes = require('./routes/productRoutes'); // <-- ADICIONADO AQUI

// Importações dos Middlewares
const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');


// === 3. INICIALIZAÇÃO ===
const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3333;


// === 4. CONFIGURAÇÃO DE MIDDLEWARES ===
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://myextasyclub.com',
  'https://www.myextasyclub.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso não permitido por CORS'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// === 5. CONFIGURAÇÃO DAS ROTAS ===

// Rotas públicas
app.use('/api', authRoutes);
app.use('/api/products', productRoutes); // <-- ADICIONADO AQUI


// === 6. CONFIGURAÇÃO DO SERVIDOR HTTP E SOCKET.IO ===
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Rotas protegidas que usam o 'io'
app.use('/api/live', authMiddleware, updateLastSeen, liveRoutes(io));

// Outras rotas protegidas
app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!fullUser) return res.status(404).json({ message: 'Usuário não encontrado.' });
    const { password, ...userWithoutPassword } = fullUser;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Erro ao buscar dados do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}`);
  });
});


// === 7. INICIALIZAÇÃO DO SERVIDOR ===
server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});