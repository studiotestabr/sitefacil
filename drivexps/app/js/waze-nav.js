/* ==========================================================================
   DriveXPS Pro 4.0 - Motor de Navegação Nativa 3D Estilo Waze (MapLibre GL)
   Arquivo: /js/waze-nav.js
   ========================================================================== */

function wazeNavModule() {
  return {
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
    minSpeedKmhNav: 4.0,
    bearingSmoothFactor: 0.65,
    ultimaLatCarro: null,
    ultimaLngCarro: null,
    mapaArrastadoPeloUsuario: false,

    vozHabilitada: true,
    ultimaInstrucaoFalada: '',
    chegadaAnunciada: false,
    coordenadasRotaAtual: [],

    recalculandoRota: false,
    contadorForaDaRota: 0,
    ultimoRecalculoTimestamp: 0,

    /**
     * Sintetizador de voz nativo do dispositivo
     */
    falarTexto(texto) {
      if (!this.vozHabilitada || !('speechSynthesis' in window)) return;
      const synth = window.speechSynthesis;
      if (synth.speaking) synth.cancel();
      
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05; 
      utterance.pitch = 1.0;
      synth.speak(utterance);
    },

    alternarVoz() {
      this.vozHabilitada = !this.vozHabilitada;
      if (this.vozHabilitada) {
        this.falarTexto('Avisos de voz ativados.');
      } else {
        window.speechSynthesis.cancel();
      }
    },

    /**
     * Inicia a navegação cockpit 3D para um pacote específico
     */
    async iniciarNavegacaoNativa(entrega) {
      if (!navigator.geolocation) {
        alert('GPS não suportado no aparelho.'); 
        return;
      }
      this.entregaNavegacao = entrega;
      this.modo = 'navegacao';
      this.nomeProximaRua = entrega ? entrega.endereco : 'Destino';
      this.instrucaoAtual = `Iniciando rota para o Canetão #${entrega?.ordem_entrega}...`;
      this.distanciaProximaManobra = '...';
      this.nomeRuaAtualCarro = 'Localizando via...';
      this.subInstrucaoEmSeguida = `Canetão #${entrega?.ordem_entrega}`;
      this.iconeManobraNav = '⬆️';
      this.chegadaAnunciada = false;
      this.velocidadeGPS = 0;
      this.mapaArrastadoPeloUsuario = false;
      this.coordenadasRotaAtual = [];
      this.contadorForaDaRota = 0;
      this.recalculandoRota = false;

      this.falarTexto(`Iniciando rota para Canetão número ${entrega.ordem_entrega}, na ${entrega.endereco}`);

      setTimeout(() => { 
        this.inicializarMapaNavGL(entrega); 
      }, 250);
    },

    inicializarMapaNavGL(entrega) {
      const container = document.getElementById('mapaNavGL');
      if (!container) return;

      if (this.mapaNavGL) {
        this.mapaNavGL.remove();
        this.mapaNavGL = null;
      }

      this.mapaNavGL = new maplibregl.Map({
        container: 'mapaNavGL',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [entrega.longitude, entrega.latitude],
        zoom: 18.5,
        pitch: 62,
        bearing: 0,
        attributionControl: false
      });

      // Detecta arrasto intencional do usuário para pausar centralização automática
      this.mapaNavGL.on('dragstart', (e) => {
        if (e.originalEvent) {
          this.mapaArrastadoPeloUsuario = true;
        }
      });

      this.mapaNavGL.on('load', () => {
        if (!this.mapaNavGL.getSource('rota-source')) {
          this.mapaNavGL.addSource('rota-source', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
          });
          this.mapaNavGL.addLayer({
            id: 'rota-borda',
            type: 'line',
            source: 'rota-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0369a1', 'line-width': 15, 'line-opacity': 0.95 }
          });
          this.mapaNavGL.addLayer({
            id: 'rota-linha',
            type: 'line',
            source: 'rota-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#38bdf8', 'line-width': 9, 'line-opacity': 1.0 }
          });
        }
        this.iniciarGPSContinuoNavegacao(entrega);
      });
    },

    iniciarGPSContinuoNavegacao(entrega) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        let sLat = pos.coords.latitude;
        let sLng = pos.coords.longitude;

        const pontoRua = await this.travarCoordenadaNaRua(sLat, sLng);
        sLat = pontoRua.lat;
        sLng = pontoRua.lng;

        this.ultimaLatCarro = sLat;
        this.ultimaLngCarro = sLng;

        this.atualizarMarcadorCarroGL(sLat, sLng, 0);

        const bearingInicial = this.calcularBearing(sLat, sLng, entrega.latitude, entrega.longitude);
        this.headingAtual = bearingInicial;
        this.centralizarNoCarroGL(sLat, sLng, bearingInicial);

        await this.calcularRotaRuaARua(sLat, sLng, entrega.latitude, entrega.longitude);

        this.watchPositionId = navigator.geolocation.watchPosition(
          (novaPos) => this.processarPosicaoGPS(novaPos, entrega.latitude, entrega.longitude),
          (err) => console.warn('Aviso GPS (Watch):', err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      }, (err) => {
        alert('Não foi possível obter o sinal de GPS.');
        this.pararNavegacao();
      }, { enableHighAccuracy: true });
    },

    /**
     * Snap-to-road: Trava a coordenada GPS na via mais próxima
     */
    async travarCoordenadaNaRua(lat, lng) {
      try {
        const url = `${this.OSRM_ROUTER_URL}/nearest/v1/driving/${lng},${lat}?number=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const data = await res.json();
          if (data.waypoints && data.waypoints.length > 0) {
            return {
              lat: data.waypoints[0].location[1],
              lng: data.waypoints[0].location[0],
              nomeRua: data.waypoints[0].name || ''
            };
          }
        }
      } catch (e) {}
      return { lat, lng, nomeRua: '' };
    },

    atualizarLinhaNavGL(coordsLngLat) {
      if (!this.mapaNavGL) return;
      const src = this.mapaNavGL.getSource('rota-source');
      if (src) {
        src.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coordsLngLat }
        });
      } else {
        this.mapaNavGL.addSource('rota-source', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coordsLngLat } }
        });
        this.mapaNavGL.addLayer({
          id: 'rota-borda',
          type: 'line',
          source: 'rota-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#0369a1', 'line-width': 15, 'line-opacity': 0.95 }
        });
        this.mapaNavGL.addLayer({
          id: 'rota-linha',
          type: 'line',
          source: 'rota-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#38bdf8', 'line-width': 9, 'line-opacity': 1.0 }
        });
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
          if (dataLocal.routes && dataLocal.routes.length > 0) {
            routeEncontrada = dataLocal.routes[0];
          }
        }
      } catch (e) {}

      // Fallback OSRM público caso o túnel local oscile
      if (!routeEncontrada) {
        try {
          const urlPub = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson&steps=true`;
          const resPub = await fetch(urlPub, { signal: AbortSignal.timeout(4000) });
          if (resPub.ok) {
            const dataPub = await resPub.json();
            if (dataPub.routes && dataPub.routes.length > 0) {
              routeEncontrada = dataPub.routes[0];
            }
          }
        } catch (e) {}
      }

      if (routeEncontrada && routeEncontrada.geometry) {
        if (typeof routeEncontrada.geometry === 'object' && Array.isArray(routeEncontrada.geometry.coordinates)) {
          coordsLngLat = routeEncontrada.geometry.coordinates.map(c => [Number(c[0]), Number(c[1])]);
        } else if (typeof routeEncontrada.geometry === 'string') {
          const pts = this.decodePolyline(routeEncontrada.geometry);
          coordsLngLat = pts.map(p => [p[1], p[0]]);
        }
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

      if (coordsLngLat.length > 1 && this.velocidadeGPS < this.minSpeedKmhNav) {
        const bearingVia = this.calcularBearing(coordsLngLat[0][1], coordsLngLat[0][0], coordsLngLat[1][1], coordsLngLat[1][0]);
        this.headingAtual = bearingVia;
        if (!this.mapaArrastadoPeloUsuario) {
          this.centralizarNoCarroGL(sLat, sLng, bearingVia);
        }
      }
    },

    atualizarMarcadorDestinoGL(lat, lng) {
      if (!this.mapaNavGL || !lat || !lng) return;
      const numeroCanetao = this.entregaNavegacao ? this.entregaNavegacao.ordem_entrega : '';
      
      let corFundo = '#10b981';
      if (this.entregaNavegacao?.status === 'entregue') corFundo = '#ef4444';
      if (this.entregaNavegacao?.status === 'ausente') corFundo = '#f59e0b';

      if (this.marcadorDestinoGL) {
        this.marcadorDestinoGL.setLngLat([lng, lat]);
        const elPin = document.getElementById('pinDestinoNav');
        if (elPin) {
          elPin.style.backgroundColor = corFundo;
          elPin.innerText = `#${numeroCanetao}`;
        }
        return;
      }

      const el = document.createElement('div');
      el.innerHTML = `
        <div id="pinDestinoNav" style="background-color: ${corFundo}; color: #000; font-weight: 900; font-family: monospace; font-size: 13px; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.85); cursor: pointer;">
          #${numeroCanetao}
        </div>
      `;

      this.marcadorDestinoGL = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(this.mapaNavGL);
    },

    atualizarMarcadorCarroGL(lat, lng, heading) {
      if (!this.mapaNavGL) return;

      if (!this.marcadorCarroGL) {
        const el = document.createElement('div');
        el.className = 'fiorino-container';
        el.innerHTML = `
          <div class="fiorino-aura"></div>
          <div class="fiorino-svg-wrapper">
            <svg width="28" height="50" viewBox="0 0 40 70" xmlns="http://www.w3.org/2000/svg">
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

        this.marcadorCarroGL = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(this.mapaNavGL);
      } else {
        this.marcadorCarroGL.setLngLat([lng, lat]);
        const p = document.getElementById('placaRuaCarro');
        if (p) p.innerText = this.nomeRuaAtualCarro || 'Sua Posição';
      }
    },

    centralizarNoCarroGL(lat, lng, bearing) {
      if (!this.mapaNavGL) return;
      this.mapaNavGL.easeTo({
        center: [lng, lat],
        bearing: (bearing !== undefined && bearing !== null) ? bearing : this.headingAtual,
        pitch: 62,
        zoom: 18.5,
        duration: 500,
        easing: (t) => t
      });
    },

    centralizarCarroManual() {
      this.mapaArrastadoPeloUsuario = false;
      if (this.ultimaLatCarro && this.ultimaLngCarro) {
        this.centralizarNoCarroGL(this.ultimaLatCarro, this.ultimaLngCarro, this.headingAtual);
      }
    },

    verificarSeSaiuDaRota(cLat, cLng) {
      if (!this.coordenadasRotaAtual || this.coordenadasRotaAtual.length < 2) return false;
      let menorDist = Infinity;
      for (let i = 0; i < this.coordenadasRotaAtual.length; i++) {
        const pt = this.coordenadasRotaAtual[i];
        const d = this.calcularDistancia(cLat, cLng, pt[1], pt[0]);
        if (d < menorDist) menorDist = d;
        if (menorDist < 20) return false;
      }
      return menorDist > 65;
    },

    async processarPosicaoGPS(pos, destLat, destLng) {
      let lat = pos.coords.latitude;
      let lng = pos.coords.longitude;
      const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
      this.velocidadeGPS = speedKmh;

      const pontoRua = await this.travarCoordenadaNaRua(lat, lng);
      lat = pontoRua.lat;
      lng = pontoRua.lng;
      if (pontoRua.nomeRua) this.nomeRuaAtualCarro = pontoRua.nomeRua;

      let distanciaDesdeUltimo = 0;
      if (this.ultimaLatCarro && this.ultimaLngCarro) {
        distanciaDesdeUltimo = this.calcularDistancia(this.ultimaLatCarro, this.ultimaLngCarro, lat, lng);
      }

      let headingCalculado = pos.coords.heading;
      if (headingCalculado === null || isNaN(headingCalculado)) {
        if (distanciaDesdeUltimo > 2) {
          headingCalculado = this.calcularBearing(this.ultimaLatCarro, this.ultimaLngCarro, lat, lng);
        }
      }

      if (headingCalculado !== null && !isNaN(headingCalculado) && this.velocidadeGPS >= this.minSpeedKmhNav) {
        this.headingAtual = this.smoothHeadingApp(this.headingAtual, headingCalculado, this.bearingSmoothFactor);
      } 

      this.atualizarMarcadorCarroGL(lat, lng, 0);

      if (!this.mapaArrastadoPeloUsuario) {
        this.centralizarNoCarroGL(lat, lng, this.headingAtual);
      }

      this.ultimaLatCarro = lat;
      this.ultimaLngCarro = lng;

      const distDestinoFinal = this.calcularDistancia(lat, lng, destLat, destLng);
      this.distanciaProximaManobra = distDestinoFinal > 1000 ? (distDestinoFinal / 1000).toFixed(1) + ' km' : Math.round(distDestinoFinal) + ' m';

      if (distDestinoFinal <= 25 && !this.chegadaAnunciada) {
        this.chegadaAnunciada = true;
        this.falarTexto(`Você chegou ao destino! Canetão número ${this.entregaNavegacao?.ordem_entrega || ''}, na ${this.entregaNavegacao?.endereco || ''}`);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 100]);
      }

      // Lógica de recálculo com filtro de estabilidade
      const agora = Date.now();
      const fora = this.verificarSeSaiuDaRota(lat, lng);
      if (fora) {
        this.contadorForaDaRota++;
      } else {
        this.contadorForaDaRota = 0;
      }

      if (this.contadorForaDaRota >= 3 && !this.recalculandoRota && (agora - this.ultimoRecalculoTimestamp > 8000)) {
        this.recalculandoRota = true;
        this.ultimoRecalculoTimestamp = agora;
        this.contadorForaDaRota = 0;
        this.falarTexto('Recalculando rota...');
        await this.calcularRotaRuaARua(lat, lng, destLat, destLng);
        this.recalculandoRota = false;
        return;
      }

      // Anúncio antecipado das instruções de manobra
      if (this.passosRota.length > 0 && this.passoAtualIndex < this.passosRota.length) {
        const stepAtual = this.passosRota[this.passoAtualIndex];
        const manobraLat = stepAtual.maneuver.location[1];
        const manobraLng = stepAtual.maneuver.location[0];
        const distParaManobra = this.calcularDistancia(lat, lng, manobraLat, manobraLng);

        if (distParaManobra < 55 && !stepAtual._anunciado) {
          stepAtual._anunciado = true;
          const info = this.interpretarManobraWaze(stepAtual);
          this.falarTexto(`A 50 metros, ${info.texto}`);
        }

        if (distParaManobra < 18) { 
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
        const nextStep = this.passosRota[this.passoAtualIndex + 1];
        const nextInfo = this.interpretarManobraWaze(nextStep);
        this.subInstrucaoEmSeguida = `${nextInfo.icone} ${nextInfo.texto}`;
      } else {
        this.subInstrucaoEmSeguida = '🏁 Destino final à frente';
      }
    },

    interpretarManobraWaze(step) {
      const type = step.maneuver.type;
      const modifier = step.maneuver.modifier || '';
      const rua = step.name || 'sua rota';

      let icone = '⬆️';
      let texto = `Siga na ${rua}`;

      if (type === 'depart') {
        icone = '⬆️';
        texto = `Siga em frente na ${rua}`;
      } else if (type === 'arrive') {
        icone = '🏁';
        texto = `Destino à frente`;
      } else if (type === 'turn') {
        if (modifier.includes('right')) {
          icone = modifier.includes('slight') ? '↗️' : '⤴️';
          texto = `Vire à direita na ${rua}`;
        } else if (modifier.includes('left')) {
          icone = modifier.includes('slight') ? '↖️' : '⤵️';
          texto = `Vire à esquerda na ${rua}`;
        } else {
          icone = '⬆️';
          texto = `Continue na ${rua}`;
        }
      } else if (type === 'roundabout') {
        icone = '🔄';
        texto = `Na rotatória, pegue a saída para ${rua}`;
      } else if (type === 'end of road') {
        icone = modifier.includes('right') ? '⤴️' : '⤵️';
        texto = `No fim da rua, vire na ${rua}`;
      }

      return { icone, texto, rua };
    },

    /**
     * Marca como entregue direto no painel inferior e recalcula rota para a próxima parada
     */
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
      const b = Math.atan2(y, x) * 180 / Math.PI;
      return (b + 360) % 360;
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
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (this.mapaNavGL) {
        this.mapaNavGL.remove();
        this.mapaNavGL = null;
      }
      this.marcadorCarroGL = null;
      this.marcadorDestinoGL = null;
      this.coordenadasRotaAtual = [];
      this.mapaArrastadoPeloUsuario = false;
      this.modo = 'rua'; 
    }
  };
}