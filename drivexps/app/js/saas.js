/* ==========================================================================
   DriveXPS Pro 4.0 - Módulo SaaS, Assinatura e Pagamentos PIX
   Arquivo: /js/saas.js
   ========================================================================== */

function saasModule() {
  return {
    planoAtivo: 'gratuito',
    dataExpiracao: null,
    trialIniciado: false,
    diasRestantesTrial: 7,
    statusAssinatura: 'trial',
    assinaturaValida: true,

    modalAssinatura: false,
    modalCadastroObrigatorio: false,
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

    /**
     * Retorna o texto formatado para o status da assinatura no menu lateral
     */
    getTextoStatusAssinatura() {
      if (this.statusAssinatura === 'ativo') {
        return `Assinatura Ativa (${this.planoAtivo.toUpperCase()})`;
      }
      if (this.planoAtivo === 'vitalicio') {
        return 'Acesso Vitalício Liberado';
      }
      if (this.trialIniciado) {
        if (this.diasRestantesTrial > 0) {
          return `Período de Teste: ${this.diasRestantesTrial} dia(s) restante(s)`;
        }
        return 'Período de Teste Expirado';
      }
      return '7 Dias Grátis (Começam na 1ª rota)';
    },

    /**
     * Sincroniza dados da assinatura do motorista com a coleção drivexps_users
     */
    async sincronizarAssinaturaSaaS() {
      if (!this.usuarioId || !this.usuarioLogado) return;

      const headers = { 'Content-Type': 'application/json' };
      if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;

      try {
        const res = await fetch(`${this.DIRECTUS_URL}/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`, { 
          headers, 
          credentials: 'include' 
        });
        const data = await res.json();
        const registros = data.data || [];

        let userSaas = null;

        if (registros.length === 0) {
          // Cria o registro SaaS inicial no primeiro login
          const novoRegistro = {
            user_id: this.usuarioId,
            email: this.usuarioEmail || null,
            nome: (this.usuarioNome && this.usuarioNome !== 'Motorista') ? this.usuarioNome : null,
            telefone: null,
            trial_expira_em: null,
            status_assinatura: 'trial',
            plano_ativo: 'gratuito'
          };

          const postRes = await fetch(`${this.DIRECTUS_URL}/items/drivexps_users`, {
            method: 'POST', 
            headers, 
            credentials: 'include', 
            body: JSON.stringify(novoRegistro)
          });
          const postData = await postRes.json();
          userSaas = postData.data;

          this.trialIniciado = false;
          this.diasRestantesTrial = 7;
          this.statusAssinatura = 'trial';
          this.planoAtivo = 'gratuito';
          this.dataExpiracao = null;
          this.assinaturaValida = true;
        } else {
          userSaas = registros[0];
          this.statusAssinatura = userSaas.status_assinatura || 'trial';
          this.planoAtivo = userSaas.plano_ativo || 'gratuito';
          this.dataExpiracao = userSaas.trial_expira_em || null;

          if (userSaas.nome && userSaas.nome !== 'Motorista') this.usuarioNome = userSaas.nome;
          if (userSaas.email) this.usuarioEmail = userSaas.email;
          if (userSaas.telefone) this.inputTelefone = userSaas.telefone;

          if (this.planoAtivo === 'vitalicio') {
            this.assinaturaValida = true; 
            this.trialIniciado = true; 
            this.diasRestantesTrial = 9999;
          } else if (!userSaas.trial_expira_em) {
            this.trialIniciado = false; 
            this.diasRestantesTrial = 7; 
            this.assinaturaValida = true;
          } else {
            this.trialIniciado = true;
            const agora = new Date(); 
            const expira = new Date(userSaas.trial_expira_em);
            const diffDias = Math.ceil((expira - agora) / (1000 * 60 * 60 * 24));
            this.diasRestantesTrial = Math.max(0, diffDias);
            
            if (diffDias > 0 || this.statusAssinatura === 'ativo') { 
              this.assinaturaValida = true; 
            } else { 
              this.assinaturaValida = false; 
              this.modalAssinatura = true; 
            }
          }

          // Polling: Verifica se a data de expiração aumentou após pagamento via PIX
          if (this.intervaloPollingPagamento) {
            const novaExpMs = userSaas.trial_expira_em ? new Date(userSaas.trial_expira_em).getTime() : 0;
            if (novaExpMs > this.dataExpAntesDoPix || this.statusAssinatura === 'ativo') {
              clearInterval(this.intervaloPollingPagamento); 
              this.intervaloPollingPagamento = null;
              this.modalAssinatura = false; 
              this.codigoPixGerado = ''; 
              this.qrCodeBase64 = '';
              alert('🎉 Pagamento Aprovado! Seu plano foi ativado com sucesso.');
            }
          }
        }

        // Validação de dados cadastrais obrigatórios
        const nomeInvalido = !userSaas?.nome || userSaas.nome.trim().toLowerCase() === 'motorista';
        const telInvalido = !userSaas?.telefone || String(userSaas.telefone).replace(/\D/g, '').length < 10;
        const emailInvalido = !userSaas?.email || !userSaas.email.includes('@');

        if (this.usuarioLogado && (nomeInvalido || telInvalido || emailInvalido)) {
          this.inputNome = (!nomeInvalido) ? userSaas.nome : (this.usuarioNome || '');
          this.inputEmail = (!emailInvalido) ? userSaas.email : (this.usuarioEmail || '');
          this.inputTelefone = userSaas?.telefone || '';
          this.erroCadastroObrigatorio = '';
          this.modalCadastroObrigatorio = true;
        } else {
          this.modalCadastroObrigatorio = false;
        }

      } catch (err) {
        console.error('Erro na sincronização SaaS:', err);
      }
    },

    /**
     * Salva as alterações de perfil feitas no menu lateral
     */
    async salvarDadosCompletosPerfil() {
      if (!this.usuarioId) return;
      this.salvandoPerfil = true;
      const telLimpo = (this.inputTelefone || '').replace(/\D/g, '');
      const headers = { 'Content-Type': 'application/json' };
      if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;

      try {
        const res = await fetch(`${this.DIRECTUS_URL}/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`, { 
          headers, 
          credentials: 'include' 
        });
        const data = await res.json();
        if (data.data && data.data[0]) {
          await fetch(`${this.DIRECTUS_URL}/items/drivexps_users/${data.data[0].id}`, {
            method: 'PATCH', 
            headers, 
            credentials: 'include', 
            body: JSON.stringify({ nome: this.usuarioNome, telefone: telLimpo })
          });
          alert('✅ Dados do perfil atualizados com sucesso!');
        }
      } catch (e) { 
        alert('Falha ao salvar dados: ' + e.message); 
      } finally { 
        this.salvandoPerfil = false; 
      }
    },

    /**
     * Valida e salva o cadastro obrigatório inicial
     */
    async salvarCadastroObrigatorio() {
      this.erroCadastroObrigatorio = '';
      const nomeLimpo = (this.inputNome || '').trim();
      const telLimpo = (this.inputTelefone || '').replace(/\D/g, '');
      const emailLimpo = (this.inputEmail || '').trim().toLowerCase();

      if (!nomeLimpo || nomeLimpo.toLowerCase() === 'motorista' || nomeLimpo.length < 3) {
        this.erroCadastroObrigatorio = 'Por favor, digite seu nome e sobrenome.';
        return;
      }
      if (telLimpo.length < 10 || telLimpo.length > 11) {
        this.erroCadastroObrigatorio = 'Informe um WhatsApp válido com DDD (10 ou 11 dígitos).';
        return;
      }
      if (!emailLimpo || !emailLimpo.includes('@') || !emailLimpo.includes('.')) {
        this.erroCadastroObrigatorio = 'Informe um e-mail válido.';
        return;
      }

      this.salvandoPerfil = true;
      const headers = { 'Content-Type': 'application/json' };
      if (this.tokenAcesso) headers['Authorization'] = `Bearer ${this.tokenAcesso}`;

      try {
        const res = await fetch(`${this.DIRECTUS_URL}/items/drivexps_users?filter[user_id][_eq]=${this.usuarioId}`, { 
          headers, 
          credentials: 'include' 
        });
        const data = await res.json();
        if (data.data && data.data[0]) {
          await fetch(`${this.DIRECTUS_URL}/items/drivexps_users/${data.data[0].id}`, {
            method: 'PATCH', 
            headers, 
            credentials: 'include',
            body: JSON.stringify({ nome: nomeLimpo, telefone: telLimpo, email: emailLimpo })
          });
          this.usuarioNome = nomeLimpo;
          this.usuarioEmail = emailLimpo;
          this.inputTelefone = telLimpo;
          this.modalCadastroObrigatorio = false;
        }
      } catch (e) {
        this.erroCadastroObrigatorio = 'Falha ao salvar: ' + e.message;
      } finally {
        this.salvandoPerfil = false;
      }
    },

    /**
     * Dispara geração do PIX PushinPay via webhook do n8n
     */
    async gerarPixAssinatura() {
      this.carregandoPix = true;
      this.dataExpAntesDoPix = this.dataExpiracao ? new Date(this.dataExpiracao).getTime() : 0;

      try {
        const res = await fetch('https://n8n.studiotesta.com.br/webhook/gerar-pix-drivexps', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            user_id: this.usuarioId, 
            email: this.usuarioEmail, 
            plano: this.planoEscolhido 
          })
        });

        if (res.ok) {
          const data = await res.json();
          this.codigoPixGerado = data.pix_copia_cola; 
          this.qrCodeBase64 = data.qr_code_base64 || '';

          if (!this.intervaloPollingPagamento) {
            this.intervaloPollingPagamento = setInterval(() => { 
              this.sincronizarAssinaturaSaaS(); 
            }, 4000);
          }
        } else { 
          alert('Não foi possível gerar o PIX. Tente novamente em instantes.'); 
        }
      } catch (e) { 
        alert('Erro de conexão ao gerar PIX: ' + e.message); 
      } finally { 
        this.carregandoPix = false; 
      }
    },

    resetarPix() {
      if (this.intervaloPollingPagamento) { 
        clearInterval(this.intervaloPollingPagamento); 
        this.intervaloPollingPagamento = null; 
      }
      this.codigoPixGerado = ''; 
      this.qrCodeBase64 = '';
    },

    fecharModalAssinatura() {
      this.resetarPix();
      this.modalAssinatura = false;
    },

    copiarCodigoPix() {
      navigator.clipboard.writeText(this.codigoPixGerado);
      alert('Código PIX copiado! Abra o app do seu banco e escolha "PIX Copia e Cola".');
    }
  };
}