(function () {
  const year = new Date().getFullYear();
  document.querySelectorAll('[data-year]').forEach((node) => {
    node.textContent = year;
  });

  const SUPABASE_URL = 'https://hudhglmitjwikhnfvckh.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_W5VlRx_aOwNw1x3oT9W6Fg_vKpxS8tl';

  function loadSupabase(callback) {
    if (window.supabase) {
      callback();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.5/dist/umd/supabase.min.js';
    script.onload = callback;
    document.head.appendChild(script);
  }

  function createAuthModal() {
    if (document.getElementById('auth-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal hidden';
    modal.innerHTML = `
      <div class="auth-modal-backdrop" data-auth-close></div>
      <div class="auth-modal-panel">
        <div class="auth-modal-header">
          <div>
            <div class="eyebrow">會員入口</div>
            <h3>會員登入 / 註冊</h3>
          </div>
          <button class="icon-button" data-auth-close>✕</button>
        </div>
        <div class="auth-tabs">
          <button class="tab active" data-auth-tab="login">登入</button>
          <button class="tab" data-auth-tab="signup">註冊</button>
        </div>
        <form class="auth-form" data-auth-form="login">
          <label>電子郵件</label>
          <input type="email" name="email" required />
          <label>密碼</label>
          <input type="password" name="password" required />
          <button class="button primary" type="submit">登入</button>
          <p class="auth-message" data-auth-message></p>
        </form>
        <form class="auth-form hidden" data-auth-form="signup">
          <label>姓名</label>
          <input type="text" name="full_name" required />
          <label>電子郵件</label>
          <input type="email" name="email" required />
          <label>密碼</label>
          <input type="password" name="password" required />
          <button class="button primary" type="submit">建立帳戶</button>
          <p class="auth-message" data-auth-message></p>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
  }

  function hideAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function bindAuthModalHandlers(client) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    modal.querySelectorAll('[data-auth-close]').forEach((btn) => {
      btn.addEventListener('click', hideAuthModal);
    });

    modal.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.authTab;
        modal.querySelectorAll('.auth-form').forEach((form) => {
          form.classList.toggle('hidden', form.dataset.authForm !== target);
        });
      });
    });

    modal.querySelectorAll('form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const message = form.querySelector('[data-auth-message]');
        if (message) message.textContent = '';

        if (form.dataset.authForm === 'login') {
          const email = data.get('email');
          const password = data.get('password');
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) {
            if (message) message.textContent = '登入失敗，請檢查帳號或密碼。';
            return;
          }
          hideAuthModal();
          return;
        }

        if (form.dataset.authForm === 'signup') {
          const email = data.get('email');
          const password = data.get('password');
          const fullName = data.get('full_name');
          const { data: signUpData, error } = await client.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName },
            },
          });
          if (error) {
            if (message) message.textContent = '註冊失敗，請稍後再試。';
            return;
          }
          if (signUpData?.user) {
            await client.from('profiles').upsert({
              id: signUpData.user.id,
              email,
              full_name: fullName,
            });
          }
          if (message) message.textContent = '請到信箱完成驗證後再登入。';
        }
      });
    });
  }

  function bindAuthButtons(client) {
    document.querySelectorAll('[data-auth-login]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        showAuthModal();
      });
    });
    document.querySelectorAll('[data-auth-logout]').forEach((btn) => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        await client.auth.signOut();
      });
    });
  }

  function ensureAuthButtons() {
    document.querySelectorAll('.nav-actions').forEach((nav) => {
      const loginButton = nav.querySelector('[data-auth-login]');
      if (loginButton) return;
      const buttons = Array.from(nav.querySelectorAll('button'));
      const login = buttons.find((btn) => btn.textContent.trim() === '登入' || btn.textContent.trim().toLowerCase() === 'login');
      if (login) {
        login.setAttribute('data-auth-login', 'true');
        return;
      }
      const fallback = document.createElement('button');
      fallback.className = 'button';
      fallback.textContent = '登入';
      fallback.setAttribute('data-auth-login', 'true');
      nav.appendChild(fallback);
    });
  }

  function updateAuthUI(session, profile) {
    document.querySelectorAll('[data-auth-status]').forEach((node) => {
      if (!session?.user) {
        node.textContent = '未登入';
        return;
      }
      const statusMap = {
        pending: '審核中',
        verified: '已通過',
        rejected: '未通過',
      };
      const planMap = {
        basic: '基礎',
        advanced: '進階',
        fellow: '專家',
      };
      const status = statusMap[profile?.status] || '審核中';
      const plan = planMap[profile?.member_level] || '基礎';
      node.textContent = `${session.user.email} · ${status} · ${plan}`;
    });

    document.querySelectorAll('[data-auth-logout]').forEach((btn) => {
      btn.classList.toggle('hidden', !session?.user);
    });
    document.querySelectorAll('[data-auth-login]').forEach((btn) => {
      btn.classList.toggle('hidden', !!session?.user);
    });
  }

  async function loadProfile(client, user) {
    if (!user) return null;
    const { data } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    return data || null;
  }

  async function renderVideoLibrary(client, session) {
    const container = document.getElementById('video-library');
    if (!container) return;

    if (!session?.user) {
      container.innerHTML = '<div class="notice">請先登入並完成審核與訂閱。</div>';
      return;
    }

    const { data, error } = await client
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      container.innerHTML = '<div class="notice">需要完成醫師審核並啟用訂閱後才能查看內容。</div>';
      return;
    }

    if (!data?.length) {
      container.innerHTML = '<div class="notice">目前尚無影片。</div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'grid-3';

    const accessMap = {
      basic: '基礎',
      advanced: '進階',
      fellow: '專家',
    };
    data.forEach((video) => {
      const card = document.createElement('div');
      card.className = 'card video-card';
      card.innerHTML = `
        <div class="eyebrow">${video.category || '手術'}</div>
        <h3>${video.title}</h3>
        <p>權限：${accessMap[video.access_level] || '基礎'}</p>
        <button class="button" data-video-id="${video.id}" data-cf-path="${video.cf_path}">播放</button>
      `;
      list.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(list);

    list.querySelectorAll('button[data-video-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const cfPath = btn.dataset.cfPath;
        btn.textContent = '準備中…';
        const { data: signed, error: signedError } = await client.functions.invoke('issue-signed-url', {
          body: { cfPath, expiresInSeconds: 300 },
        });
        if (signedError || !signed?.url) {
          btn.textContent = '播放失敗';
          return;
        }
        openVideoPlayer(signed.url, session.user?.email || 'member');
        btn.textContent = '播放';
      });
    });
  }

  async function renderLiveEvents(client, session) {
    const container = document.getElementById('live-library');
    if (!container) return;

    if (!session?.user) {
      container.innerHTML = '<div class="notice">請先登入並完成審核與訂閱。</div>';
      return;
    }

    const { data, error } = await client
      .from('live_events')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (error) {
      container.innerHTML = '<div class="notice">需要完成醫師審核並啟用訂閱後才能查看內容。</div>';
      return;
    }

    if (!data?.length) {
      container.innerHTML = '<div class="notice">目前尚無直播安排。</div>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'grid-3';
    const accessMap = {
      basic: '基礎',
      advanced: '進階',
      fellow: '專家',
    };
    data.forEach((event) => {
      const card = document.createElement('div');
      card.className = 'card';
      const date = new Date(event.scheduled_at).toLocaleString();
      card.innerHTML = `
        <div class="eyebrow">直播</div>
        <h3>${event.title}</h3>
        <p>時間：${date}</p>
        <p>權限：${accessMap[event.access_level] || '基礎'}</p>
        <button class="button" data-live-url="${event.ivs_playback_url}">進入直播</button>
      `;
      list.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(list);

    list.querySelectorAll('button[data-live-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.liveUrl;
        if (url) {
          window.open(url, '_blank', 'noopener');
        }
      });
    });
  }

  function openVideoPlayer(url, watermarkText) {
    let player = document.getElementById('video-player-modal');
    if (!player) {
      player = document.createElement('div');
      player.id = 'video-player-modal';
      player.className = 'auth-modal';
      player.innerHTML = `
        <div class="auth-modal-backdrop" data-video-close></div>
        <div class="video-player-panel">
          <div class="auth-modal-header">
            <div>
              <div class="eyebrow">安全播放</div>
              <h3>影片播放</h3>
            </div>
            <button class="icon-button" data-video-close>✕</button>
          </div>
          <div class="video-wrapper">
            <video id="secure-video" controls playsinline></video>
            <div class="video-watermark" id="video-watermark"></div>
          </div>
        </div>
      `;
      document.body.appendChild(player);
      player.querySelectorAll('[data-video-close]').forEach((btn) => {
        btn.addEventListener('click', () => player.classList.add('hidden'));
      });
    }
    const video = player.querySelector('#secure-video');
    const watermark = player.querySelector('#video-watermark');
    video.src = url;
    watermark.textContent = watermarkText;
    player.classList.remove('hidden');
  }

  function bindSubscribeButtons(client, session) {
    const buttons = document.querySelectorAll('[data-subscribe-plan]');
    if (!buttons.length) return;
    const message = document.querySelector('[data-subscribe-message]');

    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!session?.user) {
          showAuthModal();
          if (message) message.textContent = '請先登入後再訂閱。';
          return;
        }
        const plan = btn.dataset.subscribePlan || 'monthly';
        btn.disabled = true;
        const { data, error } = await client.functions.invoke('stripe-checkout', {
          body: { plan },
        });
        if (error || !data?.url) {
          if (message) message.textContent = '建立付款連結失敗，請稍後再試。';
          btn.disabled = false;
          return;
        }
        window.location.href = data.url;
      });
    });
  }

  async function bindReviewForm(client, session) {
    const form = document.getElementById('review-form');
    if (!form) return;

    if (!session?.user) {
      form.querySelector('button').disabled = true;
      form.querySelector('.form-message').textContent = '請先登入後再提交審核資料。';
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const payload = {
        full_name: data.get('full_name'),
        license_country: data.get('license_country'),
        license_number: data.get('license_number'),
        specialty: data.get('specialty'),
      };

      const { error: updateError } = await client
        .from('profiles')
        .update(payload)
        .eq('id', session.user.id);

      if (!updateError) {
        await client.from('review_requests').insert({
          user_id: session.user.id,
          notes: data.get('notes') || null,
        });
        form.querySelector('.form-message').textContent = '已提交審核，請等待郵件通知。';
      } else {
        form.querySelector('.form-message').textContent = '提交失敗，請稍後再試。';
      }
    });
  }

  loadSupabase(async () => {
    if (!window.supabase) return;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

    createAuthModal();
    ensureAuthButtons();
    bindAuthModalHandlers(client);
    bindAuthButtons(client);

    const sessionResponse = await client.auth.getSession();
    let session = sessionResponse.data.session;
    let profile = await loadProfile(client, session?.user);
    updateAuthUI(session, profile);
    renderVideoLibrary(client, session);
    renderLiveEvents(client, session);
    bindReviewForm(client, session);
    bindSubscribeButtons(client, session);

    client.auth.onAuthStateChange(async (_event, newSession) => {
      session = newSession;
      profile = await loadProfile(client, session?.user);
      updateAuthUI(session, profile);
      renderVideoLibrary(client, session);
      renderLiveEvents(client, session);
      bindReviewForm(client, session);
      bindSubscribeButtons(client, session);
    });
  });
})();
