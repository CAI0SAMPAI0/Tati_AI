const fs = require('fs');
const path = require('path');

// Função para criar ícone SVG
function createIconSVG(size) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6C63FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#4F46E5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 4}" fill="url(#grad${size})"/>
  <text x="${size/2}" y="${size/2 + size/8}" font-family="Arial, sans-serif" font-size="${size/3}" font-weight="bold" text-anchor="middle" fill="white">T</text>
</svg>`;
}

// Função para converter SVG para PNG (requer biblioteca adicional)
function createIcons() {
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const iconsDir = path.join(__dirname, '..', 'public', 'icons');
    
    // Criar diretório se não existir
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    // Criar ícones SVG
    sizes.forEach(size => {
        const svgContent = createIconSVG(size);
        const filename = `icon-${size}x${size}.svg`;
        fs.writeFileSync(path.join(iconsDir, filename), svgContent);
        console.log(`Criado: ${filename}`);
    });
    
    console.log('Ícones PWA criados com sucesso!');
    console.log('Nota: Para converter SVG para PNG, você pode usar ferramentas online como:');
    console.log('- https://convertio.co/pt/svg-png/');
    console.log('- https://cloudconvert.com/svg-to-png');
}

// Executar criação de ícones
createIcons();
