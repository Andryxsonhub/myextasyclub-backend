// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    // 1. Pega o token do cabeçalho da requisição
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    // 2. Se não houver token, retorna um erro de não autorizado
    if (token == null) {
        return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
    }

    // 3. Verifica se o token é válido
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            // Se o token for inválido (expirado, etc.), retorna um erro de token inválido
            return res.status(403).json({ message: 'Token inválido.' });
        }

        // 4. Se o token for válido, anexa os dados do usuário na requisição
        req.user = user;

        // 5. Passa para a próxima etapa (a rota em si)
        next();
    });
};

module.exports = authMiddleware;