// middleware/authMiddleware.js
// --- VERSÃO ATUALIZADA (COM OS 3 PORTEIROS) ---

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); 

// -----------------------------------------------------------------
// PORTEIRO 1: "Está logado?" (checkAuth)
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
// PORTEIRO 2: "Tem plano pago?" (checkPlanAccess)
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
// PORTEIRO 3: "Pode enviar mensagem?" (checkMessageQuota)
// -----------------------------------------------------------------
/**
 * Verifica se o usuário tem permissão para enviar uma mensagem,
 * seja por franquia de plano ou por saldo de pimentas.
 * Este middleware DEVE rodar DEPOIS do checkAuth.
 */
const checkMessageQuota = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // 1. Busca os dados ATUALIZADOS do usuário (incluindo saldo_pimentas)
        const usuario = await prisma.user.findUnique({
            where: { id: userId },
            // (Usando o nome da coluna do seu schema.prisma)
            select: { tipo_plano: true, pimentaBalance: true } 
        });

        if (!usuario) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        // 2. REGRA: Plano 'anual' é ilimitado
        if (usuario.tipo_plano === 'anual') {
            req.messageChargeType = 'franquia'; // Informa ao controller que não deve cobrar pimenta
            return next(); // Pode passar
        }

        // 3. REGRA: Plano 'mensal' (Ex: 20 mensagens / 30 dias)
        const LIMITE_MENSAL = 20; // (Usando o limite que sugerimos)

        if (usuario.tipo_plano === 'mensal') {
            const hoje = new Date();
            const dataInicioCiclo = new Date();
            dataInicioCiclo.setDate(hoje.getDate() - 30); // Calcula 30 dias atrás

            // (Usando os nomes que criamos no schema.prisma)
            const messageCount = await prisma.message.count({
                where: {
                    authorId: userId,         // Coluna do Remetente
                    createdAt: { gte: dataInicioCiclo } // Coluna da Data
                }
            });

            if (messageCount < LIMITE_MENSAL) {
                req.messageChargeType = 'franquia'; // Informa ao controller que não deve cobrar pimenta
                return next(); // Pode passar (ainda tem franquia)
            }
        }

        // 4. REGRA: Se for 'gratuito' OU 'mensal' (sem franquia), checa Pimentas
        // (Usando 'pimentaBalance' do seu schema.prisma)
        if (usuario.pimentaBalance > 0) {
            // O usuário TEM pimentas para gastar
            req.messageChargeType = 'pimenta'; // Informa ao controller que DEVE cobrar pimenta
            return next(); // Pode passar
        }

        // 5. BLOQUEIO TOTAL: Sem franquia e sem pimentas
        return res.status(403).json({
            message: "Você atingiu seu limite de mensagens e não tem Pimentas. Compre um pacote para continuar enviando.",
            code: "QUOTA_EXCEEDED"
        });

    } catch (error) {
        console.error("Erro no middleware checkMessageQuota:", error);
        res.status(500).json({ message: "Erro interno ao verificar permissões de mensagem." });
    }
};


// -----------------------------------------------------------------
// EXPORTA TODOS OS MIDDLEWARES
// -----------------------------------------------------------------
module.exports = {
    checkAuth,
    checkPlanAccess,
    checkMessageQuota // <-- Nosso novo porteiro
};