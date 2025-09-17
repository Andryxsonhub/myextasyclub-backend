const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs'); // Importa o bcrypt para hashear senhas
const { pool } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================================
// ========== NOVA ROTA: REGISTRO DE NOVO USUÁRIO ===========
// ==========================================================
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, profileType } = req.body;

    // 1. Validação básica dos dados recebidos
    if (!email || !password || !username || !profileType) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }

    // 2. Verificar se o e-mail ou username já existem
    const checkUserSql = "SELECT * FROM users WHERE email = ? OR name = ?";
    const [existingUsers] = await pool.query(checkUserSql, [email, username]);
    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrado.' });
    }

    // 3. Hashear a senha antes de salvar (MUITO IMPORTANTE para segurança)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Inserir o novo usuário no banco de dados
    const insertUserSql = "INSERT INTO users (name, email, password, profile_type) VALUES (?, ?, ?, ?)";
    const [result] = await pool.query(insertUserSql, [username, email, hashedPassword, profileType]);

    const newUser = {
        id: result.insertId,
        email,
        username,
        profileType
    };

    // 5. Enviar resposta de sucesso
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser });

  } catch (error) {
    console.error('Erro no registro do usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// --- CONFIGURAÇÃO DO MULTER PARA UPLOAD DE AVATAR ---
// (código existente)
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


// --- ROTA: UPLOAD DE AVATAR ---
// (código existente)
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    // ... seu código de upload ...
});


// --- ROTA: BUSCAR PERFIL DE USUÁRIO ---
// (código existente)
router.get('/:id', async (req, res) => {
    // ... seu código de busca de perfil ...
});

module.exports = router;