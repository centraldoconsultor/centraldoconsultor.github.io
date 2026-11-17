/* Caixa: gravar e ouvir áudio (v1, 17/11/2026 · plano Prime)
   - CaixaAudio.suportado(): o navegador consegue gravar num formato que o WhatsApp aceita?
   - CaixaAudio.botao(onPronto): cria o botão 🎤 (toque para gravar, toque de novo para parar) e chama onPronto(File)
   - CaixaAudio.player(url, mime): <audio controls> para mensagens de áudio recebidas/enviadas
   WhatsApp Cloud API aceita audio/ogg (opus), audio/mp4, audio/aac, audio/mpeg, audio/amr — NÃO aceita webm.
   iPhone/Safari grava audio/mp4 (AAC); Firefox grava audio/ogg (opus = chega como mensagem de voz). */
(function () {
  var TIPOS = ["audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/mpeg"];
  var LIMITE_S = 180; // 3 minutos por áudio

  function tipoGravacao() {
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    for (var i = 0; i < TIPOS.length; i++) { try { if (MediaRecorder.isTypeSupported(TIPOS[i])) return TIPOS[i]; } catch (e) {} }
    return null;
  }
  function ext(mime) { return /ogg/.test(mime) ? "ogg" : /mpeg/.test(mime) ? "mp3" : /aac/.test(mime) ? "aac" : "m4a"; }
  function mm(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

  var CSS = ".cca-btn{border:0;border-radius:50%;width:42px;height:42px;font-size:19px;cursor:pointer;background:#0e2a52;color:#f4efe3;flex:none}" +
    ".cca-btn.rec{background:#a33;animation:ccaP 1s infinite}.cca-btn[disabled]{opacity:.5;cursor:not-allowed}" +
    ".cca-tempo{font:600 13px/1 system-ui,sans-serif;color:#a33;min-width:38px;display:none}.cca-tempo.on{display:inline-block}" +
    "@keyframes ccaP{50%{box-shadow:0 0 0 6px rgba(170,51,51,.25)}}" +
    ".cca-player{width:100%;max-width:260px;height:36px;display:block;margin:2px 0}";
  function estilo() { if (document.getElementById("cca-css")) return; var s = document.createElement("style"); s.id = "cca-css"; s.textContent = CSS; document.head.appendChild(s); }

  function botao(onPronto) {
    estilo();
    var tipo = tipoGravacao();
    var wrap = document.createElement("span"); wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px";
    var b = document.createElement("button"); b.type = "button"; b.className = "cca-btn"; b.textContent = "🎤";
    var t = document.createElement("span"); t.className = "cca-tempo";
    wrap.appendChild(t); wrap.appendChild(b);
    if (!tipo) { b.disabled = true; b.title = "Este navegador não grava áudio no formato do WhatsApp. Use o Safari (iPhone/Mac) ou o Firefox."; return wrap; }
    b.title = "Gravar áudio";
    var rec = null, partes = [], ini = 0, tick = null, stream = null;
    function parar(enviar) {
      if (!rec) return;
      rec.__enviar = enviar; try { rec.stop(); } catch (e) {}
      clearInterval(tick); b.classList.remove("rec"); b.textContent = "🎤"; t.classList.remove("on");
    }
    b.onclick = async function () {
      if (rec) return parar(true);
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { alertar("Não consegui usar o microfone. Libere o microfone para este site nas configurações do navegador."); return; }
      partes = []; rec = new MediaRecorder(stream, { mimeType: tipo });
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) partes.push(ev.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (x) { x.stop(); });
        var enviar = rec.__enviar, dur = (Date.now() - ini) / 1000; rec = null;
        if (!enviar || dur < 1 || !partes.length) return;
        var mime = tipo.split(";")[0];
        var arq = new File(partes, "audio-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + "." + ext(mime), { type: mime });
        try { onPronto(arq, { duracao: dur, voz: /ogg/.test(mime) }); } catch (e) { console.error(e); }
      };
      rec.start(250); ini = Date.now();
      b.classList.add("rec"); b.textContent = "■"; b.title = "Parar e enviar"; t.classList.add("on"); t.textContent = "0:00";
      tick = setInterval(function () { var s = (Date.now() - ini) / 1000; t.textContent = mm(s); if (s >= LIMITE_S) parar(true); }, 250);
    };
    // segurar Esc cancela a gravação
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && rec) parar(false); });
    return wrap;
  }

  function player(url, mime) {
    estilo();
    var a = document.createElement("audio"); a.className = "cca-player"; a.controls = true; a.preload = "none";
    var s = document.createElement("source"); s.src = url; if (mime) s.type = mime; a.appendChild(s);
    return a;
  }
  function alertar(m) { if (window.__ccAviso) window.__ccAviso(m); else window.alert(m); }

  window.CaixaAudio = { suportado: function () { return !!tipoGravacao(); }, tipo: tipoGravacao, botao: botao, player: player };
})();
