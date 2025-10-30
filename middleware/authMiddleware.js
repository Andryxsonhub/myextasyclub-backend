// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
// 1. Usando PRISMA, assim como o resto do seu backend
const prisma = require('../lib/prisma'); 

// -----------------------------------------------------------------
// PORTEIRO 1: "Está logado?" (O seu middleware antigo, renomeado)
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
    // 2. Verificando o token e colocando o payload em req.user
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Ex: req.user = { userId: 1, email: '...' }
    next();
  } catch (error) {
    console.warn('Falha na verificação do token JWT:', error.message);
    res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

// -----------------------------------------------------------------
// PORTEIRO 2: "Tem plano pago?" (O nosso novo middleware)
// -----------------------------------------------------------------
/**
 * Verifica se o usuário logado (pelo checkAuth) tem um plano e status válidos.
 * Este middleware DEVE rodar DEPOIS do checkAuth.
 * @param {Array<string>} planosPermitidos - Ex: ['mensal', 'anual']
 */
const checkPlanAccess = (planosPermitidos) => {
    
    // Este middleware é 'async' pois ele vai consultar o banco de dados
    return async (req, res, next) => {
        try {
            // 3. Pegando o 'userId' que o checkAuth nos deu
            const userId = req.user.userId; 

            if (!userId) {
                return res.status(401).json({ message: "Token inválido (sem ID de usuário)." });
            }

            // 4. Busca os dados ATUALIZADOS do usuário no banco
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

            // 5. Verifica o STATUS da conta (Fase 6)
            if (usuario.status === 'congelado') {
                return res.status(403).json({ 
                    message: "Sua conta está congelada. Por favor, reative-a para continuar.",
                    code: "ACCOUNT_FROZEN" 
                });
            }
            if (usuario.status === 'deletado') {
                return res.status(404).json({ message: "Conta não encontrada." });
            }

            // 6. Verifica a PERMISSÃO DE PLANO
            const temPermissaoDePlano = planosPermitidos.includes(usuario.tipo_plano);

            if (!temPermissaoDePlano) {
                return res.status(403).json({ 
                    message: "Acesso negado. Seu plano 'gratuito' não permite esta ação. Por favor, faça um upgrade.",
                    code: "UPGRADE_REQUIRED"
                });
            }

            // 7. Verifica se o PLANO NÃO EXPIROU
            if (usuario.tipo_plano !== 'gratuito') {
                const dataExpiracao = new Date(usuario.data_expiracao_plano);
                const hoje = new Date();

                if (dataExpiracao < hoje) {
                    // TODO: Idealmente, teríamos um script que limpa planos expirados,
                    // mas por enquanto, só bloquear já funciona.
                    return res.status(403).json({ 
                        message: "Acesso negado. Seu plano expirou. Por favor, renove sua assinatura.",
                        code: "PLAN_EXPIRED"
                    });
                }
            }

            // 8. Se passou por todas as verificações, PODE PASSAR!
            next();

        } catch (error) {
            console.error("Erro no middleware checkPlanAccess:", error);
            res.status(500).json({ message: "Erro interno ao verificar permissões." });
        }
    };
};


// -----------------------------------------------------------------
// EXPORTA OS DOIS MIDDLEWARES EM UM OBJETO
// -----------------------------------------------------------------
module.exports = {
    checkAuth,
    checkPlanAccess
};