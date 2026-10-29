/* ==========================================================================
   DriveXPS Pro 4.0 - Maestro Principal da Aplicação (Alpine.js)
   Arquivo: /js/app.js
   ========================================================================== */

function entregaApp() {
  return {
    // 1. COMPOSIÇÃO DOS SUBMÓDULOS
    ...authModule(),
    ...saasModule(),
    ...shopeeModule(),
    ...mapaGeralModule(),
    ...wazeNavModule(),

    // 2. CONFIGURAÇÕES E ENDPOINTS DE PRODUÇÃO
    DIRECTUS_URL: 'https://banco.studiotesta.com.br',
    N8N_WEBHOOK_URL: 'https://n8n.studiotesta.com.br/webhook/importar-shopee',
    OSRM_ROUTER_URL: 'https://rotas.studiotesta.com.br',

    // 3. ESTADOS GERAIS DA INTERFACE
    tema: localStorage.getItem('drivexps_tema') || 'escuro',
    modo: 'rua', // 'carregamento' (Sacolas), 'rua' (Cockpit), 'mapa' (Leaflet), 'historico', 'navegacao' (Waze 3D)
    
    menuAberto: false,
    buscaAberta: false,
    termoBusca: '',
    modalImportar: false,
    modalResumoImportacao: false,

    // Tutorial Interativo
    tutorialAberto: false,
    passoTutorial: 1,

    // Estados de Instalação PWA
    mostrarPopupInstalar: false,
    temPromptInstalacao: false,
    isStandalone: false,
    isIOS: false,
    isMobile: false,

    /**
     * Ciclo de Vida: Inicialização do Alpine.js
     */
    async init() {
      // Aplica classe de tema ao carregar
      this.aplicarTemaVisual();

      // Checa ambiente PWA
      this.checarInstalacaoPWA();

      // Restaura dados do cache local offline para carregamento instantâneo
      const cacheEntregas = localStorage.getItem('drivexps_entregas_cache');
      if (cacheEntregas) {
        try {
          this.entregas = JSON.parse(cacheEntregas);
        } catch (e) {}
      }

      // Autenticação e sincronização SaaS
      await this.verificarAutenticacao();
      if (this.usuarioLogado) {
        await this.sincronizarAssinaturaSaaS();
        
        if (!this.entregas || this.entregas.length === 0) {
          await this.carregarUltimaRota();
        }
      }

      // Intercepta arquivos compartilhados via Service Worker (PWA Share Target)
      this.escutarArquivosCompartilhados();

      // Exibe tutorial na 1ª visita caso nunca tenha visto
      if (!localStorage.getItem('drivexps_tutorial_visto') && this.usuarioLogado) {
        this.iniciarTutorial();
      }
    },

    /**
     * Alternância de Temas (Alto contraste para Sol vs Noturno)
     */
    alternarTema(novoTema) {
      this.tema = novoTema;
      localStorage.setItem('drivexps_tema', novoTema);
      this.aplicarTemaVisual();
    },

    aplicarTemaVisual() {
      if (this.tema === 'claro') {
        document.body.classList.add('theme-claro');
        document.body.classList.remove('theme-escuro');
      } else {
        document.body.classList.remove('theme-claro');
        document.body.classList.add('theme-escuro');
      }
    },

    /**
     * Captura GPS para definir partida/chegada rápida
     */
    capturarGPSModal() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const latLngStr = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          this.inputPartidaModal = latLngStr;
          this.inputChegadaModal = latLngStr;
          alert('📍 Localização atual gravada na Partida e Chegada!');
        }, err => alert('Erro no GPS: ' + err.message));
      } else {
        alert('Geolocalização não suportada pelo navegador.');
      }
    },

    abrirModalImportar() {
      if (!this.assinaturaValida) { 
        this.modalAssinatura = true; 
        return; 
      }
      this.modalImportar = true;
    },

    /**
     * Abertura e foco da busca global
     */
    abrirBusca() {
      this.buscaAberta = true;
      this.termoBusca = '';
      this.$nextTick(() => {
        if (this.$refs.inputBusca) this.$refs.inputBusca.focus();
      });
    },

    irParaEntregaDireta(item) {
      this.entregaSelecionadaId = item.id;
      this.modo = 'rua';
    },

    /**
     * Tutorial Interativo
     */
    iniciarTutorial() { 
      this.passoTutorial = 1; 
      this.tutorialAberto = true; 
    },
    proximoPassoTutorial() { 
      if (this.passoTutorial < 8) this.passoTutorial++; 
      else this.concluirTutorial(); 
    },
    voltarPassoTutorial() { 
      if (this.passoTutorial > 1) this.passoTutorial--; 
    },
    concluirTutorial() { 
      this.tutorialAberto = false; 
      localStorage.setItem('drivexps_tutorial_visto', 'true'); 
    },

    /**
     * Tratamento de PWA e Instalação no Celular
     */
    checarInstalacaoPWA() {
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const userAgent = window.navigator.userAgent.toLowerCase(); 
      this.isIOS = /iphone|ipad|ipod/.test(userAgent);
      this.isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);

      if (this.isStandalone) { 
        this.mostrarPopupInstalar = false; 
        return; 
      }

      if (window.pwaDeferredPrompt) this.temPromptInstalacao = true;
      window.addEventListener('pwa-pronto-para-instalar', () => { 
        this.temPromptInstalacao = true; 
      });
    },

    acionarInstalacaoManual() {
      if (window.pwaDeferredPrompt) {
        this.instalarPWA();
      } else {
        this.mostrarPopupInstalar = true;
      }
    },

    async instalarPWA() {
      const prompt = window.pwaDeferredPrompt;
      if (!prompt) { 
        alert('Para instalar: abra o menu do navegador (3 pontinhos ou compartilhar) e toque em "Adicionar à tela inicial" ou "Instalar Aplicativo".'); 
        return; 
      }
      prompt.prompt(); 
      await prompt.userChoice;
      window.pwaDeferredPrompt = null; 
      this.mostrarPopupInstalar = false;
    },

    /**
     * Monitoramento de romaneios compartilhados pelo sistema operacional
     */
    escutarArquivosCompartilhados() {
      if (window.location.search.includes('arquivo_compartilhado=true')) {
        this.carregarArquivoCompartilhadoCache();
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.tipo === 'NOVO_ROMANEIO_COMPARTILHADO') {
            this.carregarArquivoCompartilhadoCache();
          }
        });
      }
    },

    async carregarArquivoCompartilhadoCache() {
      try {
        const cache = await caches.open('drivexps-shared-files');
        const resp = await cache.match('ultimo-romaneio');
        if (resp) {
          const blob = await resp.blob();
          const filename = decodeURIComponent(resp.headers.get('X-File-Name') || 'romaneio_shopee.xlsx');
          const file = new File([blob], filename, { type: blob.type });
          this.processarArquivoDirecto(file);
          await cache.delete('ultimo-romaneio');
        }
      } catch (e) {
        console.warn('Erro ao processar romaneio compartilhado do cache:', e);
      }
    }
  };
}