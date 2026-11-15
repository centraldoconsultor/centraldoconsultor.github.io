/* Central do Consultor — "Avisos no celular" (web push) v1, 15/11/2026
   Coloca um botao flutuante na Caixa. Usa window.CentralAuth (Central) ou window.__ccDb (Caixa). */
(function () {
  if (!document.querySelector('link[rel="manifest"]')) {
    var l = document.createElement("link"); l.rel = "manifest"; l.href = "/caixa/manifest.webmanifest"; document.head.appendChild(l);
  }
  function F(nome, corpo) {
    if (window.CentralAuth) return window.CentralAuth.funcao(nome, corpo);
    if (window.__ccDb) return window.__ccDb.functions.invoke(nome, { body: corpo });
    return Promise.resolve({ error: { message: "Caixa ainda carregando, tente de novo" } });
  }
  var temSuporte = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  var instalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var reg = null;
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/caixa/sw.js", { scope: "/caixa/" }).then(function (r) { reg = r; atualizar(); }).catch(function () {});

  var css = document.createElement("style");
  css.textContent = "#ccAvisos{position:fixed;left:12px;bottom:84px;z-index:9999;font:600 14px/1.2 system-ui,-apple-system,sans-serif;border:0;border-radius:22px;padding:11px 16px;background:#0e2a52;color:#f4efe3;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer}" +
    "#ccAvisos.ok{background:#1e6b4f}#ccAvisosBox{position:fixed;inset:auto 12px 70px 12px;max-width:420px;margin-left:auto;z-index:9999;background:#fff;color:#111;border-radius:14px;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);font:15px/1.45 system-ui,-apple-system,sans-serif}" +
    "#ccAvisosBox b{display:block;margin-bottom:6px}#ccAvisosBox button{margin-top:10px;margin-right:6px;border:0;border-radius:10px;padding:9px 14px;font-weight:700;background:#0e2a52;color:#fff}#ccAvisosBox button.sec{background:#e9e4d8;color:#0e1f3d}" +
    "@media (prefers-color-scheme:dark){#ccAvisosBox{background:#1f2a33;color:#e9edef}}";
  document.head.appendChild(css);
  var bt = document.createElement("button"); bt.id = "ccAvisos"; bt.type = "button";
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(bt); });
  if (document.body) document.body.appendChild(bt);

  function caixa(html, botoes) {
    fechar(); var b = document.createElement("div"); b.id = "ccAvisosBox"; b.innerHTML = html;
    (botoes || [["Fechar", fechar, true]]).forEach(function (x) { var k = document.createElement("button"); k.textContent = x[0]; if (x[2]) k.className = "sec"; k.onclick = x[1]; b.appendChild(k); });
    document.body.appendChild(b);
  }
  function fechar() { var b = document.getElementById("ccAvisosBox"); if (b) b.remove(); }
  function b64(s) { var p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }

  async function atualizar() {
    var on = false;
    try { if (reg && Notification.permission === "granted") on = !!(await reg.pushManager.getSubscription()); } catch (e) {}
    bt.textContent = on ? "🔔 Avisos ligados" : "🔔 Ativar avisos";
    bt.className = on ? "ok" : ""; bt.style.display = on ? "none" : "";
    bt.onclick = on ? menuLigado : ativar;
  }

  async function ativar() {
    if (ios && !instalado) {
      return caixa("<b>Primeiro, coloque a Caixa na tela de início</b>No iPhone, os avisos só funcionam assim:<br>1. Toque em <b>Compartilhar</b> (o quadrado com a seta) no Safari.<br>2. Toque em <b>Adicionar à Tela de Início</b>.<br>3. Abra a Caixa pelo ícone novo e toque em <b>Ativar avisos</b> de novo.");
    }
    if (!temSuporte) return caixa("<b>Este navegador não recebe avisos</b>Use o Chrome no Android/computador ou a Caixa instalada na tela de início do iPhone.");
    try {
      var perm = await Notification.requestPermission();
      if (perm !== "granted") return caixa("<b>Avisos bloqueados</b>Para liberar: Ajustes do celular › Notificações › Caixa (ou nas configurações do site no navegador), e tente de novo.");
      reg = reg || await navigator.serviceWorker.register("/caixa/sw.js", { scope: "/caixa/" });
      await navigator.serviceWorker.ready;
      var r = await F("push", { acao: "chave" });
      if (r.error || !r.data || !r.data.publica) throw new Error("não consegui falar com o servidor (está logado?)");
      var sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(r.data.publica) });
      var s = await F("push", { acao: "inscrever", inscricao: sub.toJSON(), aparelho: navigator.userAgent.slice(0, 200) });
      if (s.error || (s.data && s.data.erro)) throw new Error((s.data && s.data.erro) || "não consegui salvar este aparelho");
      await F("push", { acao: "teste" });
      caixa("<b>Pronto, avisos ligados !</b>Deve chegar agora um aviso de teste. A partir de agora, quando a IA passar uma conversa para você, o aviso aparece no celular.");
    } catch (e) { caixa("<b>Não deu certo</b>" + String(e.message || e)); }
    atualizar();
  }

  function menuLigado() {
    caixa("<b>Avisos ligados neste aparelho</b>Você recebe um aviso sempre que a IA passar uma conversa para você.", [
      ["Enviar teste", async function () { fechar(); await F("push", { acao: "teste" }); }],
      ["Desligar", async function () { fechar(); try { var sub = await reg.pushManager.getSubscription(); if (sub) { await F("push", { acao: "sair", endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) {} atualizar(); }, true],
      ["Fechar", fechar, true]
    ]);
  }
  atualizar();
})();
