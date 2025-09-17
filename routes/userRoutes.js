// routes/userRoutes.js

const express = require('express');
const multer = require('multer');
const path = require('path');
const { pool } = require('../db'); // Vamos precisar exportar o 'pool'
const authMiddleware = require('../middleware/authMiddleware'); // Ajuste o caminho se necessário

const router = express.Router();

// --- CONFIGURAÇÃO DO MULTER PARA UPLOAD DE AVATAR ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    // Usa o ID do usuário (do token) para criar um nome de arquivo único
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, req.user.userId + '-' + uniqueSuffix);
  }
});

const upload = multer({ storage: storage });

// --- NOVA ROTA: UPLOAD DE AVATAR ---
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Atualiza o usuário no banco de dados com a nova URL da foto
    const sql = "UPDATE users SET profile_picture_url = ? WHERE id = ?";
    await pool.query(sql, [avatarUrl, req.user.userId]);
    
    res.status(200).json({ message: 'Imagem de perfil atualizada!', avatarUrl });
  } catch (error) {
    console.error('Erro no upload da imagem:', error);
    res.status(500).json({ message: 'Erro ao processar a imagem.' });
  }
});

// --- SUA ROTA EXISTENTE: BUSCAR PERFIL DE USUÁRIO ---
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "SELECT id, name, email, profile_picture_url, bio, created_at FROM users WHERE id = ?";
        const [users] = await pool.query(sql, [id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.status(200).json(users[0]);
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

module.exports = router;