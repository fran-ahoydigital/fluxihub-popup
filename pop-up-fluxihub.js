<script>
(function () {
  // ============ CONFIG ============
  const allowedSubaccounts = [
    // Use o mesmo padrão do seu loader:
    "BwlFocgXnnnLA0BwKIiO", // FluxiHub
    // ...adicione/remova conforme necessário
  ];

  // (Opcional) Fallback por host/path quando a página é pública e não tem /v2/location/
  const allowedHosts = [
    // "seu-dominio.com",
    "app.fluxihub.co"
  ];
  const allowedPathPrefixes = [
    "/v2/preview" // sua página está nesse prefixo
  ];

  // Comportamento do pop-up
  const TRIGGER = "delay";        // "delay" | "exit" | "both"
  const DELAY_MS = 1500;          // atraso para abrir no modo "delay"
  const storageKey = "popup_iframe_shown_v1"; // controla frequência
  const showAgainAfterHours = 12; // 0 = só uma vez por navegador (até limpar storage)
  const perSessionOnly = false;   // true = sessionStorage (fecha a aba = esquece)

  // Conteúdo (sua página dentro do iframe)
  const IFRAME_URL = "https://app.fluxihub.co/v2/preview/vxg41g1r23a8VLPi4914?notrack=true";

  // Diagnóstico (mostra um badge discreto com status)
  const DEBUG = false;

  // ============ UTIL ============
  const getSubaccountId = () => {
    // Igual ao seu script que já funciona
    const match = window.location.pathname.match(/\/v2\/location\/([^\/]+)/);
    return match ? match[1] : null;
  };

  function hostPass() {
    if (!allowedHosts.length) return true;
    const host = location.hostname.toLowerCase().replace(/^www\./, "");
    const hostOk = allowedHosts.some(h => {
      const hh = h.toLowerCase().replace(/^www\./, "");
      return host === hh || host.endsWith("." + hh);
    });
    if (!hostOk) return false;
    if (!allowedPathPrefixes.length) return true;
    return allowedPathPrefixes.some(p => location.pathname.startsWith(p));
  }

  function nowSec() { return Math.floor(Date.now() / 1000); }
  function alreadyShown() {
    const store = perSessionOnly ? sessionStorage : localStorage;
    const raw = store.getItem(storageKey);
    if (!raw) return false;
    try {
      const { ts } = JSON.parse(raw) || {};
      if (!ts) return false;
      if (showAgainAfterHours <= 0) return true;
      return (nowSec() - ts) < showAgainAfterHours * 3600;
    } catch { return false; }
  }
  function markShown() {
    const store = perSessionOnly ? sessionStorage : localStorage;
    store.setItem(storageKey, JSON.stringify({ ts: nowSec() }));
  }

  function debug(msg) {
    if (!DEBUG) return;
    let el = document.getElementById("ghl_debug_pop");
    if (!el) {
      el = document.createElement("div");
      el.id = "ghl_debug_pop";
      el.style.cssText = "position:fixed;right:8px;bottom:8px;background:#111;color:#fff;padding:6px 8px;border-radius:6px;font:12px system-ui;z-index:99999999;opacity:.9";
      document.body.appendChild(el);
    }
    el.innerHTML = (el.innerHTML ? el.innerHTML + "<br>" : "") + msg;
  }

  // Evita abrir mais de uma vez simultaneamente
  let popupOpen = false;

  // ============ POPUP ============
  function openPopup() {
    if (popupOpen) return;
    popupOpen = true;

    const html = `
      <div id="gl_popup_backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:999999;">
        <div style="position:relative;background:#fff;padding:0;border-radius:12px;max-width:1000px;width:95%;height:90%;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.3);">
          <iframe src="${IFRAME_URL}" style="border:0;width:100%;height:100%;" allowfullscreen loading="lazy"></iframe>
          <button id="gl_popup_close" aria-label="Fechar" style="position:absolute;top:8px;right:10px;border:0;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.15)">✖</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", html);

    const bd = document.getElementById("gl_popup_backdrop");
    const btn = document.getElementById("gl_popup_close");
    const close = () => { bd && bd.remove(); markShown(); popupOpen = false; };

    btn.onclick = close;
    bd.onclick  = (e) => { if (e.target === bd) close(); };

    debug("✅ Pop-up aberto");
  }

  function setupExitIntent() {
    let armed = true;
    function onOut(e) {
      if (!armed) return;
      if (e.clientY <= 0) {
        armed = false;
        openPopup();
        document.removeEventListener("mouseout", onOut);
      }
    }
    document.addEventListener("mouseout", onOut);
  }

  function triggerPopup() {
    if (TRIGGER === "delay" || TRIGGER === "both") {
      setTimeout(openPopup, DELAY_MS);
    }
    if (TRIGGER === "exit" || TRIGGER === "both") {
      setupExitIntent();
    }
  }

  // ============ GATE (igual ao seu estilo) ============
  function canShowHere() {
    const subId = getSubaccountId();
    const bySub = subId && allowedSubaccounts.includes(subId);
    const byHost = hostPass();
    debug(`🌐 host=${location.hostname} path=${location.pathname}`);
    debug(`🏷 subId=${subId || "none"} | bySub=${!!bySub} | byHost=${!!byHost}`);
    // Regras:
    // - Se estiver em uma tela de app com /v2/location/{id}, validamos por subconta.
    // - Se não estiver (página pública), usamos host/path.
    return subId ? bySub : byHost;
  }

  function bootOnce() {
    if (!canShowHere()) { debug("⛔ Bloqueado por filtros"); return; }
    if (alreadyShown()) { debug("⛔ Já exibido recentemente"); return; }
    triggerPopup();
  }

  // Roda quando o DOM carrega
  document.addEventListener("DOMContentLoaded", bootOnce);

  // E monitora mudanças de rota (como no seu loader)
  let lastSub = null;
  setInterval(() => {
    const curr = getSubaccountId() || (location.hostname + location.pathname);
    if (curr !== lastSub) {
      lastSub = curr;
      // Reseta flag para permitir reavaliação ao trocar de subconta/rota
      if (!alreadyShown()) bootOnce();
      debug("🔁 Rota/subconta mudou, rechecando…");
    }
  }, 1000);

})();
</script>