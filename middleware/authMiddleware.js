// backend/middleware/authMiddleware.js (VERSÃO FINAL CORRIGIDA - Handle OPTIONS)

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // --- ADICIONADO: Permitir requisições OPTIONS passarem ---
  // O middleware 'cors' configurado no server.js cuidará de responder ao OPTIONS.
  if (req.method === 'OPTIONS') {
    return next();
  }
  // --- FIM DA ADIÇÃO ---

  // 1. Procura pelo token no cabeçalho 'Authorization'
  const authHeader = req.headers['authorization'];

  // 2. Se o cabeçalho não existir (e não for OPTIONS), nega o acesso.
  if (!authHeader) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  // 3. Separa "Bearer" do token.
  const token = authHeader.split(' ')[1];

  // 4. Se não houver token após a separação, nega o acesso.
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token mal formatado.' });
  }

  try {
    // 5. Verifica o token.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 6. Adiciona os dados do usuário ao 'req'.
    req.user = decoded; // Garante que as rotas terão acesso a req.user.userId
    
    // 7. Continua para a rota desejada.
    next();
  } catch (error) {
    // 8. Se o token for inválido/expirado.
    console.warn('Falha na verificação do token JWT:', error.message); // Log mais detalhado
    res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;