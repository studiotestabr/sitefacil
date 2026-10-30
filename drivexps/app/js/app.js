/* ==========================================================================
   DriveXPS Pro 5.0 - Motor Waze: Head-Up Fixo, Carro no Rodapé & Giro Fluido
   Arquivo: /js/app.js
   ========================================================================== */

function entregaApp() {
  return {
    // 1. ENDPOINTS E SERVIDORES
    DIRECTUS_URL: 'https://banco.studiotesta.com.br',
    N8N_WEBHOOK_URL: 'https://n8n.studiotesta.com.br/webhook/importar-shopee',
    OSRM_ROUTER_URL: 'https://rotas.studiotesta.com.br',

    // 2. TEMA E MODOS DE VISUALIZAÇÃO
    tema: localStorage.getItem('drivexps_tema') || 'escuro',
    modo: 'carregamento',
    
    // 3. ESTADOS DE INTERFACE E MODAIS
    menuAberto: false,
    buscaAberta: false,
    termoBusca: '',
    modalImportar: false,
    modalResumoImportacao: false,
    modalAssinatura: false,
    modalCadastroObrigatorio: false,

    // Formulários
    inputNome: '',
    inputEmail: '',
    inputTelefone: '',
    inputPartidaModal: '',
    inputChegadaModal: '',
    resumoPartidaTexto: '',
    resumoChegadaTexto: '',
    erroCadastroObrigatorio: '',
    planoEscolhido: 'semanal',
    carregandoPix: false,
    salvandoPerfil: false,
    codigoPixGerado: '',
    qrCodeBase64: '',
    intervaloPollingPagamento: null,
    dataExpAntesDoPix: 0,

    // 4. DADOS DA CARGA E ROTA
    nomeArquivo: '',
    msgErro: null,
    carregandoProcesso: false,
    pacotesExtraidos: [],
    entregas: [],
    rotasHistorico: [],
    rotaAtivaId: localStorage.getItem('drivexps_rota_ativa_id') || null,
    entregaSelecionadaId: null,
    coordPartidaSalva: JSON.parse(localStorage.getItem('drivexps_coord_partida') || 'null'),
    coordChegadaSalva: JSON.parse(localStorage.getItem('drivexps_coord_chegada') || 'null'),
    rotaGeometria: localStorage.getItem('drivexps_rota_geometria') || null,

    // Mapa Leaflet 2D
    mapaLeaflet: null,
    grupoMarcadores: null,
    linhaTrajeto: null,

    // 5. MOTOR DE NAVEGAÇÃO 3D (WAZE HEAD-UP PERSPECTIVE)
    entregaNavegacao: null,
    mapaNavGL: null,
    marcadorCarroGL: null,
    marcadorDestinoGL: null,
    watchPositionId: null,
    instrucaoAtual: 'Calculando melhor trajeto...',
    distanciaProximaManobra: '',
    nomeProximaRua: '',
    nomeRuaAtualCarro: '',
    subInstrucaoEmSeguida: '',
    iconeManobraNav: '⬆️',
    velocidadeGPS: 0,
    passosRota: [],
    passoAtualIndex: 0,
    headingAtual: 0,
    minSpeedKmhNav: 2.5,
    ultimaLatCarro: null,
    ultimaLngCarro: null,
    mapaArrastadoPeloUsuario: false,
    timeoutRecentralizar: null,
    vozHabilitada: true,
    chegadaAnunciada: false,
    coordenadasRotaAtual: [],
    recalculandoRota: false,
    contadorForaDaRota: 0,
    ultimoRecalculoTimestamp: 0,

    // 6. USUÁRIO E SAAS
    usuarioLogado: false,
    usuarioEmail: '',
    usuarioNome: '',
    tokenAcesso: localStorage.getItem('directus_token') || null,
    usuarioId: localStorage.getItem('directus_user_id') || null,
    planoAtivo: 'gratuito',
    dataExpiracao: null,
    trialIniciado: false,
    diasRestantesTrial: 7,
    statusAssinatura: 'trial',
    assinaturaValida: true,

    // 7. TUTORIAL
    tutorialAberto: false,
    passoTutorial: 1,

    // PWA
    mostrarPopupInstalar: false,
    temPromptInstalacao: false,
    isStandalone: false,
    isIOS: false,
    isMobile: false,

    // =========================================================================
    // COMUNICAÇÃO DIRECTUS COM AUTO-REFRESH DE TOKEN (401)
    // =========================================================================
    async fetchDirectus(path, options = {}) {
      const url = path.startsWith('http') ? path : `${this.DIRECTUS_URL}${path}`;
      const headers = options.headers || {};
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';

      const token = this.tokenAcesso || localStorage.getItem('directus_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const fetchOpts = { ...options, headers, credentials: 'include' };
      let res = await fetch(url, fetchOpts);

      if (res.status === 401) {
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

    // =========================================================================
    // GETTERS REATIVOS (LÓGICA OFICIAL INDEX_OLD13)
    // =========================================================================
    formatarParada(val) {
      if (val === null || val === undefined) return '-';
      if (val < 0) return '+' + Math.abs(val);
      return val;
    },

    get entregasOrdenadasParaSacola() {
      return [...this.entregas].sort((a, b) => {
        if (a.status === 'entregue' && b.status !== 'entregue') return 1;
        if (a.status !== 'entregue' && b.status === 'entregue') return -1;
        return a.ordem_entrega - b.ordem_entrega;
      });
    },

    get naoEntregues() {
      return this.entregas.filter(e => e.status !== 'entregue');
    },

    get entregaAtual() {
      if (this.entregaSelecionadaId) {
        const sel = this.entregas.find(e => e.id === this.entregaSelecionadaId);
        if (sel && sel.status !== 'entregue') return sel;
      }
      const primeiroPendente = this.entregas.find(e => e.status === 'pendente');
      if (primeiroPendente) return primeiroPendente;
      const primeiroAusente = this.entregas.find(e => e.status === 'ausente');
      if (primeiroAusente) return primeiroAusente;
      return null;
    },

    get ehMesmaRuaQueAnterior() {
      if (!this.entregaAtual) return false;
      const idx = this.entregas.findIndex(e => e.id === this.entregaAtual.id);
      if (idx <= 0) return false;
      const anterior = this.entregas[idx - 1];
      const ruaAtual = (this.entregaAtual.endereco || '').split(',')[0].toLowerCase().trim();
      const ruaAnterior = (anterior.endereco || '').split(',')[0].toLowerCase().trim();
      return ruaAtual === ruaAnterior;
    },

    get pacotesMesmoLocal() {
      if (!this.entregaAtual) return [];
      const cur = this.entregaAtual;
      const mesmaRua = (e) => (e.endereco || '').split(',')[0].toLowerCase().trim() === (cur.endereco || '').split(',')[0].toLowerCase().trim();
      
      const lista = this.naoEntregues.filter(e => 
        (e.cidade === cur.cidade && e.parada_shopee && cur.parada_shopee && e.parada_shopee === cur.parada_shopee && mesmaRua(e)) ||
        (e.cidade === cur.cidade && mesmaRua(e) && Math.abs(e.latitude - cur.latitude) < 0.0001 && Math.abs(e.longitude - cur.longitude) < 0.0001)
      );

      if (lista.length > 1 && 'vibrate' in navigator) navigator.vibrate(80);
      return lista;
    },

    get entregasNoBairroRestantes() {
      if (!this.entregaAtual) return 0;
      const bAtual = (this.entregaAtual.bairro || '').toLowerCase().trim();
      return this.naoEntregues.filter(e => (e.bairro || '').toLowerCase().trim() === bAtual).length;
    },

    get entregasFiltradas() {
      if (!this.termoBusca) return [];
      const t = this.termoBusca.toLowerCase().trim();
      const apenasNumeros = /^\d+$/.test(t);

      return this.entregasOrdenadasParaSacola.filter(e => {
        const paradaStr = this.formatarParada(e.parada_shopee).toString().toLowerCase();
        const ordemStr = this.formatarParada(e.ordem_shopee).toString().toLowerCase();
        const sacolaNum = Math.ceil(e.ordem_entrega / 10).toString();
        const canetaoStr = e.ordem_entrega.toString();

        if (canetaoStr === t || paradaStr === t || ordemStr === t || sacolaNum === t) return true;
        if (t.startsWith('#') && t.replace('#', '') === canetaoStr) return true;
        if (t.startsWith('+') && t === paradaStr) return true;

        if (apenasNumeros && t.length <= 3) return false;

        return (e.endereco && e.endereco.toLowerCase().includes(t)) ||
               (e.bairro && e.bairro.toLowerCase().includes(t)) ||
               (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(t));
      });
    },

    getFaixaPacotes(ordem) {
      const sacola = Math.ceil(ordem / 10);
      const inicio = (sacola - 1) * 10 + 1;
      const fim = sacola * 10;
      return `Pacotes do ${inicio} ao ${fim}`;
    },

    isGpsSuspeito(endereco) {
      const lower = (endereco || '').toLowerCase();
      return lower.includes('s/n') || lower.includes('marginal') || lower.includes('rodovia') || lower.includes(' km');
    },

    getTextoStatusAssinatura() {
      if (this.planoAtivo === 'vitalicio') return 'Assinatura Ativa (VITALICIO)';
      let nomePlano = 'Plano Semanal';
      if (this.planoAtivo === 'mensal') nomePlano = 'Plano Mensal';
      else if (this.planoAtivo === 'gratuito' || this.statusAssinatura === 'trial') nomePlano = 'Período de Teste';

      if (!this.dataExpiracao) return 'Teste Grátis (Começa na 1ª rota)';
      const exp = new Date(this.dataExpiracao);
      const agora = new Date();
      const diffDias = Math.ceil((exp - agora) / (1000 * 60 * 60 * 24));
      if (diffDias <= 0) return 'Assinatura Expirada ⚠️';
      return `${nomePlano} • Vence em ${exp.toLocaleDateString('pt-BR')} (${diffDias}d restantes)`;
    },

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================
    async init() {
      this.aplicarTemaVisual();
      this.checarInstalacaoPWA();

      const cacheEntregas = localStorage.getItem('drivexps_entregas_cache');
      if (cacheEntregas) {
        try { this.entregas = JSON.parse(cacheEntregas); } catch(e) {}
      }

      const cacheHistorico = localStorage.getItem('drivexps_rotas_historico_cache');
      if (cacheHistorico) {
        try { this.rotasHistorico = JSON.parse(cacheHistorico); } catch(e) {}
      }

      await this.verificarAutenticacao();

      if (this.usuarioLogado) {
        await this.sincronizarAssinaturaSaaS();
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
      localStorage.setItem('drivexps_tema', novoTema);
      this.aplicarTemaVisual();
    },

    salvarCacheLocal() {
      if (this.rotaAtivaId) localStorage.setItem('drivexps_rota_ativa_id', this.rotaAtivaId);
      if (this.entregas && this.entregas.length > 0) localStorage.setItem('drivexps_entregas_cache', JSON.stringify(this.entregas));
      if (this.rotaGeometria) localStorage.setItem('drivexps_rota_geometria', this.rotaGeometria);
      if (this.coordPartidaSalva) localStorage.setItem('drivexps_coord_partida', JSON.stringify(this.coordPartidaSalva));
      if (this.coordChegadaSalva) localStorage.setItem('drivexps_coord_chegada', JSON.stringify(this.coordChegadaSalva));
    },

    // =========================================================================
    // CONTROLES DE ENTREGA E REABERTURA
    // =========================================================================
    async reabrirEntrega(item) {
      if (!item) return;
      await this.atualizarStatus(item.id, 'pendente');
      this.entregaSelecionadaId = item.id;
      if ('vibrate' in navigator) navigator.vibrate([40, 40]);
    },

    async pularEntrega(entrega) {
      await this.atualizarStatus(entrega.id, 'ausente');
      this.entregaSelecionadaId = null;
    },

    async concluirEntrega(entrega) {
      const mesmoLocal = this.pacotesMesmoLocal;
      if (mesmoLocal.length > 1) {
        const conf = confirm(`Há ${mesmoLocal.length} pacotes nesta Parada. Deseja marcar TODOS como entregues?`);
        if (conf) {
          for (const p of mesmoLocal) { await this.atualizarStatus(p.id, 'entregue'); }
          this.entregaSelecionadaId = null; 
          if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
          return;
        }
      }
      this.entregaSelecionadaId = null;
      await this.atualizarStatus(entrega.id, 'entregue');
      if ('vibrate' in navigator) navigator.vibrate(40);
    },

    async atualizarStatus(id, novoStatus) {
      const idx = this.entregas.findIndex(e => e.id === id);
      if (idx !== -1) {
        this.entregas[idx].status = novoStatus;
        this.salvarCacheLocal();
        if (this.modo === 'mapa') this.desenharPinosERotaNoMapa();
      }
      try {
        await this.fetchDirectus(`/items/entregas/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: novoStatus })
        });
      } catch (e) {}
    },

    // =========================================================================
    // MAPA GERAL LEAFLET 2D (COM ROTA OFICIAL VROOM)
    // =========================================================================
    abrirAbaMapa() {
      this.modo = 'mapa';
      setTimeout(() => { this.inicializarOuAtualizarMapa(); }, 150);
    },

    inicializarOuAtualizarMapa() {
      const container = document.getElementById('mapaContainer');
      if (!container) return;

      if (!this.mapaLeaflet) {
        this.mapaLeaflet = L.map('mapaContainer', { zoomControl: false }).setView([-24.1667, -46.7800], 13);
        L.control.zoom({ position: 'bottomright' }).addTo(this.mapaLeaflet);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(this.mapaLeaflet);
        this.grupoMarcadores = L.featureGroup().addTo(this.mapaLeaflet);
      }

      this.mapaLeaflet.invalidateSize();
      this.desenharPinosERotaNoMapa();
    },

    decodePolyline(str, precision = 5) {
      if (!str) return [];
      let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
      while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; lng += longitude_change;
        coordinates.push([lat / factor, lng / factor]);
      }
      return coordinates;
    },

    desenharPinosERotaNoMapa() {
      if (!this.mapaLeaflet || !this.grupoMarcadores) return;
      this.grupoMarcadores.clearLayers();
      if (this.linhaTrajeto) { this.mapaLeaflet.removeLayer(this.linhaTrajeto); this.linhaTrajeto = null; }

      const pontosLinha = [];

      let posCD = null;
      if (this.coordPartidaSalva && this.coordPartidaSalva.latitude) {
        posCD = [this.coordPartidaSalva.latitude, this.coordPartidaSalva.longitude];
      } else if (this.rotaGeometria && this.rotaGeometria.length > 10) {
        const decoded = this.decodePolyline(this.rotaGeometria);
        if (decoded.length > 0) posCD = decoded[0];
      }

      if (posCD) {
        pontosLinha.push(posCD);
        const iconeCD = L.divIcon({ 
          className: 'custom-pin-cd', 
          html: `<div style="background-color: #3b82f6; color: #fff; font-size: 15px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 15px rgba(59,130,246,0.8);">🏭</div>`, 
          iconSize: [34, 34], iconAnchor: [17, 17] 
        });
        L.marker(posCD, { icon: iconeCD }).bindPopup(`<strong>📍 PONTO DE PARTIDA</strong>`).addTo(this.grupoMarcadores);
      }

      const entregasOrdenadas = [...this.entregas].sort((a, b) => a.ordem_entrega - b.ordem_entrega);

      entregasOrdenadas.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const coord = [p.latitude, p.longitude];
        pontosLinha.push(coord);

        let corFundo = '#10b981';
        if (p.status === 'entregue') corFundo = '#ef4444';
        if (p.status === 'ausente') corFundo = '#f59e0b';

        const iconePacote = L.divIcon({
          className: 'custom-pin-pacote',
          html: `<div style="background-color: ${corFundo}; color: #000; font-weight: 900; font-family: monospace; font-size: 11px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">#${p.ordem_entrega}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        });

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 170px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong style="color: #ea580c; font-size: 14px;">Canetão #${p.ordem_entrega}</strong>
              <span style="font-size: 10px; background: #334155; color: #fff; padding: 2px 6px; border-radius: 4px;">Sacola ${Math.ceil(p.ordem_entrega / 10)}</span>
            </div>
            <div style="font-size: 12px; font-weight: bold; color: #fff; margin-bottom: 2px;">${p.endereco}</div>
            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 8px;">${p.bairro} - ${p.cidade}</div>
            <a href="waze://?ll=${p.latitude},${p.longitude}&navigate=yes" style="display: block; background: #ea580c; color: #fff; text-align: center; padding: 6px; border-radius: 8px; font-weight: 900; font-size: 11px; text-decoration: none;">🚗 Abrir no Waze</a>
          </div>
        `;
        L.marker(coord, { icon: iconePacote }).bindPopup(popupContent).addTo(this.grupoMarcadores);
      });

      let posCasa = null;
      if (this.coordChegadaSalva && this.coordChegadaSalva.latitude) {
        posCasa = [this.coordChegadaSalva.latitude, this.coordChegadaSalva.longitude];
      } else if (this.rotaGeometria && this.rotaGeometria.length > 10) {
        const decoded = this.decodePolyline(this.rotaGeometria);
        if (decoded.length > 0) posCasa = decoded[decoded.length - 1];
      }

      if (posCasa) {
        pontosLinha.push(posCasa);
        const iconeCasa = L.divIcon({ 
          className: 'custom-pin-casa', 
          html: `<div style="background-color: #3b82f6; color: #fff; font-size: 15px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 15px rgba(59,130,246,0.8);">🏠</div>`, 
          iconSize: [34, 34], iconAnchor: [17, 17] 
        });
        L.marker(posCasa, { icon: iconeCasa }).bindPopup(`<strong>🏠 PONTO DE CHEGADA</strong>`).addTo(this.grupoMarcadores);
      }

      if (this.rotaGeometria && this.rotaGeometria.length > 5) {
        const latlngs = this.decodePolyline(this.rotaGeometria);
        this.linhaTrajeto = L.polyline(latlngs, { color: '#38bdf8', weight: 6, opacity: 0.95 }).addTo(this.mapaLeaflet);
      } else if (pontosLinha.length > 1) {
        this.linhaTrajeto = L.polyline(pontosLinha, { color: '#38bdf8', weight: 4, opacity: 0.85, dashArray: '6, 8' }).addTo(this.mapaLeaflet);
      }

      this.centralizarMapaNaCarga();
    },

    centralizarMapaNaCarga() {
      if (this.mapaLeaflet && this.grupoMarcadores && this.grupoMarcadores.getLayers().length > 0) {
        this.mapaLeaflet.fitBounds(this.grupoMarcadores.getBounds(), { padding: [40, 40] });
      }
    },

    // =========================================================================
    // NAVEGAÇÃO 3D (MOTOR WAZE NATIVO - HEAD-UP RIGOROSO & AUTO-RECENTER)
    // =========================================================================
    falarTexto(texto) {
      if (!this.vozHabilitada || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      if (synth.speaking) synth.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR'; u.rate = 1.05;
      synth.speak(u);
    },

    alternarVoz() {
      this.vozHabilitada = !this.vozHabilitada;
      if (this.vozHabilitada) this.falarTexto('Avisos de voz ativados.');
      else window.speechSynthesis.cancel();
    },

    /**
     * SNAP-TO-ROUTE LOCAL COM DIREÇÃO VETORIAL DA VIA:
     * Identifica em qual pedaço de asfalto o carro está e extrai o rumo (bearing)
     * exato do segmento para alinhar a rua para o topo da tela imediatamente.
     */
    projetarPontoNaRota(lat, lng) {
      if (!this.coordenadasRotaAtual || this.coordenadasRotaAtual.length < 2) {
        return { lat, lng, distRota: 0, headingSegmento: null };
      }

      let menorDist = Infinity;
      let pontoProjetado = { lat, lng };
      let headingDoSegmento = null;

      const rad = Math.PI / 180;
      const cosLat = Math.cos(lat * rad);
      const mPorLng = 111320 * cosLat;
      const mPorLat = 110540;

      for (let i = 0; i < this.coordenadasRotaAtual.length - 1; i++) {
        const pA = this.coordenadasRotaAtual[i];
        const pB = this.coordenadasRotaAtual[i + 1];

        const lngA = pA[0], latA = pA[1];
        const lngB = pB[0], latB = pB[1];

        const dx = (lngB - lngA) * mPorLng;
        const dy = (latB - latA) * mPorLat;
        const L2 = dx * dx + dy * dy;

        if (L2 === 0) continue;

        const px = (lng - lngA) * mPorLng;
        const py = (lat - latA) * mPorLat;

        let t = (px * dx + py * dy) / L2;
        t = Math.max(0, Math.min(1, t));

        const projX = t * dx;
        const projY = t * dy;

        const distM = Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));

        if (distM < menorDist) {
          menorDist = distM;
          pontoProjetado = {
            lat: latA + t * (latB - latA),
            lng: lngA + t * (lngB - lngA)
          };
          // Ângulo exato da rua para o Head-Up Waze
          headingDoSegmento = this.calcularBearing(latA, lngA, latB, lngB);
        }
      }

      const limiteSnap = this.velocidadeGPS > 60 ? 45 : 35;
      if (menorDist <= limiteSnap) {
        return {
          lat: pontoProjetado.lat,
          lng: pontoProjetado.lng,
          distRota: menorDist,
          headingSegmento: headingDoSegmento
        };
      }

      return { lat, lng, distRota: menorDist, headingSegmento: null };
    },

    async iniciarNavegacaoNativa(entrega) {
      if (!navigator.geolocation) { alert('GPS não suportado.'); return; }
      this.entregaNavegacao = entrega;
      this.modo = 'navegacao';
      this.nomeProximaRua = entrega ? entrega.endereco : 'Destino';
      this.nomeRuaAtualCarro = entrega?.endereco?.split(',')[0] || 'Iniciando...';
      this.instrucaoAtual = `Iniciando trajeto para o Canetão #${entrega?.ordem_entrega}...`;
      this.distanciaProximaManobra = '...';
      this.subInstrucaoEmSeguida = `Canetão #${entrega?.ordem_entrega}`;
      this.iconeManobraNav = '⬆️';
      this.chegadaAnunciada = false;
      this.velocidadeGPS = 0;
      this.mapaArrastadoPeloUsuario = false;
      if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
      this.coordenadasRotaAtual = [];
      this.contadorForaDaRota = 0;
      this.recalculandoRota = false;

      this.falarTexto(`Iniciando rota para Canetão número ${entrega.ordem_entrega}, na ${entrega.endereco}`);
      setTimeout(() => { this.inicializarMapaNavGL(entrega); }, 250);
    },

    /**
     * MOTOR MAPLIBRE GL 3D (PITCH 45°, ZOOM WAZE & LARGURA DE RUAS)
     */
    inicializarMapaNavGL(entrega) {
      const container = document.getElementById('mapaNavGL');
      if (!container) return;
      if (this.mapaNavGL) { this.mapaNavGL.remove(); this.mapaNavGL = null; }

      this.mapaNavGL = new maplibregl.Map({
        container: 'mapaNavGL',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [entrega.longitude, entrega.latitude],
        zoom: 16.8, // Panorama aberto Waze
        pitch: 45,  // Inclinação 3D da Foto 2 Waze
        bearing: 0,
        attributionControl: false
      });

      // Retorno automático à centralização caso o usuário toque na tela
      this.mapaNavGL.on('dragstart', (e) => {
        if (e.originalEvent) {
          this.mapaArrastadoPeloUsuario = true;
          if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
          // Volta a acompanhar automaticamente após 5 segundos sem toques
          this.timeoutRecentralizar = setTimeout(() => {
            this.mapaArrastadoPeloUsuario = false;
          }, 5000);
        }
      });

      this.mapaNavGL.on('load', () => {
        try {
          if (this.mapaNavGL.getLayer('background')) {
            this.mapaNavGL.setPaintProperty('background', 'background-color', '#141c2b');
          }

          // Alargamento das ruas para ficarem grossas como asfalto do Waze
          const layers = this.mapaNavGL.getStyle().layers || [];
          layers.forEach(l => {
            const id = l.id.toLowerCase();
            const isRoad = id.includes('road') || id.includes('highway') || id.includes('transportation') || id.includes('street') || id.includes('tunnel') || id.includes('bridge');

            if (l.type === 'line' && isRoad) {
              try {
                if (id.includes('casing')) {
                  this.mapaNavGL.setPaintProperty(l.id, 'line-color', '#182436');
                  this.mapaNavGL.setPaintProperty(l.id, 'line-width', [
                    'interpolate', ['linear'], ['zoom'],
                    13, 2, 15, 8, 16.8, 16, 18.5, 24
                  ]);
                } else {
                  this.mapaNavGL.setPaintProperty(l.id, 'line-color', '#25334a');
                  this.mapaNavGL.setPaintProperty(l.id, 'line-width', [
                    'interpolate', ['linear'], ['zoom'],
                    13, 1.5, 15, 6, 16.8, 13, 18.5, 20
                  ]);
                }
              } catch(err) {}
            }

            if (l.type === 'symbol' && (id.includes('label') || id.includes('name'))) {
              try {
                this.mapaNavGL.setPaintProperty(l.id, 'text-color', '#cbd5e1');
                this.mapaNavGL.setPaintProperty(l.id, 'text-halo-color', '#0f172a');
                this.mapaNavGL.setPaintProperty(l.id, 'text-halo-width', 2);
              } catch(err) {}
            }
          });
        } catch(e) {}

        if (!this.mapaNavGL.getSource('rota-source')) {
          this.mapaNavGL.addSource('rota-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
          });
          this.mapaNavGL.addLayer({
            id: 'rota-borda', type: 'line', source: 'rota-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0369a1', 'line-width': 12, 'line-opacity': 0.95 }
          });
          this.mapaNavGL.addLayer({
            id: 'rota-linha', type: 'line', source: 'rota-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#38bdf8', 'line-width': 8, 'line-opacity': 1.0 }
          });
        }
        this.iniciarGPSContinuoNavegacao(entrega);
      });
    },

    iniciarGPSContinuoNavegacao(entrega) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const sLat = pos.coords.latitude;
        const sLng = pos.coords.longitude;
        this.ultimaLatCarro = sLat; 
        this.ultimaLngCarro = sLng;

        this.atualizarMarcadorCarroGL(sLat, sLng, 0);
        const bearingInicial = this.calcularBearing(sLat, sLng, entrega.latitude, entrega.longitude);
        this.headingAtual = bearingInicial;
        this.centralizarNoCarroGL(sLat, sLng, bearingInicial, 0);

        await this.calcularRotaRuaARua(sLat, sLng, entrega.latitude, entrega.longitude);

        this.watchPositionId = navigator.geolocation.watchPosition(
          (novaPos) => this.processarPosicaoGPS(novaPos, entrega.latitude, entrega.longitude),
          (err) => console.warn('Aviso GPS:', err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }, () => {
        alert('Não foi possível obter sinal de GPS.');
        this.pararNavegacao();
      }, { enableHighAccuracy: true });
    },

    atualizarLinhaNavGL(coordsLngLat) {
      if (!this.mapaNavGL) return;
      const src = this.mapaNavGL.getSource('rota-source');
      if (src) {
        src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coordsLngLat } });
      }
    },

    async calcularRotaRuaARua(sLat, sLng, eLat, eLng) {
      if (!sLat || !sLng || !eLat || !eLng) return;
      let coordsLngLat = [];
      let routeEncontrada = null;

      try {
        const urlLocal = `${this.OSRM_ROUTER_URL}/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
        const resLocal = await fetch(urlLocal, { signal: AbortSignal.timeout(3500) });
        if (resLocal.ok) {
          const dataLocal = await resLocal.json();
          if (dataLocal.routes && dataLocal.routes.length > 0) routeEncontrada = dataLocal.routes[0];
        }
      } catch (e) {}

      if (!routeEncontrada) {
        try {
          const urlPub = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
          const resPub = await fetch(urlPub, { signal: AbortSignal.timeout(4000) });
          if (resPub.ok) {
            const dataPub = await resPub.json();
            if (dataPub.routes && dataPub.routes.length > 0) routeEncontrada = dataPub.routes[0];
          }
        } catch (e) {}
      }

      if (routeEncontrada && routeEncontrada.geometry) {
        coordsLngLat = routeEncontrada.geometry.coordinates.map(c => [Number(c[0]), Number(c[1])]);
        const distMetros = Math.round(routeEncontrada.distance);
        this.distanciaProximaManobra = distMetros > 1000 ? (distMetros / 1000).toFixed(1) + ' km' : distMetros + ' m';
        this.passosRota = routeEncontrada.legs[0].steps || [];
        this.passoAtualIndex = 0;
        this.atualizarInstrucaoUI();
      }

      if (!coordsLngLat || coordsLngLat.length === 0) {
        coordsLngLat = [[Number(sLng), Number(sLat)], [Number(eLng), Number(eLat)]];
        const distReta = Math.round(this.calcularDistancia(sLat, sLng, eLat, eLng));
        this.distanciaProximaManobra = distReta > 1000 ? (distReta / 1000).toFixed(1) + ' km' : distReta + ' m';
      }

      this.coordenadasRotaAtual = coordsLngLat;
      this.atualizarLinhaNavGL(coordsLngLat);
      this.atualizarMarcadorDestinoGL(eLat, eLng);

      if (coordsLngLat.length > 1) {
        const bearingVia = this.calcularBearing(coordsLngLat[0][1], coordsLngLat[0][0], coordsLngLat[1][1], coordsLngLat[1][0]);
        this.headingAtual = bearingVia;
        if (!this.mapaArrastadoPeloUsuario) this.centralizarNoCarroGL(sLat, sLng, bearingVia, 500);
      }
    },

    atualizarMarcadorDestinoGL(lat, lng) {
      if (!this.mapaNavGL || !lat || !lng) return;
      const numCanetao = this.entregaNavegacao ? this.entregaNavegacao.ordem_entrega : '';
      let corFundo = '#10b981';
      if (this.entregaNavegacao?.status === 'entregue') corFundo = '#ef4444';
      if (this.entregaNavegacao?.status === 'ausente') corFundo = '#f59e0b';

      if (this.marcadorDestinoGL) {
        this.marcadorDestinoGL.setLngLat([lng, lat]);
        const elPin = document.getElementById('pinDestinoNav');
        if (elPin) { elPin.style.backgroundColor = corFundo; elPin.innerText = `#${numCanetao}`; }
        return;
      }

      const el = document.createElement('div');
      el.innerHTML = `
        <div id="pinDestinoNav" style="background-color: ${corFundo}; color: #000; font-weight: 900; font-family: monospace; font-size: 11px; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.85); cursor: pointer;">
          #${numCanetao}
        </div>
      `;
      this.marcadorDestinoGL = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(this.mapaNavGL);
    },

    /**
     * FIORINO SEMPRE APONTADA PARA CIMA NO VISOR:
     * O mapa gira no chão embaixo do carro, mantendo a frente da Fiorino reta para o topo do celular!
     */
    atualizarMarcadorCarroGL(lat, lng, headingRelativo = 0) {
      if (!this.mapaNavGL) return;
      if (!this.marcadorCarroGL) {
        const el = document.createElement('div');
        el.className = 'fiorino-container';
        el.innerHTML = `
          <div class="fiorino-aura"></div>
          <div class="fiorino-svg-wrapper">
            <svg width="24" height="42" viewBox="0 0 40 70" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="10" width="4" height="12" rx="2" fill="#111"/>
              <rect x="34" y="10" width="4" height="12" rx="2" fill="#111"/>
              <rect x="2" y="48" width="4" height="12" rx="2" fill="#111"/>
              <rect x="34" y="48" width="4" height="12" rx="2" fill="#111"/>
              <rect x="4" y="4" width="32" height="62" rx="6" fill="#ea580c"/>
              <rect x="10" y="60" width="20" height="3" fill="#333"/>
              <path d="M 6 18 L 34 18 L 32 26 L 8 26 Z" fill="#1e293b"/>
              <rect x="6" y="28" width="28" height="30" rx="2" fill="#c2410c"/>
              <rect x="6" y="2" width="6" height="3" rx="1" fill="#fef08a"/>
              <rect x="28" y="2" width="6" height="3" rx="1" fill="#fef08a"/>
              <rect x="6" y="65" width="5" height="3" rx="1" fill="#ef4444"/>
              <rect x="29" y="65" width="5" height="3" rx="1" fill="#ef4444"/>
            </svg>
          </div>
          <div class="fiorino-placa-rua" id="placaRuaCarro">${this.nomeRuaAtualCarro || 'Sua Posição'}</div>
        `;
        this.marcadorCarroGL = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport' })
          .setLngLat([lng, lat])
          .addTo(this.mapaNavGL);
      } else {
        this.marcadorCarroGL.setLngLat([lng, lat]);
        const p = document.getElementById('placaRuaCarro');
        if (p) p.innerText = this.nomeRuaAtualCarro || 'Sua Posição';
      }
    },

    /**
     * ENQUADRAMENTO EXATO DO WAZE:
     * Carro próximo ao rodapé da tela, liberando o horizonte à frente,
     * e o mapa girando para manter a via 100% reta para o topo do celular.
     */
    centralizarNoCarroGL(lat, lng, bearing, duracao = 800) {
      if (!this.mapaNavGL) return;

      let zoomDinamico = 16.8;
      if (this.velocidadeGPS > 75) zoomDinamico = 15.5;
      else if (this.velocidadeGPS > 35) zoomDinamico = 16.2;
      else zoomDinamico = 16.8;

      // Ponto de visão à frente: projeta a câmera ligeiramente adiante na direção do carro
      const distOffsetMetros = 85;
      const rad = (bearing !== undefined && bearing !== null ? bearing : this.headingAtual) * Math.PI / 180;
      const dLat = (distOffsetMetros * Math.cos(rad)) / 111111;
      const dLng = (distOffsetMetros * Math.sin(rad)) / (111111 * Math.cos(lat * Math.PI / 180));

      const centerFocal = [lng + dLng, lat + dLat];

      this.mapaNavGL.easeTo({
        center: centerFocal,
        bearing: (bearing !== undefined && bearing !== null) ? bearing : this.headingAtual,
        pitch: 45, // Perspectiva 3D suave da Foto 2 Waze
        zoom: zoomDinamico,
        duration: duracao,
        easing: (t) => t // Deslize linear suave e contínuo
      });
    },

    centralizarCarroManual() {
      this.mapaArrastadoPeloUsuario = false;
      if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
      if (this.ultimaLatCarro && this.ultimaLngCarro) {
        this.centralizarNoCarroGL(this.ultimaLatCarro, this.ultimaLngCarro, this.headingAtual, 400);
      }
    },

    /**
     * LOOP DE POSIÇÃO GPS (Giro imediato ao virar a esquina)
     */
    async processarPosicaoGPS(pos, destLat, destLng) {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      this.velocidadeGPS = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

      // 1. Projeção Snap-to-Route local
      const snap = this.projetarPontoNaRota(rawLat, rawLng);
      const lat = snap.lat;
      const lng = snap.lng;

      // 2. ROTAÇÃO IMEDIATA DO MAPA (Sem efeito caranguejo):
      // Quando entra na rua, o mapa vira junto com o segmento da via
      let headingAlvo = null;
      if (snap.headingSegmento !== null) {
        headingAlvo = snap.headingSegmento;
      } else if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && this.velocidadeGPS >= this.minSpeedKmhNav) {
        headingAlvo = pos.coords.heading;
      } else if (this.ultimaLatCarro && this.ultimaLngCarro) {
        const dist = this.calcularDistancia(this.ultimaLatCarro, this.ultimaLngCarro, lat, lng);
        if (dist > 1.8) {
          headingAlvo = this.calcularBearing(this.ultimaLatCarro, this.ultimaLngCarro, lat, lng);
        }
      }

      if (headingAlvo !== null && !isNaN(headingAlvo)) {
        // Giro ágil sem delay para a rua virar para cima no exato momento da curva
        this.headingAtual = this.smoothHeadingApp(this.headingAtual, headingAlvo, 0.40);
      }

      // 3. Atualiza o nome da rua real na cápsula embaixo do carro
      if (this.passosRota.length > 0 && this.passoAtualIndex < this.passosRota.length) {
        const stepAtual = this.passosRota[this.passoAtualIndex];
        const ruaDetectada = stepAtual.name || stepAtual.ref || (this.entregaNavegacao ? this.entregaNavegacao.endereco.split(',')[0] : '');
        if (ruaDetectada) this.nomeRuaAtualCarro = ruaDetectada;
      } else if (this.entregaNavegacao) {
        this.nomeRuaAtualCarro = this.entregaNavegacao.endereco.split(',')[0];
      }

      // 4. Move o carro suavemente
      this.atualizarMarcadorCarroGL(lat, lng, 0);

      // 5. Câmera acompanha sempre se o usuário não estiver manipulando o mapa
      if (!this.mapaArrastadoPeloUsuario) {
        this.centralizarNoCarroGL(lat, lng, this.headingAtual, 900);
      }

      this.ultimaLatCarro = lat;
      this.ultimaLngCarro = lng;

      // 6. Distância até o destino
      const distDestinoFinal = this.calcularDistancia(lat, lng, destLat, destLng);
      this.distanciaProximaManobra = distDestinoFinal > 1000 ? (distDestinoFinal / 1000).toFixed(1) + ' km' : Math.round(distDestinoFinal) + ' m';

      if (distDestinoFinal <= 25 && !this.chegadaAnunciada) {
        this.chegadaAnunciada = true;
        this.falarTexto(`Você chegou ao destino! Canetão número ${this.entregaNavegacao?.ordem_entrega || ''}, na ${this.entregaNavegacao?.endereco || ''}`);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
      }

      // 7. Recálculo genuíno
      const fora = snap.distRota > 65;
      if (fora) this.contadorForaDaRota++;
      else this.contadorForaDaRota = 0;

      const agora = Date.now();
      if (this.contadorForaDaRota >= 4 && !this.recalculandoRota && (agora - this.ultimoRecalculoTimestamp > 10000)) {
        this.recalculandoRota = true;
        this.ultimoRecalculoTimestamp = agora;
        this.contadorForaDaRota = 0;
        this.falarTexto('Recalculando rota...');
        await this.calcularRotaRuaARua(rawLat, rawLng, destLat, destLng);
        this.recalculandoRota = false;
        return;
      }

      // 8. Alertas sonoros antecipados
      if (this.passosRota.length > 0 && this.passoAtualIndex < this.passosRota.length) {
        const stepAtual = this.passosRota[this.passoAtualIndex];
        const manobraLat = stepAtual.maneuver.location[1];
        const manobraLng = stepAtual.maneuver.location[0];
        const distParaManobra = this.calcularDistancia(lat, lng, manobraLat, manobraLng);
        const info = this.interpretarManobraWaze(stepAtual);

        const isAltaVelocidade = this.velocidadeGPS > 60;
        const distAvisoLonge = isAltaVelocidade ? 550 : 220;
        const distAvisoPerto = isAltaVelocidade ? 160 : 65;

        if (distParaManobra <= distAvisoLonge && distParaManobra > distAvisoPerto && !stepAtual._avisoLongeFalado) {
          stepAtual._avisoLongeFalado = true;
          const distFmt = isAltaVelocidade ? '500 metros' : '200 metros';
          this.falarTexto(`A ${distFmt}, ${info.texto}`);
        }

        if (distParaManobra <= distAvisoPerto && distParaManobra > 25 && !stepAtual._avisoPertoFalado) {
          stepAtual._avisoPertoFalado = true;
          this.falarTexto(info.texto);
        }

        if (distParaManobra < 20) { 
          this.passoAtualIndex++;
          this.atualizarInstrucaoUI();
        }
      }
    },

    atualizarInstrucaoUI() {
      if (this.passosRota.length === 0 || this.passoAtualIndex >= this.passosRota.length) return;
      const step = this.passosRota[this.passoAtualIndex];
      const info = this.interpretarManobraWaze(step);
      this.instrucaoAtual = info.texto;
      this.nomeProximaRua = info.rua;
      this.iconeManobraNav = info.icone;

      if (this.passosRota[this.passoAtualIndex + 1]) {
        const nextInfo = this.interpretarManobraWaze(this.passosRota[this.passoAtualIndex + 1]);
        this.subInstrucaoEmSeguida = `${nextInfo.icone} ${nextInfo.texto}`;
      } else {
        this.subInstrucaoEmSeguida = '🏁 Destino final à frente';
      }
    },

    interpretarManobraWaze(step) {
      const type = step.maneuver.type;
      const modifier = step.maneuver.modifier || '';
      const rua = step.name ? `na ${step.name}` : (step.ref ? `na ${step.ref}` : 'à frente');

      let icone = '⬆️';
      let texto = `Continue ${rua}`;

      if (type === 'depart') {
        icone = '⬆️';
        texto = `Siga em frente ${rua}`;
      } else if (type === 'arrive') {
        icone = '🏁';
        texto = `Destino à frente`;
      } else if (type === 'off ramp' || type === 'on ramp') {
        if (modifier.includes('right')) {
          icone = '↗️';
          texto = `Pegue a saída à direita para ${step.name || 'a alça de acesso'}`;
        } else if (modifier.includes('left')) {
          icone = '↖️';
          texto = `Pegue a saída à esquerda para ${step.name || 'a alça de acesso'}`;
        } else {
          icone = '↗️';
          texto = `Pegue a saída para ${step.name || 'a via lateral'}`;
        }
      } else if (type === 'fork') {
        if (modifier.includes('right')) {
          icone = '↗️';
          texto = `Mantenha-se à direita na bifurcação`;
        } else if (modifier.includes('left')) {
          icone = '↖️';
          texto = `Mantenha-se à esquerda na bifurcação`;
        } else {
          icone = '⬆️';
          texto = `Siga na bifurcação`;
        }
      } else if (type === 'merge') {
        icone = '⬆️';
        texto = `Junte-se à via ${rua}`;
      } else if (type === 'turn') {
        if (modifier.includes('right')) {
          icone = modifier.includes('slight') ? '↗️' : '⤴️';
          texto = `Vire à direita ${rua}`;
        } else if (modifier.includes('left')) {
          icone = modifier.includes('slight') ? '↖️' : '⤵️';
          texto = `Vire à esquerda ${rua}`;
        } else {
          icone = '⬆️';
          texto = `Continue ${rua}`;
        }
      } else if (type === 'roundabout' || type === 'rotary') {
        icone = '🔄';
        texto = `Na rotatória, pegue a saída para ${step.name || 'sua rota'}`;
      } else if (type === 'end of road') {
        icone = modifier.includes('right') ? '⤴️' : '⤵️';
        texto = `No fim da via, vire ${modifier.includes('right') ? 'à direita' : 'à esquerda'} ${rua}`;
      }

      return { icone, texto, rua: step.name || step.ref || this.entregaNavegacao?.endereco || 'Rota' };
    },

    async concluirEntregaPeloNav(entrega) {
      if (!entrega) return;
      await this.concluirEntrega(entrega);
      const proxima = this.entregas.find(e => e.status !== 'entregue' && e.id !== entrega.id);
      
      if (proxima) {
        this.entregaNavegacao = proxima;
        this.chegadaAnunciada = false;
        this.nomeProximaRua = proxima.endereco;
        this.falarTexto(`Entregue! Próxima parada: Canetão número ${proxima.ordem_entrega}, na ${proxima.endereco}`);
        if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);
        
        if (this.ultimaLatCarro && this.ultimaLngCarro) {
          await this.calcularRotaRuaARua(this.ultimaLatCarro, this.ultimaLngCarro, proxima.latitude, proxima.longitude);
        }
      } else {
        this.falarTexto('Parabéns! Todas as entregas da carga foram concluídas!');
        alert('🎉 Rota 100% Concluída com sucesso!');
        this.pararNavegacao();
      }
    },

    calcularDistancia(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const p1 = lat1 * Math.PI / 180;
      const p2 = lat2 * Math.PI / 180;
      const dp = (lat2 - lat1) * Math.PI / 180;
      const dl = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    calcularBearing(lat1, lon1, lat2, lon2) {
      const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    },

    smoothHeadingApp(current, target, factor) {
      let diff = target - current;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      return current + (diff * factor);
    },

    pararNavegacao() {
      if (this.watchPositionId) {
        navigator.geolocation.clearWatch(this.watchPositionId);
        this.watchPositionId = null;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
      if (this.mapaNavGL) { this.mapaNavGL.remove(); this.mapaNavGL = null; }
      this.marcadorCarroGL = null;
      this.marcadorDestinoGL = null;
      this.coordenadasRotaAtual = [];
      this.mapaArrastadoPeloUsuario = false;
      this.modo = 'rua'; 
    },

    // =========================================================================
    // ROTAS, HISTÓRICO E PLANILHAS (COM VROOM PURO DO INDEX_OLD13)
    // =========================================================================
    async carregarUltimaRota() {
      try {
        const resRota = await this.fetchDirectus('/items/rotas?sort=-id&limit=1');
        if (resRota.ok) {
          const dataRota = await resRota.json();
          if (dataRota.data && dataRota.data.length > 0) {
            this.rotaAtivaId = dataRota.data[0].id;
            await this.carregarEntregasPorId(this.rotaAtivaId);
          }
        }
      } catch (e) {}
    },

    async carregarEntregasPorId(rotaId) {
      try {
        const res = await this.fetchDirectus(`/items/entregas?filter[rota_id][_eq]=${rotaId}&sort=ordem_entrega&limit=300`);
        const data = await res.json();
        
        const resR = await this.fetchDirectus(`/items/rotas/${rotaId}`);
        const dataR = await resR.json();

        if (data.data && data.data.length > 0) {
          this.entregas = data.data;
          this.rotaGeometria = dataR?.data?.geometria || null;

          if (dataR?.data?.cd_lat && dataR?.data?.cd_lng) {
            this.coordPartidaSalva = { latitude: dataR.data.cd_lat, longitude: dataR.data.cd_lng };
          }
          if (dataR?.data?.casa_lat && dataR?.data?.casa_lng) {
            this.coordChegadaSalva = { latitude: dataR.data.casa_lat, longitude: dataR.data.casa_lng };
          }

          this.salvarCacheLocal();
          if (this.modo === 'mapa') {
            this.$nextTick(() => this.desenharPinosERotaNoMapa());
          }
        }
      } catch (e) {}
    },

    async abrirHistorico() {
      this.modo = 'historico';
      try {
        const resRota = await this.fetchDirectus('/items/rotas?sort=-id&limit=30');
        if (resRota.ok) {
          const dataRota = await resRota.json();
          this.rotasHistorico = dataRota.data || [];
          localStorage.setItem('drivexps_rotas_historico_cache', JSON.stringify(this.rotasHistorico));
        }
      } catch (e) {
        console.warn('Erro ao carregar histórico:', e);
      }
      
      if (!this.rotasHistorico || this.rotasHistorico.length === 0) {
        const cache = localStorage.getItem('drivexps_rotas_historico_cache');
        if (cache) {
          try { this.rotasHistorico = JSON.parse(cache); } catch(err) {}
        }
      }
    },

    async selecionarRotaHistorico(rotaId) {
      this.rotaAtivaId = rotaId;
      await this.carregarEntregasPorId(rotaId);
      this.salvarCacheLocal();
      this.modo = 'carregamento';
    },

    async apagarRota(rotaId) {
      if (!confirm(`Deseja apagar a Rota #${rotaId}?`)) return;
      try {
        const res = await this.fetchDirectus(`/items/rotas/${rotaId}`, { method: 'DELETE' });
        if (res.ok || res.status === 204) {
          this.rotasHistorico = this.rotasHistorico.filter(r => r.id !== rotaId);
          localStorage.setItem('drivexps_rotas_historico_cache', JSON.stringify(this.rotasHistorico));
          if (this.rotaAtivaId === rotaId) {
            this.rotaAtivaId = null;
            this.entregas = [];
            this.rotaGeometria = null;
            localStorage.removeItem('drivexps_rota_ativa_id');
            localStorage.removeItem('drivexps_entregas_cache');
            localStorage.removeItem('drivexps_rota_geometria');
            await this.carregarUltimaRota();
          }
          alert(`Rota #${rotaId} apagada!`);
        }
      } catch(e) {}
    },

    parseLinhasShopee(linhasMatriz) {
      this.msgErro = null;
      if (!linhasMatriz || linhasMatriz.length < 2) return [];

      let idxCabecalho = -1;
      for (let i = 0; i < Math.min(linhasMatriz.length, 10); i++) {
        const rowStr = (linhasMatriz[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('latitude') || rowStr.includes('spx tn') || rowStr.includes('destination address') || rowStr.includes('rastreamento')) { 
          idxCabecalho = i; break; 
        }
      }
      if (idxCabecalho === -1) return [];

      const cabecalho = linhasMatriz[idxCabecalho].map(c => String(c || '').trim().toLowerCase());
      const acharIdx = (termos) => cabecalho.findIndex(h => termos.some(t => h === t || h.includes(t)));

      const iSequence = acharIdx(['sequence', 'ordem', 'seq', 'ordem entrega']);
      const iStop = acharIdx(['stop', 'parada', 'n parada']);
      let iTN = acharIdx(['spx tn', 'tracking', 'rastreio']);
      if (iTN === -1 && cabecalho.length > 3) iTN = 3;

      const iAddr = acharIdx(['destination address', 'endereço', 'endereco', 'rua']);
      const iBairro = acharIdx(['bairro', 'neighborhood']);
      const iCity = acharIdx(['city', 'cidade']);
      const iCep = acharIdx(['zipcode', 'cep']);
      const iLat = acharIdx(['latitude', 'lat']);
      const iLng = acharIdx(['longitude', 'lng']);

      const lista = [];
      let contadorExtra = 1;

      for (let r = idxCabecalho + 1; r < linhasMatriz.length; r++) {
        const cols = linhasMatriz[r];
        if (!cols || cols.length <= Math.max(iLat, iLng)) continue;

        const lat = parseFloat(String(cols[iLat] || '').replace(',', '.').trim());
        const lng = parseFloat(String(cols[iLng] || '').replace(',', '.').trim());
        if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0) continue;

        const addr = String(cols[iAddr] || '').trim();
        const rawSeq = iSequence !== -1 ? String(cols[iSequence] || '').trim() : '';
        const rawStop = iStop !== -1 ? String(cols[iStop] || '').trim() : '';
        
        let seqVal = null;
        let stpVal = null;

        if (rawSeq === '-' || rawStop === '-') {
          seqVal = -contadorExtra;
          stpVal = -contadorExtra;
          contadorExtra++;
        } else {
          seqVal = parseInt(rawSeq) || null;
          stpVal = parseInt(rawStop) || null;
        }

        const rawTN = (iTN !== -1 && cols[iTN]) ? String(cols[iTN]).trim() : '';
        const rastreioFinal = (rawTN && rawTN !== '-') ? rawTN : `BR${Math.floor(100000000000 + Math.random() * 900000000000)}S`;

        let numero = 'S/N';
        const numMatch = addr.match(/,\s*(\d+|S\/?N)/i);
        if (numMatch) numero = numMatch[1];

        lista.push({
          ordem_shopee: seqVal,
          parada_shopee: stpVal,
          codigo_rastreio: rastreioFinal,
          destinatario: stpVal ? `Parada #${stpVal}` : 'Destinatário',
          telefone: '13999999999',
          endereco: addr,
          numero: numero,
          bairro: iBairro !== -1 && cols[iBairro] ? String(cols[iBairro]).trim() : '',
          cidade: iCity !== -1 && cols[iCity] ? String(cols[iCity]).trim() : 'Mongaguá',
          cep: iCep !== -1 && cols[iCep] ? String(cols[iCep]).trim() : '',
          latitude: lat,
          longitude: lng,
          gps_suspeito: this.isGpsSuspeito(addr)
        });
      }

      const contagem = {};
      lista.forEach(i => {
        if (i.parada_shopee) {
          const k = `${i.cidade}_${i.endereco.split(',')[0].toLowerCase().trim()}_${i.parada_shopee}`;
          contagem[k] = (contagem[k] || 0) + 1;
        }
      });
      lista.forEach(i => {
        if (i.parada_shopee) {
          const k = `${i.cidade}_${i.endereco.split(',')[0].toLowerCase().trim()}_${i.parada_shopee}`;
          i.total_no_local = contagem[k] || 1;
        } else i.total_no_local = 1;
      });

      return lista;
    },

    processarArquivoDirecto(file) {
      this.nomeArquivo = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          let res = [];
          for (const sheet of wb.SheetNames) {
            const matriz = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
            res = this.parseLinhasShopee(matriz);
            if (res.length > 0) break;
          }
          this.pacotesExtraidos = res;
          if (this.pacotesExtraidos.length > 0) {
            this.resumoPartidaTexto = this.inputPartidaModal?.trim() || 'Localização do 1º Pacote (GPS)';
            this.resumoChegadaTexto = this.inputChegadaModal?.trim() || 'Retorno ao Ponto Inicial';
            this.modalImportar = false;
            this.modalResumoImportacao = true;
          } else {
            alert('Nenhum pacote válido encontrado na planilha.');
          }
        } catch(err) { alert('Erro ao ler planilha: ' + err.message); }
      };
      reader.readAsArrayBuffer(file);
    },

    processarArquivoExcel(event) {
      const f = event.target.files[0];
      if (f) this.processarArquivoDirecto(f);
    },

    async converterTextoParaCoord(texto) {
      if (!texto || texto.trim().length < 3) return null;
      const partes = texto.split(',');
      if (partes.length === 2 && !isNaN(parseFloat(partes[0])) && !isNaN(parseFloat(partes[1]))) {
        return { latitude: parseFloat(partes[0]), longitude: parseFloat(partes[1]) };
      }
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&limit=1&countrycodes=br`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
      } catch(e) {}
      return null;
    },

    async enviarParaN8N() {
      if (!this.assinaturaValida) { this.modalAssinatura = true; return; }
      this.carregandoProcesso = true;
      try {
        if (!this.usuarioId) {
          const resMe = await this.fetchDirectus('/users/me');
          if (resMe.ok) {
            const ud = await resMe.json();
            if (ud?.data?.id) {
              this.usuarioId = ud.data.id;
              localStorage.setItem('directus_user_id', this.usuarioId);
            }
          }
        }

        let coordPartida = await this.converterTextoParaCoord(this.inputPartidaModal);
        let coordChegada = null;
        if (this.inputChegadaModal) {
          if (this.inputChegadaModal.toLowerCase() === this.inputPartidaModal.toLowerCase()) coordChegada = coordPartida;
          else coordChegada = await this.converterTextoParaCoord(this.inputChegadaModal);
        }

        this.coordPartidaSalva = coordPartida;
        this.coordChegadaSalva = coordChegada;

        const payload = {
          entregas: this.pacotesExtraidos,
          user_id: this.usuarioId,
          cd_lat: coordPartida ? coordPartida.latitude : (this.pacotesExtraidos[0]?.latitude || -24.1667),
          cd_lng: coordPartida ? coordPartida.longitude : (this.pacotesExtraidos[0]?.longitude || -46.7800),
          casa_lat: coordChegada ? coordChegada.latitude : (coordPartida ? coordPartida.latitude : -24.1739),
          casa_lng: coordChegada ? coordChegada.longitude : (coordPartida ? coordPartida.longitude : -46.7816)
        };

        const res = await fetch(this.N8N_WEBHOOK_URL, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const resJson = await res.json();
          if (resJson.bloqueado) {
            alert(resJson.mensagem || 'Assinatura necessária.');
            this.modalAssinatura = true;
            return;
          }

          this.modalResumoImportacao = false;
          this.pacotesExtraidos = [];
          this.nomeArquivo = '';

          await this.sincronizarAssinaturaSaaS();

          if (resJson && resJson.rota_id) {
            this.rotaAtivaId = resJson.rota_id;
            await this.carregarEntregasPorId(this.rotaAtivaId);
          } else {
            await this.carregarUltimaRota();
          }

          this.salvarCacheLocal();
          this.modo = 'carregamento';
        } else { 
          alert('Erro no servidor ao otimizar rota.'); 
        }
      } catch(e) { 
        alert('Erro de conexão: ' + e.message); 
      } finally { 
        this.carregandoProcesso = false; 
      }
    },

    // =========================================================================
    // AUTENTICAÇÃO E SAAS
    // =========================================================================
    async verificarAutenticacao() {
      if (localStorage.getItem('usuario_deslogado') === 'true') {
        this.usuarioLogado = false;
        return;
      }
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      const tokenUrl = searchParams.get('access_token') || hashParams.get('access_token') || searchParams.get('token');
      const refreshUrl = searchParams.get('refresh_token') || hashParams.get('refresh_token');

      if (tokenUrl) {
        localStorage.setItem('directus_token', tokenUrl);
        this.tokenAcesso = tokenUrl;
      }
      if (refreshUrl) localStorage.setItem('directus_refresh_token', refreshUrl);

      if (window.location.search && !window.location.search.includes('arquivo_compartilhado')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const extrair = (u) => {
        this.usuarioId = u.id;
        this.usuarioEmail = u.email || '';
        const n = [u.first_name, u.last_name].filter(Boolean).join(' ');
        this.usuarioNome = n.trim() || u.email || '';
        localStorage.setItem('directus_user_id', this.usuarioId);
        this.usuarioLogado = true;
      };

      const res = await this.fetchDirectus('/users/me');
      if (res.ok) {
        const d = await res.json();
        if (d?.data?.id) { extrair(d.data); return; }
      }

      this.usuarioLogado = false;
    },

    async sincronizarAssinaturaSaaS() {
      if (!this.usuarioId || !this.usuarioLogado) return;

      try {
        const res = await this.fetchDirectus(`/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`);
        const data = await res.json();
        const registros = data.data || [];
        let userSaas = registros[0] || null;

        if (!userSaas) {
          const novo = {
            user_id: this.usuarioId, email: this.usuarioEmail || null,
            nome: (this.usuarioNome && this.usuarioNome !== 'Motorista') ? this.usuarioNome : null,
            telefone: null, trial_expira_em: null, status_assinatura: 'trial', plano_ativo: 'gratuito'
          };
          const p = await this.fetchDirectus('/items/drivexps_users', {
            method: 'POST', body: JSON.stringify(novo)
          });
          const pd = await p.json();
          userSaas = pd.data;
          this.trialIniciado = false; this.diasRestantesTrial = 7; this.assinaturaValida = true;
        } else {
          this.statusAssinatura = userSaas.status_assinatura || 'trial';
          this.planoAtivo = userSaas.plano_ativo || 'gratuito';
          this.dataExpiracao = userSaas.trial_expira_em || null;
          if (userSaas.nome && userSaas.nome !== 'Motorista') this.usuarioNome = userSaas.nome;
          if (userSaas.telefone) this.inputTelefone = userSaas.telefone;

          if (this.planoAtivo === 'vitalicio') {
            this.assinaturaValida = true; this.trialIniciado = true; this.diasRestantesTrial = 9999;
          } else if (!userSaas.trial_expira_em) {
            this.trialIniciado = false; this.diasRestantesTrial = 7; this.assinaturaValida = true;
          } else {
            this.trialIniciado = true;
            const diff = Math.ceil((new Date(userSaas.trial_expira_em) - new Date()) / (1000 * 60 * 60 * 24));
            this.diasRestantesTrial = Math.max(0, diff);
            this.assinaturaValida = diff > 0 || this.statusAssinatura === 'ativo';
            if (!this.assinaturaValida) this.modalAssinatura = true;
          }
        }

        const nomeInvalido = !userSaas?.nome || userSaas.nome.trim().toLowerCase() === 'motorista';
        const telInvalido = !userSaas?.telefone || String(userSaas.telefone).replace(/\D/g, '').length < 10;
        const emailInvalido = !userSaas?.email || !userSaas.email.includes('@');

        if (this.usuarioLogado && (nomeInvalido || telInvalido || emailInvalido)) {
          this.inputNome = (!nomeInvalido) ? userSaas.nome : (this.usuarioNome || '');
          this.inputEmail = (!emailInvalido) ? userSaas.email : (this.usuarioEmail || '');
          this.inputTelefone = userSaas?.telefone || '';
          this.modalCadastroObrigatorio = true;
        } else {
          this.modalCadastroObrigatorio = false;
        }
      } catch(e) {}
    },

    async salvarDadosCompletosPerfil() {
      if (!this.usuarioId) return;
      this.salvandoPerfil = true;
      const tel = (this.inputTelefone || '').replace(/\D/g, '');
      try {
        const res = await this.fetchDirectus(`/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`);
        const d = await res.json();
        if (d.data && d.data[0]) {
          await this.fetchDirectus(`/items/drivexps_users/${d.data[0].id}`, {
            method: 'PATCH', body: JSON.stringify({ nome: this.usuarioNome, telefone: tel })
          });
          alert('✅ Dados salvos com sucesso!');
        }
      } catch(e) { alert('Erro: ' + e.message); } 
      finally { this.salvandoPerfil = false; }
    },

    async salvarCadastroObrigatorio() {
      this.erroCadastroObrigatorio = '';
      const nome = (this.inputNome || '').trim();
      const tel = (this.inputTelefone || '').replace(/\D/g, '');
      const email = (this.inputEmail || '').trim().toLowerCase();

      if (!nome || nome.length < 3) { this.erroCadastroObrigatorio = 'Digite seu nome e sobrenome.'; return; }
      if (tel.length < 10 || tel.length > 11) { this.erroCadastroObrigatorio = 'WhatsApp inválido com DDD.'; return; }
      if (!email.includes('@')) { this.erroCadastroObrigatorio = 'E-mail inválido.'; return; }

      this.salvandoPerfil = true;
      try {
        const res = await this.fetchDirectus(`/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`);
        const d = await res.json();
        if (d.data && d.data[0]) {
          await this.fetchDirectus(`/items/drivexps_users/${d.data[0].id}`, {
            method: 'PATCH', body: JSON.stringify({ nome, telefone: tel, email })
          });
          this.usuarioNome = nome; this.usuarioEmail = email; this.inputTelefone = tel;
          this.modalCadastroObrigatorio = false;
        }
      } catch(e) { this.erroCadastroObrigatorio = 'Erro ao salvar.'; } 
      finally { this.salvandoPerfil = false; }
    },

    async gerarPixAssinatura() {
      this.carregandoPix = true;
      this.dataExpAntesDoPix = this.dataExpiracao ? new Date(this.dataExpiracao).getTime() : 0;
      try {
        const res = await fetch('https://n8n.studiotesta.com.br/webhook/gerar-pix-drivexps', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: this.usuarioId, email: this.usuarioEmail, plano: this.planoEscolhido })
        });
        if (res.ok) {
          const d = await res.json();
          this.codigoPixGerado = d.pix_copia_cola;
          this.qrCodeBase64 = d.qr_code_base64 || '';
          if (!this.intervaloPollingPagamento) {
            this.intervaloPollingPagamento = setInterval(() => { this.sincronizarAssinaturaSaaS(); }, 4000);
          }
        }
      } catch(e) { alert('Erro ao gerar PIX.'); } 
      finally { this.carregandoPix = false; }
    },

    resetarPix() {
      if (this.intervaloPollingPagamento) { clearInterval(this.intervaloPollingPagamento); this.intervaloPollingPagamento = null; }
      this.codigoPixGerado = ''; this.qrCodeBase64 = '';
    },

    fecharModalAssinatura() { this.resetarPix(); this.modalAssinatura = false; },

    copiarCodigoPix() {
      navigator.clipboard.writeText(this.codigoPixGerado);
      alert('Código PIX copiado!');
    },

    loginGoogle() {
      localStorage.removeItem('usuario_deslogado');
      const urlLimpa = window.location.origin + window.location.pathname;
      window.location.href = `${this.DIRECTUS_URL}/auth/login/google?redirect=${encodeURIComponent(urlLimpa)}`;
    },

    async deslogar() {
      if (this.intervaloPollingPagamento) clearInterval(this.intervaloPollingPagamento);
      localStorage.setItem('usuario_deslogado', 'true');
      localStorage.removeItem('directus_token');
      localStorage.removeItem('directus_user_id');
      localStorage.removeItem('directus_refresh_token');
      localStorage.removeItem('drivexps_rota_ativa_id');
      localStorage.removeItem('drivexps_entregas_cache');
      localStorage.removeItem('drivexps_rota_geometria');
      localStorage.removeItem('drivexps_coord_partida');
      localStorage.removeItem('drivexps_coord_chegada');
      localStorage.removeItem('drivexps_rotas_historico_cache');
      this.tokenAcesso = null; this.usuarioId = null; this.usuarioLogado = false;
      this.entregas = []; this.rotaAtivaId = null; this.rotaGeometria = null; this.rotasHistorico = [];
      try {
        await fetch(`${this.DIRECTUS_URL}/auth/logout`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ mode: 'session' })
        });
      } catch(e) {}
    },

    // =========================================================================
    // UTILITÁRIOS GERAIS
    // =========================================================================
    abrirModalImportar() {
      if (!this.assinaturaValida) { this.modalAssinatura = true; return; }
      this.modalImportar = true;
    },

    abrirBusca() {
      this.buscaAberta = true;
      this.termoBusca = '';
      this.$nextTick(() => { if (this.$refs.inputBusca) this.$refs.inputBusca.focus(); });
    },

    irParaEntregaDireta(item) {
      this.entregaSelecionadaId = item.id;
      this.modo = 'rua';
    },

    capturarGPSModal() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
          const latLng = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          this.inputPartidaModal = latLng; 
          this.inputChegadaModal = latLng;
          alert('📍 Sua localização atual foi gravada no Ponto de Partida e Chegada!');
        }, err => alert('Erro no GPS: ' + err.message));
      } else {
        alert('Geolocalização não suportada pelo seu navegador.');
      }
    },

    iniciarTutorial() { this.passoTutorial = 1; this.tutorialAberto = true; },
    proximoPassoTutorial() { if (this.passoTutorial < 8) this.passoTutorial++; else this.concluirTutorial(); },
    voltarPassoTutorial() { if (this.passoTutorial > 1) this.passoTutorial--; },
    concluirTutorial() { this.tutorialAberto = false; localStorage.setItem('drivexps_tutorial_visto', 'true'); },

    checarInstalacaoPWA() {
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const ua = window.navigator.userAgent.toLowerCase();
      this.isIOS = /iphone|ipad|ipod/.test(ua);
      this.isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
      if (this.isStandalone) this.mostrarPopupInstalar = false;
      if (window.pwaDeferredPrompt) this.temPromptInstalacao = true;
      window.addEventListener('pwa-pronto-para-instalar', () => { this.temPromptInstalacao = true; });
    },

    acionarInstalacaoManual() {
      if (window.pwaDeferredPrompt) this.instalarPWA();
      else this.mostrarPopupInstalar = true;
    },

    async instalarPWA() {
      const p = window.pwaDeferredPrompt;
      if (!p) { alert('Abra o menu do navegador e toque em "Adicionar à tela inicial".'); return; }
      p.prompt(); await p.userChoice;
      window.pwaDeferredPrompt = null; this.mostrarPopupInstalar = false;
    },

    escutarArquivosCompartilhados() {
      if (window.location.search.includes('arquivo_compartilhado=true')) this.carregarArquivoCompartilhadoCache();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (e) => {
          if (e.data?.tipo === 'NOVO_ROMANEIO_COMPARTILHADO') this.carregarArquivoCompartilhadoCache();
        });
      }
    },

    async carregarArquivoCompartilhadoCache() {
      try {
        const cache = await caches.open('drivexps-shared-files');
        const resp = await cache.match('ultimo-romaneio');
        if (resp) {
          const blob = await resp.blob();
          const name = decodeURIComponent(resp.headers.get('X-File-Name') || 'romaneio.xlsx');
          const file = new File([blob], name, { type: blob.type });
          this.processarArquivoDirecto(file);
          await cache.delete('ultimo-romaneio');
        }
      } catch(e) {}
    }
  };
}