/* ==========================================================================
   DriveXPS Pro 4.0 - Módulo de Autenticação Directus / Google
   Arquivo: /js/auth.js
   ========================================================================== */

function authModule() {
  return {
    usuarioLogado: false,
    usuarioEmail: '',
    usuarioNome: '',
    tokenAcesso: localStorage.getItem('directus_token') || null,
    usuarioId: localStorage.getItem('directus_user_id') || null,

    /**
     * Verifica e valida a sessão do usuário ativo
     * Prioridade: URL Tokens -> Directus Token Local -> /auth/refresh -> Sessão por Cookie
     */
    async verificarAutenticacao() {
      if (localStorage.getItem('usuario_deslogado') === 'true') {
        this.usuarioLogado = false;
        this.modalCadastroObrigatorio = false;
        return;
      }

      // 1. CAPTURA TOKEN CASO RETORNADO POR URL (OAuth Redirect)
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
      const tokenUrl = searchParams.get('access_token') || hashParams.get('access_token') || searchParams.get('token');
      const refreshUrl = searchParams.get('refresh_token') || hashParams.get('refresh_token');

      if (tokenUrl) {
        localStorage.setItem('directus_token', tokenUrl);
        this.tokenAcesso = tokenUrl;
      }
      if (refreshUrl) {
        localStorage.setItem('directus_refresh_token', refreshUrl);
      }

      // Limpa os parâmetros sensíveis da URL mantendo o histórico limpo
      if (window.location.search && !window.location.search.includes('arquivo_compartilhado')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const extrairDadosUsuario = (u) => {
        this.usuarioId = u.id;
        this.usuarioEmail = u.email || '';
        const n = [u.first_name, u.last_name].filter(Boolean).join(' ');
        this.usuarioNome = n.trim() || u.email || '';
        localStorage.setItem('directus_user_id', this.usuarioId);
        this.usuarioLogado = true;
      };

      // 2. SE NÃO TIVER TOKEN, CHAMA O REFRESH OFICIAL DO DIRECTUS PARA RESGATAR A SESSÃO DO COOKIE
      if (!this.tokenAcesso && !localStorage.getItem('directus_token')) {
        try {
          const resRefresh = await fetch(`${this.DIRECTUS_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });
          if (resRefresh.ok) {
            const dataRefresh = await resRefresh.json();
            if (dataRefresh && dataRefresh.data && dataRefresh.data.access_token) {
              this.tokenAcesso = dataRefresh.data.access_token;
              localStorage.setItem('directus_token', this.tokenAcesso);
            }
          }
        } catch (e) {
          console.warn('Erro ao tentar handshake de refresh:', e);
        }
      }

      // 3. CONSULTA O USUÁRIO ATIVO PELO BEARER TOKEN
      const tokenAtivo = this.tokenAcesso || localStorage.getItem('directus_token');
      if (tokenAtivo) {
        try {
          const res = await fetch(`${this.DIRECTUS_URL}/users/me`, { 
            headers: { 'Authorization': `Bearer ${tokenAtivo}` } 
          });
          if (res.ok) { 
            const data = await res.json(); 
            if (data && data.data && data.data.id) {
              extrairDadosUsuario(data.data); 
              return; 
            }
          }
        } catch (e) {
          console.warn('Token atual inválido ou expirado:', e);
        }
      }

      // 4. FALLBACK FINAL POR COOKIE DE SESSÃO HTTP-ONLY
      try {
        const resSession = await fetch(`${this.DIRECTUS_URL}/users/me`, { credentials: 'include' });
        if (resSession.ok) {
          const userData = await resSession.json();
          if (userData && userData.data && userData.data.id) { 
            extrairDadosUsuario(userData.data); 
            return; 
          }
        }
      } catch (e) {
        console.warn('Falha no fallback de sessão:', e);
      }
      
      this.usuarioLogado = false;
      this.modalCadastroObrigatorio = false;
    },

    /**
     * Inicia fluxo de autenticação com o Google OAuth
     */
    loginGoogle() {
      localStorage.removeItem('usuario_deslogado');
      const urlLimpa = window.location.origin + window.location.pathname;
      window.location.href = `${this.DIRECTUS_URL}/auth/login/google?redirect=${encodeURIComponent(urlLimpa)}`;
    },

    /**
     * Encerra a sessão, limpa caches e cookies
     */
    async deslogar() {
      if (this.intervaloPollingPagamento) clearInterval(this.intervaloPollingPagamento);
      localStorage.setItem('usuario_deslogado', 'true');
      localStorage.removeItem('directus_token'); 
      localStorage.removeItem('directus_user_id');
      localStorage.removeItem('directus_refresh_token');
      localStorage.removeItem('drivexps_rota_ativa_id'); 
      localStorage.removeItem('drivexps_entregas_cache');
      
      this.tokenAcesso = null; 
      this.usuarioId = null; 
      this.usuarioLogado = false;
      this.modalCadastroObrigatorio = false;
      this.entregas = []; 
      this.rotaAtivaId = null;

      try {
        await fetch(`${this.DIRECTUS_URL}/auth/logout`, {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          credentials: 'include', 
          body: JSON.stringify({ mode: 'session' })
        });
      } catch (e) {
        console.warn('Erro ao deslogar no backend:', e);
      }
    }
  };
}