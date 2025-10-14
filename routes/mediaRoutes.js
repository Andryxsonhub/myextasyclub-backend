// routes/mediaRoutes.js (VERSÃO FINAL COM QUERY PARAMETERS)

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');

// A rota agora é simples: /media
// As informações virão via query: ?folder=...&file=...
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 1. Lemos os parâmetros da query string (ex: req.query.folder)
    const { folder, file: filename } = req.query;

    // Uma verificação de segurança para impedir que usuários acessem outras pastas
    if (!filename || !folder || filename.includes('..') || folder.includes('..')) {
      return res.status(400).json({ message: 'Parâmetros de arquivo inválidos.' });
    }

    const loggedInUser = req.user;
    const filePath = path.join(__dirname, '..', 'uploads', folder, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado.' });
    }

    const watermarkText = `${loggedInUser.name} - ${new Date().toLocaleDateString('pt-BR')}`;

    const svgWatermark = `
      <svg width="500" height="40">
        <text
            x="10" y="30"
            font-family="Arial, sans-serif"
            font-size="24"
            fill="rgba(255, 255, 255, 0.5)"
            text-anchor="start">
          ${watermarkText}
        </text>
      </svg>
    `;

    const imageBuffer = await sharp(filePath)
      .composite([{
        input: Buffer.from(svgWatermark),
        gravity: 'southeast',
      }])
      .jpeg({ quality: 80 })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);

  } catch (error) {
    console.error("Erro ao aplicar marca d'água:", error);
    res.status(500).json({ message: 'Erro ao processar a imagem.' });
  }
});

module.exports = router;