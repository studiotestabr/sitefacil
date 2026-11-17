/* ==========================================================================
   Um Canto, Uma Prece! v1.0.0 - Núcleo Reativo Oficial
   Repertório por Categorias, Karaokê Sincronizado, Áudio Offline & Painel Admin
   Arquivo: /um-canto-uma-prece/js/app.js
   ========================================================================== */

function umCantoApp() {
  return {
    // 1. ENDPOINTS OFICIAIS
    DIRECTUS_URL: 'https://banco.studiotesta.com.br',
    N8N_WEBHOOK_URL: 'https://n8n.studiotesta.com.br/webhook/processar-ponto-umbanda',
    AUDIO_CACHE_NAME: 'um-canto-uma-prece-audios-v1',

    // 2. PREFERÊNCIAS VISUAIS E NAVEGAÇÃO
    tema: localStorage.getItem('canto_tema') || 'escuro',
    tamanhoFonteKaraoke: localStorage.getItem('canto_fonte') || 'normal', // 'normal' | 'grande' | 'gigante'
    abaAtual: 'repertorio', // 'repertorio' | 'karaoke' | 'favoritos' | 'admin'
    menuAberto: false,
    buscaAberta: false,
    termoBusca: '',
    categoriaSelecionada: 'Todas',

    // 3. CATÁLOGO OFICIAL DE CATEGORIAS (ORIXÁS & LINHAS)
    categoriasLista: [
      { nome: 'Oxalá', icone: '🕊️' },
      { nome: 'Ogum', icone: '⚔️' },
      { nome: 'Oxóssi', icone: '🏹' },
      { nome: 'Xangô', icone: '⚡' },
      { nome: 'Iansã', icone: '🌪️' },
      { nome: 'Oxum', icone: '💛' },
      { nome: 'Iemanjá', icone: '🌊' },
      { nome: 'Nanã', icone: '💜' },
      { nome: 'Obaluaê / Omolu', icone: '🌾' },
      { nome: 'Caboclos', icone: '🪶' },
      { nome: 'Pretos Velhos', icone: '☕' },
      { nome: 'Erês (Crianças)', icone: '🍬' },
      { nome: 'Baianos', icone: '🥥' },
      { nome: 'Boiadeiros', icone: '🤠' },
      { nome: 'Marinheiros', icone: '⚓' },
      { nome: 'Ciganos', icone: '🔮' },
      { nome: 'Exu', icone: '🔱' },
      { nome: 'Pombagira', icone: '🌹' },
      { nome: 'Zé Pelintra / Malandragem', icone: '🎩' },
      { nome: 'Abertura / Defumação / Encerramento', icone: '🌿' },
      { nome: 'Hino / Louvação', icone: '🙏' },
      { nome: 'Outros', icone: '🥁' }
    ],

    tiposPontoLista: [
      'Ponto Cantado',
      'Chamada',
      'Firmeza',
      'Subida',
      'Saudação',
      'Defumação',
      'Demanda',
      'Hino / Louvação'
    ],

    // 4. DADOS DO REPERTÓRIO E FAVORITOS
    pontos: [],
    carregandoPontos: false,
    erroCarregamento: null,
    favoritosIds: new Set(JSON.parse(localStorage.getItem('canto_favoritos') || '[]')),
    audiosOfflineUrls: new Set(JSON.parse(localStorage.getItem('canto_audios_offline') || '[]')),
    baixandoOfflineId: null,
    baixandoLoteOffline: false,

    // 5. ESTADO DO PLAYER & KARAOKÊ SINCRONIZADO
    pontoAtual: null,
    versosAtuais: [],
    tocando: false,
    carregandoAudio: false,
    erroAudio: null,
    tempoAtualSeg: 0,
    duracaoTotalSeg: 0,
    velocidadeAudio: Number(localStorage.getItem('canto_velocidade') || '1'),
    loopAtivo: false,
    indiceVersoAtivo: -1,
    usuarioRolandoManualmente: false,
    timeoutScrollManual: null,

    // 6. STATUS DE REDE, WAKE LOCK & PWA
    estaOnline: navigator.onLine,
    wakeLockSentinel: null,
    wakeLockAtivo: false,
    isStandalone: false,
    isIOS: false,
    temPromptInstalacao: false,
    mostrarPopupInstalar: false,

    // 7. ÁREA ADMIN (DIRECTUS AUTH + CADASTRO + EDITOR DE SINCRONIZAÇÃO)
    adminLogado: false,
    adminEmail: '',
    adminNome: '',
    tokenAcesso: localStorage.getItem('directus_token') || null,
    loginEmailInput: '',
    loginSenhaInput: '',
    carregandoLogin: false,
    erroLogin: '',

    // Formulário de Novo Ponto (YouTube ou Upload Direto)
    formModoEntrada: 'youtube', // 'youtube' | 'arquivo'
    formYoutubeUrl: '',
    formArquivoNome: '',
    formArquivoBase64: '',
    formArquivoMime: '',
    formTitulo: '',
    formCategoria: 'Auto',
    formTipoPonto: 'Ponto Cantado',
    formToque: '',
    formObservacoes: '',
    formLetraManual: '',
    processandoNovoPonto: false,
    statusProcessamento: '',
    erroProcessamento: '',

    // Editor Fino de Ponto Existente & Timestamps
    modalEditorAberto: false,
    editandoPonto: null,
    editandoVersos: [],
    salvandoEdicao: false,

    // =========================================================================
    // INICIALIZAÇÃO DO APP
    // =========================================================================
    async init() {
      this.aplicarTemaVisual();
      this.checarInstalacaoPWA();

      window.addEventListener('online', () => {
        this.estaOnline = true;
        this.carregarPontos();
      });

      window.addEventListener('offline', () => {
        this.estaOnline = false;
      });

      // Carrega cache instantâneo para abrir rápido mesmo sem sinal no terreiro
      const cachePontos = localStorage.getItem('canto_pontos_cache');
      if (cachePontos) {
        try {
          const parsed = JSON.parse(cachePontos);
          if (Array.isArray(parsed)) this.pontos = parsed;
        } catch (e) {}
      }

      this.configurarListenersAudio();
      await this.verificarAutenticacaoAdmin();
      await this.carregarPontos();
      await this.sincronizarListaAudiosOffline();

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (this.tocando || this.abaAtual === 'karaoke')) {
          this.ativarWakeLock();
        }
      });
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

    alternarTema(novoTema) {
      this.tema = novoTema;
      localStorage.setItem('canto_tema', novoTema);
      this.aplicarTemaVisual();
    },

    alterarTamanhoFonte(tamanho) {
      this.tamanhoFonteKaraoke = tamanho;
      localStorage.setItem('canto_fonte', tamanho);
    },

    // =========================================================================
    // WAKE LOCK API (MANTÉM TELA ACESA DURANTE ENSAIO OU GIRA)
    // =========================================================================
    async ativarWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          if (this.wakeLockSentinel) return;
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockAtivo = true;
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockSentinel = null;
            this.wakeLockAtivo = false;
          });
        } catch (err) {
          this.wakeLockAtivo = false;
        }
      }
    },

    liberarWakeLock() {
      if (this.wakeLockSentinel) {
        try {
          this.wakeLockSentinel.release();
        } catch (e) {}
        this.wakeLockSentinel = null;
        this.wakeLockAtivo = false;
      }
    },

    // =========================================================================
    // DIRECTUS API (PÚBLICO + ADMIN COM REFRESH AUTOMÁTICO)
    // =========================================================================
    async fetchDirectus(path, options = {}, usarAuth = true) {
      const url = path.startsWith('http') ? path : `${this.DIRECTUS_URL}${path}`;
      const headers = { ...(options.headers || {}) };
      if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      if (usarAuth) {
        const token = this.tokenAcesso || localStorage.getItem('directus_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOpts = { ...options, headers, credentials: usarAuth ? 'include' : 'omit' };
      let res = await fetch(url, fetchOpts);

      if (usarAuth && res.status === 401) {
        const renovou = await this.tentarRenovarTokenDirectus();
        if (renovou) {
          headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
          res = await fetch(url, { ...fetchOpts, headers });
        }
      }
      return res;
    },

    async tentarRenovarTokenDirectus() {
      const refreshToken = localStorage.getItem('directus_refresh_token');
      try {
        const bodyPayload = refreshToken ? { refresh_token: refreshToken, mode: 'json' } : { mode: 'session' };
        const res = await fetch(`${this.DIRECTUS_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(bodyPayload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data?.access_token) {
            this.tokenAcesso = data.data.access_token;
            localStorage.setItem('directus_token', this.tokenAcesso);
            if (data.data.refresh_token) {
              localStorage.setItem('directus_refresh_token', data.data.refresh_token);
            }
            return true;
          }
        }
      } catch (e) {}
      return false;
    },

    async carregarPontos() {
      if (!navigator.onLine && this.pontos.length > 0) return;

      this.carregandoPontos = true;
      this.erroCarregamento = null;

      try {
        // Busca pública sem depender de token de sessão expirado
        const filtro = this.adminLogado ? '' : '&filter[ativo][_eq]=true';
        const res = await this.fetchDirectus(
          `/items/pontos_umbanda?sort=categoria,titulo&limit=500${filtro}`,
          { method: 'GET' },
          false
        );

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json.data)) {
            this.pontos = json.data;
            localStorage.setItem('canto_pontos_cache', JSON.stringify(this.pontos));

            // Atualiza referência do ponto ativo se estiver aberto no karaokê
            if (this.pontoAtual) {
              const atualizado = this.pontos.find(p => String(p.id) === String(this.pontoAtual.id));
              if (atualizado) {
                this.pontoAtual = atualizado;
                this.versosAtuais = this.normalizarVersos(atualizado);
              }
            }
          }
        } else {
          this.erroCarregamento = 'Não foi possível atualizar o repertório agora.';
        }
      } catch (err) {
        if (this.pontos.length === 0) {
          this.erroCarregamento = 'Sem conexão com o servidor no momento.';
        }
      } finally {
        this.carregandoPontos = false;
      }
    },

    // =========================================================================
    // HELPERS DE REPERTÓRIO, FILTROS & FAVORITOS
    // =========================================================================
    obterIconeCategoria(nomeCat) {
      const cat = this.categoriasLista.find(c => c.nome.toLowerCase() === String(nomeCat || '').toLowerCase());
      return cat ? cat.icone : '🥁';
    },

    obterUrlAudio(ponto) {
      if (!ponto) return '';
      if (ponto.audio_url && String(ponto.audio_url).trim()) {
        return String(ponto.audio_url).trim();
      }
      if (ponto.audio_file_id) {
        const fid = typeof ponto.audio_file_id === 'object' ? ponto.audio_file_id.id : ponto.audio_file_id;
        if (fid) return `${this.DIRECTUS_URL}/assets/${fid}`;
      }
      return '';
    },

    normalizarVersos(ponto) {
      if (!ponto) return [];

      let lista = ponto.letra_sincronizada;
      if (typeof lista === 'string') {
        try {
          lista = JSON.parse(lista);
        } catch (e) {
          lista = [];
        }
      }

      if (Array.isArray(lista) && lista.length > 0) {
        return lista
          .map(v => ({
            start: Number(v.start ?? v.time ?? 0),
            end: Number(v.end ?? (Number(v.start ?? v.time ?? 0) + 4)),
            text: String(v.text || '').trim()
          }))
          .filter(v => v.text.length > 0);
      }

      // Fallback para letra completa sem timestamp
      if (ponto.letra_completa && String(ponto.letra_completa).trim()) {
        return String(ponto.letra_completa)
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
          .map(texto => ({ start: -1, end: -1, text: texto }));
      }

      return [];
    },

    get categoriasComContagem() {
      const contagem = {};
      this.pontos.forEach(p => {
        if (p.ativo === false && !this.adminLogado) return;
        const c = p.categoria || 'Outros';
        contagem[c] = (contagem[c] || 0) + 1;
      });

      return this.categoriasLista
        .map(c => ({
          ...c,
          total: contagem[c.nome] || 0
        }))
        .filter(c => c.total > 0);
    },

    get pontosFiltrados() {
      let lista = [...this.pontos];

      if (!this.adminLogado) {
        lista = lista.filter(p => p.ativo !== false);
      }

      if (this.abaAtual === 'favoritos') {
        lista = lista.filter(p => this.favoritosIds.has(p.id));
      } else if (this.categoriaSelecionada && this.categoriaSelecionada !== 'Todas') {
        lista = lista.filter(p => (p.categoria || 'Outros') === this.categoriaSelecionada);
      }

      if (this.termoBusca && this.termoBusca.trim().length > 0) {
        const t = this.termoBusca
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim();

        lista = lista.filter(p => {
          const texto = [p.titulo, p.categoria, p.tipo_ponto, p.toque, p.letra_completa, p.observacoes]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return texto.includes(t);
        });
      }

      return lista;
    },

    isFavorito(id) {
      return this.favoritosIds.has(id);
    },

    alternarFavorito(ponto, event) {
      if (event) event.stopPropagation();
      if (!ponto) return;

      if (this.favoritosIds.has(ponto.id)) {
        this.favoritosIds.delete(ponto.id);
      } else {
        this.favoritosIds.add(ponto.id);
      }
      localStorage.setItem('canto_favoritos', JSON.stringify(Array.from(this.favoritosIds)));
      if ('vibrate' in navigator) navigator.vibrate(25);
    },

    // =========================================================================
    // CACHE DE ÁUDIO OFFLINE (PARA TERREIROS SEM 4G)
    // =========================================================================
    async sincronizarListaAudiosOffline() {
      if (!('caches' in window)) return;
      try {
        const cache = await caches.open(this.AUDIO_CACHE_NAME);
        const keys = await cache.keys();
        const urls = new Set(keys.map(k => k.url.split('#')[0]));
        this.audiosOfflineUrls = urls;
        localStorage.setItem('canto_audios_offline', JSON.stringify(Array.from(urls)));
      } catch (e) {}
    },

    isAudioOffline(ponto) {
      const url = this.obterUrlAudio(ponto);
      if (!url) return false;
      return this.audiosOfflineUrls.has(url);
    },

    async alternarAudioOffline(ponto, event) {
      if (event) event.stopPropagation();
      const url = this.obterUrlAudio(ponto);
      if (!url || !('caches' in window)) return;

      const cache = await caches.open(this.AUDIO_CACHE_NAME);

      if (this.audiosOfflineUrls.has(url)) {
        await cache.delete(url);
        this.audiosOfflineUrls.delete(url);
        localStorage.setItem('canto_audios_offline', JSON.stringify(Array.from(this.audiosOfflineUrls)));
        return;
      }

      this.baixandoOfflineId = ponto.id;
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res && res.ok) {
          await cache.put(url, res);
          this.audiosOfflineUrls.add(url);
          localStorage.setItem('canto_audios_offline', JSON.stringify(Array.from(this.audiosOfflineUrls)));
          if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
        } else {
          alert('Não foi possível baixar este áudio agora.');
        }
      } catch (e) {
        alert('Verifique sua conexão para baixar o áudio para uso offline.');
      } finally {
        this.baixandoOfflineId = null;
      }
    },

    async baixarTodosFiltradosOffline() {
      const lista = this.pontosFiltrados.filter(p => this.obterUrlAudio(p) && !this.isAudioOffline(p));
      if (lista.length === 0) {
        alert('Todos os pontos desta seleção já estão salvos para uso offline!');
        return;
      }
      if (!confirm(`Deseja baixar ${lista.length} áudio(s) para ouvir offline dentro do terreiro?`)) return;

      this.baixandoLoteOffline = true;
      try {
        const cache = await caches.open(this.AUDIO_CACHE_NAME);
        for (const p of lista) {
          const url = this.obterUrlAudio(p);
          try {
            const res = await fetch(url, { mode: 'cors' });
            if (res && res.ok) {
              await cache.put(url, res);
              this.audiosOfflineUrls.add(url);
            }
          } catch (err) {}
        }
        localStorage.setItem('canto_audios_offline', JSON.stringify(Array.from(this.audiosOfflineUrls)));
        alert('✅ Pontos salvos para ensaio offline com sucesso!');
      } finally {
        this.baixandoLoteOffline = false;
      }
    },

    // =========================================================================
    // MOTOR DO PLAYER & KARAOKÊ SINCRONIZADO
    // =========================================================================
    configurarListenersAudio() {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;

      audio.playbackRate = this.velocidadeAudio || 1.0;

      audio.addEventListener('loadstart', () => {
        this.carregandoAudio = true;
        this.erroAudio = null;
      });

      audio.addEventListener('canplay', () => {
        this.carregandoAudio = false;
        audio.playbackRate = this.velocidadeAudio || 1.0;
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          this.duracaoTotalSeg = audio.duration;
        }
      });

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          this.duracaoTotalSeg = audio.duration;
        }
      });

      audio.addEventListener('play', () => {
        this.tocando = true;
        this.ativarWakeLock();
        this.atualizarMediaSession();
      });

      audio.addEventListener('pause', () => {
        this.tocando = false;
      });

      audio.addEventListener('timeupdate', () => {
        this.tempoAtualSeg = audio.currentTime || 0;
        this.sincronizarVersoPorTempo(this.tempoAtualSeg);
      });

      audio.addEventListener('ended', () => {
        if (this.loopAtivo) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return;
        }
        this.tocando = false;
        this.indiceVersoAtivo = -1;
      });

      audio.addEventListener('error', () => {
        this.carregandoAudio = false;
        this.tocando = false;
        this.erroAudio = 'Não foi possível reproduzir este áudio. Verifique a conexão ou se ele foi salvo offline.';
      });
    },

    abrirPontoNoKaraoke(ponto, autoPlay = true) {
      if (!ponto) return;

      const audio = document.getElementById('audioPlayerPrincipal');
      const mesmoPonto = this.pontoAtual && String(this.pontoAtual.id) === String(ponto.id);

      this.pontoAtual = ponto;
      this.versosAtuais = this.normalizarVersos(ponto);
      this.abaAtual = 'karaoke';
      this.erroAudio = null;
      this.usuarioRolandoManualmente = false;
      this.ativarWakeLock();

      if (!mesmoPonto) {
        this.tempoAtualSeg = 0;
        this.duracaoTotalSeg = Number(ponto.duracao_seg) || 0;
        this.indiceVersoAtivo = -1;

        const url = this.obterUrlAudio(ponto);
        if (audio && url) {
          audio.src = url;
          audio.load();
          audio.playbackRate = this.velocidadeAudio || 1.0;
          if (autoPlay) {
            audio.play().catch(() => {
              this.tocando = false;
            });
          }
        }
      } else if (autoPlay && audio && audio.paused) {
        audio.play().catch(() => {});
      }

      this.$nextTick(() => {
        const palco = document.getElementById('palcoKaraoke');
        if (palco) palco.scrollTop = 0;
      });
    },

    alternarPlayPause() {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio || !this.pontoAtual) return;

      if (!audio.src) {
        const url = this.obterUrlAudio(this.pontoAtual);
        if (!url) {
          this.erroAudio = 'Este ponto ainda não possui arquivo de áudio vinculado.';
          return;
        }
        audio.src = url;
      }

      if (audio.paused) {
        audio.playbackRate = this.velocidadeAudio || 1.0;
        audio.play().catch(() => {
          this.erroAudio = 'Toque novamente para liberar o áudio no navegador.';
        });
      } else {
        audio.pause();
      }
    },

    reiniciarPonto() {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;
      audio.currentTime = 0;
      this.tempoAtualSeg = 0;
      this.indiceVersoAtivo = -1;
      if (audio.paused) audio.play().catch(() => {});
    },

    buscarTempoSlider(novoTempo) {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;
      const t = Number(novoTempo) || 0;
      audio.currentTime = t;
      this.tempoAtualSeg = t;
      this.sincronizarVersoPorTempo(t, true);
    },

    avancarOuVoltarSegundos(delta) {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;
      const maxT = this.duracaoTotalSeg || audio.duration || 9999;
      const novo = Math.max(0, Math.min(maxT, (audio.currentTime || 0) + delta));
      audio.currentTime = novo;
      this.tempoAtualSeg = novo;
      this.sincronizarVersoPorTempo(novo, true);
    },

    alterarVelocidade(vel) {
      this.velocidadeAudio = Number(vel);
      localStorage.setItem('canto_velocidade', String(this.velocidadeAudio));
      const audio = document.getElementById('audioPlayerPrincipal');
      if (audio) audio.playbackRate = this.velocidadeAudio;
      if ('vibrate' in navigator) navigator.vibrate(20);
    },

    alternarLoop() {
      this.loopAtivo = !this.loopAtivo;
      if ('vibrate' in navigator) navigator.vibrate(20);
    },

    pularParaVerso(verso, idx) {
      if (!verso || verso.start < 0) return;
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;

      const t = Math.max(0, Number(verso.start) || 0);
      audio.currentTime = t;
      this.tempoAtualSeg = t;
      this.indiceVersoAtivo = idx;
      this.usuarioRolandoManualmente = false;

      if (audio.paused) {
        audio.playbackRate = this.velocidadeAudio || 1.0;
        audio.play().catch(() => {});
      }
      if ('vibrate' in navigator) navigator.vibrate(25);
    },

    marcarScrollManualPalco() {
      this.usuarioRolandoManualmente = true;
      if (this.timeoutScrollManual) clearTimeout(this.timeoutScrollManual);
      this.timeoutScrollManual = setTimeout(() => {
        this.usuarioRolandoManualmente = false;
      }, 3000);
    },

    sincronizarVersoPorTempo(tempoAtual, forcarScroll = false) {
      if (!this.versosAtuais || this.versosAtuais.length === 0) return;
      if (this.versosAtuais[0].start < 0) return; // Sem timestamps

      let novoIndice = -1;
      for (let i = 0; i < this.versosAtuais.length; i++) {
        const v = this.versosAtuais[i];
        if (tempoAtual >= (v.start - 0.15)) {
          novoIndice = i;
        } else {
          break;
        }
      }

      if (novoIndice !== this.indiceVersoAtivo) {
        this.indiceVersoAtivo = novoIndice;
        if (novoIndice >= 0 && (!this.usuarioRolandoManualmente || forcarScroll)) {
          this.$nextTick(() => {
            const el = document.getElementById(`verso-karaoke-${novoIndice}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      }
    },

    tocarProximoPonto(direcao = 1) {
      const lista = this.pontosFiltrados.length > 0 ? this.pontosFiltrados : this.pontos;
      if (!lista || lista.length === 0) return;
      if (!this.pontoAtual) {
        this.abrirPontoNoKaraoke(lista[0], true);
        return;
      }

      const idxAtual = lista.findIndex(p => String(p.id) === String(this.pontoAtual.id));
      let proxIdx = idxAtual + direcao;
      if (proxIdx < 0) proxIdx = lista.length - 1;
      if (proxIdx >= lista.length) proxIdx = 0;
      this.abrirPontoNoKaraoke(lista[proxIdx], true);
    },

    formatarTempoMMSS(segundos) {
      const s = Math.max(0, Math.floor(Number(segundos) || 0));
      const min = Math.floor(s / 60);
      const seg = s % 60;
      return `${min}:${seg < 10 ? '0' : ''}${seg}`;
    },

    atualizarMediaSession() {
      if (!('mediaSession' in navigator) || !this.pontoAtual) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: this.pontoAtual.titulo || 'Ponto de Umbanda',
          artist: `${this.pontoAtual.categoria || 'Umbanda'} • Um Canto, Uma Prece!`,
          album: this.pontoAtual.tipo_ponto || 'Pontos Cantados'
        });
        navigator.mediaSession.setActionHandler('play', () => this.alternarPlayPause());
        navigator.mediaSession.setActionHandler('pause', () => this.alternarPlayPause());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.tocarProximoPonto(-1));
        navigator.mediaSession.setActionHandler('nexttrack', () => this.tocarProximoPonto(1));
      } catch (e) {}
    },

    // =========================================================================
    // ÁREA ADMIN (LOGIN DIRECTUS, ENVIO PARA N8N & EDITOR DE SINCRONIZAÇÃO)
    // =========================================================================
    async verificarAutenticacaoAdmin() {
      if (localStorage.getItem('canto_admin_deslogado') === 'true') {
        this.adminLogado = false;
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      const tokenUrl = searchParams.get('access_token') || hashParams.get('access_token') || searchParams.get('token');
      const refreshUrl = searchParams.get('refresh_token') || hashParams.get('refresh_token');

      if (tokenUrl) {
        this.tokenAcesso = tokenUrl;
        localStorage.setItem('directus_token', tokenUrl);
      }
      if (refreshUrl) {
        localStorage.setItem('directus_refresh_token', refreshUrl);
      }

      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (!this.tokenAcesso) {
        this.adminLogado = false;
        return;
      }

      try {
        const res = await this.fetchDirectus('/users/me', { method: 'GET' }, true);
        if (res && res.ok) {
          const data = await res.json();
          if (data?.data?.id) {
            this.adminLogado = true;
            this.adminEmail = data.data.email || '';
            this.adminNome = [data.data.first_name, data.data.last_name].filter(Boolean).join(' ') || data.data.email || 'Dirigente';
            return;
          }
        }
      } catch (e) {}
      this.adminLogado = false;
    },

    async loginDirectusEmailSenha() {
      const email = (this.loginEmailInput || '').trim();
      const password = this.loginSenhaInput || '';
      if (!email || !password) {
        this.erroLogin = 'Informe o e-mail e a senha do Directus.';
        return;
      }

      this.carregandoLogin = true;
      this.erroLogin = '';
      localStorage.removeItem('canto_admin_deslogado');

      try {
        const res = await fetch(`${this.DIRECTUS_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, mode: 'json' })
        });
        const data = await res.json();
        if (res.ok && data?.data?.access_token) {
          this.tokenAcesso = data.data.access_token;
          localStorage.setItem('directus_token', this.tokenAcesso);
          if (data.data.refresh_token) {
            localStorage.setItem('directus_refresh_token', data.data.refresh_token);
          }
          this.loginSenhaInput = '';
          await this.verificarAutenticacaoAdmin();
          await this.carregarPontos();
        } else {
          this.erroLogin = 'E-mail ou senha inválidos.';
        }
      } catch (e) {
        this.erroLogin = 'Erro ao conectar ao servidor Directus.';
      } finally {
        this.carregandoLogin = false;
      }
    },

    loginGoogleAdmin() {
      localStorage.removeItem('canto_admin_deslogado');
      const urlLimpa = window.location.origin + window.location.pathname;
      window.location.href = `${this.DIRECTUS_URL}/auth/login/google?redirect=${encodeURIComponent(urlLimpa)}`;
    },

    async deslogarAdmin() {
      localStorage.setItem('canto_admin_deslogado', 'true');
      localStorage.removeItem('directus_token');
      localStorage.removeItem('directus_refresh_token');
      this.tokenAcesso = null;
      this.adminLogado = false;
      this.adminEmail = '';
      this.adminNome = '';
      try {
        await fetch(`${this.DIRECTUS_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ mode: 'session' })
        });
      } catch (e) {}
      this.abaAtual = 'repertorio';
      await this.carregarPontos();
    },

    selecionarArquivoAudioAdmin(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.formArquivoNome = file.name;
      this.formArquivoMime = file.type || 'audio/mpeg';
      if (!this.formTitulo) {
        this.formTitulo = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.formArquivoBase64 = e.target.result || '';
      };
      reader.readAsDataURL(file);
    },

    async enviarNovoPontoParaN8N() {
      if (!this.adminLogado) return;
      this.erroProcessamento = '';

      if (this.formModoEntrada === 'youtube' && !this.formYoutubeUrl.trim()) {
        this.erroProcessamento = 'Cole o link do vídeo no YouTube.';
        return;
      }
      if (this.formModoEntrada === 'arquivo' && !this.formArquivoBase64) {
        this.erroProcessamento = 'Selecione um arquivo de áudio MP3, OGG, M4A ou WAV.';
        return;
      }

      this.processandoNovoPonto = true;
      this.statusProcessamento = this.formModoEntrada === 'youtube'
        ? '⏳ Baixando MP3 do YouTube, transcrevendo no Whisper e revisando letra com IA... (pode levar 20 a 50s)'
        : '⏳ Enviando áudio, transcrevendo no Whisper e sincronizando versos...';

      try {
        const payload = {
          youtube_url: this.formModoEntrada === 'youtube' ? this.formYoutubeUrl.trim() : '',
          audio_base64: this.formModoEntrada === 'arquivo' ? this.formArquivoBase64 : '',
          audio_filename: this.formArquivoNome || 'ponto_umbanda.mp3',
          audio_mimetype: this.formArquivoMime || 'audio/mpeg',
          titulo: this.formTitulo.trim(),
          categoria: this.formCategoria,
          tipo_ponto: this.formTipoPonto,
          toque: this.formToque.trim(),
          observacoes: this.formObservacoes.trim(),
          letra_manual: this.formLetraManual.trim()
        };

        const res = await fetch(this.N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data?.sucesso) {
          this.formYoutubeUrl = '';
          this.formArquivoNome = '';
          this.formArquivoBase64 = '';
          this.formTitulo = '';
          this.formToque = '';
          this.formObservacoes = '';
          this.formLetraManual = '';
          this.statusProcessamento = '';

          await this.carregarPontos();

          if (data.ponto && data.ponto.id) {
            const salvo = this.pontos.find(p => String(p.id) === String(data.ponto.id)) || data.ponto;
            this.abrirPontoNoKaraoke(salvo, false);
          } else {
            this.abaAtual = 'repertorio';
          }
          alert('✅ Ponto processado e publicado com sucesso!');
        } else {
          this.erroProcessamento = data?.mensagem || 'Erro no servidor n8n ao processar o ponto.';
        }
      } catch (err) {
        this.erroProcessamento = 'Falha de comunicação com o n8n: ' + err.message;
      } finally {
        this.processandoNovoPonto = false;
      }
    },

    // =========================================================================
    // EDITOR FINO DE LETRA & TIMESTAMPS (ADMIN)
    // =========================================================================
    abrirEditorPonto(ponto, event) {
      if (event) event.stopPropagation();
      if (!ponto || !this.adminLogado) return;

      this.editandoPonto = {
        id: ponto.id,
        titulo: ponto.titulo || '',
        categoria: ponto.categoria || 'Outros',
        tipo_ponto: ponto.tipo_ponto || 'Ponto Cantado',
        toque: ponto.toque || '',
        observacoes: ponto.observacoes || '',
        ativo: ponto.ativo !== false
      };

      const versos = this.normalizarVersos(ponto);
      this.editandoVersos = versos.map(v => ({
        start: v.start >= 0 ? Number(v.start) : 0,
        end: v.end >= 0 ? Number(v.end) : 4,
        text: v.text
      }));

      this.modalEditorAberto = true;
    },

    adicionarLinhaEditor() {
      const ultimo = this.editandoVersos[this.editandoVersos.length - 1];
      const inicio = ultimo ? Math.round((Number(ultimo.end) + 0.2) * 100) / 100 : 0;
      this.editandoVersos.push({
        start: inicio,
        end: Math.round((inicio + 4) * 100) / 100,
        text: ''
      });
    },

    removerLinhaEditor(idx) {
      this.editandoVersos.splice(idx, 1);
    },

    ajustarOffsetGlobalEditor(deltaSeg) {
      this.editandoVersos = this.editandoVersos.map(v => ({
        ...v,
        start: Math.max(0, Math.round((Number(v.start) + deltaSeg) * 100) / 100),
        end: Math.max(0, Math.round((Number(v.end) + deltaSeg) * 100) / 100)
      }));
    },

    marcarTempoAtualNaLinhaEditor(idx) {
      const audio = document.getElementById('audioPlayerPrincipal');
      if (!audio) return;
      const t = Math.round((audio.currentTime || 0) * 100) / 100;
      this.editandoVersos[idx].start = t;
      if (this.editandoVersos[idx].end <= t) {
        this.editandoVersos[idx].end = Math.round((t + 4) * 100) / 100;
      }
      if (idx > 0 && this.editandoVersos[idx - 1].end > t) {
        this.editandoVersos[idx - 1].end = t;
      }
    },

    async salvarEdicaoPonto() {
      if (!this.editandoPonto) return;
      this.salvandoEdicao = true;

      try {
        const versosLimpos = this.editandoVersos
          .map(v => ({
            start: Math.max(0, Math.round((Number(v.start) || 0) * 100) / 100),
            end: Math.max(0, Math.round((Number(v.end) || 0) * 100) / 100),
            text: String(v.text || '').trim()
          }))
          .filter(v => v.text.length > 0)
          .sort((a, b) => a.start - b.start);

        const letraCompleta = versosLimpos.map(v => v.text).join('\n');

        const payload = {
          titulo: this.editandoPonto.titulo.trim() || 'Ponto de Umbanda',
          categoria: this.editandoPonto.categoria,
          tipo_ponto: this.editandoPonto.tipo_ponto,
          toque: this.editandoPonto.toque.trim() || null,
          observacoes: this.editandoPonto.observacoes.trim() || null,
          ativo: Boolean(this.editandoPonto.ativo),
          letra_sincronizada: versosLimpos,
          letra_completa: letraCompleta
        };

        const res = await this.fetchDirectus(`/items/pontos_umbanda/${this.editandoPonto.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }, true);

        if (res.ok) {
          this.modalEditorAberto = false;
          await this.carregarPontos();
          alert('✅ Ponto atualizado com sucesso!');
        } else {
          alert('Erro ao salvar alterações no Directus.');
        }
      } catch (e) {
        alert('Erro de conexão ao salvar: ' + e.message);
      } finally {
        this.salvandoEdicao = false;
      }
    },

    async excluirPontoAdmin(ponto, event) {
      if (event) event.stopPropagation();
      if (!ponto || !this.adminLogado) return;
      if (!confirm(`Deseja excluir definitivamente o ponto "${ponto.titulo}"?`)) return;

      try {
        const res = await this.fetchDirectus(`/items/pontos_umbanda/${ponto.id}`, {
          method: 'DELETE'
        }, true);

        if (res.ok) {
          if (this.pontoAtual && String(this.pontoAtual.id) === String(ponto.id)) {
            const audio = document.getElementById('audioPlayerPrincipal');
            if (audio) audio.pause();
            this.pontoAtual = null;
            this.abaAtual = 'repertorio';
          }
          await this.carregarPontos();
          alert('🗑️ Ponto excluído!');
        } else {
          alert('Não foi possível excluir este ponto.');
        }
      } catch (e) {
        alert('Erro ao excluir: ' + e.message);
      }
    },

    // =========================================================================
    // PWA & INSTALAÇÃO
    // =========================================================================
    checarInstalacaoPWA() {
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const ua = window.navigator.userAgent.toLowerCase();
      this.isIOS = /iphone|ipad|ipod/.test(ua);
      if (this.isStandalone) this.mostrarPopupInstalar = false;
      if (window.pwaDeferredPrompt) this.temPromptInstalacao = true;
      window.addEventListener('pwa-pronto-para-instalar', () => {
        this.temPromptInstalacao = true;
      });
    },

    async instalarPWA() {
      const p = window.pwaDeferredPrompt;
      if (!p) {
        alert('Abra o menu do seu navegador e toque em "Adicionar à tela inicial".');
        return;
      }
      p.prompt();
      await p.userChoice;
      window.pwaDeferredPrompt = null;
      this.mostrarPopupInstalar = false;
    }
  };
}

window.umCantoApp = umCantoApp;