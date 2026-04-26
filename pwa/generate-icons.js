const fs = require('fs');
const path = require('path');

// Criar diretório de ícones se não existir
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Criar ícones simples usando SVG
const createIcon = (size) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C63FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4F46E5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" fill="url(#grad)"/>
  <text x="${size/2}" y="${size/2 + size/8}" font-family="Arial, sans-serif" font-size="${size/3}" font-weight="bold" text-anchor="middle" fill="white">T</text>
</svg>`;
  
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), Buffer.from(svg));
  console.log(`Criado ícone: icon-${size}x${size}.png`);
};

// Criar todos os tamanhos necessários
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
sizes.forEach(size => createIcon(size));

console.log('Ícones PWA criados com sucesso!');
