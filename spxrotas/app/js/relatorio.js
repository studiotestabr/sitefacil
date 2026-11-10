/* ==========================================================================
   SPXrotas Pro v1.4.0 - Módulo de Telemetria Real, Custos e Relatório PDF
   Cálculo Fiel de KM Percorrido, Tempo em Trânsito, Tempo de Atendimento e Gastos
   Arquivo: /spxrotas/app/js/relatorio.js
   ========================================================================== */

(function (window) {
  'use strict';

  const Relatorio = {
    /**
     * Formata milissegundos ou segundos em formato legível (Xh Ymin Zs)
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
     * Compila os dados reais medidos pelo hodômetro do GPS e cronômetros
     */
    compilarDados(rota, entregas, configVeiculo = {}, telemetriaAoVivo = null) {
      const ordenadas = [...(entregas || [])].sort((a, b) => (Number(a.ordem_entrega) || 0) - (Number(b.ordem_entrega) || 0));
      const totalPacotes = ordenadas.length;

      // Status das entregas
      const entregues = ordenadas.filter(p => p.status === 'entregue');
      const ausentes = ordenadas.filter(p => p.status === 'ausente');
      const pendentes = ordenadas.filter(p => p.status === 'pendente' || !p.status);
      const avulsos = ordenadas.filter(p => !p.parada_shopee || Number(p.parada_shopee) <= 0 || p.parada_shopee === '-');

      // Agrupamento por Imóvel Físico
      const chavesParadas = new Set();
      ordenadas.forEach(p => {
        const rua = (p.endereco || '').split(',')[0].toLowerCase().trim();
        const num = (p.numero || '').toLowerCase().trim();
        chavesParadas.add(`${rua}_${num}_${p.cidade}`);
      });
      const totalParadasUnicas = chavesParadas.size || totalPacotes;

      // 1. DADOS REAIS DE TELEMETRIA (CAIXA-PRETA DO APP)
      // Se a rota gravou telemetria no banco ou localStorage, usa os dados 100% verídicos!
      const telemetria = telemetriaAoVivo || rota?.telemetria || JSON.parse(localStorage.getItem(`spxrotas_telemetria_${rota?.id}`) || 'null');

      let kmRealPercorrido = 0;
      let segundosTempoTotal = 0;
      let segundosDeslocamento = 0;
      let segundosAtendimento = 0;
      let rotaConcluida = pendentes.length === 0 && totalPacotes > 0;
      let dataHoraInicio = null;
      let dataHoraFim = null;

      if (telemetria && telemetria.odometroMetros > 0) {
        // HODÔMETRO REAL MEDIDO PELO GPS DO CARRO
        kmRealPercorrido = Math.round((telemetria.odometroMetros / 1000) * 10) / 10;
        segundosTempoTotal = Math.round((telemetria.tempoTotalMs || 0) / 1000);
        segundosDeslocamento = Math.round((telemetria.tempoDeslocamentoMs || 0) / 1000);
        segundosAtendimento = Math.round((telemetria.tempoAtendimentoMs || 0) / 1000);

        if (telemetria.inicioTimestamp) {
          dataHoraInicio = new Date(telemetria.inicioTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        if (telemetria.fimTimestamp) {
          dataHoraFim = new Date(telemetria.fimTimestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      } else {
        // Fallback transitório (apenas se o motorista ainda não começou a rodar no GPS)
        kmRealPercorrido = rota?.km_real || 0;
        segundosTempoTotal = rota?.tempo_total_segundos || 0;
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
        tempoTotalTexto: this.formatarTempo(segundosTempoTotal),
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
     * Exporta o Relatório Executivo Oficial em PDF A4
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

      const cards = [
        { label: 'PACOTES ENTREGUES', valor: `${dados.qtdEntregues} de ${dados.totalPacotes}`, cor: [234, 88, 12] },
        { label: 'HODÔMETRO REAL', valor: `${dados.kmRealPercorrido} km`, cor: [56, 189, 248] },
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

      // 3. ANÁLISE DE TEMPO & DESLOCAMENTO (VERDADEIRO)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...corCinzaEscuro);
      doc.text('⏱️ Auditoria de Tempo: Trânsito vs. Atendimento no Cliente', margemX, yPos);

      yPos += 3;
      doc.setDrawColor(...corLaranja);
      doc.setLineWidth(0.6);
      doc.line(margemX, yPos, margemX + 85, yPos);
      yPos += 5;

      const dadosTempo = [
        ['Tempo em Trânsito (Dirigindo no Trânsito):', `${dados.tempoDeslocamentoTexto}`],
        ['Tempo Parado em Atendimento (Na Porta das Casas):', `${dados.tempoAtendimentoTexto}`],
        ['Duração Total da Operação (Saída ao Retorno):', `${dados.tempoTotalTexto}`],
        ['Combustível Real Consumido:', `${dados.litrosGastos.toFixed(2)} litros (${dados.tipoCombustivel} @ R$ ${dados.precoLitro.toFixed(2)}/L)`],
        ['Custo Médio de Gasolina por Pacote Entregue:', `R$ ${dados.custoPorPacote.toFixed(2)} / entrega`]
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

      // 4. TABELA ANALÍTICA DE ENTREGAS COM TEMPO REAL POR PARADA
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...corCinzaEscuro);
      doc.text('📦 Detalhamento das Paradas com Tempo Real no Cliente', margemX, yPos);

      yPos += 3;
      doc.setDrawColor(...corLaranja);
      doc.line(margemX, yPos, margemX + 90, yPos);
      yPos += 5;

      const linhasEntregas = dados.listaEntregasAuditadas.slice(0, 50).map(e => [
        `#${e.canetao}`,
        e.finalRastreio,
        e.endereco,
        e.bairro,
        e.horaEntrega,
        e.tempoAtendimentoTexto,
        e.status === 'entregue' ? 'Entregue' : (e.status === 'ausente' ? 'Ausente' : 'Pendente')
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
        doc.text(`⚠️ Devoluções no Galpão (${dados.listaAusentes.length} volumes ausentes)`, margemX, yPos);

        yPos += 3;
        doc.setDrawColor(245, 158, 11);
        doc.line(margemX, yPos, margemX + 80, yPos);
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