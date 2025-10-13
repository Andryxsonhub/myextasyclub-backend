// routes/mediaRoutes.js (ARQUIVO NOVO)

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/authMiddleware');

// Nova rota segura para servir imagens com marca d'água
// Ex: GET /api/media/photos/nome-do-arquivo.jpg
router.get('/:folder/:filename', authMiddleware, async (req, res) => {
  try {
    const { folder, filename } = req.params;
    const loggedInUser = req.user; // Obtido pelo authMiddleware

    // 1. Monta o caminho completo para o arquivo original no servidor
    const filePath = path.join(__dirname, '..', 'uploads', folder, filename);

    // Verifica se o arquivo realmente existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Arquivo não encontrado.' });
    }

    // 2. Cria o texto da marca d'água com o nome do usuário logado e a data
    const watermarkText = `${loggedInUser.name} - ${new Date().toLocaleDateString('pt-BR')}`;

    // 3. Cria uma imagem SVG em memória para ser a marca d'água
    // Isso nos dá mais controle sobre a aparência (cor, fonte, opacidade)
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

    // 4. Usa a biblioteca 'sharp' para ler a imagem e aplicar a marca d'água
    const imageBuffer = await sharp(filePath)
      .composite([{
        input: Buffer.from(svgWatermark),
        gravity: 'southeast', // Posição: canto inferior direito
      }])
      .jpeg({ quality: 80 }) // Comprime a imagem para carregar mais rápido
      .toBuffer();

    // 5. Envia a imagem processada como resposta
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);

  } catch (error) {
    console.error("Erro ao aplicar marca d'água:", error);
    res.status(500).json({ message: 'Erro ao processar a imagem.' });
  }
});

module.exports = router;