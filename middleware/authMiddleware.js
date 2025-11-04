// middleware/authMiddleware.js
// --- ATUALIZADO (Adicionado Bloco de DEBUG no checkPlanAccess) ---

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma'); 

// -----------------------------------------------------------------
// PORTEIRO 1: "Está logado?" (checkAuth)
// -----------------------------------------------------------------
const checkAuth = (req, res, next) => {
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
    req.user = decoded; 
    next();
  } catch (error) {
    console.warn('Falha na verificação do token JWT:', error.message);
    res.status(403).json({ message: 'Token inválido ou expirado.' });
  }
};

// -----------------------------------------------------------------
// PORTEIRO 2: "Tem plano pago?" (checkPlanAccess)
// --- ★★★ CÓDIGO CORRIGIDO (LENDO DO TOKEN) + DEBUG ★★★ ---
// -----------------------------------------------------------------
const checkPlanAccess = (planosPermitidos) => {
    return (req, res, next) => {
        try {
            // --- ★★★ INÍCIO DO DEBUG DO "GUARDA" ★★★ ---
            console.log('\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
            console.log('!!! DEBUG (checkPlanAccess): O "GUARDA" ESTÁ VENDO ISSO:');
            console.log('!!! Rota Acessada:', req.originalUrl);
            console.log('!!! Planos Permitidos para esta Rota:', planosPermitidos);
            console.log('!!! Conteúdo do Token (req.user):', JSON.stringify(req.user, null, 2));
            console.log('!!! Plano lido do token:', req.user.tipo_plano);
            console.log('!!! Data de Exp. lida do token:', req.user.data_expiracao_plano);
            console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n');
            // --- ★★★ FIM DO DEBUG ★★★ ---

            const planoDoUsuario = req.user.tipo_plano;
            const dataExpiracaoDoUsuario = req.user.data_expiracao_plano;

            const temPermissaoDePlano = planosPermitidos.includes(planoDoUsuario);

            if (!temPermissaoDePlano) {
                console.log('[checkPlanAccess] BLOQUEADO: O plano do usuário não está na lista.');
                return res.status(403).json({ 
                    message: `Acesso negado. Seu plano '${planoDoUsuario || 'gratuito'}' não permite esta ação.`,
                    code: "UPGRADE_REQUIRED"
                });
            }

            if (planoDoUsuario !== 'gratuito') {
                if (!dataExpiracaoDoUsuario) {
                    console.log('[checkPlanAccess] BLOQUEADO: A data de expiração é nula/undefined.');
                    return res.status(403).json({ 
                        message: "Acesso negado. Seu plano não tem uma data de expiração válida.",
                        code: "PLAN_EXPIRED"
                    });
                }
                
                const dataExpiracao = new Date(dataExpiracaoDoUsuario);
                const hoje = new Date();

                if (dataExpiracao < hoje) {
                    console.log('[checkPlanAccess] BLOQUEADO: O plano expirou.');
                    return res.status(403).json({ 
                        message: "Acesso negado. Seu plano expirou. Por favor, renove sua assinatura.",
                        code: "PLAN_EXPIRED"
                    });
                }
            }
            
            console.log('[checkPlanAccess] ACESSO PERMITIDO. CHAMANDO next()');
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
const checkMessageQuota = async (req, res, next) => {
// (O resto do arquivo é idêntico ao que você já tem)
    try {
        const userId = req.user.userId;
        const usuario = await prisma.user.findUnique({
            where: { id: userId },
            select: { tipo_plano: true, pimentaBalance: true } 
        });
        if (!usuario) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }
        if (usuario.tipo_plano === 'anual') {
            req.messageChargeType = 'franquia'; 
            return next(); 
        }
        const LIMITE_MENSAL = 20; 
        if (usuario.tipo_plano === 'mensal') {
            const hoje = new Date();
            const dataInicioCiclo = new Date();
            dataInicioCiclo.setDate(hoje.getDate() - 30); 
            const messageCount = await prisma.message.count({
                where: {
                    authorId: userId,      
                    createdAt: { gte: dataInicioCiclo } 
                }
            });
            if (messageCount < LIMITE_MENSAL) {
                req.messageChargeType = 'franquia'; 
                return next(); 
            }
        }
        if (usuario.pimentaBalance > 0) {
            req.messageChargeType = 'pimenta'; 
            return next(); 
        }
        return res.status(403).json({
            message: "Você atingiu seu limite de mensagens e não tem Pimentas. Compre um pacote para continuar enviando.",
            code: "QUOTA_EXCEEDED"
        });
    } catch (error) {
        console.error("Erro no middleware checkMessageQuota:", error);
        res.status(500).json({ message: "Erro interno ao verificar permissões de mensagem." });
    }
};

module.exports = {
    checkAuth,
    checkPlanAccess,
    checkMessageQuota
};