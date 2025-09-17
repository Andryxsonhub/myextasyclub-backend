// routes/userRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../db'); // Seu arquivo de conexão com o banco
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================================
//           ROTA DE REGISTRO DE NOVO USUÁRIO (ATUALIZADA)
// ==========================================================
// URL: /api/users/register
router.post('/register', async (req, res) => {
  try {
    // 1. Extrai TODOS os dados do corpo da requisição (novos e antigos)
    const {
      email,
      password,
      username,
      profileType,
      interests,
      desires,
      fetishes,
      location,
      favoritedSuggestions // Note o camelCase vindo do frontend
    } = req.body;

    // 2. Validação dos campos essenciais
    if (!email || !password || !username || !profileType) {
      return res.status(400).json({ message: 'Campos essenciais são obrigatórios.' });
    }

    // 3. Verifica se o usuário já existe
    const checkUserSql = "SELECT id FROM users WHERE email = ? OR name = ?";
    const [existingUsers] = await pool.query(checkUserSql, [email, username]);

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrado.' });
    }

    // 4. Criptografa a senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. ATUALIZAÇÃO: Query SQL agora inclui as novas colunas
    const insertUserSql = `
      INSERT INTO users (
        name, email, password, profile_type, 
        interests, desires, fetishes, location, favorited_suggestions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // 6. ATUALIZAÇÃO: Lista de valores para a query, incluindo os novos dados
    // Usamos JSON.stringify para converter os arrays do JS em texto no formato JSON,
    // que é como o banco de dados espera receber.
    const values = [
      username,
      email,
      hashedPassword,
      profileType,
      JSON.stringify(interests || []),
      JSON.stringify(desires || []),
      JSON.stringify(fetishes || []),
      location || null,
      JSON.stringify(favoritedSuggestions || []) // Mapeia camelCase para snake_case
    ];

    const [result] = await pool.query(insertUserSql, values);
    
    // 7. Prepara o objeto de resposta (sem dados sensíveis)
    const newUser = {
      id: result.insertId,
      username: username,
      email: email
    };

    console.log(`Perfil completo do usuário '${newUser.username}' cadastrado com sucesso!`);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });

  } catch (error) {
    console.error('Erro no registro do usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// ==========================================================
//              ROTA DE UPLOAD DE AVATAR (POST)
// ==========================================================
// (Sem alterações aqui, o código continua o mesmo)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, req.user.userId + '-' + uniqueSuffix);
  }
});
const upload = multer({ storage: storage });

router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  // ... seu código de upload ...
});


// ==========================================================
//          ROTA PARA BUSCAR PERFIL DE USUÁRIO (GET)
// ==========================================================
// (Sem alterações aqui, o código continua o mesmo)
router.get('/:id', async (req, res) => {
  // ... seu código de busca de perfil ...
});


module.exports = router;