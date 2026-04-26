class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = document.getElementById('install-button');
        this.init();
    }

    init() {
        // Escuta o evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Escuta o evento appinstalled
        window.addEventListener('appinstalled', () => {
            this.hideInstallButton();
            console.log('App instalado com sucesso!');
        });

        // Se houver botão, adiciona evento de clique
        if (this.installButton) {
            this.installButton.addEventListener('click', () => this.install());
        }
    }

    showInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'block';
            this.installButton.classList.add('show');
        }
    }

    hideInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'none';
            this.installButton.classList.remove('show');
        }
    }

    async install() {
        if (!this.deferredPrompt) {
            console.log('Instalação não disponível');
            return;
        }

        try {
            // Mostra o prompt de instalação
            const { outcome } = await this.deferredPrompt.prompt();
            
            if (outcome === 'accepted') {
                console.log('Usuário aceitou a instalação');
                this.hideInstallButton();
            } else {
                console.log('Usuário recusou a instalação');
            }
            
            // Limpa o prompt
            this.deferredPrompt = null;
        } catch (error) {
            console.error('Erro ao instalar o app:', error);
        }
    }

    // Método para forçar a instalação (útil para botões personalizados)
    forceInstall() {
        this.install();
    }

    // Verifica se o app pode ser instalado
    canInstall() {
        return this.deferredPrompt !== null;
    }

    // Verifica se o app já foi instalado
    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches;
    }
}

// Exporta a classe
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstaller;
} else {
    // Torna globalmente disponível
    window.PWAInstaller = PWAInstaller;
}