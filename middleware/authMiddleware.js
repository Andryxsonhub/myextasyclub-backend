// middleware/authMiddleware.js
// --- VERSÃO CORRETA (QUE EXPORTA UM OBJETO) ---

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); 

// -----------------------------------------------------------------
// PORTEIRO 1: "Está logado?"
// -----------------------------------------------------------------
const checkAuth = (req, res, next) => {
  // Permitir requisições OPTIONS passarem
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'Acesso negado. Nenhum token fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Acesso negado. Token mal formatado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Ex: req.user = { userId: 1, email: '...' }
    next();
  } catch (error) {
    console.warn('Falha na verificação do token JWT:', error.message);
    res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

// -----------------------------------------------------------------
// PORTEIRO 2: "Tem plano pago?"
// -----------------------------------------------------------------
const checkPlanAccess = (planosPermitidos) => {
    
    return async (req, res, next) => {
        try {
            const userId = req.user.userId; 

            if (!userId) {
                return res.status(401).json({ message: "Token inválido (sem ID de usuário)." });
            }

            const usuario = await prisma.user.findUnique({
                where: { id: userId },
                select: { 
                    tipo_plano: true, 
                    data_expiracao_plano: true, 
                    status: true 
                }
            });

            if (!usuario) {
                return res.status(404).json({ message: "Usuário do token não encontrado." });
            }

            if (usuario.status === 'congelado') {
                return res.status(403).json({ 
                    message: "Sua conta está congelada. Por favor, reative-a para continuar.",
                    code: "ACCOUNT_FROZEN" 
                });
            }
            if (usuario.status === 'deletado') {
                return res.status(404).json({ message: "Conta não encontrada." });
            }

            const temPermissaoDePlano = planosPermitidos.includes(usuario.tipo_plano);

            if (!temPermissaoDePlano) {
                return res.status(403).json({ 
                    message: "Acesso negado. Seu plano 'gratuito' não permite esta ação. Por favor, faça um upgrade.",
                    code: "UPGRADE_REQUIRED"
                });
            }

            if (usuario.tipo_plano !== 'gratuito') {
                const dataExpiracao = new Date(usuario.data_expiracao_plano);
                const hoje = new Date();

                if (dataExpiracao < hoje) {
                    return res.status(403).json({ 
                        message: "Acesso negado. Seu plano expirou. Por favor, renove sua assinatura.",
                        code: "PLAN_EXPIRED"
                    });
                }
            }
            
            next();

        } catch (error) {
            console.error("Erro no middleware checkPlanAccess:", error);
            res.status(500).json({ message: "Erro interno ao verificar permissões." });
        }
    };
};

// -----------------------------------------------------------------
// EXPORTA OS DOIS MIDDLEWARES EM UM OBJETO (O PONTO PRINCIPAL)
// -----------------------------------------------------------------
module.exports = {
    checkAuth,
    checkPlanAccess
};