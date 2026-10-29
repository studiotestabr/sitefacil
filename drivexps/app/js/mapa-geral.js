/* ==========================================================================
   DriveXPS Pro 4.0 - Módulo Mapa Geral (Leaflet 2D)
   Arquivo: /js/mapa-geral.js
   ========================================================================== */

function mapaGeralModule() {
  return {
    mapaLeaflet: null,
    grupoMarcadores: null,
    linhaTrajeto: null,
    rotaGeometria: null,

    /**
     * Alterna para a aba Mapa e garante a renderização correta
     */
    abrirAbaMapa() {
      this.modo = 'mapa';
      setTimeout(() => { 
        this.inicializarOuAtualizarMapa(); 
      }, 150);
    },

    /**
     * Instancia o mapa Leaflet caso não exista e atualiza as dimensões
     */
    inicializarOuAtualizarMapa() {
      const container = document.getElementById('mapaContainer');
      if (!container) return;

      if (!this.mapaLeaflet) {
        this.mapaLeaflet = L.map('mapaContainer', { zoomControl: false }).setView([-15.7801, -47.9292], 4);
        L.control.zoom({ position: 'bottomright' }).addTo(this.mapaLeaflet);
        
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { 
          maxZoom: 19 
        }).addTo(this.mapaLeaflet);
        
        this.grupoMarcadores = L.featureGroup().addTo(this.mapaLeaflet);
      }

      this.mapaLeaflet.invalidateSize();
      this.desenharPinosERotaNoMapa();
    },

    /**
     * Decodificador de coordenadas compactadas (Google Encoded Polyline Algorithm)
     */
    decodePolyline(str, precision = 5) {
      if (!str) return [];
      let index = 0, lat = 0, lng = 0, coordinates = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
      
      while (index < str.length) {
        byte = null; shift = 0; result = 0;
        do { 
          byte = str.charCodeAt(index++) - 63; 
          result |= (byte & 0x1f) << shift; 
          shift += 5; 
        } while (byte >= 0x20);
        
        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        shift = result = 0;
        
        do { 
          byte = str.charCodeAt(index++) - 63; 
          result |= (byte & 0x1f) << shift; 
          shift += 5; 
        } while (byte >= 0x20);
        
        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change; 
        lng += longitude_change;
        
        coordinates.push([lat / factor, lng / factor]);
      }
      return coordinates;
    },

    /**
     * Renderiza no mapa a linha do trajeto OSRM e todos os marcadores da rota ativa
     */
    desenharPinosERotaNoMapa() {
      if (!this.mapaLeaflet || !this.grupoMarcadores) return;
      
      this.grupoMarcadores.clearLayers();
      if (this.linhaTrajeto) { 
        this.mapaLeaflet.removeLayer(this.linhaTrajeto); 
        this.linhaTrajeto = null; 
      }

      const pontosLinha = [];

      // 1. Ponto de Partida (CD / Base)
      if (this.coordPartidaSalva && this.coordPartidaSalva.latitude) {
        const posCD = [this.coordPartidaSalva.latitude, this.coordPartidaSalva.longitude];
        pontosLinha.push(posCD);
        
        const iconeCD = L.divIcon({ 
          className: 'custom-pin-cd', 
          html: `<div style="background-color: #3b82f6; color: #fff; font-size: 15px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 15px rgba(59,130,246,0.8);">🏭</div>`, 
          iconSize: [34, 34], 
          iconAnchor: [17, 17] 
        });
        
        L.marker(posCD, { icon: iconeCD }).bindPopup(`<strong>📍 PONTO DE PARTIDA</strong>`).addTo(this.grupoMarcadores);
      }

      // 2. Marcadores das Entregas (Canetão)
      const entregasOrdenadas = [...this.entregas].sort((a, b) => a.ordem_entrega - b.ordem_entrega);

      entregasOrdenadas.forEach(p => {
        if (!p.latitude || !p.longitude) return;
        const coord = [p.latitude, p.longitude];
        pontosLinha.push(coord);

        let corFundo = '#10b981'; // Verde (Pendente)
        if (p.status === 'entregue') corFundo = '#ef4444'; // Vermelho (Entregue)
        if (p.status === 'ausente') corFundo = '#f59e0b'; // Amarelo (Ausente)

        const iconePacote = L.divIcon({
          className: 'custom-pin-pacote',
          html: `<div style="background-color: ${corFundo}; color: #000; font-weight: 900; font-family: monospace; font-size: 11px; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.6);">#${p.ordem_entrega}</div>`,
          iconSize: [28, 28], 
          iconAnchor: [14, 14]
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

      // 3. Ponto de Chegada (Casa / Retorno)
      if (this.coordChegadaSalva && this.coordChegadaSalva.latitude) {
        const posCasa = [this.coordChegadaSalva.latitude, this.coordChegadaSalva.longitude];
        pontosLinha.push(posCasa);
        
        const iconeCasa = L.divIcon({ 
          className: 'custom-pin-casa', 
          html: `<div style="background-color: #3b82f6; color: #fff; font-size: 15px; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #ffffff; box-shadow: 0 4px 15px rgba(59,130,246,0.8);">🏠</div>`, 
          iconSize: [34, 34], 
          iconAnchor: [17, 17] 
        });
        
        L.marker(posCasa, { icon: iconeCasa }).bindPopup(`<strong>🏠 PONTO DE CHEGADA</strong>`).addTo(this.grupoMarcadores);
      }

      // 4. Desenha a geometria oficial da rota ou linha guia
      if (this.rotaGeometria && this.rotaGeometria.length > 5) {
        const latlngs = this.decodePolyline(this.rotaGeometria);
        this.linhaTrajeto = L.polyline(latlngs, { 
          color: '#38bdf8', 
          weight: 6, 
          opacity: 0.95 
        }).addTo(this.mapaLeaflet);
      } else if (pontosLinha.length > 1) {
        this.linhaTrajeto = L.polyline(pontosLinha, { 
          color: '#38bdf8', 
          weight: 4, 
          opacity: 0.85, 
          dashArray: '6, 8' 
        }).addTo(this.mapaLeaflet);
      }

      this.centralizarMapaNaCarga();
    },

    /**
     * Ajusta o zoom e a centralização para enquadrar todos os pinos na tela
     */
    centralizarMapaNaCarga() {
      if (this.mapaLeaflet && this.grupoMarcadores && this.grupoMarcadores.getLayers().length > 0) {
        this.mapaLeaflet.fitBounds(this.grupoMarcadores.getBounds(), { padding: [40, 40] });
      }
    }
  };
}