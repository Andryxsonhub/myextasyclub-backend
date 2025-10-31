// server.js
// --- CÓDIGO ATUALIZADO (com messageRoutes) ---

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
const messageRoutes = require('./routes/messageRoutes'); // --- LINHA NECESSÁRIA (1/2) ---

// Middlewares
const { checkAuth } = require('./middleware/authMiddleware'); 
const updateLastSeen = require('./middleware/updateLastSeen');

// Webhook MercadoPago (Rotas públicas)
const mercadopagoWebhook = require('./webhooks/mercadopagoWebhook');

const app = express();
const port = process.env.PORT || 3333;

app.set('trust proxy', 1);

// ======================
// 1) CORS E PARSERS (BODY PARSERS)
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
// 2) ROTAS PÚBLICAS (WEBHOOKS E AUTENTICAÇÃO)
// ======================

// Webhook MercadoPago
app.use('/api/payments', mercadopagoWebhook);

// Rotas públicas de autenticação e produtos
app.use('/api', authRoutes); // Inclui /register e /login
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

// ======================
// 4) ROTAS PROTEGIDAS (Exigem Login)
// ======================
app.use(checkAuth); 
app.use(updateLastSeen); 

app.use('/api/media', mediaRoutes);
app.use('/api/pimentas', pimentaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/lives', liveRoutes(io)); 
app.use('/api/interactions', interactionRoutes);
app.use('/api/messages', messageRoutes(io)); // --- LINHA NECESSÁRIA (2/2) ---


// Endpoint de perfil do usuário autenticado
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
    console.error("Erro ao buscar dados do usuário:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
A }
});

// Chat (Socket.IO)
io.on('connection', (socket) => {
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}`);
  
  socket.on('join_room', (roomName) => { 
    console.log(`[Socket] Usuário ${socket.id} entrou na sala ${roomName}`);
    socket.join(roomName); 
  });
  
  socket.on('chat message', (msg, roomName) => { 
    console.log(`[Socket] Mensagem na sala ${roomName} de ${msg.user.name}: ${msg.text}`);
    socket.to(roomName).emit('chat message', msg); 
  });
  
  socket.on('disconnect', (reason) => { 
    console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}. Motivo: ${reason}`); 
  });
});

// ======================
// 5) START
// ======================
const effectivePort = process.env.PORT || 3333; 
server.listen(effectivePort, () => {
  console.log(`✅ Servidor backend rodando na porta ${effectivePort}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});

module.exports = app;