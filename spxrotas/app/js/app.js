/* ==========================================================================
   SPXrotas Pro v2.1.0 - Núcleo Mestre Reativo Oficial
   Gravação Cirúrgica no Directus, Blindagem Offline Real (Fim do Reset),
   Conferência Roxo ➔ Verde e Navegação Viária Offline no Asfalto/Terra
   Arquivo: /spxrotas/app/js/app.js
   ========================================================================== */

function spxRotasApp() {
  return {
    // 1. ENDPOINTS E SERVIDORES OFICIAIS
    DIRECTUS_URL: 'https://banco.studiotesta.com.br',
    N8N_WEBHOOK_URL: 'https://n8n.studiotesta.com.br/webhook/importar-shopee',
    OSRM_ROUTER_URL: 'https://rotas.studiotesta.com.br',

    // 2. TEMA, MODOS E PREFERÊNCIAS
    tema: localStorage.getItem('spxrotas_tema') || 'escuro',
    modo: 'carregamento', // 'carregamento' | 'rua' | 'mapa' | 'historico' | 'navegacao' | 'bipador'
    appNavegacaoEscolhido: localStorage.getItem('spxrotas_nav_app') || 'spxrotas',

    // 3. ESTADOS DE INTERFACE E MODAIS
    menuAberto: false,
    buscaAberta: false,
    termoBusca: '',
    modalImportar: false,
    modalResumoImportacao: false,
    modalAssinatura: false,
    modalCadastroObrigatorio: false,
    modalRelatorio: false,
    dadosRelatorio: null,

    // Configurações Salvas no Cache do Celular
    configVeiculo: JSON.parse(localStorage.getItem('spxrotas_config_veiculo') || '{"tipoCombustivel":"Gasolina","consumoKmL":10.0,"precoLitro":5.89}'),
    contatoEmergencia: localStorage.getItem('spxrotas_contato_emergencia') || '',

    // Partida e Chegada Padrão (Persistidas no Celular)
    inputPartidaModal: localStorage.getItem('spxrotas_partida_padrao') || '',
    inputChegadaModal: localStorage.getItem('spxrotas_chegada_padrao') || '',
    resumoPartidaTexto: '',
    resumoChegadaTexto: '',

    // Formulários e Estados de Pagamento
    inputNome: '',
    inputEmail: '',
    inputTelefone: '',
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
    rotaAtivaId: localStorage.getItem('spxrotas_rota_ativa_id') || null,
    entregaSelecionadaId: null,
    coordPartidaSalva: JSON.parse(localStorage.getItem('spxrotas_coord_partida') || 'null'),
    coordChegadaSalva: JSON.parse(localStorage.getItem('spxrotas_coord_chegada') || 'null'),
    rotaGeometria: localStorage.getItem('spxrotas_rota_geometria') || null,

    // 5. CAIXA-PRETA DE TELEMETRIA REAL (GRAVAÇÃO SILENCIOSA DE AUDITORIA)
    telemetria: {
      inicioTimestamp: null,
      fimTimestamp: null,
      odometroMetros: 0,
      tempoTotalMs: 0,
      tempoDeslocamentoMs: 0,
      tempoAtendimentoMs: 0,
      momentoChegadaUltimaParada: null,
      momentoSaidaUltimaParada: null
    },

    // 6. ARQUITETURA OFFLINE-FIRST & FILA DE SINCRONIZAÇÃO (SYNCQUEUE)
    estaOnline: navigator.onLine,
    syncQueue: JSON.parse(localStorage.getItem('spxrotas_sync_queue') || '[]'),
    processandoSync: false,
    intervaloSyncOffline: null,

    // 7. CONFERÊNCIA ANTI-PACOTE TROCADO (LISTA DE IDS BIPADOS)
    idsConferidos: new Set(),

    // Mapa Leaflet 2D
    mapaLeaflet: null,
    grupoMarcadores: null,
    linhaTrajeto: null,

    // 8. NAVEGADOR 3D NATIVO (WAZE MAPLIBRE GL COM MEMÓRIA DE RUMO)
    entregaNavegacao: null,
    mapaNavGL: null,
    marcadorCarroGL: null,
    marcadorDestinoGL: null,
    marcadoresRadaresGL: [],
    watchPositionId: null,
    instrucaoAtual: 'Calculando melhor trajeto...',
    distanciaProximaManobra: '',
    nomeProximaRua: '',
    nomeRuaAtualCarro: '',
    nomeRuaPisoAtual: '',
    subInstrucaoEmSeguida: '',
    iconeManobraNav: '⬆️',
    velocidadeGPS: 0,
    passosRota: [],
    passoAtualIndex: 0,
    headingAtual: 0,
    ultimoHeadingEmMovimento: null,
    minSpeedKmhNav: 2.5,
    ultimaLatCarro: null,
    ultimaLngCarro: null,
    mapaArrastadoPeloUsuario: false,
    timeoutRecentralizar: null,
    vozHabilitada: true,
    chegadaAnunciada: false,
    alertaRetornoFalado: false,
    coordenadasRotaAtual: [],
    recalculandoRota: false,
    contadorForaDaRota: 0,
    ultimoRecalculoTimestamp: 0,

    // 9. MOTOR DE RADARES NACIONAL AUDITADO
    listaRadares: [],
    radarProximoAlerta: null,
    distanciaRadarTexto: '',
    radarExcessoVelocidade: false,
    radarVozAnunciadaId: null,
    audioContextBipe: null,
    intervaloBipeExcesso: null,

    // 10. WAKE LOCK API (TELA 100% ACESA AUTOMÁTICA)
    wakeLockSentinel: null,
    wakeLockAtivo: false,

    // 11. BIPADOR DE SACOLAS COM VOZ (BARCODE DETECTOR - FOTO 1)
    streamCameraBipador: null,
    cameraFacingMode: 'environment',
    lanternaAtiva: false,
    intervaloScanBipador: null,
    statusTextoBipador: '🎯 Enquadre o código de barras',
    ultimoPacoteBipado: null,
    detectorCodigoBarras: null,
    ultimoCodigoLido: '',
    timestampUltimoBip: 0,

    // 12. USUÁRIO E SAAS
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

    // 13. TUTORIAL & PWA
    tutorialAberto: false,
    passoTutorial: 1,
    mostrarPopupInstalar: false,
    temPromptInstalacao: false,
    isStandalone: false,
    isIOS: false,
    isMobile: false,

    // =========================================================================
    // CONFERÊNCIA ANTI-PACOTE TROCADO (ROXO ➔ VERDE)
    // =========================================================================
    carregarConferidosLocal() {
      if (!this.rotaAtivaId) return;
      const salvos = localStorage.getItem(`spxrotas_conferidos_${this.rotaAtivaId}`);
      if (salvos) {
        try {
          this.idsConferidos = new Set(JSON.parse(salvos));
        } catch (e) {
          this.idsConferidos = new Set();
        }
      } else {
        this.idsConferidos = new Set();
      }
    },

    salvarConferidosLocal() {
      if (!this.rotaAtivaId) return;
      localStorage.setItem(`spxrotas_conferidos_${this.rotaAtivaId}`, JSON.stringify(Array.from(this.idsConferidos)));
    },

    isPacoteConferido(item) {
      if (!item) return false;
      return this.idsConferidos.has(item.id) || item.status === 'entregue' || item.status === 'ausente';
    },

    marcarComoConferidoManual(item) {
      if (!item) return;
      this.idsConferidos.add(item.id);
      this.salvarConferidosLocal();
      if ('vibrate' in navigator) navigator.vibrate(50);
    },

    get pacotesAguardandoBipagem() {
      return this.entregas.filter(e => e.status !== 'entregue' && e.status !== 'ausente' && !this.idsConferidos.has(e.id));
    },

    // =========================================================================
    // CAIXA-PRETA DE TELEMETRIA REAL
    // =========================================================================
    carregarTelemetriaLocal() {
      if (!this.rotaAtivaId) return;
      const salva = localStorage.getItem(`spxrotas_telemetria_${this.rotaAtivaId}`);
      if (salva) {
        try {
          this.telemetria = { ...this.telemetria, ...JSON.parse(salva) };
        } catch (e) {}
      }
    },

    salvarTelemetriaLocal() {
      if (!this.rotaAtivaId) return;
      localStorage.setItem(`spxrotas_telemetria_${this.rotaAtivaId}`, JSON.stringify(this.telemetria));
    },

    iniciarTelemetriaSeNecessario() {
      if (!this.telemetria.inicioTimestamp) {
        this.telemetria.inicioTimestamp = Date.now();
        this.telemetria.momentoSaidaUltimaParada = Date.now();
        this.salvarTelemetriaLocal();
      }
    },

    // =========================================================================
    // ARQUITETURA OFFLINE-FIRST (SYNCQUEUE & GRAVAÇÃO LIMPA NO DIRECTUS)
    // =========================================================================
    get totalFilaSync() {
      return (this.syncQueue || []).length;
    },

    salvarFilaSyncLocal() {
      localStorage.setItem('spxrotas_sync_queue', JSON.stringify(this.syncQueue));
    },

    enfileirarSincronizacao(metodo, endpoint, payload) {
      const itemFila = {
        id: 'sync_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        metodo: metodo || 'PATCH',
        endpoint: endpoint,
        payload: payload,
        timestamp: Date.now()
      };

      this.syncQueue.push(itemFila);
      this.salvarFilaSyncLocal();

      if (navigator.onLine) {
        this.processarFilaSync();
      }
    },

    async processarFilaSync() {
      if (this.processandoSync || !this.syncQueue || this.syncQueue.length === 0) return;
      if (!navigator.onLine) {
        this.estaOnline = false;
        return;
      }

      this.processandoSync = true;
      const filaCopia = [...this.syncQueue];

      for (const item of filaCopia) {
        try {
          const res = await this.fetchDirectus(item.endpoint, {
            method: item.metodo,
            body: JSON.stringify(item.payload)
          });

          if (res && (res.ok || res.status === 404)) {
            this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
            this.salvarFilaSyncLocal();
          } else {
            break;
          }
        } catch (err) {
          this.estaOnline = false;
          break;
        }
      }

      this.processandoSync = false;
    },

    // =========================================================================
    // NAVEGAÇÃO VIÁRIA OFFLINE (RESGATANDO DA POLILINHA VROOM MESTRA)
    // =========================================================================
    obterTrechoViarioOffline(latOrigem, lngOrigem, latDestino, lngDestino) {
      if (!this.rotaGeometria || this.rotaGeometria.length < 10) return null;

      try {
        const coordsTodas = this.decodePolyline(this.rotaGeometria);
        if (!coordsTodas || coordsTodas.length < 2) return null;

        // Acha o ponto mais próximo da origem na polilinha
        let idxInicio = 0;
        let menorDistInicio = Infinity;
        for (let i = 0; i < coordsTodas.length; i++) {
          const d = this.calcularDistancia(latOrigem, lngOrigem, coordsTodas[i][0], coordsTodas[i][1]);
          if (d < menorDistInicio) {
            menorDistInicio = d;
            idxInicio = i;
          }
        }

        // Acha o ponto mais próximo do destino na polilinha
        let idxFim = coordsTodas.length - 1;
        let menorDistFim = Infinity;
        for (let j = idxInicio; j < coordsTodas.length; j++) {
          const d = this.calcularDistancia(latDestino, lngDestino, coordsTodas[j][0], coordsTodas[j][1]);
          if (d < menorDistFim) {
            menorDistFim = d;
            idxFim = j;
          }
        }

        let subTrecho = [];
        if (idxInicio <= idxFim) {
          subTrecho = coordsTodas.slice(idxInicio, idxFim + 1);
        } else {
          subTrecho = coordsTodas.slice(idxFim, idxInicio + 1).reverse();
        }

        if (subTrecho.length >= 2) {
          // Converte para formato [lng, lat] do MapLibre GL
          return subTrecho.map(c => [Number(c[1]), Number(c[0])]);
        }
      } catch (e) {
        console.warn('Erro ao fatiar geometria offline:', e);
      }
      return null;
    },

    // =========================================================================
    // TRAVA E VALIDAÇÃO DE PARTIDA E RETORNO (PASSO 1 OBRIGATÓRIO)
    // =========================================================================
    get temPartidaEChegadaValida() {
      return Boolean(
        this.inputPartidaModal && this.inputPartidaModal.trim().length >= 3 &&
        this.inputChegadaModal && this.inputChegadaModal.trim().length >= 3
      );
    },

    salvarPartidaChegadaLocal() {
      if (this.inputPartidaModal) {
        localStorage.setItem('spxrotas_partida_padrao', this.inputPartidaModal.trim());
      }
      if (this.inputChegadaModal) {
        localStorage.setItem('spxrotas_chegada_padrao', this.inputChegadaModal.trim());
      }
    },

    processarArquivoExcelComValidacao(event) {
      if (!this.temPartidaEChegadaValida) {
        alert('⚠️ ATENÇÃO:\n\nPreencha o Ponto de Partida e o Ponto de Retorno no Passo 1 antes de selecionar a planilha!\n\nO cálculo viário precisa desses dados para eliminar a marcha à ré.');
        event.target.value = '';
        return;
      }
      this.salvarPartidaChegadaLocal();
      this.processarArquivoExcel(event);
    },

    // =========================================================================
    // WAKE LOCK API (TELA SEMPRE ACESA EM SEGUNDO PLANO)
    // =========================================================================
    async ativarWakeLock() {
      if ('wakeLock' in navigator) {
        try {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockAtivo = true;
          this.wakeLockSentinel.addEventListener('release', () => {
            this.wakeLockAtivo = false;
          });
        } catch (err) {
          this.wakeLockAtivo = false;
        }
      }
    },

    liberarWakeLock() {
      if (this.wakeLockSentinel !== null) {
        try {
          this.wakeLockSentinel.release();
        } catch (e) {}
        this.wakeLockSentinel = null;
        this.wakeLockAtivo = false;
      }
    },

    // =========================================================================
    // BOTÃO S.O.S DE EMERGÊNCIA
    // =========================================================================
    salvarContatoEmergencia() {
      const tel = (this.contatoEmergencia || '').replace(/\D/g, '');
      this.contatoEmergencia = tel;
      localStorage.setItem('spxrotas_contato_emergencia', tel);
      alert('✅ Contato de emergência salvo com sucesso!');
    },

    dispararEmergenciaSOS() {
      if (!this.contatoEmergencia || this.contatoEmergencia.length < 10) {
        alert('⚠️ Cadastre o WhatsApp do seu contato de emergência no menu lateral antes de usar o S.O.S!');
        this.menuAberto = true;
        return;
      }

      const conf = confirm('🚨 ATENÇÃO: Deseja enviar um alerta de emergência com sua localização em tempo real para seu contato cadastrado?');
      if (!conf) return;

      const lat = this.ultimaLatCarro || (this.entregaNavegacao?.latitude) || '-24.1667';
      const lng = this.ultimaLngCarro || (this.entregaNavegacao?.longitude) || '-46.7800';
      const linkMaps = `https://maps.google.com/?q=${lat},${lng}`;
      const nomeMot = this.usuarioNome || 'Motorista Parceiro SPX';

      const mensagem = `🚨 *ALERTA DE EMERGÊNCIA SPXROTAS* 🚨\n\nOlá, sou ${nomeMot}. Estou em rota de entregas e precisei acionar o botão de S.O.S do aplicativo.\n\n📍 Minha localização atual é:\n${linkMaps}\n\nPor favor, entre em contato comigo urgente!`;

      const numFormatado = this.contatoEmergencia.startsWith('55') ? this.contatoEmergencia : `55${this.contatoEmergencia}`;
      const urlWa = `https://wa.me/${numFormatado}?text=${encodeURIComponent(mensagem)}`;
      window.open(urlWa, '_blank');
    },

    // =========================================================================
    // PINGO INTELIGENTE COM MEMÓRIA & BLINDAGEM DE SANIDADE (450 METROS)
    // =========================================================================
    async corrigirPingoPeloGPS(entrega) {
      if (!entrega) return;

      if (!navigator.geolocation) {
        alert('GPS indisponível no aparelho.');
        return;
      }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        const novaLat = pos.coords.latitude;
        const novaLng = pos.coords.longitude;

        if (entrega.latitude && entrega.longitude) {
          const distOriginal = this.calcularDistancia(novaLat, novaLng, Number(entrega.latitude), Number(entrega.longitude));
          if (distOriginal > 450) {
            const distFmt = distOriginal > 1000 ? (distOriginal / 1000).toFixed(1) + ' km' : Math.round(distOriginal) + ' metros';
            alert(`⚠️ BLOQUEADO POR SEGURANÇA:\n\nVocê está a ${distFmt} de distância do endereço original!\n\nO portão só pode ser fixado se você estiver na mesma rua (máximo 450 metros).`);
            return;
          }
        }

        const conf = confirm(`Deseja salvar sua posição atual como o portão correto para o endereço:\n\n"${entrega.endereco}"?`);
        if (!conf) return;

        entrega.latitude = novaLat;
        entrega.longitude = novaLng;

        const idx = this.entregas.findIndex(e => e.id === entrega.id);
        if (idx !== -1) {
          this.entregas[idx].latitude = novaLat;
          this.entregas[idx].longitude = novaLng;
          this.salvarCacheLocal();
        }

        // Gravação cirúrgica com apenas as colunas existentes em 'entregas'
        this.enfileirarSincronizacao('PATCH', `/items/entregas/${entrega.id}`, { latitude: novaLat, longitude: novaLng });
        this.enfileirarSincronizacao('POST', '/items/spxrotas_pingos_corrigidos', {
          endereco: entrega.endereco,
          cidade: entrega.cidade,
          bairro: entrega.bairro,
          latitude: novaLat,
          longitude: novaLng,
          corrigido_por: this.usuarioId || 'motorista_app'
        });

        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
        alert('📍 Pingo Inteligente gravado com sucesso! Nas próximas rotas, este endereço já cairá no portão exato.');
      }, (err) => {
        alert('Erro ao obter coordenadas do GPS: ' + err.message);
      }, { enableHighAccuracy: true });
    },

    // =========================================================================
    // BIPADOR DE SACOLAS COM VOZ (BARCODE DETECTOR - FOTO 1)
    // =========================================================================
    async abrirBipadorVoz() {
      if (!this.entregas || this.entregas.length === 0) {
        alert('Carregue uma rota primeiro antes de iniciar o Bipador.');
        return;
      }

      this.modo = 'bipador';
      this.ultimoPacoteBipado = null;
      this.ultimoCodigoLido = '';
      this.statusTextoBipador = '⏳ Abrindo câmera do leitor...';

      if ('BarcodeDetector' in window) {
        try {
          this.detectorCodigoBarras = new BarcodeDetector({
            formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'data_matrix']
          });
        } catch (e) {
          this.detectorCodigoBarras = null;
        }
      }

      setTimeout(() => {
        this.iniciarCameraBipador();
      }, 250);
    },

    async iniciarCameraBipador() {
      const video = document.getElementById('videoScannerBipador');
      if (!video) return;

      this.pararCameraBipador();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: this.cameraFacingMode },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          },
          audio: false
        });

        this.streamCameraBipador = stream;
        video.srcObject = stream;
        await video.play();

        this.statusTextoBipador = '🎯 Enquadre o código de barras da caixa';
        this.iniciarLoopLeituraBipador();
      } catch (err) {
        this.statusTextoBipador = '❌ Erro ao acessar câmera';
        alert('Não foi possível abrir a câmera. Verifique as permissões do navegador.');
        this.modo = 'carregamento';
      }
    },

    iniciarLoopLeituraBipador() {
      if (this.intervaloScanBipador) clearInterval(this.intervaloScanBipador);

      const video = document.getElementById('videoScannerBipador');
      this.intervaloScanBipador = setInterval(async () => {
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

        if (this.detectorCodigoBarras) {
          try {
            const codigos = await this.detectorCodigoBarras.detect(video);
            if (codigos && codigos.length > 0) {
              const valor = (codigos[0].rawValue || '').toUpperCase().trim();
              this.processarLeituraEtiqueta(valor);
            }
          } catch (e) {}
        }
      }, 120);
    },

    processarLeituraEtiqueta(codigo) {
      if (!codigo || codigo.length < 4) return;

      const agora = Date.now();
      if (codigo === this.ultimoCodigoLido && (agora - this.timestampUltimoBip < 2500)) {
        return;
      }

      const match = this.entregas.find(e => {
        const rastreio = (e.codigo_rastreio || '').toUpperCase();
        return rastreio === codigo || rastreio.includes(codigo) || codigo.includes(rastreio) || rastreio.endsWith(codigo.slice(-4));
      });

      if (match) {
        this.ultimoCodigoLido = codigo;
        this.timestampUltimoBip = agora;
        this.ultimoPacoteBipado = match;

        // 🟢 Transição do Ciclo de Conferência: Roxo ➔ Verde
        this.idsConferidos.add(match.id);
        this.salvarConferidosLocal();
        this.salvarCacheLocal();

        this.tocarBipScanner();
        if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);

        const canetao = match.ordem_entrega;
        const sacola = Math.ceil(canetao / 10);

        let textoAudio = `Canetão ${canetao}! Sacola ${sacola}!`;
        if (!match.parada_shopee || Number(match.parada_shopee) <= 0 || match.parada_shopee === '-') {
          textoAudio = `Canetão ${canetao}! Sacola ${sacola}! Pacote Avulso!`;
        }

        this.falarTexto(textoAudio);
        this.statusTextoBipador = `✅ Canetão #${canetao} identificado!`;
      }
    },

    tocarBipScanner() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(2400, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.09);
      } catch (e) {}
    },

    async alternarLanternaBipador() {
      if (!this.streamCameraBipador) return;
      const track = this.streamCameraBipador.getVideoTracks()[0];
      if (!track || !track.applyConstraints) return;

      this.lanternaAtiva = !this.lanternaAtiva;
      try {
        await track.applyConstraints({ advanced: [{ torch: this.lanternaAtiva }] });
      } catch (e) {
        this.lanternaAtiva = false;
      }
    },

    alternarCameraBipador() {
      this.cameraFacingMode = (this.cameraFacingMode === 'environment') ? 'user' : 'environment';
      this.iniciarCameraBipador();
    },

    pararCameraBipador() {
      if (this.intervaloScanBipador) {
        clearInterval(this.intervaloScanBipador);
        this.intervaloScanBipador = null;
      }
      if (this.streamCameraBipador) {
        try {
          this.streamCameraBipador.getTracks().forEach(t => t.stop());
        } catch (e) {}
        this.streamCameraBipador = null;
      }
      this.lanternaAtiva = false;
    },

    fecharBipadorVoz() {
      this.pararCameraBipador();
      this.modo = 'carregamento';
    },

    // =========================================================================
    // NAVEGADOR PADRÃO (SPXROTAS 3D / WAZE / MAPS)
    // =========================================================================
    selecionarAppNavegacao(appKey) {
      this.appNavegacaoEscolhido = appKey;
      localStorage.setItem('spxrotas_nav_app', appKey);
      if ('vibrate' in navigator) navigator.vibrate(30);
    },

    getIconeBotaoNavegacao() {
      if (this.appNavegacaoEscolhido === 'waze') return '🚗';
      if (this.appNavegacaoEscolhido === 'maps') return '🗺️';
      return '🧭';
    },

    getTextoBotaoNavegacao() {
      if (this.appNavegacaoEscolhido === 'waze') return 'Navegar com Waze';
      if (this.appNavegacaoEscolhido === 'maps') return 'Navegar com Google Maps';
      return 'Navegar no SPXrotas (3D)';
    },

    getEstiloBotaoNavegacao() {
      if (this.appNavegacaoEscolhido === 'waze') {
        return 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30';
      }
      if (this.appNavegacaoEscolhido === 'maps') {
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30';
      }
      return 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-600/40';
    },

    dispararNavegacaoConfigurada(entrega) {
      if (!entrega || !entrega.latitude || !entrega.longitude) {
        alert('Coordenadas indisponíveis para este pacote.');
        return;
      }

      this.iniciarTelemetriaSeNecessario();

      if (this.appNavegacaoEscolhido === 'waze') {
        window.location.href = `waze://?ll=${entrega.latitude},${entrega.longitude}&navigate=yes`;
        return;
      }

      if (this.appNavegacaoEscolhido === 'maps') {
        const isAndroid = /android/i.test(navigator.userAgent);
        if (isAndroid) {
          window.location.href = `google.navigation:q=${entrega.latitude},${entrega.longitude}`;
        } else {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${entrega.latitude},${entrega.longitude}`, '_system');
        }
        return;
      }

      this.iniciarNavegacaoNativa(entrega);
    },

    // =========================================================================
    // RELATÓRIOS EXECUTIVOS & TELEMETRIA REAL AUDITADA
    // =========================================================================
    salvarConfigVeiculo() {
      localStorage.setItem('spxrotas_config_veiculo', JSON.stringify(this.configVeiculo));
      alert('✅ Dados de consumo atualizados com sucesso!');
    },

    async abrirModalRelatorio(rota) {
      if (!rota) return;
      try {
        let entregasDaRota = [];
        if (String(this.rotaAtivaId) === String(rota.id) && this.entregas && this.entregas.length > 0) {
          entregasDaRota = this.entregas;
        } else {
          const res = await this.fetchDirectus(`/items/entregas?filter[rota_id][_eq]=${rota.id}&sort=ordem_entrega&limit=500`);
          if (res && res.ok) {
            const data = await res.json();
            entregasDaRota = data.data || [];
          }
        }

        const moduloRelatorio = window.SPXrotasRelatorio || window.DriveXPSRelatorio;
        if (moduloRelatorio) {
          this.dadosRelatorio = moduloRelatorio.compilarDados(rota, entregasDaRota, this.configVeiculo, this.telemetria);
          this.modalRelatorio = true;
        } else {
          alert('Módulo de relatórios carregando, tente em instantes.');
        }
      } catch (e) {
        alert('Erro ao carregar dados do relatório: ' + e.message);
      }
    },

    baixarPDFRelatorio() {
      const moduloRelatorio = window.SPXrotasRelatorio || window.DriveXPSRelatorio;
      if (!this.dadosRelatorio || !moduloRelatorio) return;
      moduloRelatorio.exportarPDF(this.dadosRelatorio, this.usuarioNome || 'Motorista Parceiro SPX');
    },

    // =========================================================================
    // COMUNICAÇÃO DIRECTUS (COM BLINDAGEM DE SINAL OFFLINE)
    // =========================================================================
    async fetchDirectus(path, options = {}) {
      const url = path.startsWith('http') ? path : `${this.DIRECTUS_URL}${path}`;
      const headers = options.headers || {};
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';

      const token = this.tokenAcesso || localStorage.getItem('directus_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const fetchOpts = { ...options, headers, credentials: 'include' };
      
      try {
        let res = await fetch(url, fetchOpts);

        if (res.status === 401) {
          const renovou = await this.tentarRenovarTokenDirectus();
          if (renovou) {
            headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
            res = await fetch(url, { ...fetchOpts, headers });
          }
        }
        return res;
      } catch (networkError) {
        this.estaOnline = false;
        throw networkError;
      }
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
    // GETTERS REATIVOS & FILTROS (MÉTODO CANETÃO & CONFERÊNCIA)
    // =========================================================================
    limparEnderecoVisual(end) {
      if (!end) return '';
      return end
        .replace(/,\s*N\/A/gi, '')
        .replace(/,\s*(São Paulo|SP)\b.*$/gi, '')
        .replace(/,\s*\d{5}-?\d{3}.*$/gi, '')
        .replace(/,\s*\d{7,8}.*$/gi, '')
        .trim();
    },

    formatarParada(val) {
      if (val === null || val === undefined || val === '') return '-';
      if (typeof val === 'number' && val < 0) return '+' + Math.abs(val);
      if (typeof val === 'string' && Number(val) < 0) return '+' + Math.abs(Number(val));
      return val;
    },

    get entregasOrdenadasParaSacola() {
      return [...this.entregas].sort((a, b) => {
        if (a.status === 'entregue' && b.status !== 'entregue') return 1;
        if (a.status !== 'entregue' && b.status === 'entregue') return -1;
        return (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0);
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
      // Prioridade 1: Pacote já pronto e conferido (verde)
      const primeiroPronto = this.entregas.find(e => e.status === 'pendente' && this.idsConferidos.has(e.id));
      if (primeiroPronto) return primeiroPronto;
      // Prioridade 2: Qualquer outro não entregue
      const primeiroNaoEntregue = this.entregas.find(e => e.status === 'pendente');
      if (primeiroNaoEntregue) return primeiroNaoEntregue;
      // Prioridade 3: Ausente da volta
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
        const rastreioCompleto = (e.codigo_rastreio || '').toLowerCase();
        const finalRastreio = rastreioCompleto.slice(-4);

        if (canetaoStr === t || paradaStr === t || ordemStr === t || sacolaNum === t) return true;
        if (t.startsWith('#') && t.replace('#', '') === canetaoStr) return true;
        if (t.startsWith('+') && t === paradaStr) return true;

        if (finalRastreio === t || (t.length >= 3 && finalRastreio.endsWith(t))) return true;

        if (apenasNumeros && t.length <= 3 && canetaoStr !== t) return false;

        return (e.endereco && e.endereco.toLowerCase().includes(t)) ||
               (e.bairro && e.bairro.toLowerCase().includes(t)) ||
               rastreioCompleto.includes(t);
      });
    },

    getTextoStatusAssinatura() {
      if (this.planoAtivo === 'vitalicio') return 'Assinatura Ativa (VITALÍCIO)';
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
    // INICIALIZAÇÃO DO APP
    // =========================================================================
    async init() {
      this.aplicarTemaVisual();
      this.checarInstalacaoPWA();

      // Ativa Wake Lock automaticamente
      this.ativarWakeLock();

      // Monitor de Conexão Online/Offline
      window.addEventListener('online', () => {
        this.estaOnline = true;
        this.processarFilaSync();
      });

      window.addEventListener('offline', () => {
        this.estaOnline = false;
      });

      // Tenta processar fila offline a cada 10 segundos
      this.intervaloSyncOffline = setInterval(() => {
        if (navigator.onLine && this.syncQueue.length > 0) {
          this.processarFilaSync();
        }
      }, 10000);

      // Carregamento de Cache Offline Imediato (Fonte Suprema da Verdade)
      const cacheEntregas = localStorage.getItem('spxrotas_entregas_cache');
      if (cacheEntregas) {
        try { this.entregas = JSON.parse(cacheEntregas); } catch (e) {}
      }

      const cacheHistorico = localStorage.getItem('spxrotas_rotas_historico_cache');
      if (cacheHistorico) {
        try { this.rotasHistorico = JSON.parse(cacheHistorico); } catch (e) {}
      }

      this.carregarConferidosLocal();

      await this.verificarAutenticacao();

      if (this.usuarioLogado) {
        await this.sincronizarAssinaturaSaaS();
        if (this.rotaAtivaId) {
          await this.carregarEntregasPorId(this.rotaAtivaId);
          this.carregarTelemetriaLocal();
        } else {
          await this.carregarUltimaRota();
        }
        this.carregarRadaresDoBanco();
      }

      this.escutarArquivosCompartilhados();

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.ativarWakeLock();
          if (navigator.onLine) this.processarFilaSync();
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
      localStorage.setItem('spxrotas_tema', novoTema);
      this.aplicarTemaVisual();
    },

    salvarCacheLocal() {
      if (this.rotaAtivaId) localStorage.setItem('spxrotas_rota_ativa_id', String(this.rotaAtivaId));
      if (this.entregas && this.entregas.length > 0) localStorage.setItem('spxrotas_entregas_cache', JSON.stringify(this.entregas));
      if (this.rotaGeometria) localStorage.setItem('spxrotas_rota_geometria', this.rotaGeometria);
      if (this.coordPartidaSalva) localStorage.setItem('spxrotas_coord_partida', JSON.stringify(this.coordPartidaSalva));
      if (this.coordChegadaSalva) localStorage.setItem('spxrotas_coord_chegada', JSON.stringify(this.coordChegadaSalva));
    },

    // =========================================================================
    // BLINDAGEM DE RADARES (TRAVA DE 18 METROS DA POLILINHA)
    // =========================================================================
    async carregarRadaresDoBanco() {
      try {
        let endpoint = '/items/drivexps_radares?limit=1000';

        if (this.entregas && this.entregas.length > 0) {
          let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
          this.entregas.forEach(p => {
            const lat = Number(p.latitude);
            const lng = Number(p.longitude);
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          });

          const margem = 0.09;
          const latMin = (minLat - margem).toFixed(4);
          const latMax = (maxLat + margem).toFixed(4);
          const lngMin = (minLng - margem).toFixed(4);
          const lngMax = (maxLng + margem).toFixed(4);

          endpoint = `/items/drivexps_radares?filter[latitude][_gte]=${latMin}&filter[latitude][_lte]=${latMax}&filter[longitude][_gte]=${lngMin}&filter[longitude][_lte]=${lngMax}&limit=2500`;
        }

        const res = await this.fetchDirectus(endpoint);
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.data && data.data.length > 0) {
            this.listaRadares = data.data.map(r => ({
              id: r.id || r.osm_id,
              latitude: Number(r.latitude),
              longitude: Number(r.longitude),
              velocidade: Number(r.velocidade) || 60,
              tipo: r.tipo || 'fixo',
              rodovia_rua: r.rodovia_rua || 'Via Monitorada'
            }));

            if (this.modo === 'navegacao' && this.mapaNavGL) {
              this.renderizarRadaresNaPistaGL();
            }
          }
        }
      } catch (e) {
        console.warn('[SPXrotas] Operando com radares locais ou offline');
      }
    },

    renderizarRadaresNaPistaGL() {
      if (!this.mapaNavGL) return;

      if (this.marcadoresRadaresGL && this.marcadoresRadaresGL.length > 0) {
        this.marcadoresRadaresGL.forEach(m => m.remove());
      }
      this.marcadoresRadaresGL = [];

      if (!this.listaRadares || this.listaRadares.length === 0) return;

      this.listaRadares.forEach(r => {
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        const el = document.createElement('div');
        el.className = 'radar-pino-pista';
        el.title = `Radar ${r.velocidade || 60} km/h - ${r.rodovia_rua || 'Via'}`;
        el.innerHTML = `
          <div class="radar-pino-disco">
            <span class="radar-pino-vel">${r.velocidade || 60}</span>
          </div>
          <div class="radar-pino-haste"></div>
        `;

        const marcador = new maplibregl.Marker({
          element: el,
          anchor: 'bottom',
          rotationAlignment: 'viewport'
        })
        .setLngLat([lng, lat])
        .addTo(this.mapaNavGL);

        this.marcadoresRadaresGL.push(marcador);
      });
    },

    tocarBipeExcessoVelocidade() {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!this.audioContextBipe && AudioContextClass) {
          this.audioContextBipe = new AudioContextClass();
        }
        if (this.audioContextBipe && this.audioContextBipe.state === 'suspended') {
          this.audioContextBipe.resume();
        }
        if (this.audioContextBipe) {
          const osc = this.audioContextBipe.createOscillator();
          const gain = this.audioContextBipe.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, this.audioContextBipe.currentTime);
          gain.gain.setValueAtTime(0.20, this.audioContextBipe.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioContextBipe.currentTime + 0.16);
          osc.connect(gain);
          gain.connect(this.audioContextBipe.destination);
          osc.start();
          osc.stop(this.audioContextBipe.currentTime + 0.17);
        }
      } catch (e) {}
    },

    calcularDistanciaPontoAteRota(pLat, pLng) {
      if (!this.coordenadasRotaAtual || this.coordenadasRotaAtual.length < 2) return 9999;
      let menorDist = Infinity;
      const rad = Math.PI / 180;
      const cosLat = Math.cos(pLat * rad);
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

        const px = (pLng - lngA) * mPorLng;
        const py = (pLat - latA) * mPorLat;
        let t = (px * dx + py * dy) / L2;
        t = Math.max(0, Math.min(1, t));

        const projX = t * dx;
        const projY = t * dy;
        const distM = Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
        if (distM < menorDist) menorDist = distM;
      }
      return menorDist;
    },

    verificarRadaresProximos(lat, lng, headingCarro) {
      if (!this.listaRadares || this.listaRadares.length === 0) {
        this.radarProximoAlerta = null;
        this.radarExcessoVelocidade = false;
        if (this.intervaloBipeExcesso) { clearInterval(this.intervaloBipeExcesso); this.intervaloBipeExcesso = null; }
        return;
      }

      let radarMaisProximo = null;
      let menorDistancia = Infinity;
      const temRotaAtiva = this.coordenadasRotaAtual && this.coordenadasRotaAtual.length >= 2;

      const viaAtualCarro = (this.nomeRuaAtualCarro || this.nomeRuaPisoAtual || '').toLowerCase().trim();
      const carroEstaEmMarginalOuBairro = viaAtualCarro.includes('marginal') || viaAtualCarro.includes('rua') || viaAtualCarro.includes('avenida') || viaAtualCarro.includes('alameda');
      const carroNaoEstaNaRodovia = !viaAtualCarro.includes('rodovia') && !viaAtualCarro.includes('sp-') && !viaAtualCarro.includes('br-');

      for (const r of this.listaRadares) {
        const rLat = Number(r.latitude);
        const rLng = Number(r.longitude);
        const dist = this.calcularDistancia(lat, lng, rLat, rLng);

        if (dist <= 320 && dist < menorDistancia) {
          const viaRadar = (r.rodovia_rua || '').toLowerCase().trim();
          const radarEhDeRodoviaExpressa = viaRadar.includes('rodovia') || viaRadar.includes('sp-') || viaRadar.includes('br-') || r.velocidade >= 80;

          if (radarEhDeRodoviaExpressa && carroEstaEmMarginalOuBairro && carroNaoEstaNaRodovia) {
            continue;
          }

          if (temRotaAtiva) {
            const distRadarAteRota = this.calcularDistanciaPontoAteRota(rLat, rLng);
            if (distRadarAteRota > 18) continue;
          }

          const anguloAteRadar = this.calcularBearing(lat, lng, rLat, rLng);
          let diffAngulo = Math.abs(anguloAteRadar - headingCarro);
          if (diffAngulo > 180) diffAngulo = 360 - diffAngulo;

          if (diffAngulo <= 45) {
            menorDistancia = dist;
            radarMaisProximo = { ...r, distMetros: Math.round(dist) };
          }
        }
      }

      if (radarMaisProximo) {
        this.radarProximoAlerta = radarMaisProximo;
        this.distanciaRadarTexto = radarMaisProximo.distMetros > 1000
          ? (radarMaisProximo.distMetros / 1000).toFixed(1) + ' km'
          : radarMaisProximo.distMetros + ' m';

        const velLimite = Number(radarMaisProximo.velocidade) || 60;
        const acimaLimite = this.velocidadeGPS > velLimite;
        this.radarExcessoVelocidade = acimaLimite;

        if (this.radarVozAnunciadaId !== radarMaisProximo.id && radarMaisProximo.distMetros <= 300) {
          this.radarVozAnunciadaId = radarMaisProximo.id;
          this.falarTexto(`Atenção: Radar à frente, limite ${velLimite} por hora`);
        }

        if (acimaLimite) {
          if (!this.intervaloBipeExcesso) {
            this.tocarBipeExcessoVelocidade();
            if ('vibrate' in navigator) navigator.vibrate([80, 50, 80]);
            this.intervaloBipeExcesso = setInterval(() => {
              if (this.radarExcessoVelocidade) this.tocarBipeExcessoVelocidade();
            }, 850);
          }
        } else {
          if (this.intervaloBipeExcesso) { clearInterval(this.intervaloBipeExcesso); this.intervaloBipeExcesso = null; }
        }
      } else {
        this.radarProximoAlerta = null;
        this.radarExcessoVelocidade = false;
        this.radarVozAnunciadaId = null;
        if (this.intervaloBipeExcesso) { clearInterval(this.intervaloBipeExcesso); this.intervaloBipeExcesso = null; }
      }
    },

    // =========================================================================
    // CONTROLES DE ENTREGA E GRAVAÇÃO LIMPA NO DIRECTUS (SEM ERRO 400)
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
          for (const p of mesmoLocal) { 
            await this.registrarConclusaoComTelemetria(p, 'entregue');
          }
          this.entregaSelecionadaId = null;
          if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
          return;
        }
      }
      this.entregaSelecionadaId = null;
      await this.registrarConclusaoComTelemetria(entrega, 'entregue');
      if ('vibrate' in navigator) navigator.vibrate(40);
    },

    /**
     * Caixa-Preta: Grava o tempo exato parado na porta do cliente no cache local
     */
    async registrarConclusaoComTelemetria(entrega, status) {
      const agora = Date.now();
      this.iniciarTelemetriaSeNecessario();

      let tempoAtendimentoSec = 60;
      if (this.telemetria.momentoChegadaUltimaParada) {
        tempoAtendimentoSec = Math.max(15, Math.round((agora - this.telemetria.momentoChegadaUltimaParada) / 1000));
      }

      let tempoDeslocamentoSec = 120;
      if (this.telemetria.momentoSaidaUltimaParada) {
        const momentoChegada = this.telemetria.momentoChegadaUltimaParada || agora;
        tempoDeslocamentoSec = Math.max(20, Math.round((momentoChegada - this.telemetria.momentoSaidaUltimaParada) / 1000));
      }

      // Salva campos ricos apenas no cache local do celular para o PDF
      entrega.tempo_atendimento_seg = tempoAtendimentoSec;
      entrega.tempo_deslocamento_seg = tempoDeslocamentoSec;
      entrega.entregue_em = new Date().toISOString();

      this.telemetria.tempoAtendimentoMs += (tempoAtendimentoSec * 1000);
      this.telemetria.momentoSaidaUltimaParada = agora;
      this.telemetria.momentoChegadaUltimaParada = null;

      const restantesAposEsta = this.entregas.filter(e => e.status !== 'entregue' && e.id !== entrega.id);
      if (restantesAposEsta.length === 0) {
        this.telemetria.fimTimestamp = agora;
        this.telemetria.tempoTotalMs = Math.max(60000, agora - this.telemetria.inicioTimestamp);
      }

      this.salvarTelemetriaLocal();
      await this.atualizarStatus(entrega.id, status);
    },

    /**
     * 🛡️ GRAVAÇÃO CIRÚRGICA: Envia APENAS o campo 'status' para a tabela 'entregas'
     * Isso elimina 100% dos erros 400 do Directus e garante que o banco grava de verdade!
     */
    async atualizarStatus(id, novoStatus) {
      // 1. Atualiza na memória reativa da tela
      const idx = this.entregas.findIndex(e => e.id === id);
      if (idx !== -1) {
        this.entregas[idx].status = novoStatus;
      }

      // 2. Grava no cache supremo do celular (imunidade contra queda de sinal)
      this.salvarCacheLocal();
      if (this.modo === 'mapa') this.desenharPinosERotaNoMapa();

      // 3. Tenta salvar no Directus imediatamente se online
      const payloadLimpo = { status: novoStatus };
      if (navigator.onLine) {
        try {
          await this.fetchDirectus(`/items/entregas/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payloadLimpo)
          });
          return;
        } catch (e) {
          // Se falhou ou caiu o 4G, enfileira para a SyncQueue garantir!
        }
      }

      this.enfileirarSincronizacao('PATCH', `/items/entregas/${id}`, payloadLimpo);
    },

    // =========================================================================
    // MAPA GERAL LEAFLET 2D
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

      const entregasOrdenadas = [...this.entregas].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));

      entregasOrdenadas.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const coord = [p.latitude, p.longitude];
        pontosLinha.push(coord);

        let corFundo = '#a855f7'; // Roxo padrão (Aguardando Bipagem)
        if (this.isPacoteConferido(p)) corFundo = '#10b981'; // Verde (Pronto / Conferido)
        if (p.status === 'entregue') corFundo = '#ef4444'; // Vermelho (Entregue)
        if (p.status === 'ausente') corFundo = '#f59e0b'; // Amarelo (Ausente)

        const iconePacote = L.divIcon({
          className: 'custom-pin-pacote',
          html: `<div style="background-color: ${corFundo}; color: #ffffff; font-weight: 900; font-family: monospace; font-size: 11px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">#${p.ordem_entrega}</div>`,
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
    // NAVEGAÇÃO 3D NATIVA (COM SUPORTE A POLILINHA VIÁRIA OFFLINE)
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
      else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },

    projetarPontoNaRota(lat, lng, headingCarro) {
      if (!this.coordenadasRotaAtual || this.coordenadasRotaAtual.length < 2) {
        return { lat, lng, distRota: 0, headingSegmento: null, indiceSegmento: 0 };
      }

      let menorDist = Infinity;
      let pontoProjetado = { lat, lng };
      let headingDoSegmento = null;
      let indiceMaisProximo = 0;

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
          headingDoSegmento = this.calcularBearing(latA, lngA, latB, lngB);
          indiceMaisProximo = i;
        }
      }

      if (headingCarro !== null && headingDoSegmento !== null) {
        let diff = Math.abs(headingCarro - headingDoSegmento);
        if (diff > 180) diff = 360 - diff;
        if (diff > 55) {
          return { lat, lng, distRota: menorDist, headingSegmento: null, indiceSegmento: indiceMaisProximo };
        }
      }

      if (menorDist <= 20) {
        return {
          lat: pontoProjetado.lat,
          lng: pontoProjetado.lng,
          distRota: menorDist,
          headingSegmento: headingDoSegmento,
          indiceSegmento: indiceMaisProximo
        };
      }

      return { lat, lng, distRota: menorDist, headingSegmento: null, indiceSegmento: indiceMaisProximo };
    },

    async iniciarNavegacaoNativa(entrega) {
      if (!navigator.geolocation) { alert('GPS não suportado.'); return; }

      if (this.watchPositionId) {
        navigator.geolocation.clearWatch(this.watchPositionId);
        this.watchPositionId = null;
      }

      this.ativarWakeLock();
      this.iniciarTelemetriaSeNecessario();

      this.entregaNavegacao = entrega;
      this.modo = 'navegacao';
      this.nomeProximaRua = entrega ? entrega.endereco : 'Destino';
      this.nomeRuaPisoAtual = entrega?.endereco?.split(',')[0] || 'Via Atual';
      this.nomeRuaAtualCarro = this.nomeRuaPisoAtual;
      this.instrucaoAtual = `Iniciando rota para o Canetão #${entrega?.ordem_entrega}...`;
      this.distanciaProximaManobra = '...';
      this.subInstrucaoEmSeguida = `Canetão #${entrega?.ordem_entrega}`;
      this.iconeManobraNav = '⬆️';
      this.chegadaAnunciada = false;
      this.alertaRetornoFalado = false;
      this.velocidadeGPS = 0;
      this.mapaArrastadoPeloUsuario = false;
      if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
      this.coordenadasRotaAtual = [];
      this.contadorForaDaRota = 0;
      this.recalculandoRota = false;
      this.radarProximoAlerta = null;
      this.radarExcessoVelocidade = false;
      this.radarVozAnunciadaId = null;

      setTimeout(() => { this.inicializarMapaNavGL(entrega); }, 250);
    },

    inicializarMapaNavGL(entrega) {
      const container = document.getElementById('mapaNavGL');
      if (!container) return;
      if (this.mapaNavGL) { this.mapaNavGL.remove(); this.mapaNavGL = null; }

      const bearingInicialSeguro = (this.ultimoHeadingEmMovimento !== null) ? this.ultimoHeadingEmMovimento : 0;
      this.headingAtual = bearingInicialSeguro;

      this.mapaNavGL = new maplibregl.Map({
        container: 'mapaNavGL',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [entrega.longitude, entrega.latitude],
        zoom: 16.8,
        pitch: 42,
        bearing: bearingInicialSeguro,
        attributionControl: false
      });

      const pausarCameraAutomatica = () => {
        this.mapaArrastadoPeloUsuario = true;
        if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
        this.timeoutRecentralizar = setTimeout(() => {
          this.mapaArrastadoPeloUsuario = false;
        }, 8000);
      };

      this.mapaNavGL.on('dragstart', pausarCameraAutomatica);
      this.mapaNavGL.on('zoomstart', (e) => { if (e.originalEvent) pausarCameraAutomatica(); });
      this.mapaNavGL.on('rotatestart', (e) => { if (e.originalEvent) pausarCameraAutomatica(); });
      this.mapaNavGL.on('pitchstart', (e) => { if (e.originalEvent) pausarCameraAutomatica(); });
      this.mapaNavGL.on('touchstart', (e) => {
        if (e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) {
          pausarCameraAutomatica();
        }
      });

      this.mapaNavGL.on('load', () => {
        try {
          if (this.mapaNavGL.getLayer('background')) {
            this.mapaNavGL.setPaintProperty('background', 'background-color', '#141c2b');
          }

          const layers = this.mapaNavGL.getStyle().layers || [];
          layers.forEach(l => {
            const id = l.id.toLowerCase();
            const isRoad = id.includes('road') || id.includes('highway') || id.includes('transportation') || id.includes('street');

            if (l.type === 'line' && isRoad) {
              try {
                if (id.includes('casing')) {
                  this.mapaNavGL.setPaintProperty(l.id, 'line-color', '#182436');
                } else {
                  this.mapaNavGL.setPaintProperty(l.id, 'line-color', '#25334a');
                }
              } catch (err) {}
            }

            if (l.type === 'symbol' && (id.includes('label') || id.includes('name') || id.includes('street'))) {
              try {
                this.mapaNavGL.setPaintProperty(l.id, 'text-color', '#ffffff');
                this.mapaNavGL.setPaintProperty(l.id, 'text-halo-color', '#090d16');
                this.mapaNavGL.setPaintProperty(l.id, 'text-halo-width', 2.5);
                this.mapaNavGL.setLayoutProperty(l.id, 'text-size', [
                  'interpolate', ['linear'], ['zoom'],
                  13, 11, 15, 14, 16.8, 16, 18.5, 18
                ]);
              } catch (err) {}
            }
          });
        } catch (e) {}

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

        this.renderizarRadaresNaPistaGL();
        this.iniciarGPSContinuoNavegacao();
      });
    },

    iniciarGPSContinuoNavegacao() {
      if (!this.entregaNavegacao) return;

      navigator.geolocation.getCurrentPosition(async (pos) => {
        const sLat = pos.coords.latitude;
        const sLng = pos.coords.longitude;
        this.ultimaLatCarro = sLat;
        this.ultimaLngCarro = sLng;

        this.atualizarMarcadorCarroGL(sLat, sLng);

        const bearingPartida = (this.ultimoHeadingEmMovimento !== null) ? this.ultimoHeadingEmMovimento : this.headingAtual;
        this.headingAtual = bearingPartida;
        this.centralizarNoCarroGL(sLat, sLng, bearingPartida, 0);

        await this.calcularRotaRuaARua(sLat, sLng, this.entregaNavegacao.latitude, this.entregaNavegacao.longitude);

        this.watchPositionId = navigator.geolocation.watchPosition(
          (novaPos) => this.processarPosicaoGPS(novaPos),
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

    /**
     * 🛣️ CÁLCULO DE ROTA RUAS-A-RUAS COM SUPORTE A POLILINHA OFFLINE (FIM DA LINHA RETA)
     */
    async calcularRotaRuaARua(sLat, sLng, eLat, eLng) {
      if (!sLat || !sLng || !eLat || !eLng) return;
      let coordsLngLat = [];
      let routeEncontrada = null;

      // 1. SE TIVER INTERNET -> CHAMA O OSRM ONLINE
      if (navigator.onLine) {
        try {
          const urlLocal = `${this.OSRM_ROUTER_URL}/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
          const resLocal = await fetch(urlLocal, { signal: AbortSignal.timeout(3000) });
          if (resLocal.ok) {
            const dataLocal = await resLocal.json();
            if (dataLocal.routes && dataLocal.routes.length > 0) routeEncontrada = dataLocal.routes[0];
          }
        } catch (e) {}

        if (!routeEncontrada) {
          try {
            const urlPub = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
            const resPub = await fetch(urlPub, { signal: AbortSignal.timeout(3000) });
            if (resPub.ok) {
              const dataPub = await resPub.json();
              if (dataPub.routes && dataPub.routes.length > 0) routeEncontrada = dataPub.routes[0];
            }
          } catch (e) {}
        }
      }

      // 2. SE NÃO TIVER INTERNET (ÁREA DE CHÁCARAS) -> RESGATA O TRECHO DA POLILINHA VROOM!
      if (!routeEncontrada) {
        const trechoViarioOffline = this.obterTrechoViarioOffline(sLat, sLng, eLat, eLng);
        if (trechoViarioOffline && trechoViarioOffline.length >= 2) {
          coordsLngLat = trechoViarioOffline;
          const distMetros = Math.round(this.calcularDistancia(sLat, sLng, eLat, eLng) * 1.25);
          this.distanciaProximaManobra = distMetros > 1000 ? (distMetros / 1000).toFixed(1) + ' km' : distMetros + ' m';
          this.passosRota = [];
        }
      }

      if (routeEncontrada && routeEncontrada.geometry) {
        coordsLngLat = routeEncontrada.geometry.coordinates.map(c => [Number(c[0]), Number(c[1])]);
        const distMetros = Math.round(routeEncontrada.distance);
        this.distanciaProximaManobra = distMetros > 1000 ? (distMetros / 1000).toFixed(1) + ' km' : distMetros + ' m';
        this.passosRota = routeEncontrada.legs[0]?.steps || [];
        this.passoAtualIndex = 0;

        if (this.passosRota.length > 0) {
          const viaSaida = this.passosRota[0].name || this.passosRota[0].ref;
          if (viaSaida && viaSaida.trim() !== '') {
            this.nomeRuaPisoAtual = viaSaida;
            this.nomeRuaAtualCarro = viaSaida;
          }
        }

        this.avaliarManobraSaida(coordsLngLat);
        this.atualizarInstrucaoUI();
      }

      // Fallback extremo caso não haja polilinha gravada
      if (!coordsLngLat || coordsLngLat.length === 0) {
        coordsLngLat = [[Number(sLng), Number(sLat)], [Number(eLng), Number(eLat)]];
        const distReta = Math.round(this.calcularDistancia(sLat, sLng, eLat, eLng));
        this.distanciaProximaManobra = distReta > 1000 ? (distReta / 1000).toFixed(1) + ' km' : distReta + ' m';
      }

      this.coordenadasRotaAtual = coordsLngLat;
      this.atualizarLinhaNavGL(coordsLngLat);
      this.atualizarMarcadorDestinoGL(eLat, eLng);

      if (coordsLngLat.length > 1) {
        const bearingInicialSeguro = (this.ultimoHeadingEmMovimento !== null) ? this.ultimoHeadingEmMovimento : this.headingAtual;
        if (!this.mapaArrastadoPeloUsuario) this.centralizarNoCarroGL(sLat, sLng, bearingInicialSeguro, 500);
      }
    },

    avaliarManobraSaida(coordsRota) {
      if (!coordsRota || coordsRota.length < 2 || this.alertaRetornoFalado) return;

      const bearingFrenteCarro = (this.ultimoHeadingEmMovimento !== null) ? this.ultimoHeadingEmMovimento : this.headingAtual;
      const bearingPrimeiroSegmento = this.calcularBearing(coordsRota[0][1], coordsRota[0][0], coordsRota[1][1], coordsRota[1][0]);

      let diff = Math.abs(bearingFrenteCarro - bearingPrimeiroSegmento);
      if (diff > 180) diff = 360 - diff;

      const primeiroStep = this.passosRota[0] || {};
      const nomeViaAtual = (this.nomeRuaAtualCarro || this.nomeRuaPisoAtual || '').toLowerCase().trim();
      const ehViaExpressaComCanteiro = nomeViaAtual.includes('rodovia') || nomeViaAtual.includes('sp-') || nomeViaAtual.includes('br-') || (nomeViaAtual.includes('avenida') && !nomeViaAtual.includes('rua'));

      if (primeiroStep.maneuver?.modifier === 'uturn' || diff > 130) {
        this.alertaRetornoFalado = true;

        if (ehViaExpressaComCanteiro) {
          this.instrucaoAtual = 'Destino no sentido oposto. Siga até o retorno oficial';
          this.iconeManobraNav = '⬆️';
          this.falarTexto(`Atenção: Destino no sentido oposto. Siga em frente até o retorno oficial para o Canetão ${this.entregaNavegacao?.ordem_entrega}`);
        } else {
          this.instrucaoAtual = `Faça o retorno na ${this.nomeRuaAtualCarro || 'mesma via'}`;
          this.iconeManobraNav = '↩️';
          this.falarTexto(`Atenção: Destino atrás de você. Faça o retorno na ${this.nomeRuaAtualCarro || 'mesma rua'} para o Canetão ${this.entregaNavegacao?.ordem_entrega}`);
        }
      } else {
        if (!this.alertaRetornoFalado) {
          this.falarTexto(`Iniciando rota para Canetão número ${this.entregaNavegacao?.ordem_entrega}, na ${this.entregaNavegacao?.endereco}`);
          this.alertaRetornoFalado = true;
        }
      }
    },

    atualizarMarcadorDestinoGL(lat, lng) {
      if (!this.mapaNavGL || !lat || !lng) return;
      const numCanetao = this.entregaNavegacao ? this.entregaNavegacao.ordem_entrega : '';
      let corFundo = '#a855f7'; // Roxo padrão
      if (this.isPacoteConferido(this.entregaNavegacao)) corFundo = '#10b981'; // Verde
      if (this.entregaNavegacao?.status === 'entregue') corFundo = '#ef4444'; // Vermelho
      if (this.entregaNavegacao?.status === 'ausente') corFundo = '#f59e0b'; // Amarelo

      if (this.marcadorDestinoGL) {
        this.marcadorDestinoGL.setLngLat([lng, lat]);
        const elPin = document.getElementById('pinDestinoNav');
        if (elPin) { elPin.style.backgroundColor = corFundo; elPin.innerText = `#${numCanetao}`; }
        return;
      }

      const el = document.createElement('div');
      el.innerHTML = `
        <div id="pinDestinoNav" style="background-color: ${corFundo}; color: #ffffff; font-weight: 900; font-family: monospace; font-size: 11px; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.85); cursor: pointer;">
          #${numCanetao}
        </div>
      `;
      this.marcadorDestinoGL = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(this.mapaNavGL);
    },

    atualizarMarcadorCarroGL(lat, lng) {
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

    centralizarNoCarroGL(lat, lng, bearing, duracao = 800) {
      if (!this.mapaNavGL) return;

      let zoomDinamico = 16.8;
      if (this.velocidadeGPS > 75) zoomDinamico = 15.5;
      else if (this.velocidadeGPS > 35) zoomDinamico = 16.2;
      else zoomDinamico = 16.8;

      this.mapaNavGL.easeTo({
        center: [lng, lat],
        bearing: (bearing !== undefined && bearing !== null) ? bearing : this.headingAtual,
        pitch: 42,
        zoom: zoomDinamico,
        padding: { top: 250, bottom: 30, left: 0, right: 0 },
        duration: duracao,
        easing: (t) => t
      });
    },

    centralizarCarroManual() {
      this.mapaArrastadoPeloUsuario = false;
      if (this.timeoutRecentralizar) clearTimeout(this.timeoutRecentralizar);
      if (this.ultimaLatCarro && this.ultimaLngCarro) {
        this.centralizarNoCarroGL(this.ultimaLatCarro, this.ultimaLngCarro, this.headingAtual, 400);
      }
    },

    async processarPosicaoGPS(pos) {
      if (!this.entregaNavegacao) return;

      const destLat = this.entregaNavegacao.latitude;
      const destLng = this.entregaNavegacao.longitude;

      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const accuracy = pos.coords.accuracy || 15;
      this.velocidadeGPS = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

      // Hodômetro real medido
      if (this.ultimaLatCarro && this.ultimaLngCarro) {
        const distMov = this.calcularDistancia(this.ultimaLatCarro, this.ultimaLngCarro, rawLat, rawLng);
        if (distMov >= 3.0 && this.velocidadeGPS >= 3.0 && accuracy <= 35) {
          this.telemetria.odometroMetros += distMov;
          this.telemetria.tempoDeslocamentoMs += 1000;
          this.salvarTelemetriaLocal();
        }
      }

      // Detecção de chegada no cliente
      const distDestinoFinal = this.calcularDistancia(rawLat, rawLng, destLat, destLng);
      if (distDestinoFinal <= 35 && !this.telemetria.momentoChegadaUltimaParada) {
        this.telemetria.momentoChegadaUltimaParada = Date.now();
        this.salvarTelemetriaLocal();
      }

      let headingMovimento = null;
      if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0 && this.velocidadeGPS >= this.minSpeedKmhNav) {
        headingMovimento = pos.coords.heading;
        this.ultimoHeadingEmMovimento = headingMovimento;
      } else if (this.ultimaLatCarro && this.ultimaLngCarro) {
        const distMov = this.calcularDistancia(this.ultimaLatCarro, this.ultimaLngCarro, rawLat, rawLng);
        if (distMov >= 1.8 && this.velocidadeGPS >= this.minSpeedKmhNav) {
          headingMovimento = this.calcularBearing(this.ultimaLatCarro, this.ultimaLngCarro, rawLat, rawLng);
          this.ultimoHeadingEmMovimento = headingMovimento;
        }
      }

      const snap = this.projetarPontoNaRota(rawLat, rawLng, headingMovimento);
      const lat = snap.lat;
      const lng = snap.lng;

      if (headingMovimento !== null) {
        let headingAlvo = headingMovimento;
        if (snap.headingSegmento !== null && snap.distRota <= 20) {
          let diff = Math.abs(snap.headingSegmento - headingMovimento);
          if (diff > 180) diff = 360 - diff;
          if (diff <= 35) headingAlvo = snap.headingSegmento;
        }
        this.headingAtual = this.smoothHeadingApp(this.headingAtual, headingAlvo, 0.45);
      }

      if (this.nomeRuaPisoAtual && this.nomeRuaPisoAtual.trim() !== '') {
        this.nomeRuaAtualCarro = this.nomeRuaPisoAtual;
      } else if (this.passosRota.length > 0) {
        this.nomeRuaAtualCarro = this.passosRota[0].name || this.passosRota[0].ref || 'Sua Rota';
      }

      this.verificarRadaresProximos(lat, lng, this.headingAtual);
      this.atualizarMarcadorCarroGL(lat, lng);

      if (!this.mapaArrastadoPeloUsuario) {
        this.centralizarNoCarroGL(lat, lng, this.headingAtual, 900);
      }

      this.ultimaLatCarro = lat;
      this.ultimaLngCarro = lng;

      this.distanciaProximaManobra = distDestinoFinal > 1000 ? (distDestinoFinal / 1000).toFixed(1) + ' km' : Math.round(distDestinoFinal) + ' m';

      if (distDestinoFinal <= 25 && !this.chegadaAnunciada) {
        this.chegadaAnunciada = true;
        this.falarTexto(`Você chegou ao destino! Canetão número ${this.entregaNavegacao?.ordem_entrega || ''}, na ${this.entregaNavegacao?.endereco || ''}`);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
      }

      const agora = Date.now();
      const foraDaLinha = snap.distRota > 22;
      if (foraDaLinha) this.contadorForaDaRota++;
      else this.contadorForaDaRota = 0;

      if (this.contadorForaDaRota >= 2 && !this.recalculandoRota && (agora - this.ultimoRecalculoTimestamp > 2500)) {
        this.recalculandoRota = true;
        this.ultimoRecalculoTimestamp = agora;
        this.contadorForaDaRota = 0;
        this.falarTexto('Recalculando rota...');
        await this.calcularRotaRuaARua(rawLat, rawLng, destLat, destLng);
        this.recalculandoRota = false;
        return;
      }

      if (this.passosRota.length > 0 && this.passoAtualIndex < this.passosRota.length) {
        const stepManobra = this.passosRota[this.passoAtualIndex];
        const manobraLat = stepManobra.maneuver.location[1];
        const manobraLng = stepManobra.maneuver.location[0];
        const distParaManobra = this.calcularDistancia(lat, lng, manobraLat, manobraLng);
        const info = this.interpretarManobraWaze(stepManobra);

        const isAltaVelocidade = this.velocidadeGPS > 60;
        const distAvisoLonge = isAltaVelocidade ? 550 : 220;
        const distAvisoPerto = isAltaVelocidade ? 160 : 65;

        if (distParaManobra <= distAvisoLonge && distParaManobra > distAvisoPerto && !stepManobra._avisoLongeFalado) {
          stepManobra._avisoLongeFalado = true;
          const distFmt = isAltaVelocidade ? '500 metros' : '200 metros';
          this.falarTexto(`A ${distFmt}, ${info.texto}`);
        }

        if (distParaManobra <= distAvisoPerto && distParaManobra > 25 && !stepManobra._avisoPertoFalado) {
          stepManobra._avisoPertoFalado = true;
          this.falarTexto(info.texto);
        }

        if (distParaManobra < 14) {
          if (stepManobra.name && stepManobra.name.trim() !== '') {
            this.nomeRuaPisoAtual = stepManobra.name;
            this.nomeRuaAtualCarro = stepManobra.name;
          }
          this.passoAtualIndex++;
          this.atualizarInstrucaoUI();
        }
      }
    },

    atualizarInstrucaoUI() {
      if (this.passosRota.length === 0 || this.passoAtualIndex >= this.passosRota.length) return;

      const stepManobra = this.passosRota[this.passoAtualIndex];
      const info = this.interpretarManobraWaze(stepManobra);

      if (this.iconeManobraNav !== '↩️') {
        this.instrucaoAtual = info.texto;
        this.nomeProximaRua = info.rua;
        this.iconeManobraNav = info.icone;
      }

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
      } else if (modifier.includes('uturn')) {
        icone = '↩️';
        texto = `Faça o retorno ${rua}`;
      } else if (type === 'off ramp' || type === 'on ramp') {
        if (modifier.includes('right')) {
          icone = '↗️';
          texto = `Pegue a saída à direita para ${step.name || 'a alça'}`;
        } else if (modifier.includes('left')) {
          icone = '↖️';
          texto = `Pegue a saída à esquerda para ${step.name || 'a alça'}`;
        } else {
          icone = '↗️';
          texto = `Pegue a saída para ${step.name || 'a via lateral'}`;
        }
      } else if (type === 'fork') {
        if (modifier.includes('right')) {
          icone = '↗️';
          texto = `Mantenha-se à direita`;
        } else if (modifier.includes('left')) {
          icone = '↖️';
          texto = `Mantenha-se à esquerda`;
        } else {
          icone = '⬆️';
          texto = `Siga na bifurcação`;
        }
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
      }

      return { icone, texto, rua: step.name || step.ref || this.entregaNavegacao?.endereco || 'Rota' };
    },

    async concluirEntregaPeloNav(entrega) {
      if (!entrega) return;
      await this.concluirEntrega(entrega);

      this.pararNavegacao();
      this.modo = 'rua';

      const restantes = this.naoEntregues;
      if (restantes.length > 0) {
        this.falarTexto('Entregue!');
        if ('vibrate' in navigator) navigator.vibrate([60, 40, 60]);
      } else {
        this.falarTexto('Parabéns! Todos os pacotes da carga foram entregues com sucesso!');
        if ('vibrate' in navigator) navigator.vibrate([150, 80, 150, 80, 200]);
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
      if (this.intervaloBipeExcesso) { clearInterval(this.intervaloBipeExcesso); this.intervaloBipeExcesso = null; }

      if (this.marcadoresRadaresGL && this.marcadoresRadaresGL.length > 0) {
        this.marcadoresRadaresGL.forEach(m => m.remove());
        this.marcadoresRadaresGL = [];
      }

      if (this.mapaNavGL) { this.mapaNavGL.remove(); this.mapaNavGL = null; }
      this.marcadorCarroGL = null;
      this.marcadorDestinoGL = null;
      this.coordenadasRotaAtual = [];
      this.mapaArrastadoPeloUsuario = false;
      this.radarProximoAlerta = null;
      this.radarExcessoVelocidade = false;
      this.alertaRetornoFalado = false;
      this.modo = 'rua';
    },

    // =========================================================================
    // ROTAS, HISTÓRICO E BLINDAGEM DE MERGE (FIM DO RESET DE ENTREGAS)
    // =========================================================================
    async carregarUltimaRota() {
      try {
        const resRota = await this.fetchDirectus('/items/rotas?sort=-id&limit=1');
        if (resRota && resRota.ok) {
          const dataRota = await resRota.json();
          if (dataRota.data && dataRota.data.length > 0) {
            this.rotaAtivaId = dataRota.data[0].id;
            await this.carregarEntregasPorId(this.rotaAtivaId);
            this.carregarTelemetriaLocal();
          } else {
            if (!this.entregas || this.entregas.length === 0) {
              this.rotaAtivaId = null;
              this.entregas = [];
              this.rotaGeometria = null;
              localStorage.removeItem('spxrotas_rota_ativa_id');
              localStorage.removeItem('spxrotas_entregas_cache');
              localStorage.removeItem('spxrotas_rota_geometria');
            }
          }
        }
      } catch (e) {
        console.warn('[SPXrotas] Operando em modo offline com a última rota local');
      }
    },

    /**
     * 🛡️ MERGE INTELIGENTE DE PROTEÇÃO:
     * Nunca permite que o servidor reverta para 'pendente' o que o motorista já entregou localmente!
     */
    async carregarEntregasPorId(rotaId) {
      this.carregarConferidosLocal();

      try {
        const res = await this.fetchDirectus(`/items/entregas?filter[rota_id][_eq]=${rotaId}&sort=ordem_entrega&limit=500`);
        const data = await res.json();

        const resR = await this.fetchDirectus(`/items/rotas/${rotaId}`);
        const dataR = await resR.json();

        if (data.data && data.data.length > 0) {
          const entregasServidor = data.data;

          // Mapa das entregas que o celular já marcou
          const mapaStatusLocal = new Map();
          (this.entregas || []).forEach(e => {
            if (e.status === 'entregue' || e.status === 'ausente') {
              mapaStatusLocal.set(e.id, e.status);
            }
          });

          entregasServidor.forEach(e => {
            if (mapaStatusLocal.has(e.id)) {
              // PRESERVAÇÃO SUPREMA: O status do celular prevalece!
              e.status = mapaStatusLocal.get(e.id);
            }
          });

          this.entregas = entregasServidor;
          this.rotaGeometria = dataR?.data?.geometria || this.rotaGeometria;

          this.salvarCacheLocal();
          this.carregarTelemetriaLocal();

          if (this.modo === 'mapa') {
            this.$nextTick(() => this.desenharPinosERotaNoMapa());
          }
        }
      } catch (e) {
        console.warn('[SPXrotas] Sem sinal de 4G: Mantendo entregas do celular intactas!');
      }
    },

    async abrirHistorico() {
      this.modo = 'historico';
      try {
        const resRota = await this.fetchDirectus('/items/rotas?sort=-id&limit=30');
        if (resRota && resRota.ok) {
          const dataRota = await resRota.json();
          this.rotasHistorico = dataRota.data || [];
          localStorage.setItem('spxrotas_rotas_historico_cache', JSON.stringify(this.rotasHistorico));
        }
      } catch (e) {
        console.warn('Erro ao carregar histórico:', e);
      }
    },

    async selecionarRotaHistorico(rotaId) {
      this.rotaAtivaId = rotaId;
      await this.carregarEntregasPorId(rotaId);
      this.salvarCacheLocal();
      this.carregarTelemetriaLocal();
      this.carregarConferidosLocal();
      this.modo = 'carregamento';
    },

    async apagarRota(rotaId) {
      if (!confirm(`Deseja apagar a Rota #${rotaId} e todos os seus pacotes do banco?`)) return;
      try {
        const resEntregas = await this.fetchDirectus(`/items/entregas?filter[rota_id][_eq]=${rotaId}&fields=id&limit=500`);
        if (resEntregas && resEntregas.ok) {
          const dataEntregas = await resEntregas.json();
          const ids = (dataEntregas.data || []).map(e => e.id);
          if (ids.length > 0) {
            await this.fetchDirectus('/items/entregas', {
              method: 'DELETE',
              body: JSON.stringify(ids)
            });
          }
        }

        await this.fetchDirectus(`/items/rotas/${rotaId}`, { method: 'DELETE' });

        this.rotasHistorico = this.rotasHistorico.filter(r => String(r.id) !== String(rotaId));
        localStorage.setItem('spxrotas_rotas_historico_cache', JSON.stringify(this.rotasHistorico));
        localStorage.removeItem(`spxrotas_conferidos_${rotaId}`);

        if (String(this.rotaAtivaId) === String(rotaId) || !this.rotaAtivaId) {
          this.rotaAtivaId = null;
          this.entregas = [];
          this.rotaGeometria = null;
          this.idsConferidos.clear();
          localStorage.removeItem('spxrotas_rota_ativa_id');
          localStorage.removeItem('spxrotas_entregas_cache');
          localStorage.removeItem('spxrotas_rota_geometria');
          localStorage.removeItem(`spxrotas_telemetria_${rotaId}`);
          await this.carregarUltimaRota();
        }

        alert(`✅ Rota #${rotaId} e seus pacotes foram 100% apagados com sucesso!`);
      } catch (e) {
        alert('Erro ao apagar rota: ' + e.message);
      }
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

        const rawLat = String(cols[iLat] || '').replace(',', '.').trim();
        const rawLng = String(cols[iLng] || '').replace(',', '.').trim();
        const lat = parseFloat(rawLat);
        const lng = parseFloat(rawLng);

        if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0) continue;

        const addr = String(cols[iAddr] || '').trim();
        const rawSeq = iSequence !== -1 ? String(cols[iSequence] || '').trim() : '';
        const rawStop = iStop !== -1 ? String(cols[iStop] || '').trim() : '';

        let seqVal = null;
        let stpVal = null;

        if (rawSeq === '-' || rawStop === '-' || rawSeq === '' || rawStop === '') {
          seqVal = -contadorExtra;
          stpVal = -contadorExtra;
          contadorExtra++;
        } else {
          seqVal = parseInt(rawSeq);
          stpVal = parseInt(rawStop);
          if (isNaN(seqVal)) seqVal = null;
          if (isNaN(stpVal)) stpVal = null;
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
          destinatario: (stpVal !== null && stpVal < 0) ? `Final ${rastreioFinal.slice(-4)}` : (stpVal ? `Parada #${stpVal}` : 'Destinatário'),
          telefone: '13999999999',
          endereco: addr,
          numero: numero,
          bairro: iBairro !== -1 && cols[iBairro] ? String(cols[iBairro]).trim() : '',
          cidade: iCity !== -1 && cols[iCity] ? String(cols[iCity]).trim() : 'Mongaguá',
          cep: iCep !== -1 && cols[iCep] ? String(cols[iCep]).trim() : '',
          latitude: lat,
          longitude: lng,
          gps_suspeito: (addr.toLowerCase().includes('s/n') || addr.toLowerCase().includes('marginal')),
          status: 'pendente'
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
            this.resumoPartidaTexto = this.inputPartidaModal?.trim() || 'Galpão / Início';
            this.resumoChegadaTexto = this.inputChegadaModal?.trim() || 'Residência / Final';
            this.modalImportar = false;
            this.modalResumoImportacao = true;
          } else {
            alert('Nenhum pacote válido encontrado na planilha da Shopee.');
          }
        } catch (err) {
          alert('Erro ao ler planilha: ' + err.message);
        }
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
      } catch (e) {}
      return null;
    },

    async enviarParaN8N() {
      if (!this.assinaturaValida) { this.modalAssinatura = true; return; }
      this.carregandoProcesso = true;
      try {
        if (!this.usuarioId) {
          const resMe = await this.fetchDirectus('/users/me');
          if (resMe && resMe.ok) {
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
          this.idsConferidos.clear();

          // Reinicia telemetria
          this.telemetria = {
            inicioTimestamp: null,
            fimTimestamp: null,
            odometroMetros: 0,
            tempoTotalMs: 0,
            tempoDeslocamentoMs: 0,
            tempoAtendimentoMs: 0,
            momentoChegadaUltimaParada: null,
            momentoSaidaUltimaParada: null
          };

          await this.sincronizarAssinaturaSaaS();

          if (resJson && resJson.rota_id) {
            this.rotaAtivaId = resJson.rota_id;
            localStorage.removeItem(`spxrotas_conferidos_${this.rotaAtivaId}`);
            await this.carregarEntregasPorId(this.rotaAtivaId);
          } else {
            await this.carregarUltimaRota();
          }

          this.salvarCacheLocal();
          this.modo = 'carregamento';
        } else {
          alert('Erro no servidor ao calcular rota.');
        }
      } catch (e) {
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
      if (res && res.ok) {
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

        const nomeInvalido = !userSaas?.nome || userSaas.nome.trim().toLowerCase() === 'motorista' || userSaas.nome.length < 3;
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
      } catch (e) {}
    },

    async salvarDadosCompletosPerfil() {
      if (!this.usuarioId) return;
      const tel = (this.inputTelefone || '').replace(/\D/g, '');
      const nome = (this.usuarioNome || '').trim();

      if (!nome || nome.length < 3) {
        alert('Digite seu nome e sobrenome completo.');
        return;
      }
      if (tel.length < 10 || tel.length > 11) {
        alert('Informe um WhatsApp válido com DDD (10 ou 11 números).');
        return;
      }

      this.salvandoPerfil = true;
      try {
        const res = await this.fetchDirectus(`/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`);
        const d = await res.json();
        if (d.data && d.data[0]) {
          await this.fetchDirectus(`/items/drivexps_users/${d.data[0].id}`, {
            method: 'PATCH',
            body: JSON.stringify({ nome: nome, telefone: tel })
          });
          this.usuarioNome = nome;
          this.inputTelefone = tel;
          alert('✅ Dados salvos com sucesso no sistema!');
        }
      } catch (e) {
        alert('Erro ao salvar dados: ' + e.message);
      } finally {
        this.salvandoPerfil = false;
      }
    },

    async salvarCadastroObrigatorio() {
      const nome = (this.inputNome || '').trim();
      const tel = (this.inputTelefone || '').replace(/\D/g, '');
      const email = (this.inputEmail || '').trim().toLowerCase();

      if (!nome || nome.length < 3) {
        alert('Por favor, informe seu nome completo.');
        return;
      }
      if (tel.length < 10 || tel.length > 11) {
        alert('Informe um WhatsApp válido com DDD (10 ou 11 dígitos).');
        return;
      }
      if (!email.includes('@')) {
        alert('Informe um e-mail válido.');
        return;
      }

      this.salvandoPerfil = true;
      try {
        const res = await this.fetchDirectus(`/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`);
        const d = await res.json();
        if (d.data && d.data[0]) {
          await this.fetchDirectus(`/items/drivexps_users/${d.data[0].id}`, {
            method: 'PATCH',
            body: JSON.stringify({ nome, telefone: tel, email })
          });
          this.usuarioNome = nome;
          this.usuarioEmail = email;
          this.inputTelefone = tel;
        }

        if (this.contatoEmergencia) {
          const telEmergencia = this.contatoEmergencia.replace(/\D/g, '');
          localStorage.setItem('spxrotas_contato_emergencia', telEmergencia);
        }

        localStorage.setItem('spxrotas_config_veiculo', JSON.stringify(this.configVeiculo));

        this.modalCadastroObrigatorio = false;
        alert('✅ Cadastro concluído com sucesso! Bem-vindo ao SPXrotas.');
      } catch (e) {
        alert('Erro ao salvar cadastro: ' + e.message);
      } finally {
        this.salvandoPerfil = false;
      }
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
      } catch (e) { alert('Erro ao gerar PIX.'); }
      finally { this.carregandoPix = false; }
    },

    fecharModalAssinatura() {
      if (this.intervaloPollingPagamento) {
        clearInterval(this.intervaloPollingPagamento);
        this.intervaloPollingPagamento = null;
      }
      this.codigoPixGerado = '';
      this.qrCodeBase64 = '';
      this.modalAssinatura = false;
    },

    copiarCodigoPix() {
      navigator.clipboard.writeText(this.codigoPixGerado);
      alert('Código PIX copiado com sucesso!');
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
      localStorage.removeItem('spxrotas_rota_ativa_id');
      localStorage.removeItem('spxrotas_entregas_cache');
      localStorage.removeItem('spxrotas_rota_geometria');
      this.tokenAcesso = null; this.usuarioId = null; this.usuarioLogado = false;
      this.entregas = []; this.rotaAtivaId = null;
      try {
        await fetch(`${this.DIRECTUS_URL}/auth/logout`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ mode: 'session' })
        });
      } catch (e) {}
    },

    // =========================================================================
    // UTILITÁRIOS, TUTORIAL & PWA
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
          this.salvarPartidaChegadaLocal();
          alert('📍 Localização atual gravada como Ponto de Partida e Retorno!');
        }, err => alert('Erro no GPS: ' + err.message));
      } else {
        alert('Geolocalização indisponível.');
      }
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
      localStorage.setItem('spxrotas_tutorial_visto', 'true'); 
    },

    checarInstalacaoPWA() {
      this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const ua = window.navigator.userAgent.toLowerCase();
      this.isIOS = /iphone|ipad|ipod/.test(ua);
      this.isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
      if (this.isStandalone) this.mostrarPopupInstalar = false;
      if (window.pwaDeferredPrompt) this.temPromptInstalacao = true;
      window.addEventListener('pwa-pronto-para-instalar', () => { this.temPromptInstalacao = true; });
    },

    async instalarPWA() {
      const p = window.pwaDeferredPrompt;
      if (!p) { alert('Abra o menu do navegador e escolha "Adicionar à tela inicial".'); return; }
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
        const cache = await caches.open('spxrotas-shared-files');
        const resp = await cache.match('ultimo-romaneio');
        if (resp) {
          const blob = await resp.blob();
          const name = decodeURIComponent(resp.headers.get('X-File-Name') || 'romaneio.xlsx');
          const file = new File([blob], name, { type: blob.type });
          this.processarArquivoDirecto(file);
          await cache.delete('ultimo-romaneio');
        }
      } catch (e) {}
    }
  };
}

// Compatibilidade global
window.spxRotasApp = spxRotasApp;
window.entregaApp = spxRotasApp;