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

// Webhook MercadoPago (Rotas públicas)
const mercadopagoWebhook = require('./webhooks/mercadopagoWebhook');

const app = express();
const port = process.env.PORT || 3333;

app.set('trust proxy', 1);

// ======================
// 1) CORS E PARSERS (BODY PARSERS)
// ======================
// Configuração CORS original para Express (mantida)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // Necessário para produção
  'https://myextasyclub.com',
  'https://www.myextasyclub.com'
].filter(Boolean); // Filtra valores undefined/null de FRONTEND_URL se não estiver definido

const corsOptions = {
  origin: function (origin, callback) {
    // Permite requisições sem 'origin' (ex: Postman, apps mobile) ou origens permitidas
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origem: ${origin}`); // Loga a origem bloqueada
      callback(new Error('Acesso não permitido por CORS'));
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
    // CORREÇÃO TEMPORÁRIA PARA TESTE LOCAL: Permitir qualquer origem
    origin: "*", 
    methods: ["GET", "POST"],
    // credentials: true // Manter comentado ou remover se causar problemas com "*"
  }
});

// ======================
// 4) ROTAS PROTEGIDAS (Exigem Login)
// ======================
// Aplica authMiddleware e updateLastSeen para todas as rotas abaixo
app.use(authMiddleware); 
app.use(updateLastSeen); 

app.use('/api/media', mediaRoutes);
app.use('/api/pimentas', pimentaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/payments', paymentRoutes); // Rotas de pagamento agora protegidas
app.use('/api/lives', liveRoutes(io)); // Passa a instância 'io' para as rotas de live
app.use('/api/interactions', interactionRoutes);


// Endpoint de perfil do usuário autenticado ('/auth/me' já está em authRoutes, mas ok ter aqui se precisar de includes extras)
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
    
    // eslint-disable-next-line no-unused-vars
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
  
  socket.on('join_room', (roomName) => { 
    console.log(`[Socket] Usuário ${socket.id} entrou na sala ${roomName}`);
    socket.join(roomName); 
  });
  
  socket.on('chat message', (msg, roomName) => { 
    console.log(`[Socket] Mensagem na sala ${roomName} de ${msg.user.name}: ${msg.text}`);
    // Emite para todos na sala, EXCETO o remetente
    socket.to(roomName).emit('chat message', msg); 
  });
  
  socket.on('disconnect', (reason) => { 
    console.log(`🔌 Um usuário se desconectou. ID: ${socket.id}. Motivo: ${reason}`); 
  });
});

// ======================
// 5) START
// ======================
const effectivePort = process.env.PORT || 3333; // Usar a porta do Render ou 3333 localmente
server.listen(effectivePort, () => {
  console.log(`✅ Servidor backend rodando na porta ${effectivePort}`);
  console.log('🚀 Servidor de Chat (Socket.IO) pronto para conexões.');
});

module.exports = app; // Exportar app pode ser útil para testes
