// routes/mediaRoutes.js (VERSÃO FINAL COM CURINGA *)

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');

// A CORREÇÃO ESTÁ AQUI -> /:folder/*
// O Express irá capturar a pasta no parâmetro 'folder'
// e TUDO o que vier depois do '*' será colocado em 'req.params[0]'
router.get('/:folder/*', authMiddleware, async (req, res) => {
  try {
    // Capturamos os parâmetros da forma correta
    const folder = req.params.folder;
    const filename = req.params[0]; // O nome do arquivo vem do curinga '*'

    // Uma verificação de segurança para impedir que usuários acessem outras pastas
    if (!filename || filename.includes('..')) {
      return res.status(400).json({ message: 'Nome de arquivo inválido.' });
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