// backend/server.js (VERSÃO FINAL E CORRETA)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const prisma = require('./lib/prisma');

// Importações de rotas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pimentaRoutes = require('./routes/pimentaRoutes');
const liveRoutes = require('./routes/liveRoutes');
const productRoutes = require('./routes/productRoutes');
const mediaRoutes = require('./routes/mediaRoutes'); // Rota da marca d'água

// Middlewares
const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');

// 🔔 Webhook PagBank (precisa vir ANTES do express.json())
const pagbankWebhook = require('./webhooks/pagbankWebhook');

const app = express();
const port = process.env.PORT || 3333;

// Render/Proxy: habilita X-Forwarded-* corretamente (cookies, secure, etc.)
app.set('trust proxy', 1);

// ======================
// 1) MONTA O WEBHOOK AQUI
// ======================
// ⚠️ O pagbankWebhook já usa express.raw internamente.
//    Ele precisa ser montado antes de qualquer body parser JSON global.
app.use(pagbankWebhook);

// ======================
// 2) DEMAIS PARSERS E CORS
// ======================
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
// Parsers globais (depois do webhook)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// 3) ROTAS PÚBLICAS
// ======================
app.use('/api', authRoutes);
app.use('/api/products', productRoutes);

// ======================
// 4) SOCKET.IO
// ======================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ======================
// 5) ROTAS PROTEGIDAS
// ======================
app.use('/api/media', mediaRoutes); // pública ou protegida? (mantive como estava)
app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);
app.use('/api/lives', authMiddleware, updateLastSeen, liveRoutes(io));

// Endpoint de perfil do usuário autenticado
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

// Chat (Socket.IO)
io.on('connection', (socket) => {
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}`);
  socket.on('join_room', (roomName) => { socket.join(roomName); });
  socket.on('chat message', (msg, roomName) => { socket.to(roomName).emit('chat message', msg); });
  socket.on('disconnect', () => { console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}`); });
});

// ======================
// 6) START
// ======================
server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});
