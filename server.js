// server.js
// --- ATUALIZAÇÃO: Inclusão das rotas de Notificações com Deep Linking ---

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const prisma = require('./lib/prisma');
const jwt = require('jsonwebtoken'); 

// Importações de rotas
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const productRoutes = require('./routes/productRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const notificationRoutes = require('./routes/notificationRoutes'); // <-- NOVA ROTA

// Middlewares
const { checkAuth } = require('./middleware/authMiddleware'); 
const updateLastSeen = require('./middleware/updateLastSeen');

// Webhook MercadoPago (Rotas públicas)
const mercadopagoWebhook = require('./webhooks/mercadopagoWebhook');

const app = express();
const port = process.env.PORT || 3333;

app.set('trust proxy', 1);

// ======================
// 1) CORS E PARSERS
// ======================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, 
  'https://myextasyclub.com',
  'https://www.myextasyclub.com'
].filter(Boolean); 

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origem: ${origin}`); 
      callback(null, false);
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ======================
// 2) ROTAS PÚBLICAS
// ======================
app.use('/api/payments', mercadopagoWebhook);
app.use('/api', authRoutes);
app.use('/api/products', productRoutes);

// ======================
// 3) SOCKET.IO
// ======================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Acesso negado.'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; 
    next();
  } catch (error) {
    return next(new Error('Token inválido.'));
  }
});


// ======================
// 4) ROTAS PROTEGIDAS
// ======================
app.use(checkAuth); 
app.use(updateLastSeen); 

// Rotas que dependem do 'io'
const liveRoutes = require('./routes/liveRoutes')(io);
const messageRoutes = require('./routes/messageRoutes')(io);
const pimentaRoutes = require('./routes/pimentaRoutes')(io);

app.use('/api/media', mediaRoutes);
app.use('/api/pimentas', pimentaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/lives', liveRoutes); 
app.use('/api/interactions', interactionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes); // <-- REGISTRO DA ROTA DE NOTIFICAÇÕES

// Endpoint de perfil
app.get('/api/auth/me', async (req, res) => {
  try {
    const fullUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        following: { select: { followingId: true } },
        likesGiven: { select: { likedUserId: true } },
        blockedUsers: { select: { blockedUserId: true } }
      }
    });
    if (!fullUser) return res.status(404).json({ message: 'Usuário não encontrado.' });
    const { password, ...userWithoutPassword } = fullUser;
    res.status(200).json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: "Erro interno." });
  }
});

// Socket.IO Events
io.on('connection', (socket) => {
  socket.on('join_room', (roomName) => socket.join(roomName));
  socket.on('chat message', (msg, roomName) => { 
    if (msg.isTip === true) {
        socket.to(roomName).emit('chat message', msg);
        return;
    }
    const planoDoUsuario = socket.user.tipo_plano;
    if (!planoDoUsuario || planoDoUsuario === 'gratuito') {
        socket.emit('chat_error', { message: "Faça upgrade do seu plano." });
        return;
    }
    socket.to(roomName).emit('chat message', msg); 
  });
});

// ======================
// 5) START
// ======================
const effectivePort = process.env.PORT || 3333; 
server.listen(effectivePort, () => {
  console.log(`✅ Servidor backend rodando na porta ${effectivePort}`);
});

module.exports = app;