/* Central: toque no "CC" do topo abre "Meu perfil" (v1, 17/11/2026)
   Mostra nome, e-mail, plano, situação da assinatura e atalhos. Usa CentralAuth (central-db.js). */
(function () {
  var NOME = { essencial: "Essencial", plus: "Plus", prime: "Prime", ia: "Prime" };
  var ST = { teste: "Teste grátis", ativo: "Ativa", atrasado: "Pagamento pendente", bloqueado: "Pausada", cancelado: "Cancelada", cortesia: "Cortesia" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function br(d) { return d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—"; }
  var CSS = ".ccp-fundo{position:fixed;inset:0;z-index:300;background:rgba(10,20,38,.55);display:flex;align-items:flex-start;justify-content:flex-start}" +
    ".ccp{margin:calc(env(safe-area-inset-top,0px) + 70px) 0 0 12px;width:min(340px,calc(100vw - 24px));background:#fffdf8;color:#0e1f3d;border-radius:16px;border-top:4px solid #b08a3e;box-shadow:0 12px 40px rgba(0,0,0,.25);padding:18px;font:15px/1.5 'Figtree','Segoe UI',system-ui,sans-serif;max-height:calc(100vh - 100px);overflow:auto}" +
    ".ccp h3{margin:0;font:700 1.1rem 'Sora',system-ui,sans-serif}.ccp small{color:#5d6579}" +
    ".ccp .sel{display:inline-block;margin-top:6px;padding:2px 10px;border-radius:99px;background:#f3ead4;color:#7a5a1c;font-size:.8rem;font-weight:700}" +
    ".ccp .kv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.ccp .kv div{background:#f8f4ea;border-radius:10px;padding:8px 10px}.ccp .kv b{display:block;font-size:.95rem}.ccp .kv span{font-size:.75rem;color:#5d6579}" +
    ".ccp a.it,.ccp button.it{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:11px 10px;border:0;border-radius:10px;background:none;color:#0e1f3d;text-decoration:none;font:600 15px 'Figtree',system-ui,sans-serif;cursor:pointer}" +
    ".ccp a.it:hover,.ccp button.it:hover{background:#f3ead4}.ccp .sair{color:#8f2d22}";
  function estilo() { if (document.getElementById("ccp-css")) return; var s = document.createElement("style"); s.id = "ccp-css"; s.textContent = CSS; document.head.appendChild(s); }

  async function abrir() {
    estilo();
    var A = window.CentralAuth; if (!A) return;
    var f = document.createElement("div"); f.className = "ccp-fundo"; f.setAttribute("role", "dialog"); f.setAttribute("aria-label", "Meu perfil");
    f.innerHTML = '<div class="ccp"><small>Carregando…</small></div>';
    f.onclick = function (e) { if (e.target === f) f.remove(); };
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { f.remove(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(f);
    var email = "", nome = (document.getElementById("ccNome") || {}).textContent || "", a = {};
    try { var s = await A.sessao(); email = (s && (s.user ? s.user.email : s.email)) || ""; } catch (e) {}
    try { var r = await A.rpc("minha_assinatura"); a = (r && r.data) || {}; } catch (e) {}
    var plano = NOME[a.plano] || "—", st = ST[a.status] || "—";
    f.querySelector(".ccp").innerHTML =
      "<h3>" + esc(nome || "Meu perfil") + "</h3><small>" + esc(email) + "</small><br><span class=\"sel\">Plano " + esc(plano) + "</span>" +
      '<div class="kv"><div><span>Assinatura</span><b>' + esc(st) + "</b></div>" +
      (a.status === "cortesia" ? '<div><span>Mensalidade</span><b>Cortesia</b></div>' :
        '<div><span>' + (a.status === "teste" ? "Teste até" : "Vencimento") + "</span><b>" + br(a.status === "teste" ? (a.teste_ate || a.proximo_vencimento) : a.proximo_vencimento) + "</b></div>") + "</div>" +
      '<a class="it" href="/central/minha-assinatura/">💳 Minha assinatura</a>' +
      '<a class="it" href="#cotador" data-dados>🪪 Meus dados no Cotador</a>' +
      '<a class="it" href="/caixa/">💬 Caixa (WhatsApp)</a>' +
      '<button class="it" type="button" data-passos>🚀 Primeiros passos</button>' +
      '<a class="it" href="mailto:central.consultor@outlook.com?subject=Central%20do%20Consultor%20-%20suporte">🛟 Falar com o suporte</a>' +
      '<button class="it sair" type="button" data-sair>Sair</button>';
    f.querySelector("[data-sair]").onclick = function () { A.sair(); };
    [].forEach.call(f.querySelectorAll("a.it"), function (l) { l.addEventListener("click", function () { setTimeout(function () { f.remove(); }, 50); }); });
    f.querySelector("[data-passos]").onclick = function () { f.remove(); var b = document.getElementById("ppBtn"); if (b) { b.hidden = false; b.click(); } };
  }

  function ligar() {
    var cc = document.querySelector("header .brand .mark") || document.querySelector(".brand .mark");
    if (!cc || cc.__ccp) return !!cc;
    cc.__ccp = true; cc.style.cursor = "pointer"; cc.setAttribute("role", "button"); cc.setAttribute("tabindex", "0"); cc.setAttribute("aria-label", "Abrir meu perfil");
    cc.addEventListener("click", abrir);
    cc.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } });
    return true;
  }
  if (!ligar()) document.addEventListener("DOMContentLoaded", ligar);
  window.CentralPerfil = { abrir: abrir };
})();
