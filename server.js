// backend/server.js (VERSÃO FINAL E CORRETA)
// --- ATUALIZADO PARA INCLUIR DADOS DE LIKE/FOLLOW NO LOGIN ---

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
const mediaRoutes = require('./routes/mediaRoutes');
const interactionRoutes = require('./routes/interactionRoutes');

// Middlewares
const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');

// Webhook PagBank
const pagbankWebhook = require('./webhooks/pagbankWebhook');

const app = express();
const port = process.env.PORT || 3333;

app.set('trust proxy', 1);

// ======================
// 1) MONTA O WEBHOOK AQUI
// ======================
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
app.use('/api/media', mediaRoutes);
app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);
app.use('/api/lives', authMiddleware, updateLastSeen, liveRoutes(io));
app.use('/api/interactions', authMiddleware, updateLastSeen, interactionRoutes);

// --- ESTE ENDPOINT FOI MODIFICADO ---
// Endpoint de perfil do usuário autenticado
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    // Agora buscamos o usuário E suas relações de "seguir" e "curtir"
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        // Inclui um array 'following' com os IDs de quem o usuário segue
        following: {
          select: { followingId: true }
        },
        // Inclui um array 'likesGiven' com os IDs de quem o usuário curtiu
        likesGiven: {
          select: { likedUserId: true }
        }
      }
    });

    if (!fullUser) return res.status(404).json({ message: 'Usuário não encontrado.' });
    
    const { password, ...userWithoutPassword } = fullUser;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error("Erro ao buscar dados do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
});
// --- FIM DA MODIFICAÇÃO ---

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