/* ==========================================================================
   DriveXPS Pro 4.0 - Módulo Shopee Express, Sacolas e Gerenciamento de Carga
   Arquivo: /js/shopee.js
   ========================================================================== */

function shopeeModule() {
  return {
    nomeArquivo: '',
    msgErro: null,
    carregandoProcesso: false,
    
    pacotesExtraidos: [],
    entregas: [],
    rotasHistorico: [],
    rotaAtivaId: localStorage.getItem('drivexps_rota_ativa_id') || null,
    entregaSelecionadaId: null,

    inputPartidaModal: '',
    inputChegadaModal: '',
    resumoPartidaTexto: '',
    resumoChegadaTexto: '',
    coordPartidaSalva: null,
    coordChegadaSalva: null,

    /**
     * Retorna a lista de pacotes ordenada pelo número sequencial do Canetão
     */
    get entregasOrdenadasParaSacola() {
      return [...this.entregas].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));
    },

    /**
     * Retorna os pacotes ainda pendentes ou ausentes (não entregues)
     */
    get naoEntregues() {
      return this.entregas.filter(e => e.status !== 'entregue');
    },

    /**
     * Retorna o pacote do cockpit da tela "Rua"
     */
    get entregaAtual() {
      if (this.entregaSelecionadaId) {
        const sel = this.entregas.find(e => e.id === this.entregaSelecionadaId);
        if (sel && sel.status !== 'entregue') return sel;
      }
      const primeiroPendente = this.entregas.find(e => e.status === 'pendente');
      if (primeiroPendente) return primeiroPendente;
      
      const primeiroPulado = this.entregas.find(e => e.status === 'ausente');
      if (primeiroPulado) return primeiroPulado;
      
      return null;
    },

    /**
     * Detecta se a entrega atual é na mesma rua que a parada imediatamente anterior
     */
    get ehMesmaRuaQueAnterior() {
      if (!this.entregaAtual) return false;
      const idx = this.entregas.findIndex(e => e.id === this.entregaAtual.id);
      if (idx <= 0) return false;
      const anterior = this.entregas[idx - 1];
      const ruaAtual = (this.entregaAtual.endereco || '').split(',')[0].toLowerCase().trim();
      const ruaAnterior = (anterior.endereco || '').split(',')[0].toLowerCase().trim();
      return ruaAtual === ruaAnterior;
    },

    /**
     * Agrupa pacotes que pertencem à mesma parada / mesmo local físico
     */
    get pacotesMesmoLocal() {
      if (!this.entregaAtual) return [];
      const cur = this.entregaAtual;
      const mesmaRua = (e) => (e.endereco || '').split(',')[0].toLowerCase().trim() === (cur.endereco || '').split(',')[0].toLowerCase().trim();
      
      const lista = this.naoEntregues.filter(e => 
        (e.cidade === cur.cidade && e.parada_shopee && cur.parada_shopee && e.parada_shopee === cur.parada_shopee && mesmaRua(e)) ||
        (e.cidade === cur.cidade && mesmaRua(e) && Math.abs(e.latitude - cur.latitude) < 0.0001 && Math.abs(e.longitude - cur.longitude) < 0.0001)
      );

      if (lista.length > 1 && 'vibrate' in navigator) {
        navigator.vibrate(80);
      }

      return lista;
    },

    /**
     * Conta pacotes pendentes no mesmo bairro da entrega atual
     */
    get entregasNoBairroRestantes() {
      if (!this.entregaAtual || !this.entregaAtual.bairro) return 0;
      const bairroAlvo = this.entregaAtual.bairro.toLowerCase().trim();
      return this.naoEntregues.filter(e => (e.bairro || '').toLowerCase().trim() === bairroAlvo).length;
    },

    /**
     * Filtro da barra de busca global
     */
    get entregasFiltradas() {
      if (!this.termoBusca || this.termoBusca.trim() === '') return [];
      const t = this.termoBusca.toLowerCase().trim();
      return this.entregas.filter(e => 
        (e.endereco && e.endereco.toLowerCase().includes(t)) ||
        (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(t)) ||
        (e.bairro && e.bairro.toLowerCase().includes(t)) ||
        (e.ordem_entrega && String(e.ordem_entrega) === t) ||
        (e.parada_shopee && String(e.parada_shopee) === t)
      );
    },

    formatarParada(val) {
      if (val === null || val === undefined || val === '' || Number(val) < 0) return '-';
      return val;
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

    salvarCacheLocal() {
      if (this.rotaAtivaId) {
        localStorage.setItem('drivexps_rota_ativa_id', this.rotaAtivaId);
      }
      if (this.entregas && this.entregas.length > 0) {
        localStorage.setItem('drivexps_entregas_cache', JSON.stringify(this.entregas));
      }
      if (this.rotaGeometria) {
        localStorage.setItem('drivexps_rota_geometria', this.rotaGeometria);
      }
    },

    /**
     * Parser oficial do layout da planilha de motorista da Shopee Express
     */
    parseLinhasShopee(linhasMatriz) {
      this.msgErro = null;
      if (!linhasMatriz || linhasMatriz.length < 2) { 
        this.msgErro = 'Planilha com poucas linhas.'; 
        return []; 
      }

      let idxCabecalho = -1;
      for (let i = 0; i < Math.min(linhasMatriz.length, 10); i++) {
        const rowStr = (linhasMatriz[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('latitude') || rowStr.includes('spx tn') || rowStr.includes('destination address') || rowStr.includes('rastreamento') || rowStr.includes('tracking')) { 
          idxCabecalho = i; 
          break; 
        }
      }

      if (idxCabecalho === -1) { 
        this.msgErro = 'Colunas oficiais da Shopee não foram encontradas na planilha.'; 
        return []; 
      }

      const cabecalho = linhasMatriz[idxCabecalho].map(c => String(c || '').trim().toLowerCase());
      const acharIdx = (termos) => cabecalho.findIndex(h => termos.some(t => h === t || h.includes(t)));

      const iSequence = acharIdx(['sequence', 'ordem', 'seq', 'ordem entrega', 'ordem de parada']);
      const iStop = acharIdx(['stop', 'parada', 'stop sequence', 'n parada']);
      let iTN = acharIdx(['spx tn', 'tracking', 'rastreio', 'tracking number', 'número de rastreamento', 'numero de rastreamento', 'código de rastreio', 'codigo de rastreio']);
      if (iTN === -1 && cabecalho.length > 3) iTN = 3;

      const iAddr = acharIdx(['destination address', 'endereço', 'endereco', 'address', 'logradouro', 'rua']);
      const iBairro = acharIdx(['bairro', 'neighborhood', 'distrito']);
      const iCity = acharIdx(['city', 'cidade', 'município', 'municipio']);
      const iCep = acharIdx(['zipcode/postal code', 'zipcode', 'postal', 'cep', 'código postal', 'codigo postal']);
      const iLat = acharIdx(['latitude', 'lat']);
      const iLng = acharIdx(['longitude', 'lng', 'long']);

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
          telefone: '',
          endereco: addr,
          numero: numero,
          bairro: iBairro !== -1 && cols[iBairro] ? String(cols[iBairro]).trim() : '',
          cidade: iCity !== -1 && cols[iCity] ? String(cols[iCity]).trim() : '',
          cep: iCep !== -1 && cols[iCep] ? String(cols[iCep]).trim() : '',
          latitude: lat,
          longitude: lng,
          gps_suspeito: this.isGpsSuspeito(addr)
        });
      }

      // Calcula a contagem exata de pacotes por parada
      const contagemParadas = {};
      for (const item of lista) {
        if (item.parada_shopee) {
          const chave = `${item.cidade}_${item.endereco.split(',')[0].toLowerCase().trim()}_${item.parada_shopee}`;
          contagemParadas[chave] = (contagemParadas[chave] || 0) + 1;
        }
      }
      for (const item of lista) {
        if (item.parada_shopee) {
          const chave = `${item.cidade}_${item.endereco.split(',')[0].toLowerCase().trim()}_${item.parada_shopee}`;
          item.total_no_local = contagemParadas[chave] || 1;
        } else {
          item.total_no_local = 1;
        }
      }

      return lista;
    },

    processarArquivoDirecto(file) {
      this.nomeArquivo = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          let entregasAparecidas = [];

          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            const res = this.parseLinhasShopee(matriz);
            if (res.length > 0) { 
              entregasAparecidas = res; 
              break; 
            }
          }

          this.pacotesExtraidos = entregasAparecidas;
          if (this.pacotesExtraidos.length > 0) {
            this.resumoPartidaTexto = (this.inputPartidaModal && this.inputPartidaModal.trim() !== '') ? this.inputPartidaModal.trim() : 'Localização do 1º Pacote (GPS)';
            this.resumoChegadaTexto = (this.inputChegadaModal && this.inputChegadaModal.trim() !== '') ? this.inputChegadaModal.trim() : 'Retorno ao Ponto Inicial';
            
            this.modalImportar = false;
            this.modalResumoImportacao = true;
          } else if (!this.msgErro) {
            this.msgErro = 'Nenhum pacote válido encontrado no arquivo selecionado.';
          }
        } catch (err) { 
          this.msgErro = 'Erro ao processar planilha: ' + err.message; 
        }
      };
      reader.readAsArrayBuffer(file);
    },

    processarArquivoExcel(event) {
      const file = event.target.files[0];
      if (file) this.processarArquivoDirecto(file);
    },

    async converterTextoParaCoord(texto) {
      if (!texto || texto.trim().length < 3) return null;
      const partes = texto.split(',');
      if (partes.length === 2 && !isNaN(parseFloat(partes[0])) && !isNaN(parseFloat(partes[1]))) {
        return { latitude: parseFloat(partes[0]), longitude: parseFloat(partes[1]) };
      }

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texto)}&addressdetails=1&limit=1&countrycodes=br`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
        const data = await res.json();
        if (data && data.length > 0) {
          return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
        }
      } catch (e) {}
      return null;
    },

    /**
     * Envia os pacotes e coordenadas ao n8n para otimização com VROOM + OSRM
     */
    async enviarParaN8N() {
      if (!this.assinaturaValida) { 
        this.modalAssinatura = true; 
        return; 
      }
      this.carregandoProcesso = true;

      try {
        if (!this.usuarioId) {
          const u = await fetch(`${this.DIRECTUS_URL}/users/me`, { credentials: 'include' });
          const ud = await u.json();
          if (ud?.data?.id) {
            this.usuarioId = ud.data.id;
            localStorage.setItem('directus_user_id', this.usuarioId);
          }
        }

        let coordPartida = await this.converterTextoParaCoord(this.inputPartidaModal);
        let coordChegada = null;
        const pStr = this.inputPartidaModal.trim();
        const cStr = this.inputChegadaModal.trim();

        if (pStr) coordPartida = await this.converterTextoParaCoord(pStr);
        if (cStr) {
          if (cStr.toLowerCase() === pStr.toLowerCase()) {
            coordChegada = coordPartida;
          } else {
            coordChegada = await this.converterTextoParaCoord(cStr);
          }
        }

        this.coordPartidaSalva = coordPartida;
        this.coordChegadaSalva = coordChegada;

        const payload = {
          entregas: this.pacotesExtraidos,
          user_id: this.usuarioId,
          cd_lat: coordPartida ? coordPartida.latitude : (this.pacotesExtraidos[0]?.latitude || -15.7801),
          cd_lng: coordPartida ? coordPartida.longitude : (this.pacotesExtraidos[0]?.longitude || -47.9292),
          casa_lat: coordChegada ? coordChegada.latitude : (coordPartida ? coordPartida.latitude : -15.7801),
          casa_lng: coordChegada ? coordChegada.longitude : (coordPartida ? coordPartida.longitude : -47.9292)
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
      } catch (e) { 
        alert('Falha na comunicação: ' + e.message); 
      } finally { 
        this.carregandoProcesso = false; 
      }
    },

    async carregarUltimaRota() {
      try {
        const headers = {};
        if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
        const resRota = await fetch(`${this.DIRECTUS_URL}/items/rotas?sort=-id&limit=1`, { headers, credentials: 'include' });
        const dataRota = await resRota.json();

        if (dataRota.data && dataRota.data.length > 0) {
          this.rotaAtivaId = dataRota.data[0].id;
          await this.carregarEntregasPorId(this.rotaAtivaId);
        } else if (!this.rotaAtivaId) {
          this.entregas = []; 
          this.rotaAtivaId = null;
        }
      } catch (e) {}
    },

    async carregarEntregasPorId(rotaId) {
      try {
        const headers = {};
        if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
        const res = await fetch(`${this.DIRECTUS_URL}/items/entregas?filter[rota_id][_eq]=${rotaId}&sort=ordem_entrega&limit=300`, { headers, credentials: 'include' });
        const data = await res.json();
        
        const resR = await fetch(`${this.DIRECTUS_URL}/items/rotas/${rotaId}`, { headers, credentials: 'include' });
        const dataR = await resR.json();

        if (data.data && data.data.length > 0) {
          this.entregas = data.data;
          this.rotaGeometria = dataR?.data?.geometria || null;
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
        const headers = {};
        if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
        const resRota = await fetch(`${this.DIRECTUS_URL}/items/rotas?sort=-id&limit=30`, { headers, credentials: 'include' });
        const dataRota = await resRota.json();
        this.rotasHistorico = dataRota.data || [];
      } catch (e) {}
    },

    async selecionarRotaHistorico(rotaId) {
      this.rotaAtivaId = rotaId;
      await this.carregarEntregasPorId(rotaId);
      this.salvarCacheLocal();
      this.modo = 'carregamento';
    },

    async apagarRota(rotaId) {
      if (!confirm(`Deseja realmente apagar a Rota #${rotaId} e todos os seus pacotes do banco de dados? Esta ação não pode ser desfeita.`)) return;
      
      try {
        const headers = {};
        if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;
        const res = await fetch(`${this.DIRECTUS_URL}/items/rotas/${rotaId}`, { method: 'DELETE', headers, credentials: 'include' });
        
        if (res.ok || res.status === 204) {
          this.rotasHistorico = this.rotasHistorico.filter(r => r.id !== rotaId);
          if (this.rotaAtivaId === rotaId) {
            this.rotaAtivaId = null; 
            this.entregas = [];
            localStorage.removeItem('drivexps_rota_ativa_id'); 
            localStorage.removeItem('drivexps_entregas_cache');
            await this.carregarUltimaRota();
          }
          alert(`Rota #${rotaId} apagada com sucesso!`);
        } else { 
          alert('Erro ao apagar rota no servidor.'); 
        }
      } catch (e) { 
        alert('Falha na comunicação: ' + e.message); 
      }
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
            await this.atualizarStatus(p.id, 'entregue'); 
          }
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
        if (this.modo === 'mapa') {
          this.desenharPinosERotaNoMapa();
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;

      try {
        await fetch(`${this.DIRECTUS_URL}/items/entregas/${id}`, {
          method: 'PATCH', 
          headers, 
          credentials: 'include', 
          body: JSON.stringify({ status: novoStatus })
        });
      } catch (e) {}
    }
  };
}