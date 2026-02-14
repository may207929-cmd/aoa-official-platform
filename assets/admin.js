(function () {
  const STORAGE_KEY = "aoa_admin_dashboard_draft_v2";
  const EMAIL_CACHE_KEY = "aoa_admin_last_email";
  const CONTENT_KEY = "homepage";
  const ADMIN_FUNCTION_NAME = "content-admin";

  const SUPABASE_URL = "https://hudhglmitjwikhnfvckh.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_W5VlRx_aOwNw1x3oT9W6Fg_vKpxS8tl";

  const DEFAULT_DATA = {
    site: {
      name: "亞洲眼整形醫師聯盟培訓機構",
      tagline: "國際眼整形醫學教育平台",
      topline: "學術教育 · 醫師資格審核 · 合規管理"
    },
    hero: {
      label: "國際級眼整形醫學教育平台",
      title: "建立可信任的眼整形教育體系",
      description: "面向全球整形外科與眼科醫師，提供修復手術培訓、臨床策略與標準化教學。",
      primaryCta: "查看課程",
      secondaryCta: "會員申請"
    },
    stats: [
      { value: "500+", label: "手術影片" },
      { value: "2000+", label: "註冊會員" },
      { value: "50歲以上", label: "臨床專家" },
      { value: "15年以上", label: "國際教學經驗" }
    ],
    events: [
      { date: "2026 / 03 / 15", title: "眼整形修復策略研討會（線上）" },
      { date: "2026 / 04 / 10", title: "高難度併發症處理專題" },
      { date: "2026 / 05 / 05", title: "國際專家手術觀摩直播" }
    ],
    faculty: {
      name: "潘貳 博士",
      role: "核心講師",
      credential: "副主任醫師｜南方醫科大學整形外科學博士",
      org: "廣州研媄薈醫療美容門診部"
    }
  };

  let state = loadLocalDraft();
  let supabaseClient = null;
  let currentUser = null;
  let isAdmin = false;
  let revisions = [];

  const form = document.getElementById("editorForm");
  const statusMessage = document.getElementById("statusMessage");
  const statsEditor = document.getElementById("statsEditor");
  const eventsEditor = document.getElementById("eventsEditor");
  const previewCanvas = document.getElementById("previewCanvas");
  const authStatus = document.getElementById("authStatus");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const lockOverlay = document.getElementById("lockOverlay");

  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");

  const remoteMeta = document.getElementById("remoteMeta");
  const revisionSelect = document.getElementById("revisionSelect");

  const loadRemoteBtn = document.getElementById("loadRemoteBtn");
  const saveRemoteDraftBtn = document.getElementById("saveRemoteDraftBtn");
  const publishBtn = document.getElementById("publishBtn");
  const rollbackBtn = document.getElementById("rollbackBtn");
  const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importInput = document.getElementById("importInput");

  bindModuleNav();
  buildInlineEditors();
  fillFormFromState();
  fillLoginEmail();
  renderPreview();
  bindEvents();
  setEditorLock(true, "請先以管理員身分登入");
  initSupabase();

  function bindEvents() {
    form.addEventListener("input", handleFormInput);
    loginForm.addEventListener("submit", loginWithPassword);
    logoutBtn.addEventListener("click", logout);

    loadRemoteBtn.addEventListener("click", loadRemoteDraft);
    saveRemoteDraftBtn.addEventListener("click", saveCloudDraft);
    publishBtn.addEventListener("click", publishContent);
    rollbackBtn.addEventListener("click", rollbackToRevision);
    refreshHistoryBtn.addEventListener("click", refreshRevisionHistory);

    saveDraftBtn.addEventListener("click", saveLocalDraft);
    resetBtn.addEventListener("click", resetData);
    exportBtn.addEventListener("click", exportJson);
    importInput.addEventListener("change", importJson);

    emailInput.addEventListener("change", cacheLoginEmail);
    emailInput.addEventListener("blur", cacheLoginEmail);
  }

  function bindModuleNav() {
    const links = Array.from(document.querySelectorAll(".module-link"));
    const sections = Array.from(document.querySelectorAll(".editor-section"));

    links.forEach((link) => {
      link.addEventListener("click", () => {
        const target = link.dataset.target;
        links.forEach((node) => node.classList.toggle("active", node === link));
        sections.forEach((section) => section.classList.toggle("hidden", section.dataset.section !== target));
      });
    });
  }

  async function initSupabase() {
    try {
      setStatus("載入 Supabase 中...");
      await loadSupabaseScript();
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      const { data } = await supabaseClient.auth.getSession();
      await applySession(data?.session || null);

      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await applySession(session);
      });
    } catch (_error) {
      setStatus("Supabase 初始化失敗，請檢查網路或金鑰");
      setEditorLock(true, "無法連線 Supabase");
    }
  }

  async function applySession(session) {
    currentUser = session?.user || null;
    isAdmin = false;

    if (!currentUser) {
      authStatus.textContent = "尚未登入";
      loginForm.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      setEditorLock(true, "請先以管理員身分登入");
      setStatus("請登入管理員帳號");
      return;
    }

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error) {
      authStatus.textContent = `${currentUser.email}（無法讀取角色）`;
      setEditorLock(true, "無法驗證權限");
      setStatus("讀取角色失敗，請檢查 profiles 權限");
      return;
    }

    isAdmin = profile?.role === "admin";
    authStatus.textContent = `${currentUser.email} · ${isAdmin ? "admin" : "non-admin"}`;
    loginForm.classList.add("hidden");
    logoutBtn.classList.remove("hidden");

    if (!isAdmin) {
      setEditorLock(true, "你的帳號不是管理員");
      setStatus("非管理員帳號，僅可預覽");
      return;
    }

    setEditorLock(false, "");
    setStatus("管理員登入成功，正在載入雲端草稿...");
    await loadRemoteDraft();
  }

  async function loginWithPassword(event) {
    event.preventDefault();
    if (!supabaseClient) {
      setStatus("Supabase 尚未就緒");
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setStatus("請輸入帳號與密碼");
      return;
    }

    cacheLoginEmail();
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus("密碼登入失敗，請檢查帳密");
      return;
    }

    passwordInput.value = "";
    setStatus("登入成功，正在驗證權限...");
  }

  async function logout() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    setStatus("已登出");
    remoteMeta.textContent = "尚未讀取雲端狀態";
    revisionSelect.innerHTML = "";
  }

  async function loadRemoteDraft() {
    if (!requireAdmin()) return;
    const response = await callAdminFunction("load");
    if (!response) return;

    if (response.payloadDraft) {
      state = mergeWithDefault(response.payloadDraft);
      fillFormFromState();
      buildInlineEditors();
      renderPreview();
    }

    revisions = Array.isArray(response.revisions) ? response.revisions : [];
    renderRevisionOptions(revisions);
    renderRemoteMeta(response);
    setStatus("已載入雲端草稿");
  }

  async function saveCloudDraft() {
    if (!requireAdmin()) return;
    const response = await callAdminFunction("save_draft", { payload: state });
    if (!response) return;
    revisions = Array.isArray(response.revisions) ? response.revisions : revisions;
    renderRevisionOptions(revisions);
    renderRemoteMeta(response);
    setStatus("雲端草稿已儲存");
  }

  async function publishContent() {
    if (!requireAdmin()) return;
    const response = await callAdminFunction("publish", { note: "Manual publish from admin dashboard" });
    if (!response) return;
    revisions = Array.isArray(response.revisions) ? response.revisions : revisions;
    renderRevisionOptions(revisions);
    renderRemoteMeta(response);
    setStatus("已發布到網站");
  }

  async function rollbackToRevision() {
    if (!requireAdmin()) return;
    const revisionNo = Number(revisionSelect.value);
    if (Number.isNaN(revisionNo)) {
      setStatus("請先選擇要回滾的版本");
      return;
    }

    const response = await callAdminFunction("rollback", {
      targetRevision: revisionNo,
      note: `Rollback to revision ${revisionNo}`
    });
    if (!response) return;

    if (response.payloadDraft) {
      state = mergeWithDefault(response.payloadDraft);
      fillFormFromState();
      buildInlineEditors();
      renderPreview();
    }

    revisions = Array.isArray(response.revisions) ? response.revisions : revisions;
    renderRevisionOptions(revisions);
    renderRemoteMeta(response);
    setStatus(`已回滾並發布（來源版本 #${revisionNo}）`);
  }

  async function refreshRevisionHistory() {
    if (!requireAdmin()) return;
    const response = await callAdminFunction("history");
    if (!response) return;
    revisions = Array.isArray(response.revisions) ? response.revisions : [];
    renderRevisionOptions(revisions);
    setStatus("版本列表已刷新");
  }

  async function callAdminFunction(action, extraBody) {
    if (!supabaseClient) {
      setStatus("Supabase 尚未就緒");
      return null;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      setStatus("會話已過期，請重新登入");
      return null;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${ADMIN_FUNCTION_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ action, key: CONTENT_KEY, ...(extraBody || {}) })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || `雲端操作失敗 (${response.status})`;
        setStatus(message);
        return null;
      }
      return payload;
    } catch (_error) {
      setStatus("無法連線 Edge Function，請確認已部署 content-admin");
      return null;
    }
  }

  function renderRemoteMeta(data) {
    const publishedRevision = data?.publishedRevision ?? "-";
    const currentRevision = data?.currentRevision ?? "-";
    const publishedAt = data?.publishedAt ? new Date(data.publishedAt).toLocaleString("zh-Hant") : "尚未發布";
    remoteMeta.textContent = `當前版本 #${currentRevision} ｜ 已發布 #${publishedRevision} ｜ 發布時間：${publishedAt}`;
  }

  function renderRevisionOptions(items) {
    revisionSelect.innerHTML = "";
    if (!items.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "無可用版本";
      revisionSelect.appendChild(option);
      return;
    }

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = String(item.revision_no);
      const date = item.created_at ? new Date(item.created_at).toLocaleString("zh-Hant") : "";
      option.textContent = `#${item.revision_no} ${item.action} ${date}`;
      revisionSelect.appendChild(option);
    });
  }

  function requireAdmin() {
    if (!supabaseClient) {
      setStatus("Supabase 尚未就緒");
      return false;
    }
    if (!currentUser) {
      setStatus("請先登入管理員帳號");
      return false;
    }
    if (!isAdmin) {
      setStatus("你沒有管理員權限");
      return false;
    }
    return true;
  }

  function setEditorLock(locked, message) {
    lockOverlay.classList.toggle("hidden", !locked);
    if (message) lockOverlay.textContent = message;

    const editableEls = document.querySelectorAll(
      "#editorForm input, #editorForm textarea, .module-link, #loadRemoteBtn, #saveRemoteDraftBtn, #publishBtn, #rollbackBtn, #refreshHistoryBtn, #revisionSelect, #saveDraftBtn, #resetBtn, #exportBtn, #importInput"
    );
    editableEls.forEach((node) => {
      node.disabled = locked;
    });

    importInput.parentElement.classList.toggle("disabled", locked);
  }

  function buildInlineEditors() {
    statsEditor.innerHTML = "";
    state.stats.forEach((item, index) => {
      const block = document.createElement("div");
      block.className = "inline-card";
      block.innerHTML = `
        <h3>數據 ${index + 1}</h3>
        <label>數值
          <input type="text" data-array="stats" data-index="${index}" data-key="value" value="${escapeHtml(item.value)}" />
        </label>
        <label>說明
          <input type="text" data-array="stats" data-index="${index}" data-key="label" value="${escapeHtml(item.label)}" />
        </label>
      `;
      statsEditor.appendChild(block);
    });

    eventsEditor.innerHTML = "";
    state.events.forEach((item, index) => {
      const block = document.createElement("div");
      block.className = "inline-card";
      block.innerHTML = `
        <h3>活動 ${index + 1}</h3>
        <label>日期
          <input type="text" data-array="events" data-index="${index}" data-key="date" value="${escapeHtml(item.date)}" />
        </label>
        <label>標題
          <input type="text" data-array="events" data-index="${index}" data-key="title" value="${escapeHtml(item.title)}" />
        </label>
      `;
      eventsEditor.appendChild(block);
    });
  }

  function fillFormFromState() {
    for (const input of form.querySelectorAll("input[name], textarea[name]")) {
      const value = getByPath(state, input.name);
      if (typeof value === "string") input.value = value;
    }
  }

  function handleFormInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    if (target.dataset.array) {
      const listName = target.dataset.array;
      const index = Number(target.dataset.index);
      const key = target.dataset.key;
      if (!Array.isArray(state[listName]) || Number.isNaN(index) || !key) return;
      state[listName][index][key] = target.value.trim();
    } else if (target.name) {
      setByPath(state, target.name, target.value.trim());
    }

    renderPreview();
    setStatus("有未儲存變更");
  }

  function renderPreview() {
    previewCanvas.innerHTML = `
      <section class="preview-hero">
        <span class="preview-chip">${escapeHtml(state.hero.label)}</span>
        <h3>${escapeHtml(state.hero.title)}</h3>
        <p>${escapeHtml(state.hero.description)}</p>
        <div class="preview-cta">
          <span class="preview-btn primary">${escapeHtml(state.hero.primaryCta)}</span>
          <span class="preview-btn">${escapeHtml(state.hero.secondaryCta)}</span>
        </div>
      </section>

      <section class="preview-stats">
        ${state.stats
          .map(
            (item) => `
          <article class="preview-item">
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </article>
        `
          )
          .join("")}
      </section>

      <section class="preview-events">
        <h3>近期重點</h3>
        <ul class="preview-list">
          ${state.events
            .map(
              (item) => `
            <li><span>${escapeHtml(item.date)}</span><strong>${escapeHtml(item.title)}</strong></li>
          `
            )
            .join("")}
        </ul>
      </section>

      <section class="preview-faculty">
        <h3>${escapeHtml(state.faculty.name)}</h3>
        <p>${escapeHtml(state.faculty.role)}</p>
        <p>${escapeHtml(state.faculty.credential)}</p>
        <p>${escapeHtml(state.faculty.org)}</p>
      </section>
    `;
  }

  function loadLocalDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefault();
      return mergeWithDefault(JSON.parse(raw));
    } catch (_error) {
      return cloneDefault();
    }
  }

  function saveLocalDraft() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus("本地草稿已儲存");
  }

  function resetData() {
    state = cloneDefault();
    fillFormFromState();
    buildInlineEditors();
    renderPreview();
    localStorage.removeItem(STORAGE_KEY);
    setStatus("已重設為預設內容");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aoa-homepage-content.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("已匯出 JSON");
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      state = mergeWithDefault(parsed);
      fillFormFromState();
      buildInlineEditors();
      renderPreview();
      setStatus("匯入完成，記得儲存雲端草稿");
    } catch (_error) {
      setStatus("匯入失敗，請確認 JSON 格式");
    } finally {
      event.target.value = "";
    }
  }

  function setStatus(message) {
    statusMessage.textContent = message;
  }

  function fillLoginEmail() {
    const cached = localStorage.getItem(EMAIL_CACHE_KEY);
    if (cached) emailInput.value = cached;
  }

  function cacheLoginEmail() {
    const email = emailInput.value.trim();
    if (email) localStorage.setItem(EMAIL_CACHE_KEY, email);
  }

  function getByPath(target, path) {
    return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), target);
  }

  function setByPath(target, path, value) {
    const keys = path.split(".");
    let cursor = target;
    for (let i = 0; i < keys.length - 1; i += 1) {
      if (!cursor[keys[i]] || typeof cursor[keys[i]] !== "object") cursor[keys[i]] = {};
      cursor = cursor[keys[i]];
    }
    cursor[keys[keys.length - 1]] = value;
  }

  function mergeWithDefault(candidate) {
    const merged = cloneDefault();
    if (!candidate || typeof candidate !== "object") return merged;

    if (candidate.site && typeof candidate.site === "object") merged.site = { ...merged.site, ...candidate.site };
    if (candidate.hero && typeof candidate.hero === "object") merged.hero = { ...merged.hero, ...candidate.hero };
    if (candidate.faculty && typeof candidate.faculty === "object") merged.faculty = { ...merged.faculty, ...candidate.faculty };

    if (Array.isArray(candidate.stats)) {
      merged.stats = merged.stats.map((item, index) => ({ ...item, ...(candidate.stats[index] || {}) }));
    }
    if (Array.isArray(candidate.events)) {
      merged.events = merged.events.map((item, index) => ({ ...item, ...(candidate.events[index] || {}) }));
    }

    return merged;
  }

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (window.supabase) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.5/dist/umd/supabase.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load supabase script"));
      document.head.appendChild(script);
    });
  }
})();
