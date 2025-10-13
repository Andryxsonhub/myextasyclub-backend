// backend/server.js (VERSÃO COM MARCA D'ÁGUA)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const prisma = require('./lib/prisma');

// --- 1. IMPORTAR A NOVA ROTA ---
const mediaRoutes = require('./routes/mediaRoutes'); 

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
// ... (outras importações de rotas)

const authMiddleware = require('./middleware/authMiddleware');
const updateLastSeen = require('./middleware/updateLastSeen');

const app = express();
const port = process.env.PORT || 3333;

// ... (configuração do CORS permanece a mesma)

app.use(cors(corsOptions));
app.use(express.json());

// --- 2. LINHA REMOVIDA ---
// A linha abaixo foi REMOVIDA para que os arquivos não sejam mais públicos.
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', authRoutes);
app.use('/api/products', productRoutes);

const server = http.createServer(app);
const io = new Server(server, { /* ... */ });

// --- 3. ADICIONAR A NOVA ROTA ---
// Todas as requisições para /api/media agora passarão pelo nosso novo sistema
app.use('/api/media', mediaRoutes); 

app.use('/api/pimentas', authMiddleware, updateLastSeen, pimentaRoutes);
app.use('/api/users', authMiddleware, updateLastSeen, userRoutes);
app.use('/api/posts', authMiddleware, updateLastSeen, postRoutes);
app.use('/api/payments', authMiddleware, updateLastSeen, paymentRoutes);
app.use('/api/lives', authMiddleware, updateLastSeen, liveRoutes(io));

// ... (o resto do seu server.js permanece exatamente o mesmo) ...

app.get('/api/auth/me', /* ... */ );
io.on('connection', /* ... */ );
server.listen(port, /* ... */ );

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