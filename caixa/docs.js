// Caixa · Conferir documentos (v1, 18/11/2026) — SOMENTE para o Diego (o servidor tambem recusa outros logins)
(function () {
  const DIEGO = "940d7b8d-9e51-4e60-a664-3a2c5b880338";
  const URL_CONF = "https://tqhrjivlfpexmhkwakwl.supabase.co/functions/v1/whatsapp-webhook?conferir=1";
  const $d = (id) => document.getElementById(id);
  const escD = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let ultimo = null;

  function souDiego() { try { const e = window.CXI && window.CXI.eu(); return !!e && e.id === DIEGO; } catch (e) { return false; } }
  function contatoAberto() { try { return window.CXI ? window.CXI.aberta() : null; } catch (e) { return null; } }

  setInterval(() => {
    const b = $d("bDocs"); if (!b) return;
    b.style.display = souDiego() ? "" : "none";
    const c = contatoAberto();
    if (c !== ultimo) { ultimo = c; const p = $d("cDocs"); if (p) p.innerHTML = ""; }
  }, 800);

  async function chamar(corpo) {
    const { data } = await window.CXI.db.auth.getSession();
    const r = await fetch(URL_CONF, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + (data?.session?.access_token ?? "") }, body: JSON.stringify(corpo) });
    return r.json();
  }

  function lista(titulo, itens, cor) {
    if (!itens || !itens.length) return "";
    return `<div style="margin-top:6px"><b style="color:${cor}">${titulo}</b><ul style="margin:4px 0 0 18px;padding:0">${itens.map((i) => `<li>${escD(i)}</li>`).join("")}</ul></div>`;
  }

  async function abrir() {
    const p = $d("cDocs"); const id = contatoAberto(); if (!p || !id) return;
    const { data: ct } = await window.CXI.db.from("contatos").select("documentacao").eq("id", id).maybeSingle();
    const d = ct?.documentacao ?? {};
    p.innerHTML = `<div class="resumo" style="font-size:14px">
      <b>📄 Conferir documentos</b>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;align-items:center">
        <label>Caso <select id="dCaso">
          ${["mei", "caepf", "inclusao", "migracao"].map((c) => `<option value="${c}" ${d.caso === c ? "selected" : ""}>${{ mei: "MEI (CNPJ)", caepf: "CAEPF", inclusao: "Inclusão", migracao: "Troca de plano" }[c]}</option>`).join("")}
        </select></label>
        <label>Vidas <input id="dVidas" type="number" min="1" max="20" value="${escD(d.vidas ?? 1)}" style="width:52px"></label>
        <label>Crianças <input id="dCri" type="number" min="0" max="20" value="${escD(d.criancas ?? 0)}" style="width:52px"></label>
        <label><input id="dConj" type="checkbox" ${d.conjuge ? "checked" : ""}> Esposa/marido</label>
        <button id="dIr" class="forte" type="button">Conferir agora</button>
        <button id="dZerar" type="button" title="Esquece a leitura anterior e lê todos os arquivos de novo">Ler tudo de novo</button>
      </div>
      <div id="dRes">${d.conferido_em ? resultado(d) : '<span style="color:#666">A IA lê as fotos e PDFs que o cliente mandou e diz o que falta.</span>'}</div>
    </div>`;
    const ir = async (reiniciar) => {
      $d("dRes").innerHTML = "Lendo os documentos… (pode levar até 1 minuto)";
      const corpo = { contato_id: id, caso: $d("dCaso").value, vidas: Number($d("dVidas").value || 1), criancas: Number($d("dCri").value || 0), conjuge: $d("dConj").checked, reiniciar: !!reiniciar };
      try { const r = await chamar(corpo); $d("dRes").innerHTML = r.erro ? `<span style="color:#b00">${escD(r.erro)}</span>` : resultado(r); }
      catch (e) { $d("dRes").innerHTML = `<span style="color:#b00">Erro: ${escD(e.message)}</span>`; }
    };
    $d("dIr").onclick = () => ir(false);
    $d("dZerar").onclick = () => ir(true);
  }

  function resultado(r) {
    const topo = r.completo ? '<div style="color:#0a7a2f;font-weight:700">✅ Documentação completa e conferida</div>'
      : '<div style="color:#b06b00;font-weight:700">⏳ Ainda falta documento</div>';
    return topo + lista("Recebidos", r.recebidos, "#0a7a2f") + lista("Faltando", r.pendentes, "#b06b00") + lista("Para mandar de novo", r.ilegiveis, "#b00")
      + (r.nao_lidos ? `<div style="color:#b00;margin-top:6px">${r.nao_lidos} arquivo(s) não foram lidos. Tente de novo em instantes.</div>` : "");
  }

  document.addEventListener("click", (e) => { if (e.target && e.target.id === "bDocs") abrir(); });
})();
