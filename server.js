// server.js
// --- CORRIGIDO (Adicionado Socket.IO Auth e Lógica de Permissão no Chat) ---

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const prisma = require('./lib/prisma');
const jwt = require('jsonwebtoken'); // --- ★★★ ADICIONADO (1/5) ★★★ ---

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
const messageRoutes = require('./routes/messageRoutes');

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

// --- ★★★ ADICIONADO (2/5) ★★★ ---
// ======================
// 3B) SOCKET.IO AUTHENTICATION MIDDLEWARE
// ======================
// Isso "protege" CADA conexão de socket
io.use((socket, next) => {
  // O frontend (Live.tsx) vai enviar o token aqui
  const token = socket.handshake.auth.token;

  if (!token) {
    console.warn(`[Socket Auth] Conexão recusada (sem token). ID: ${socket.id}`);
    return next(new Error('Acesso negado. Nenhum token fornecido.'));
  }

  try {
    // Verifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ★ IMPORTANTE: Anexa os dados do usuário (incluindo o plano) ao socket
    socket.user = decoded; // ex: { userId: 1, tipo_plano: 'mensal', ... }
    next(); // Permite a conexão
  } catch (error) {
    console.warn(`[Socket Auth] Conexão recusada (token inválido). ID: ${socket.id}`);
    return next(new Error('Token inválido ou expirado.'));
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
app.use('/api/messages', messageRoutes(io));


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
  }
});

// --- ★★★ CORRIGIDO (3/5) ★★★ ---
// Chat (Socket.IO) - Lógica de Permissão Adicionada
io.on('connection', (socket) => {
  // Graças ao io.use(), agora temos 'socket.user' em todas as conexões
  console.log(`🔌 Um usuário se conectou ao chat. ID: ${socket.id}, UserID: ${socket.user.userId}, Plano: ${socket.user.tipo_plano}`);
  
  socket.on('join_room', (roomName) => { 
    console.log(`[Socket] Usuário ${socket.id} (UserID: ${socket.user.userId}) entrou na sala ${roomName}`);
    socket.join(roomName); 
  });
  
  // --- ★★★ CORRIGIDO (4/5) ★★★ ---
  socket.on('chat message', (msg, roomName) => { 
    // 1. Verifica se é um PRESENTE (isTip). Presentes são permitidos para TODOS.
    if (msg.isTip === true) {
        console.log(`[Socket] Presente 🎁 na sala ${roomName} de UserID ${socket.user.userId}`);
        socket.to(roomName).emit('chat message', msg); // Envia para todos na sala
        return; // Permite o presente
    }

    // 2. Se não é presente, é CHAT. Verifica o plano (do token seguro).
    const planoDoUsuario = socket.user.tipo_plano;

    if (!planoDoUsuario || planoDoUsuario === 'gratuito') {
        // 3. BLOQUEIA o usuário 'gratuito'
        console.log(`[Socket] Chat bloqueado 🚫 para plano '${planoDoUsuario}' (UserID: ${socket.user.userId})`);
        // Avisa SÓ AQUELE usuário que a msg foi bloqueada
        socket.emit('chat_error', { message: "Faça upgrade do seu plano para conversar no chat." });
        return; // Impede a mensagem de ser enviada
    }
    
    // 4. Se chegou aqui, é um usuário PAGO. Permite o chat.
    // (Corrigido de msg.user.name e msg.text para msg.content, que é o que o cliente envia)
    console.log(`[Socket] Mensagem na sala ${roomName} de UserID ${socket.user.userId}: ${msg.content}`);
    socket.to(roomName).emit('chat message', msg); 
  });
  
  // --- ★★★ CORRIGIDO (5/5) ★★★ ---
  socket.on('disconnect', (reason) => { 
    // Adiciona 'socket.user' ao log para saber quem desconectou
    const userId = socket.user ? socket.user.userId : 'desconhecido';
    console.log(`🔌 Um usuário se desconectou. ID: ${socket.id} (UserID: ${userId}). Motivo: ${reason}`); 
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