/* 클리사 배경음악 — 모든 페이지 공용.
   브라우저는 문서를 새로 열 때마다 오디오를 처음부터 다시 만든다. 그래서 페이지를 넘기면
   소리가 끊기는 것은 피할 수 없다. 대신 곡 번호와 재생 위치를 기억해 두었다가 다음 페이지에서
   같은 자리부터 이어 켠다. 자동 재생을 허용하는 브라우저에서는 즉시, 막는 브라우저(대개 모바일)에서는
   그 페이지의 첫 터치에 이어진다. 껐던 방문자는 다시 켜지 않는다. */
(function () {
  var TRACKS = ["media/track1.mp3", "media/track2.mp3", "media/track3.mp3", "media/track4.mp3"];
  var VOL = 0.55;
  var K = { on: "clisa-music", i: "clisa-music-i", t: "clisa-music-t" };

  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var ctl = document.querySelector(".ctl");
  var a = document.getElementById("ha");
  if (!a) {
    a = document.createElement("audio");
    a.id = "ha"; a.preload = "metadata";
    document.body.appendChild(a);
  }
  var btn = document.getElementById("snd");
  if (!btn) {
    if (!ctl) return;
    btn = document.createElement("button");
    btn.id = "snd"; btn.className = "music"; btn.title = "Music";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = '<span class="ic">♪</span> <span lang-ko>음악</span><span lang-en>Music</span>';
    ctl.appendChild(btn);
  }
  if (!document.querySelector("style[data-music]")) {           /* 인증 페이지에는 이 규칙이 없다 */
    var st = document.createElement("style");
    st.setAttribute("data-music", "");
    st.textContent =
      '.music .ic{display:inline-block;transition:transform .3s}' +
      '.music[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}' +
      '.music[aria-pressed="true"] .ic{animation:bob 1.1s ease-in-out infinite}' +
      '.music.hint:not([aria-pressed="true"]){animation:hint 1.6s ease-in-out infinite;border-color:var(--accent);color:var(--accent)}' +
      '@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}' +
      '@keyframes hint{0%,100%{box-shadow:0 0 0 0 rgba(229,83,59,0)}50%{box-shadow:0 0 0 6px rgba(229,83,59,.25)}}' +
      '@media (prefers-reduced-motion: reduce){.music .ic,.music.hint{animation:none}}';
    document.head.appendChild(st);
  }

  var i = parseInt(get(K.i, ""), 10);
  if (!(i >= 0 && i < TRACKS.length)) i = Math.floor(Math.random() * TRACKS.length);   /* 첫 방문은 무작위 곡 */
  var resumeAt = parseFloat(get(K.t, "0")) || 0;

  function load(seek) {
    a.src = TRACKS[i];
    set(K.i, i);
    if (seek > 0) a.addEventListener("loadedmetadata", function once() {
      a.removeEventListener("loadedmetadata", once);
      if (seek < (a.duration || 0) - 1) { try { a.currentTime = seek; } catch (e) {} }
    });
  }

  var mark = 0;
  a.addEventListener("timeupdate", function () {                 /* 위치 기록 — 다음 페이지가 이어받는다 */
    var n = Date.now();
    if (n - mark > 1000) { mark = n; set(K.t, a.currentTime.toFixed(1)); }
  });
  function stash() { if (!a.paused) set(K.t, a.currentTime.toFixed(1)); }
  window.addEventListener("pagehide", stash);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stash(); });

  a.addEventListener("ended", function () { i = (i + 1) % TRACKS.length; set(K.t, "0"); load(0); a.play().catch(function () {}); });
  a.addEventListener("error", function () { if (btn) btn.remove(); }, { once: true });

  load(resumeAt);
  btn.hidden = false;

  var fade;
  function on() {
    clearInterval(fade); a.volume = 0;
    return a.play().then(function () {
      btn.setAttribute("aria-pressed", "true");
      fade = setInterval(function () { a.volume = Math.min(VOL, a.volume + 0.05); if (a.volume >= VOL) clearInterval(fade); }, 120);
    });
  }
  function off() {
    clearInterval(fade);
    fade = setInterval(function () { a.volume = Math.max(0, a.volume - 0.08); if (a.volume <= 0) { clearInterval(fade); a.pause(); } }, 80);
    btn.setAttribute("aria-pressed", "false");
  }
  btn.addEventListener("click", function () {
    if (a.paused) { on().catch(function () {}); set(K.on, "on"); }
    else { off(); set(K.on, "off"); }
  });

  if (get(K.on, "on") !== "off") {
    /* 이어 켜기: 허용하는 브라우저에서는 즉시. 막히면 그 페이지의 첫 터치·클릭·키 입력에 켠다. */
    a.play().then(function () {
      btn.setAttribute("aria-pressed", "true"); a.volume = VOL; btn.classList.remove("hint");
    }).catch(function () {});
    var evs = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
    var arm = function (e) {
      if (e && btn.contains(e.target)) return;
      if (!a.paused) return;
      on().then(function () {
        set(K.on, "on"); btn.classList.remove("hint");
        for (var k = 0; k < evs.length; k++) document.removeEventListener(evs[k], arm, true);
      }).catch(function () {});
    };
    for (var k = 0; k < evs.length; k++) document.addEventListener(evs[k], arm, true);
    btn.classList.add("hint");
  }
})();
