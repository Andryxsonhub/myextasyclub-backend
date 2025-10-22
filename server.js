// backend/server.js
// --- ATUALIZADO PARA WEBHOOKS DO MERCADOPAGO ---

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
const paymentRoutes = require('./routes/paymentRoutes'); // (Rotas protegidas)
const pimentaRoutes = require('./routes/pimentaRoutes');
const liveRoutes = require('./routes/liveRoutes');
const productRoutes = require('./routes/productRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const interactionRoutes = require('./routes/interactionRoutes');

// Middlewares
const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');

// Webhook PagBank (Comentado)
// const pagbankWebhook = require('./webhooks/pagbankWebhook');

// --- NOVO ---
// Webhook MercadoPago (Rotas públicas)
const mercadopagoWebhook = require('./webhooks/mercadopagoWebhook');

const app = express();
const port = process.env.PORT || 3333;

app.set('trust proxy', 1);

// ======================
// 1) CORS E PARSERS (BODY PARSERS)
// (Movido para cima. Deve vir ANTES de TODAS as rotas)
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
app.use(express.json()); // <-- Essencial para o webhook ler o req.body
app.use(express.urlencoded({ extended: true }));


// ======================
// 2) ROTAS PÚBLICAS (WEBHOOKS E AUTENTICAÇÃO)
// ======================
// Webhook PagBank (Desativado)
// app.use(pagbankWebhook);

// --- NOVO ---
// Webhook MercadoPago (Público, sem authMiddleware)
// O prefixo /api/payments + /webhook-mercadopago (do arquivo)
// forma: /api/payments/webhook-mercadopago
app.use('/api/payments', mercadopagoWebhook);

// Rotas públicas de autenticação e produtos
app.use('/api', authRoutes);
app.use('/api/products', productRoutes);

// ======================
// 3) SOCKET.IO
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
// 4) ROTAS PROTEGIDAS (Exigem Login)
// ======================
app.use('/api/media', mediaRoutes);
app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);

// --- ATUALIZADO ---
// Estas são as rotas PROTEGIDAS de pagamento (ex: /create-pimenta-checkout)
// Elas usam o mesmo prefixo /api/payments, mas como vêm DEPOIS
// do webhook, o Express aplica o authMiddleware corretamente.
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);

app.use('/api/lives', authMiddleware, updateLastSeen, liveRoutes(io));
app.use('/api/interactions', authMiddleware, updateLastSeen, interactionRoutes);


// Endpoint de perfil do usuário autenticado
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        following: {
          select: { followingId: true }
        },
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

// Chat (Socket.IO)
io.on('connection', (socket) => {
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}`);
  socket.on('join_room', (roomName) => { socket.join(roomName); });
  socket.on('chat message', (msg, roomName) => { socket.to(roomName).emit('chat message', msg); });
  socket.on('disconnect', () => { console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}`); });
});

// ======================
// 5) START
// ======================
server.listen(port, () => {
  console.log(`✅ Servidor backend rodando na porta ${port}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});