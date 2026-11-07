/* ==========================================================================
   DriveXPS Pro 6.8 - Módulo Dedicado de Relatórios, Custos e Exportação PDF
   Arquivo: /js/relatorio.js
   ========================================================================== */

(function (window) {
  'use strict';

  const Relatorio = {
    /**
     * Decodifica polilinha comprimida (Google Encoded Polyline)
     */
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

    /**
     * Distância Haversine entre dois pontos em Quilômetros
     */
    calcularDistanciaKm(lat1, lon1, lat2, lon2) {
      const R = 6371; // Raio da Terra em KM
      const p1 = lat1 * Math.PI / 180;
      const p2 = lat2 * Math.PI / 180;
      const dp = (lat2 - lat1) * Math.PI / 180;
      const dl = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    /**
     * Calcula a quilometragem total percorrida na geometria da rota
     */
    calcularKmTotalRota(geometria, entregas) {
      if (geometria && geometria.length > 5) {
        const coords = this.decodePolyline(geometria);
        if (coords.length > 1) {
          let totalKm = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            totalKm += this.calcularDistanciaKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
          }
          return Math.round(totalKm * 10) / 10;
        }
      }

      // Fallback: cálculo sequencial ponto a ponto
      if (entregas && entregas.length > 1) {
        let totalKm = 0;
        const ordenadas = [...entregas].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));
        for (let i = 0; i < ordenadas.length - 1; i++) {
          if (ordenadas[i].latitude && ordenadas[i + 1].latitude) {
            totalKm += this.calcularDistanciaKm(
              Number(ordenadas[i].latitude), Number(ordenadas[i].longitude),
              Number(ordenadas[i + 1].latitude), Number(ordenadas[i + 1].longitude)
            );
          }
        }
        // Aplica fator de correção viária urbana (+25% sobre a linha reta)
        return Math.round(totalKm * 1.25 * 10) / 10;
      }

      return 0;
    },

    /**
     * Gera todos os dados estatísticos, financeiros e operacionais do relatório
     */
    compilarDados(rota, entregas, configVeiculo = {}) {
      const ordenadas = [...(entregas || [])].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));
      const totalPacotes = ordenadas.length;

      // Paradas Únicas físicas (agrupadas por endereço)
      const chavesParadas = new Set();
      ordenadas.forEach(p => {
        const rua = (p.endereco || '').split(',')[0].toLowerCase().trim();
        const num = (p.numero || '').toLowerCase().trim();
        chavesParadas.add(`${rua}_${num}_${p.cidade}`);
      });
      const totalParadasUnicas = chavesParadas.size || totalPacotes;

      // Status das entregas
      const entregues = ordenadas.filter(p => p.status === 'entregue');
      const ausentes = ordenadas.filter(p => p.status === 'ausente');
      const pendentes = ordenadas.filter(p => p.status === 'pendente' || !p.status);
      const avulsos = ordenadas.filter(p => !p.parada_shopee || Number(p.parada_shopee) <= 0 || p.parada_shopee === '-');

      // Quilometragem
      const kmTotal = this.calcularKmTotalRota(rota?.geometria, ordenadas);

      // Consumo Personalizado do Veículo do Motorista
      const tipoCombustivel = configVeiculo.tipoCombustivel || 'Gasolina';
      const consumoKmL = parseFloat(configVeiculo.consumoKmL) || 10.0;
      const precoLitro = parseFloat(configVeiculo.precoLitro) || 5.89;

      const litrosGastos = consumoKmL > 0 ? (kmTotal / consumoKmL) : 0;
      const custoTotalCombustivel = litrosGastos * precoLitro;
      const custoPorPacote = totalPacotes > 0 ? (custoTotalCombustivel / totalPacotes) : 0;

      // Estimativa de tempo (35 km/h velocidade média urbana + 1.8 min por parada)
      const tempoViagemHoras = (kmTotal / 32);
      const tempoAtendimentoHoras = (totalParadasUnicas * 1.8) / 60;
      const tempoTotalHoras = tempoViagemHoras + tempoAtendimentoHoras;

      const horasInt = Math.floor(tempoTotalHoras);
      const minutosInt = Math.round((tempoTotalHoras - horasInt) * 60);
      const tempoEstimadoFormatado = `${horasInt}h ${minutosInt < 10 ? '0' : ''}${minutosInt}min`;

      // Raio-X por Bairro
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

      // Data formatada da rota
      let dataFormatada = 'Hoje';
      if (rota?.data) {
        try {
          dataFormatada = new Date(rota.data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        } catch (e) {}
      }

      return {
        rotaId: rota?.id || '---',
        data: dataFormatada,
        totalPacotes,
        totalParadasUnicas,
        qtdEntregues: entregues.length,
        qtdAusentes: ausentes.length,
        qtdPendentes: pendentes.length,
        qtdAvulsos: avulsos.length,
        kmTotal,
        tipoCombustivel,
        consumoKmL,
        precoLitro,
        litrosGastos: Math.round(litrosGastos * 100) / 100,
        custoTotalCombustivel: Math.round(custoTotalCombustivel * 100) / 100,
        custoPorPacote: Math.round(custoPorPacote * 100) / 100,
        tempoEstimadoFormatado,
        listaBairros,
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
     * Exporta o Relatório Executivo em formato PDF formatado
     */
    exportarPDF(dados, nomeMotorista = 'Motorista Parceiro') {
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
      const corTexto = [51, 65, 85];

      // 1. CABEÇALHO DO RELATÓRIO
      doc.setFillColor(...corCinzaEscuro);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text('Drive', 14, 18);
      doc.setTextColor(...corLaranja);
      doc.text('XPS', 36, 18);

      doc.setFontSize(10);
      doc.setTextColor(203, 213, 225);
      doc.text('RELATÓRIO OPERACIONAL E FINANCEIRO DE ROTA', 14, 26);

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`ROTA #${dados.rotaId} • DATA: ${dados.data}`, 145, 18);
      doc.text(`MOTORISTA: ${nomeMotorista.toUpperCase()}`, 145, 25);

      // Faixa Laranja Divisória
      doc.setFillColor(...corLaranja);
      doc.rect(0, 36, 210, 2, 'F');

      let yPos = 46;

      // 2. INDICADORES PRINCIPAIS (4 CARDS)
      const larguraCard = 43;
      const alturaCard = 22;
      const espacamento = 5;
      const margemX = 14;

      const cards = [
        { label: 'TOTAL PACOTES', valor: `${dados.totalPacotes}`, cor: [234, 88, 12] },
        { label: 'PARADAS ÚNICAS', valor: `${dados.totalParadasUnicas}`, cor: [15, 23, 42] },
        { label: 'DISTÂNCIA TOTAL', valor: `${dados.kmTotal} km`, cor: [56, 189, 248] },
        { label: 'TEMPO ESTIMADO', valor: dados.tempoEstimadoFormatado, cor: [16, 185, 129] }
      ];

      cards.forEach((c, idx) => {
        const x = margemX + idx * (larguraCard + espacamento);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, yPos, larguraCard, alturaCard, 3, 3, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(c.label, x + 4, yPos + 6);

        doc.setFontSize(13);
        doc.setTextColor(...c.cor);
        doc.text(c.valor, x + 4, yPos + 16);
      });

      yPos += alturaCard + 10;

      // 3. ANÁLISE DE CUSTOS DE COMBUSTÍVEL
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...corCinzaEscuro);
      doc.text('⛽ Gestão Financeira de Combustível', margemX, yPos);

      yPos += 4;
      doc.setDrawColor(...corLaranja);
      doc.setLineWidth(0.6);
      doc.line(margemX, yPos, margemX + 70, yPos);

      yPos += 6;

      const dadosCombustivel = [
        ['Combustível Configurado:', `${dados.tipoCombustivel}`],
        ['Média Informada:', `${dados.consumoKmL} km/l`],
        ['Preço Médio do Litro:', `R$ ${dados.precoLitro.toFixed(2)}`],
        ['Consumo Estimado da Carga:', `${dados.litrosGastos.toFixed(2)} litros`],
        ['CUSTO TOTAL DE GASOLINA:', `R$ ${dados.custoTotalCombustivel.toFixed(2)}`],
        ['Custo de Combustível por Pacote:', `R$ ${dados.custoPorPacote.toFixed(2)} / entrega`]
      ];

      if (doc.autoTable) {
        doc.autoTable({
          startY: yPos,
          margin: { left: margemX, right: 14 },
          body: dadosCombustivel,
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2 },
          columnStyles: {
            0: { fontStyle: 'bold', textColor: [51, 65, 85], cellWidth: 100 },
            1: { halign: 'right', fontStyle: 'bold', textColor: [234, 88, 12] }
          }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }

      // 4. RAIO-X POR BAIRRO
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...corCinzaEscuro);
      doc.text('📍 Distribuição de Pacotes por Região / Bairro', margemX, yPos);

      yPos += 4;
      doc.setDrawColor(...corLaranja);
      doc.line(margemX, yPos, margemX + 85, yPos);

      yPos += 6;

      const linhasBairros = dados.listaBairros.map(b => [
        b.nome,
        `${b.qtd} pacotes`,
        `${b.porcentagem}% da carga`
      ]);

      if (doc.autoTable) {
        doc.autoTable({
          startY: yPos,
          margin: { left: margemX, right: 14 },
          head: [['Bairro / Região', 'Volume de Pacotes', 'Representação na Rota']],
          body: linhasBairros,
          theme: 'striped',
          headStyles: { fillColor: corCinzaEscuro, textColor: 255, fontStyle: 'bold' },
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2 }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      }

      // 5. OCORRÊNCIAS / AUSENTES PARA CONFERÊNCIA NO CD (SE HOUVER)
      if (dados.listaAusentes && dados.listaAusentes.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(180, 83, 9);
        doc.text(`⚠️ Pacotes Não Entregues / Ausentes (${dados.listaAusentes.length} volumes para devolução)`, margemX, yPos);

        yPos += 4;
        doc.setDrawColor(245, 158, 11);
        doc.line(margemX, yPos, margemX + 110, yPos);

        yPos += 6;

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
            headStyles: { fillColor: [245, 158, 11], textColor: [0, 0, 0], fontStyle: 'bold' },
            styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 }
          });
          yPos = doc.lastAutoTable.finalY + 8;
        }
      }

      // RODAPÉ EXECUTIVO
      const totalPaginas = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `DriveXPS • Sistema Profissional de Otimização Logística • Desenvolvido por STUDIOTESTA (CNPJ: 54.404.992/0001-41) • Página ${i} de ${totalPaginas}`,
          margemX,
          290
        );
      }

      // Download Automático do Arquivo
      const nomeLimpo = `DriveXPS_Relatorio_Rota_${dados.rotaId}.pdf`;
      doc.save(nomeLimpo);
    }
  };

  window.DriveXPSRelatorio = Relatorio;
})(window);