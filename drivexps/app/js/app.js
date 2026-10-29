/* ==========================================================================
   DriveXPS Pro 4.0 - Maestro Principal da Aplicação (Alpine.js)
   Arquivo: /js/app.js
   ========================================================================== */

/**
 * Utilitário para unir submódulos preservando Getters e Setters reativos
 */
function mergeModules(target, ...sources) {
  for (const source of sources) {
    if (!source) continue;
    const descriptors = Object.getOwnPropertyDescriptors(source);
    Object.defineProperties(target, descriptors);
  }
  return target;
}

function entregaApp() {
  const baseApp = {
    // 1. CONFIGURAÇÕES E ENDPOINTS DE PRODUÇÃO
    DIRECTUS_URL: 'https://banco.studiotesta.com.br',
    N8N_WEBHOOK_URL: 'https://n8n.studiotesta.com.br/webhook/importar-shopee',
    OSRM_ROUTER_URL: 'https://rotas.studiotesta.com.br',

    // 2. ESTADOS GERAIS DA INTERFACE
    tema: localStorage.getItem('drivexps_tema') || 'escuro',
    modo: 'carregamento', // Inicia focado em conferência de sacolas
    
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
      this.aplicarTemaVisual();
      this.checarInstalacaoPWA();

      // 1. Restaura entregas e traçado de ruas do cache local imediato
      const cacheEntregas = localStorage.getItem('drivexps_entregas_cache');
      if (cacheEntregas) {
        try {
          this.entregas = JSON.parse(cacheEntregas);
        } catch (e) {}
      }

      const cacheGeo = localStorage.getItem('drivexps_rota_geometria');
      if (cacheGeo) {
        this.rotaGeometria = cacheGeo;
      }

      // 2. Autenticação e sincronização com o banco
      await this.verificarAutenticacao();

      if (this.usuarioLogado) {
        await this.sincronizarAssinaturaSaaS();
        
        // Sempre busca os dados e o traçado oficial das ruas da rota ativa no servidor
        if (this.rotaAtivaId) {
          await this.carregarEntregasPorId(this.rotaAtivaId);
        } else {
          await this.carregarUltimaRota();
        }
      }

      this.escutarArquivosCompartilhados();

      if (!localStorage.getItem('drivexps_tutorial_visto') && this.usuarioLogado) {
        this.iniciarTutorial();
      }
    },

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
        alert('Para instalar: abra o menu do navegador e toque em "Adicionar à tela inicial" ou "Instalar Aplicativo".'); 
        return; 
      }
      prompt.prompt(); 
      await prompt.userChoice;
      window.pwaDeferredPrompt = null; 
      this.mostrarPopupInstalar = false;
    },

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

  // Une todos os submódulos mantendo Getters reativos
  return mergeModules(
    baseApp,
    authModule(),
    saasModule(),
    shopeeModule(),
    mapaGeralModule(),
    wazeNavModule()
  );
}