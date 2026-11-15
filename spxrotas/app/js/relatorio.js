/* ==========================================================================
   SPXrotas Pro v1.5.0 - Módulo de Telemetria Real, Custos e Relatório PDF
   Cálculo Fiel de KM Percorrido (GPS + Fallback Geometria Viária), Tempo em Trânsito,
   Tempo de Atendimento, Gastos & Impressão Completa Sem Limite de 50 Pacotes
   Arquivo: /spxrotas/app/js/relatorio.js
   ========================================================================== */

(function (window) {
  'use strict';

  const Relatorio = {
    /**
     * Formata segundos em formato legível (Xh Ymin Zs)
     */
    formatarTempo(segundosTotal) {
      if (!segundosTotal || segundosTotal <= 0 || isNaN(segundosTotal)) return '0min';
      const h = Math.floor(segundosTotal / 3600);
      const m = Math.floor((segundosTotal % 3600) / 60);
      const s = Math.floor(segundosTotal % 60);

      if (h > 0) {
        return `${h}h ${m < 10 ? '0' : ''}${m}min`;
      }
      if (m > 0) {
        return `${m}min ${s < 10 ? '0' : ''}${s}s`;
      }
      return `${s}s`;
    },

    /**
     * Calcula distância em metros entre duas coordenadas (Haversine)
     */
    calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const p1 = lat1 * Math.PI / 180;
      const p2 = lat2 * Math.PI / 180;
      const dp = (lat2 - lat1) * Math.PI / 180;
      const dl = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
                Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    /**
     * Decodifica polilinha VROOM/OSRM para calcular KM viário real quando o hodômetro estiver zerado
     */
    decodePolyline(str, precision = 5) {
      if (!str || typeof str !== 'string') return [];
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

    /**
     * Calcula a distância em KM a partir da geometria viária salva na rota ou das paradas ordenadas
     */
    calcularKmFallbackDaRota(rota, ordenadas) {
      if (rota?.geometria && rota.geometria.length > 10) {
        try {
          const pts = this.decodePolyline(rota.geometria);
          if (pts && pts.length >= 2) {
            let metros = 0;
            for (let i = 0; i < pts.length - 1; i++) {
              metros += this.calcularDistanciaMetros(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
            }
            if (metros > 0) {
              return Math.round((metros / 1000) * 10) / 10;
            }
          }
        } catch (e) {}
      }

      if (ordenadas && ordenadas.length >= 2) {
        let metrosParadas = 0;
        for (let i = 0; i < ordenadas.length - 1; i++) {
          const a = ordenadas[i];
          const b = ordenadas[i + 1];
          if (a.latitude && a.longitude && b.latitude && b.longitude) {
            metrosParadas += this.calcularDistanciaMetros(Number(a.latitude), Number(a.longitude), Number(b.latitude), Number(b.longitude));
          }
        }
        if (metrosParadas > 0) {
          return Math.round(((metrosParadas * 1.25) / 1000) * 10) / 10;
        }
      }

      return 0;
    },

    /**
     * Compila os dados reais medidos pelo hodômetro do GPS, cronômetros e geometria da rota
     */
    compilarDados(rota, entregas, configVeiculo = {}, telemetriaAoVivo = null) {
      const ordenadas = [...(entregas || [])].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));
      const totalPacotes = ordenadas.length;

      // Status das entregas
      const entregues = ordenadas.filter(p => p.status === 'entregue');
      const ausentes = ordenadas.filter(p => p.status === 'ausente');
      const pendentes = ordenadas.filter(p => p.status === 'pendente' || p.status === 'conferido' || !p.status);
      const avulsos = ordenadas.filter(p => !p.parada_shopee || Number(p.parada_shopee) <= 0 || p.parada_shopee === '-');

      // Agrupamento por Imóvel Físico
      const chavesParadas = new Set();
      ordenadas.forEach(p => {
        const rua = (p.endereco || '').split(',')[0].toLowerCase().trim();
        const num = (p.numero || '').toLowerCase().trim();
        chavesParadas.add(`${rua}_${num}_${p.cidade}`);
      });
      const totalParadasUnicas = chavesParadas.size || totalPacotes;

      // 1. RESGATE INTELIGENTE DA TELEMETRIA (NÃO SOBRESCREVE ROTA DO HISTÓRICO COM CACHE ZERADO)
      let telemetriaLocal = null;
      if (rota?.id) {
        try {
          telemetriaLocal = JSON.parse(localStorage.getItem(`spxrotas_telemetria_${rota.id}`) || 'null');
        } catch (e) {}
      }

      const aoVivoValida = (telemetriaAoVivo && (telemetriaAoVivo.inicioTimestamp || telemetriaAoVivo.odometroMetros > 0 || telemetriaAoVivo.tempoTotalMs > 0))
        ? telemetriaAoVivo
        : null;

      let telemetriaBanco = rota?.telemetria || null;
      if (typeof telemetriaBanco === 'string') {
        try { telemetriaBanco = JSON.parse(telemetriaBanco); } catch (e) { telemetriaBanco = null; }
      }

      const telemetria = aoVivoValida || telemetriaLocal || telemetriaBanco || {};

      // Resgata timestamps reais das entregas caso existam
      const timestampsEntregas = ordenadas
        .map(p => p.entregue_em ? new Date(p.entregue_em).getTime() : null)
        .filter(t => t && !isNaN(t))
        .sort((a, b) => a - b);

      let kmRealPercorrido = 0;
      let origemKm = 'GPS';
      let segundosTempoTotal = 0;
      let segundosDeslocamento = 0;
      let segundosAtendimento = 0;
      const rotaConcluida = pendentes.length === 0 && totalPacotes > 0;
      let dataHoraInicio = null;
      let dataHoraFim = null;

      if (telemetria.odometroMetros && telemetria.odometroMetros > 0) {
        kmRealPercorrido = Math.round((telemetria.odometroMetros / 1000) * 10) / 10;
        origemKm = 'GPS';
      } else if (rota?.km_real && Number(rota.km_real) > 0) {
        kmRealPercorrido = Number(rota.km_real);
        origemKm = 'GPS';
      } else {
        kmRealPercorrido = this.calcularKmFallbackDaRota(rota, ordenadas);
        origemKm = 'Rota Viária';
      }

      // Cálculo de Horários & Tempo (Independente do odômetro estar > 0)
      const inicioTs = telemetria.inicioTimestamp || (timestampsEntregas.length > 0 ? timestampsEntregas[0] : null);
      const fimTs = telemetria.fimTimestamp || (timestampsEntregas.length > 0 ? timestampsEntregas[timestampsEntregas.length - 1] : null);

      if (inicioTs) {
        dataHoraInicio = new Date(inicioTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
      if (fimTs) {
        dataHoraFim = new Date(fimTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }

      if (telemetria.tempoTotalMs && telemetria.tempoTotalMs > 0) {
        segundosTempoTotal = Math.round(telemetria.tempoTotalMs / 1000);
      } else if (inicioTs && fimTs && fimTs > inicioTs) {
        segundosTempoTotal = Math.round((fimTs - inicioTs) / 1000);
      } else if (rota?.tempo_total_segundos) {
        segundosTempoTotal = Number(rota.tempo_total_segundos) || 0;
      }

      // Soma tempo de atendimento nas portas
      const somaAtendimentoPacotes = ordenadas.reduce((acc, p) => acc + (Number(p.tempo_atendimento_seg) || 0), 0);
      if (telemetria.tempoAtendimentoMs && telemetria.tempoAtendimentoMs > 0) {
        segundosAtendimento = Math.round(telemetria.tempoAtendimentoMs / 1000);
      } else if (somaAtendimentoPacotes > 0) {
        segundosAtendimento = somaAtendimentoPacotes;
      }

      // Tempo de deslocamento
      if (telemetria.tempoDeslocamentoMs && telemetria.tempoDeslocamentoMs > 0) {
        segundosDeslocamento = Math.round(telemetria.tempoDeslocamentoMs / 1000);
      } else if (segundosTempoTotal > 0 && segundosTempoTotal > segundosAtendimento) {
        segundosDeslocamento = segundosTempoTotal - segundosAtendimento;
      }

      // 2. CÁLCULO FINANCEIRO REAL DE COMBUSTÍVEL
      const tipoCombustivel = configVeiculo.tipoCombustivel || 'Gasolina';
      const consumoKmL = parseFloat(configVeiculo.consumoKmL) || 10.0;
      const precoLitro = parseFloat(configVeiculo.precoLitro) || 5.89;

      const litrosGastos = consumoKmL > 0 ? (kmRealPercorrido / consumoKmL) : 0;
      const custoTotalCombustivel = litrosGastos * precoLitro;
      const custoPorPacote = entregues.length > 0 ? (custoTotalCombustivel / entregues.length) : (totalPacotes > 0 ? (custoTotalCombustivel / totalPacotes) : 0);

      // 3. ANÁLISE POR BAIRRO
      const contagemBairros = {};
      ordenadas.forEach(p => {
        const bairro = (p.bairro || 'Centro / Outros').trim();
        contagemBairros[bairro] = (contagemBairros[bairro] || 0) + 1;
      });

      const listaBairros = Object.entries(contagemBairros)
        .map(([nome, qtd]) => ({
          nome,
          qtd,
          porcentagem: totalPacotes > 0 ? Math.round((qtd / totalPacotes) * 100) : 0
        }))
        .sort((a, b) => b.qtd - a.qtd);

      // 4. DETALHAMENTO REAL POR PACOTE (TEMPO GASTO EM CADA ENTREGA)
      const listaEntregasAuditadas = ordenadas.map(p => {
        const tempoAtendimentoSec = p.tempo_atendimento_seg || p.telemetria?.tempoAtendimentoSec || null;
        const tempoDeslocamentoSec = p.tempo_deslocamento_seg || p.telemetria?.tempoDeslocamentoSec || null;

        return {
          canetao: p.ordem_entrega,
          endereco: p.endereco,
          bairro: p.bairro,
          rastreio: p.codigo_rastreio,
          finalRastreio: p.codigo_rastreio ? p.codigo_rastreio.slice(-4) : '----',
          status: p.status || 'pendente',
          tempoAtendimentoTexto: tempoAtendimentoSec ? this.formatarTempo(tempoAtendimentoSec) : (p.status === 'entregue' ? 'Registrado' : '--'),
          tempoDeslocamentoTexto: tempoDeslocamentoSec ? this.formatarTempo(tempoDeslocamentoSec) : '--',
          horaEntrega: p.entregue_em ? new Date(p.entregue_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--'
        };
      });

      // Data formatada da rota
      let dataFormatada = 'Hoje';
      if (rota?.data) {
        try {
          dataFormatada = new Date(rota.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        } catch (e) {}
      }

      const tempoTotalFmt = this.formatarTempo(segundosTempoTotal);

      return {
        rotaId: rota?.id || '---',
        data: dataFormatada,
        horaInicio: dataHoraInicio || '--:--',
        horaFim: dataHoraFim || (rotaConcluida ? 'Concluída' : 'Em andamento'),
        isEmAndamento: !rotaConcluida,
        totalPacotes,
        totalParadasUnicas,
        qtdEntregues: entregues.length,
        qtdAusentes: ausentes.length,
        qtdPendentes: pendentes.length,
        qtdAvulsos: avulsos.length,

        // Telemetria Real Medida
        kmRealPercorrido,
        kmTotal: kmRealPercorrido,
        origemKm,
        tempoTotalTexto: tempoTotalFmt,
        tempoEstimadoFormatado: tempoTotalFmt,
        tempoDeslocamentoTexto: this.formatarTempo(segundosDeslocamento),
        tempoAtendimentoTexto: this.formatarTempo(segundosAtendimento),
        segundosTempoTotal,

        // Finanças
        tipoCombustivel,
        consumoKmL,
        precoLitro,
        litrosGastos: Math.round(litrosGastos * 100) / 100,
        custoTotalCombustivel: Math.round(custoTotalCombustivel * 100) / 100,
        custoPorPacote: Math.round(custoPorPacote * 100) / 100,

        // Listas
        listaBairros,
        listaEntregasAuditadas,
        listaAusentes: ausentes.map(p => ({
          canetao: p.ordem_entrega,
          endereco: p.endereco,
          bairro: p.bairro,
          rastreio: p.codigo_rastreio,
          finalRastreio: p.codigo_rastreio ? p.codigo_rastreio.slice(-4) : '----'
        }))
      };
    },

    /**
     * Exporta o Relatório Executivo Oficial em PDF A4 (100% da rota, sem limite de 50 pacotes)
     */
    exportarPDF(dados, nomeMotorista = 'Motorista Parceiro SPX') {
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('A biblioteca jsPDF está sendo carregada. Tente novamente em 2 segundos.');
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const corLaranja = [234, 88, 12];
      const corCinzaEscuro = [15, 23, 42];

      // 1. CABEÇALHO DO RELATÓRIO
      doc.setFillColor(...corCinzaEscuro);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('SPX', 14, 18);
      doc.setTextColor(...corLaranja);
      doc.text('rotas', 35, 18);

      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text('RELATÓRIO DE TELEMETRIA REAL & AUDITORIA DE ROTA', 14, 26);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`ROTA #${dados.rotaId} • DATA: ${dados.data}`, 145, 16);
      doc.text(`HORÁRIO: ${dados.horaInicio} às ${dados.horaFim}`, 145, 22);
      doc.text(`MOTORISTA: ${nomeMotorista.toUpperCase()}`, 145, 28);

      // Faixa Laranja Divisória
      doc.setFillColor(...corLaranja);
      doc.rect(0, 36, 210, 2, 'F');

      let yPos = 44;

      // 2. INDICADORES PRINCIPAIS DE TELEMETRIA REAL (4 CARDS)
      const larguraCard = 43;
      const alturaCard = 22;
      const espacamento = 5;
      const margemX = 14;

      const labelKm = dados.origemKm === 'GPS' ? 'HODÔMETRO REAL' : 'DISTÂNCIA DA ROTA';
      const cards = [
        { label: 'PACOTES ENTREGUES', valor: `${dados.qtdEntregues} de ${dados.totalPacotes}`, cor: [234, 88, 12] },
        { label: labelKm, valor: `${dados.kmRealPercorrido} km`, cor: [56, 189, 248] },
        { label: 'TEMPO TOTAL REAL', valor: dados.tempoTotalTexto, cor: [16, 185, 129] },
        { label: 'CUSTO COMBUSTÍVEL', valor: `R$ ${dados.custoTotalCombustivel.toFixed(2)}`, cor: [245, 158, 11] }
      ];

      cards.forEach((c, idx) => {
        const x = margemX + idx * (larguraCard + espacamento);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, yPos, larguraCard, alturaCard, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, x + 3.5, yPos + 6);

        doc.setFontSize(12);
        doc.setTextColor(...c.cor);
        doc.text(c.valor, x + 3.5, yPos + 16);
      });

      yPos += alturaCard + 8;

      // 3. ANÁLISE DE TEMPO & DESLOCAMENTO (SEM EMOJIS QUEBRADOS)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...corCinzaEscuro);
      doc.text('Auditoria de Tempo: Trânsito vs. Atendimento no Cliente', margemX, yPos);

      yPos += 3;
      doc.setDrawColor(...corLaranja);
      doc.setLineWidth(0.6);
      doc.line(margemX, yPos, margemX + 95, yPos);
      yPos += 5;

      const dadosTempo = [
        ['Tempo em Trânsito (Dirigindo no Trânsito):', `${dados.tempoDeslocamentoTexto}`],
        ['Tempo Parado em Atendimento (Na Porta das Casas):', `${dados.tempoAtendimentoTexto}`],
        ['Duração Total da Operação (Saída ao Retorno):', `${dados.tempoTotalTexto}`],
        ['Combustível Real Consumido:', `${dados.litrosGastos.toFixed(2)} litros (${dados.tipoCombustivel} @ R$ ${dados.precoLitro.toFixed(2)}/L)`],
        ['Custo Médio de Combustível por Pacote Entregue:', `R$ ${dados.custoPorPacote.toFixed(2)} / entrega`]
      ];

      if (doc.autoTable) {
        doc.autoTable({
          startY: yPos,
          margin: { left: margemX, right: 14 },
          body: dadosTempo,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 110 },
            1: { halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] }
          }
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // 4. TABELA ANALÍTICA COMPLETA DE TODAS AS ENTREGAS (SEM CORTE DE 50 PACOTES)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...corCinzaEscuro);
      doc.text(`Detalhamento das Paradas com Tempo Real no Cliente (${dados.listaEntregasAuditadas.length} pacotes)`, margemX, yPos);

      yPos += 3;
      doc.setDrawColor(...corLaranja);
      doc.line(margemX, yPos, margemX + 125, yPos);
      yPos += 5;

      const linhasEntregas = dados.listaEntregasAuditadas.map(e => [
        `#${e.canetao}`,
        e.finalRastreio,
        e.endereco,
        e.bairro,
        e.horaEntrega,
        e.tempoAtendimentoTexto,
        e.status === 'entregue' ? 'Entregue' : (e.status === 'ausente' ? 'Ausente' : (e.status === 'conferido' ? 'Conferido' : 'Pendente'))
      ]);

      if (doc.autoTable) {
        doc.autoTable({
          startY: yPos,
          margin: { left: margemX, right: 14 },
          head: [['Canetão', 'Final', 'Endereço', 'Bairro', 'Horário', 'Tempo Parado', 'Status']],
          body: linhasEntregas,
          theme: 'striped',
          headStyles: { fillColor: corCinzaEscuro, textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 }
        });
        yPos = doc.lastAutoTable.finalY + 8;
      }

      // 5. DEVOLUÇÕES / AUSENTES PARA CONFERÊNCIA NO CD (SE HOUVER)
      if (dados.listaAusentes && dados.listaAusentes.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(180, 83, 9);
        doc.text(`Devoluções no Galpão (${dados.listaAusentes.length} volumes ausentes)`, margemX, yPos);

        yPos += 3;
        doc.setDrawColor(245, 158, 11);
        doc.line(margemX, yPos, margemX + 85, yPos);
        yPos += 5;

        const linhasAusentes = dados.listaAusentes.map(a => [
          `#${a.canetao}`,
          a.finalRastreio,
          a.endereco,
          a.bairro,
          a.rastreio
        ]);

        if (doc.autoTable) {
          doc.autoTable({
            startY: yPos,
            margin: { left: margemX, right: 14 },
            head: [['Canetão', 'Final', 'Endereço', 'Bairro', 'Código de Rastreio Oficial']],
            body: linhasAusentes,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.8 }
          });
          yPos = doc.lastAutoTable.finalY + 8;
        }
      }

      // RODAPÉ EXECUTIVO COM NUMERAÇÃO DE PÁGINA
      const totalPaginas = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `SPXrotas • Sistema de Telemetria Logística • STUDIOTESTA (CNPJ: 54.404.992/0001-41) • Página ${i} de ${totalPaginas}`,
          margemX,
          290
        );
      }

      const nomeLimpo = `SPXrotas_Relatorio_Real_Rota_${dados.rotaId}.pdf`;
      doc.save(nomeLimpo);
    }
  };

  window.SPXrotasRelatorio = Relatorio;
  window.DriveXPSRelatorio = Relatorio;
})(window);