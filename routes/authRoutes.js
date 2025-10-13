// backend/routes/authRoutes.js (VERSÃO FINAL COM USERNAME)

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

router.post('/register', async (req, res) => {
    // CORREÇÃO: Pegamos 'name' e 'username' separadamente do corpo da requisição
    const { name, username, email, password, profileType, interests, desires, fetishes, location } = req.body;

    // CORREÇÃO: Adicionamos 'username' à validação
    if (!email || !password || !name || !username) {
        return res.status(400).json({ message: 'Nome, nome de usuário, e-mail e senha são obrigatórios.' });
    }

    try {
        // CORREÇÃO: Verificamos se o email OU o username já existem
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });

        if (existingUser) {
            return res.status(409).json({ message: 'E-mail ou nome de usuário já cadastrados.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                username, // <-- CORREÇÃO: Salvamos o username no campo correto
                email,
                password: hashedPassword,
                profileType,
                interests: interests ? JSON.stringify(interests) : null,
                desires: desires ? JSON.stringify(desires) : null,
                fetishes: fetishes ? JSON.stringify(fetishes) : null,
                location,
            },
        });
        
        res.status(201).json({ message: 'Usuário criado com sucesso!', userId: newUser.id });

    } catch (error) {
        console.error('Erro no registro de usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }

        const user = await prisma.user.findUnique({
            where: { email: email },
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        // CORREÇÃO: Adicionamos 'username' ao token JWT para ser usado em outras rotas
        const token = jwt.sign(
            { userId: user.id, name: user.name, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: 'Login bem-sucedido!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                username: user.username, // <-- CORREÇÃO: Enviamos o username para o frontend
                email: user.email,
            },
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

module.exports = router;
