const fs = require('fs');
const path = require('path');

const mode = process.argv[2]; // 'local' ou 'prod'
const configPath = path.join(__dirname, '../mobile_app/capacitor/capacitor.config.json');

if (!mode || (mode !== 'local' && mode !== 'prod')) {
  console.error('Uso: node scripts/switch-env.js <local|prod>');
  process.exit(1);
}

if (!fs.existsSync(configPath)) {
  console.error(`Erro: Arquivo não encontrado em ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

if (mode === 'prod') {
  // Configuração para Produção (Vercel)
  config.server = {
    url: 'https://tati-ai.vercel.app',
    cleartext: true
  };
  console.log('--- Configurando para PRODUÇÃO (Vercel) ---');
} else {
  // Configuração para Local (IP do Computador)
  // Nota: O IP pode mudar dependendo da rede. 
  config.server = {
    url: 'http://192.168.1.3:3000',
    cleartext: true
  };
  console.log('--- Configurando para LOCAL (192.168.1.3) ---');
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Sucesso! capacitor.config.json atualizado.');
console.log('Lembre-se de rodar "npx cap sync" antes de compilar no Android Studio.');
