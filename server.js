const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
// AJUSTE 1: Usar a porta do ambiente ou a 3001 como padrão
const port = process.env.PORT || 3001;

// --- Middlewares Essenciais ---
app.use(cors());
app.use(express.json());

// AJUSTE 2: Pegar a chave secreta das variáveis de ambiente
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("ERRO FATAL: A variável de ambiente JWT_SECRET não está definida.");
  process.exit(1); // Encerra a aplicação se a chave não for encontrada
}

// AJUSTE 3: Pegar as configurações do banco das variáveis de ambiente
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";
    await pool.query(sql, [name, email, hashedPassword]);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Este e-mail já está em uso.' });
    }
    console.error('Erro no servidor ao tentar cadastrar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }
    const sql = "SELECT * FROM users WHERE email = ?";
    const [users] = await pool.query(sql, [email]);
    if (users.length === 0) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }
    const user = users[0];
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
    }
    const token = jwt.sign(
      { userId: user.id, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.status(200).json({ message: 'Login bem-sucedido!', token: token });
  } catch (error) {
    console.error('Erro no servidor ao tentar fazer login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// --- ROTAS DE POSTS ---
app.get('/api/posts', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.*, 
                u.name AS author_name,
                u.profile_picture_url AS author_avatar_url 
            FROM posts AS p
            JOIN users AS u ON p.userid = u.id
            ORDER BY p.created_at DESC
        `;
        const [posts] = await pool.query(sql);
        res.status(200).json(posts);
    } catch (error) {
        console.error('Erro ao buscar posts:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar posts.' });
    }
});

app.post('/api/posts/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?";
        await pool.query(sql, [id]);
        const [result] = await pool.query("SELECT likes_count FROM posts WHERE id = ?", [id]);
        const newLikesCount = result[0].likes_count;
        res.status(200).json({ message: 'Post curtido com sucesso!', likes_count: newLikesCount });
    } catch (error) {
        console.error('Erro ao curtir post:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao curtir o post.' });
    }
});


// --- ROTA DE PERFIL DE USUÁRIO (ATUALIZADA) ---
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = "SELECT id, name, email, profile_picture_url, bio, created_at FROM users WHERE id = ?";
        const [users] = await pool.query(sql, [id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = users[0];
        res.status(200).json(user);
    } catch (error) {
        console.error('Erro ao buscar perfil do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});


// --- Iniciar o Servidor ---
app.listen(port, () => {
  // AJUSTE 4: Mensagem de log um pouco mais genérica
  console.log(`Servidor backend rodando na porta ${port}`);
});