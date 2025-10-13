// backend/server.js (VERSÃO FINAL COM CHAT FUNCIONAL)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const prisma = require('./lib/prisma');

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pimentaRoutes = require('./routes/pimentaRoutes');
const liveRoutes = require('./routes/liveRoutes');
const productRoutes = require('./routes/productRoutes'); // <-- ADICIONADO AQUI

const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');

const app = express();
const port = process.env.PORT || 3333;

const allowedOrigins = [
  'http://localhost:5173', 'http://localhost:4173', 'http://localhost:3000',
  process.env.FRONTEND_URL, 'https://myextasyclub.com', 'https://www.myextasyclub.com'
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

app.use('/api', authRoutes);
app.use('/api/products', productRoutes); // <-- ADICIONADO AQUI

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);
app.use('/api/lives', authMiddleware, updateLastSeen, liveRoutes(io));

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

// ==========================================================
//  AQUI ESTÁ A LÓGICA DO CHAT CORRIGIDA
// ==========================================================
io.on('connection', (socket) => {
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}`);
  
  // 1. O usuário avisa em qual sala de live ele quer entrar
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    console.log(`[Socket.IO] Usuário ${socket.id} entrou na sala: ${roomName}`);
  });

  // 2. Quando o servidor recebe uma 'chat message' de um usuário...
  socket.on('chat message', (msg, roomName) => {
    // 3. Ele retransmite a mensagem para TODOS OS OUTROS na mesma sala.
    socket.to(roomName).emit('chat message', msg);
    console.log(`[Socket.IO] Mensagem recebida na sala ${roomName} e retransmitida.`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}`);
  });
});

server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});