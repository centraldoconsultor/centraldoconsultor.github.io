/* Central do Consultor · central-db.js (v1, 14/11/2026)
   Substitui o window.claude do claude.ai: banco (colecao/documento) no Supabase,
   usuario logado, sugestao por IA (funcao ia-texto) e download de arquivos.
   As telas continuam chamando claude.use("db" | "user" | "sample" | "downloads"). */
(function () {
  "use strict";
  if (window.claude && window.claude.__central) return;
  var SB_URL = "https://tqhrjivlfpexmhkwakwl.supabase.co";
  var SB_KEY = "sb_publishable_vI455mCunOwgHkEaPra01w_05Ynugib";
  var LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

  var clienteP = null;
  function sb() {
    if (!clienteP) clienteP = import(LIB).then(function (m) { return m.createClient(SB_URL, SB_KEY); });
    return clienteP;
  }
  function erro(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function limpa(p) { return String(p || "").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/"); }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function novoId() {
    var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", s = "";
    var r = crypto.getRandomValues(new Uint8Array(20));
    for (var i = 0; i < 20; i++) s += a[r[i] % a.length];
    return s;
  }
  function campo(o, f) { var p = String(f).split("."), v = o; for (var i = 0; i < p.length; i++) { if (v == null) return undefined; v = v[p[i]]; } return v; }
  function ehObj(v) { return v && typeof v === "object" && !Array.isArray(v); }
  function mescla(a, b) {
    var o = ehObj(a) ? clone(a) : {};
    Object.keys(b || {}).forEach(function (k) { o[k] = ehObj(b[k]) && ehObj(o[k]) ? mescla(o[k], b[k]) : clone(b[k]); });
    return o;
  }
  function aplicaUpdate(a, b) {
    var o = ehObj(a) ? clone(a) : {};
    Object.keys(b || {}).forEach(function (k) {
      var p = k.split("."), alvo = o;
      for (var i = 0; i < p.length - 1; i++) { if (!ehObj(alvo[p[i]])) alvo[p[i]] = {}; alvo = alvo[p[i]]; }
      alvo[p[p.length - 1]] = clone(b[k]);
    });
    return o;
  }

  /* ---------- sessao e consultor ---------- */
  var EU = null, euP = null;
  async function sessao() { var c = await sb(); var r = await c.auth.getSession(); return (r.data && r.data.session) || null; }
  async function meuId() { var s = await sessao(); return s ? s.user.id : null; }
  function carregarEu() {
    if (!euP) euP = (async function () {
      var id = await meuId(); if (!id) return null;
      var c = await sb();
      var r = await c.from("consultores").select("*").eq("id", id).maybeSingle();
      EU = r.data || { id: id, papel: "consultor", plano: "essencial", nome: "" };
      return EU;
    })();
    return euP;
  }

  /* ---------- tempo real: uma assinatura, varios ouvintes por colecao ---------- */
  var ouvintes = {}, canal = null, filaRef = {};
  function avisar(col) {
    if (!ouvintes[col]) return;
    clearTimeout(filaRef[col]);
    filaRef[col] = setTimeout(function () { (ouvintes[col] || []).slice().forEach(function (f) { f(); }); }, 120);
  }
  async function ligarTempoReal() {
    if (canal) return; canal = "abrindo";
    var c = await sb(); if (!(await meuId())) { canal = null; return; }
    canal = c.channel("central-docs").on("postgres_changes", { event: "*", schema: "public", table: "docs" }, function (p) {
      var r = p.new && p.new.colecao ? p.new : p.old; if (r && r.colecao) avisar(r.colecao);
    }).subscribe();
  }
  function ouvir(col, f) {
    (ouvintes[col] = ouvintes[col] || []).push(f); ligarTempoReal();
    return function () { ouvintes[col] = (ouvintes[col] || []).filter(function (x) { return x !== f; }); };
  }

  /* ---------- leitura ---------- */
  async function lerColecao(col) {
    var c = await sb(), todos = [], de = 0;
    for (;;) {
      var r = await c.from("docs").select("doc_id,dados").eq("colecao", col).order("doc_id").range(de, de + 999);
      if (r.error) throw erro("unavailable", r.error.message);
      todos = todos.concat(r.data || []); if (!r.data || r.data.length < 1000) break; de += 1000;
    }
    return todos;
  }
  async function lerDoc(caminho) {
    var c = await sb();
    var r = await c.from("docs").select("dados").eq("caminho", caminho).maybeSingle();
    if (r.error && !/^propostas\//.test(caminho)) throw erro("unavailable", r.error.message);
    if (r.data) return r.data.dados;
    var m = /^propostas\/([a-z0-9]{8})$/.exec(caminho);
    if (m) { var x = await c.rpc("ler_proposta", { codigo: m[1] }); return x.data || null; }
    return null;
  }
  function snapDoc(id, dados, ref) {
    return { id: id, ref: ref, exists: dados != null, data: function () { return dados == null ? undefined : clone(dados); }, get: function (f) { return dados == null ? undefined : clone(campo(dados, f)); } };
  }
  function snapLista(docs) {
    return { docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, forEach: function (f) { docs.forEach(f); } };
  }

  /* ---------- escrita ---------- */
  async function gravar(caminho, dados) {
    var id = await meuId(); if (!id) throw erro("unauthenticated", "Entre com seu e-mail e senha para salvar.");
    var i = caminho.lastIndexOf("/"), col = caminho.slice(0, i), doc = caminho.slice(i + 1);
    var c = await sb();
    var r = await c.from("docs").upsert({ caminho: caminho, colecao: col, doc_id: doc, dono: id, dados: clone(dados) || {} }, { onConflict: "caminho" });
    if (r.error) throw erro(/row-level|permission/i.test(r.error.message) ? "permission-denied" : "unavailable", r.error.message);
    avisar(col);
  }

  /* ---------- referencias (mesma forma do banco do claude.ai) ---------- */
  function DocRef(caminho) {
    caminho = limpa(caminho);
    var i = caminho.lastIndexOf("/"), self = this;
    this.path = caminho; this.id = caminho.slice(i + 1); this.parentPath = caminho.slice(0, i);
    this.collection = function (p) { return new Consulta(caminho + "/" + limpa(p)); };
    this.get = async function () { return snapDoc(self.id, await lerDoc(caminho), self); };
    this.set = async function (d, op) {
      if (op && (op.merge || op.mergeFields)) { d = mescla(await lerDoc(caminho), d); }
      await gravar(caminho, d);
    };
    this.update = async function (d) {
      var atual = await lerDoc(caminho);
      if (atual == null) throw erro("not-found", "Documento não encontrado.");
      await gravar(caminho, aplicaUpdate(atual, d));
    };
    this.delete = async function () {
      var c = await sb(); var r = await c.from("docs").delete().eq("caminho", caminho);
      if (r.error) throw erro("permission-denied", r.error.message);
      avisar(self.parentPath);
    };
    this.onSnapshot = function (prox, falha) {
      var vivo = true;
      function rodar() { lerDoc(caminho).then(function (d) { if (vivo) prox(snapDoc(self.id, d, self)); }, function (e) { if (vivo && falha) falha(e); }); }
      rodar(); var parar = ouvir(self.parentPath, rodar);
      return function () { vivo = false; parar(); };
    };
  }
  function Consulta(col, filtros, ordem, max) {
    col = limpa(col); filtros = filtros || []; ordem = ordem || []; var self = this;
    this.path = col; this.id = col.slice(col.lastIndexOf("/") + 1);
    this.doc = function (id) { return new DocRef(col + "/" + (id ? limpa(id) : novoId())); };
    this.add = async function (d) { var r = new DocRef(col + "/" + novoId()); await r.set(d); return r; };
    this.where = function (f, op, v) { return new Consulta(col, filtros.concat([[f, op, v]]), ordem, max); };
    this.orderBy = function (f, dir) { return new Consulta(col, filtros, ordem.concat([[f, dir === "desc" ? -1 : 1]]), max); };
    this.limit = function (n) { return new Consulta(col, filtros, ordem, n); };
    function passa(o, w) {
      var a = campo(o, w[0]), b = w[2];
      switch (w[1]) {
        case "==": case "eq": return a === b; case "!=": case "ne": return a !== b;
        case "<": case "lt": return a < b; case "<=": case "lte": return a <= b;
        case ">": case "gt": return a > b; case ">=": case "gte": return a >= b;
        case "in": return (b || []).indexOf(a) >= 0; case "not-in": return (b || []).indexOf(a) < 0;
        case "array-contains": return Array.isArray(a) && a.indexOf(b) >= 0;
        default: return true;
      }
    }
    async function rodar() {
      var linhas = (await lerColecao(col)).filter(function (l) { return filtros.every(function (w) { return passa(l.dados, w); }); });
      ordem.forEach(function () {});
      if (ordem.length) linhas.sort(function (x, y) {
        for (var k = 0; k < ordem.length; k++) { var a = campo(x.dados, ordem[k][0]), b = campo(y.dados, ordem[k][0]); if (a === b) continue; if (a == null) return 1; if (b == null) return -1; return (a < b ? -1 : 1) * ordem[k][1]; }
        return 0;
      });
      if (max) linhas = linhas.slice(0, max);
      return snapLista(linhas.map(function (l) { return snapDoc(l.doc_id, l.dados, new DocRef(col + "/" + l.doc_id)); }));
    }
    this.get = rodar;
    this.onSnapshot = function (prox, falha) {
      if (typeof prox === "object" && prox && prox.next) { falha = prox.error; prox = prox.next; }
      var vivo = true;
      function vai() { rodar().then(function (s) { if (vivo) prox(s); }, function (e) { if (vivo && falha) falha(e); }); }
      vai(); var parar = ouvir(col, vai);
      return function () { vivo = false; parar(); };
    };
  }
  var DB = {
    collection: function (p) { return new Consulta(p); },
    doc: function (p) { return new DocRef(p); }
  };

  /* ---------- usuario ---------- */
  async function perfis(ids) {
    var out = {}, eu = await carregarEu();
    if (eu) out[eu.id] = { name: eu.nome || "Você" };
    if (eu && eu.papel === "dono") {
      try {
        var c = await sb(); var r = await c.functions.invoke("admin-consultores", { body: { acao: "listar" } });
        ((r.data && r.data.consultores) || []).forEach(function (x) { out[x.id] = { name: x.nome || x.email || "Consultor" }; });
      } catch (e) {}
    }
    var res = {}; (ids || []).forEach(function (id) { if (out[id]) res[id] = out[id]; });
    return res;
  }
  async function usuario() {
    var eu = await carregarEu(); if (!eu) return null;
    return {
      id: function () { return eu.id; },
      isOwner: function () { return eu.papel === "dono"; },
      canEdit: function () { return true; },
      can: function () { return true; },
      name: function () { return eu.nome || ""; },
      plano: function () { return eu.plano || "essencial"; },
      profiles: perfis
    };
  }

  /* ---------- IA (plano Com IA) ---------- */
  async function amostra() {
    return async function (prompt, op) {
      var c = await sb();
      var r = await c.functions.invoke("ia-texto", { body: { prompt: String(prompt || ""), rapido: !!(op && op.modelTier === "quick") } });
      var d = r.data || {};
      if (r.error || d.ok === false) {
        var st = r.error && r.error.context && r.error.context.status;
        if (st === 403 || d.erro === "plano") throw erro("unavailable", "A sugestão por IA faz parte do plano Com IA.");
        if (st === 429) throw erro("rate_limited", "Muitos pedidos seguidos.");
        throw erro("unavailable", "Não consegui sugerir agora. Tente de novo.");
      }
      var t = String(d.texto || "");
      if (op && typeof op.onText === "function") { try { op.onText({ text: t }); } catch (e) {} }
      return { text: t };
    };
  }

  /* ---------- download ---------- */
  var baixar = {
    save: async function (o) {
      var d = o && o.data, blob;
      if (d && typeof d.arrayBuffer === "function") blob = new Blob([await d.arrayBuffer()], { type: d.type || "application/octet-stream" });
      else blob = new Blob([d == null ? "" : d], { type: (o && o.type) || "application/octet-stream" });
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = (o && o.filename) || "arquivo"; a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      return { ok: true };
    }
  };

  window.claude = {
    __central: true,
    use: function (n) {
      if (n === "db") return Promise.resolve(DB);
      if (n === "user") return usuario();
      if (n === "sample") return carregarEu().then(function (eu) { return eu && eu.plano === "ia" ? amostra() : null; });
      if (n === "downloads") return Promise.resolve(baixar);
      return Promise.resolve(null);
    }
  };

  /* ---------- login (usado pela tela principal) ---------- */
  window.CentralAuth = {
    sessao: sessao,
    eu: carregarEu,
    entrar: async function (email, senha) { var c = await sb(); var r = await c.auth.signInWithPassword({ email: email, password: senha }); if (r.error) throw r.error; return r.data; },
    esqueci: async function (email) { var c = await sb(); var r = await c.auth.resetPasswordForEmail(email, { redirectTo: "https://centraldoconsultor.github.io/caixa/" }); if (r.error) throw r.error; },
    sair: async function () { var c = await sb(); await c.auth.signOut(); location.reload(); }
  };
})();
