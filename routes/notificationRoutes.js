// myextasyclub-backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { checkAuth } = require('../middleware/authMiddleware');

// ROTA: Buscar todas as notificações do usuário logado
router.get('/', checkAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }, // Mais recentes primeiro
    });
    res.json(notifications);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    res.status(500).json({ message: "Erro ao buscar notificações." });
  }
});

// ROTA: Marcar uma notificação específica como lida
router.patch('/:id/read', checkAuth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
    res.json({ message: "Notificação lida." });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar notificação." });
  }
});

// ROTA: Marcar todas como lidas
router.patch('/read-all', checkAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false },
      data: { read: true }
    });
    res.json({ message: "Todas marcadas como lidas." });
  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar todas." });
  }
});

module.exports = router;