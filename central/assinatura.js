/* Central do Consultor: aviso de teste grátis, mensalidade pendente e bloqueio por atraso (v2, 16/11/2026: aviso do teste só nos últimos 9 dias + link Minha assinatura)
   Uso: CentralAssinatura.verificar(function (nome, args) { return clienteSupabase.rpc(nome, args); }) */
(function () {
  var SUPORTE = "mailto:dilima17@icloud.com?subject=Central%20do%20Consultor%20-%20pagamento";
  function hojeSP() { var p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); return new Date(p + "T00:00:00"); }
  function diasAte(d) { return d ? Math.round((new Date(d + "T00:00:00") - hojeSP()) / 86400000) : null; }
  function br(d) { return d ? d.split("-").reverse().join("/") : ""; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function linkPag(a) { return a.link_pagamento && /^https:\/\//.test(a.link_pagamento) ? a.link_pagamento : ""; }

  var CSS = ".cc-ass-faixa{position:sticky;top:0;z-index:150;display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:10px 16px;font:500 14px/1.4 'Figtree','Segoe UI',system-ui,sans-serif;border-bottom:2px solid #b08a3e;background:#0e2a52;color:#f4efe3}" +
    ".cc-ass-faixa.alerta{background:#7a2a20;border-color:#f0b9b0}" +
    ".cc-ass-faixa b{font-weight:700}.cc-ass-faixa a.btn{background:#d9bf85;color:#0e1f3d;text-decoration:none;font-weight:700;padding:6px 12px;border-radius:8px}" +
    ".cc-ass-faixa button{margin-left:auto;background:none;border:0;color:inherit;font-size:20px;line-height:1;cursor:pointer;padding:2px 6px}" +
    ".cc-ass-bloq{position:fixed;inset:0;z-index:400;background:rgba(10,20,38,.96);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;font:15px/1.55 'Figtree','Segoe UI',system-ui,sans-serif}" +
    ".cc-ass-bloq .box{width:100%;max-width:420px;background:#fffdf8;color:#0e1f3d;border-top:4px solid #b08a3e;border-radius:16px;padding:26px;display:flex;flex-direction:column;gap:12px}" +
    ".cc-ass-bloq h2{font:700 1.3rem 'Sora','Segoe UI',system-ui,sans-serif;margin:0}.cc-ass-bloq p{margin:0;color:#5d6579}" +
    ".cc-ass-bloq .mk{width:46px;height:46px;border-radius:50%;background:#0e2a52;color:#d9bf85;display:grid;place-items:center;font:700 15px 'Sora',system-ui,sans-serif}" +
    ".cc-ass-bloq a.btn{display:block;text-align:center;background:#0e2a52;color:#f4efe3;text-decoration:none;font-weight:700;padding:13px;border-radius:10px}" +
    ".cc-ass-bloq a.sec{color:#0e1f3d;font-size:.9rem;text-align:center}";

  function estilo() { if (document.getElementById("cc-ass-css")) return; var s = document.createElement("style"); s.id = "cc-ass-css"; s.textContent = CSS; document.head.appendChild(s); }

  function faixa(html, alerta, chave) {
    try { if (chave && sessionStorage.getItem(chave) === "1") return; } catch (e) {}
    estilo();
    var d = document.createElement("div"); d.className = "cc-ass-faixa" + (alerta ? " alerta" : ""); d.setAttribute("role", "status");
    d.innerHTML = html + '<button type="button" aria-label="Fechar aviso">×</button>';
    d.querySelector("button").onclick = function () { d.remove(); try { if (chave) sessionStorage.setItem(chave, "1"); } catch (e) {} };
    document.body.insertBefore(d, document.body.firstChild);
  }

  function bloquear(a) {
    estilo();
    var link = linkPag(a);
    var d = document.createElement("div"); d.className = "cc-ass-bloq"; d.setAttribute("role", "alertdialog"); d.setAttribute("aria-modal", "true");
    var cancel = a.status === "cancelado";
    d.innerHTML = '<div class="box"><span class="mk">CC</span>' +
      "<h2>" + (cancel ? "Assinatura encerrada" : "Pagamento pendente") + "</h2>" +
      "<p>" + (cancel
        ? "Sua assinatura da Central do Consultor foi cancelada. Seus dados continuam guardados. Para voltar a usar, fale com o suporte."
        : "O acesso à Central está pausado porque a mensalidade" + (a.proximo_vencimento ? " que venceu em <b>" + esc(br(a.proximo_vencimento)) + "</b>" : "") + " ainda não foi paga. Seus dados continuam guardados. Assim que o pagamento for confirmado, o acesso volta sozinho.") + "</p>" +
      (link && !cancel ? '<a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">Pagar agora (Pix ou cartão)</a>' : "") +
      '<a class="' + (link && !cancel ? "sec" : "btn") + '" href="' + SUPORTE + '">Falar com o suporte</a>' +
      '<a class="sec" href="#" data-sair>Sair</a></div>';
    d.querySelector("[data-sair]").onclick = function (e) { e.preventDefault(); if (window.CentralAuth && CentralAuth.sair) CentralAuth.sair(); else if (window.__ccSair) window.__ccSair(); };
    document.body.appendChild(d);
    document.documentElement.style.overflow = "hidden";
  }

  async function verificar(rpc) {
    var r; try { r = await rpc("minha_assinatura"); } catch (e) { return null; }
    var a = r && r.data; if (!a || !a.status) return null;
    var venc = diasAte(a.proximo_vencimento), link = linkPag(a);
    var pagar = link ? ' <a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">Ver pagamento</a>' : ' <a class="btn" href="/central/minha-assinatura/">Minha assinatura</a>';
    if (a.status === "bloqueado" || (a.status === "cancelado" && (venc === null || venc < 0))) { bloquear(a); return a; }
    if (a.status === "atrasado" || (a.status === "teste" && venc !== null && venc < 0) || (a.status === "ativo" && venc !== null && venc < 0)) {
      var resta = venc === null ? 0 : Math.max(0, 3 + venc + 1);
      faixa("<span><b>Mensalidade pendente</b> desde " + esc(br(a.proximo_vencimento)) + ". " +
        (resta > 0 ? "O acesso será pausado em " + resta + (resta === 1 ? " dia" : " dias") + "." : "O acesso será pausado hoje.") + "</span>" +
        (link ? ' <a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">Pagar agora</a>' : ""), true, null);
      return a;
    }
    if (a.status === "teste") {
      var dt = diasAte(a.teste_ate || a.proximo_vencimento);
      if (dt !== null && dt > 9) return a; /* 16/11 (Diego): lembrete só perto do fim (turma de janeiro: só em janeiro) */
      var txt = dt === 0 ? "Seu teste grátis acaba <b>hoje</b>." : "Seu teste grátis acaba em <b>" + dt + (dt === 1 ? " dia" : " dias") + "</b> (" + esc(br(a.teste_ate || a.proximo_vencimento)) + ").";
      faixa("<span>" + txt + "</span>" + pagar, false, "cc-ass-teste-" + (a.teste_ate || ""));
      return a;
    }
    if (a.status === "ativo" && venc !== null && venc <= 2 && link) {
      faixa("<span>Sua mensalidade vence " + (venc === 0 ? "hoje" : "em " + venc + (venc === 1 ? " dia" : " dias")) + ".</span>" +
        ' <a class="btn" href="' + esc(link) + '" target="_blank" rel="noopener">Pagar agora</a>', false, "cc-ass-venc-" + a.proximo_vencimento);
    }
    return a;
  }

  window.CentralAssinatura = { verificar: verificar };
})();
