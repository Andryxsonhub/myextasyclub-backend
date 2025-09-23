// backend/middleware/authMiddleware.js (VERSÃO FINAL E MAIS ROBUSTA)

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  // 1. Procura pelo token no cabeçalho 'Authorization'
  const authHeader = req.headers['authorization'];

  // 2. Se o cabeçalho não existir, nega o acesso imediatamente
  if (!authHeader) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  // 3. O cabeçalho vem no formato "Bearer TOKEN". Nós separamos a palavra "Bearer" do token.
  const token = authHeader.split(' ')[1];

  // 4. Se, após a separação, não houver um token, nega o acesso.
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token mal formatado.' });
  }

  try {
    // 5. Verifica se o token é válido usando o nosso segredo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 6. Se for válido, adiciona os dados do usuário (o 'payload' do token) ao objeto 'req'
    //    para que as próximas rotas possam usá-lo.
    req.user = decoded;
    
    // 7. Permite que a requisição continue para a rota desejada (ex: /profile ou /create-payment)
    next();
  } catch (error) {
    // 8. Se o token for inválido ou expirado, o jwt.verify vai dar um erro.
    res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

module.exports = authMiddleware;
