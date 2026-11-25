/* Fofoca do Dia. Build steps 2 and 3: the three rounds, the result screen and
   saved progress. Rules live in logic.js. See ..\docs\SPEC.md. */
(function () {
  'use strict';

  var L = window.FofocaLogic;
  var DIRS = { E: [0, 1], S: [1, 0], SE: [1, 1] };
  var BLANK = '____';
  var STORE = 'fofoca-do-dia-v1';
  var SCREENS = ['round1', 'round2', 'round3', 'end'];
  var $ = function (id) { return document.getElementById(id); };
  var isLocal = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1;

  var puzzle = null;
  var day = null;        // today's progress (see logic.js newDay)
  var saved = {};        // {date, day, streak, first}
  var cellEls = [];      // cellEls[row][col]
  var start = null;      // first tapped cell {r, c}
  var drag = null;       // {from, to, moved} while a finger is down

  /* ---------- storage (the phone's own; nothing is sent anywhere) ---------- */

  function readStore() {
    try {
      var data = JSON.parse(localStorage.getItem(STORE));
      return data && typeof data === 'object' ? data : {};
    } catch (err) { return {}; }
  }

  function save() {
    saved.date = puzzle.date;
    saved.day = day;
    try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch (err) { /* private mode: play without saving */ }
  }

  /* ---------- anonymous counts ----------
     One small request per event to a free public counter. It carries the event
     name and the date only: no cookie, no name, nothing about the player.
     Nothing is sent from the developer's machine; there the events are kept in
     window.__fofocaEvents so they can be checked. */

  var COUNT_URL = 'https://abacus.jasoncameron.dev/hit/';
  var today = null;      // Brasília date used for counting
  var events = [];
  if (isLocal) window.__fofocaEvents = events;

  function hit(key) {
    var ns = ((window.FOFOCA_SITE || {}).counter || {}).abacus;
    if (isLocal) { events.push(key); return; }
    if (!ns || !/^[a-z0-9-]+$/.test(ns) || !/^[a-z0-9-]+$/.test(key)) return;
    try {
      fetch(COUNT_URL + ns + '/' + key, { keepalive: true, cache: 'no-store' }).catch(function () {});
    } catch (err) { /* counting must never break the game */ }
  }

  function track(name) { if (today) hit(L.countKey(name, today)); }

  function trackLink(id) {
    if (!L.linkId(id)) return;
    track('link');
    hit('link-' + id);
  }

  /* Called on the player's first touch of the day. */
  function notePlay() {
    if (!today) return;
    var r = L.playEvents(saved, today);
    if (!r.events.length) return;
    saved.first = r.first;
    saved.lastPlay = r.lastPlay;
    saved.ret1 = r.ret1;
    saved.ret7 = r.ret7;
    save();
    r.events.forEach(track);
  }

  /* ---------- loading ---------- */

  function getJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('missing ' + url);
      return res.json();
    });
  }

  /* Shows today's puzzle (Brasília date). If today's is missing or not approved,
     shows the last approved one. puzzles/index.json is written by toolsuild_index.py. */
  function load() {
    // On the developer's own machine only: "?dev=YYYY-MM-DD" pretends it is that
    // day, and puzzles not yet approved can be opened.
    var dev = isLocal ? new URLSearchParams(location.search).get('dev') : null;
    today = /^\d{4}-\d{2}-\d{2}$/.test(dev || '') ? dev : L.brasiliaDate(new Date());
    return getJson('puzzles/index.json').then(function (index) {
      var date = L.pickDate(today, index && index.puzzles, isLocal);
      if (!date) throw new Error('no puzzle');
      return getJson('puzzles/' + date + '.json');
    }).then(function (data) {
      if (data.approved !== true && !isLocal) throw new Error('not approved');
      return data;
    });
  }

  /* ---------- screens ---------- */

  function show(name) {
    SCREENS.forEach(function (id) { $(id).hidden = id !== name; });
    var n = SCREENS.indexOf(name);
    var d = puzzle.date.split('-');
    $('step').textContent = (n < 3 ? 'Rodada ' + (n + 1) + ' de 3 · ' : '') + 'Fofoca de ' + d[2] + '/' + d[1];
    window.scrollTo(0, 0);
  }

  /* The Celular Lacrado speaks: picture (normal, feliz or susto) and a line. */
  function setHost(el, text, mood) {
    el.textContent = '';
    var img = document.createElement('img');
    img.src = 'img/host-' + (mood || 'normal') + '.png';
    img.alt = '';
    img.width = 64;
    var span = document.createElement('span');
    var name = document.createElement('b');
    name.textContent = 'Celular Lacrado: ';
    span.appendChild(name);
    span.appendChild(document.createTextNode(text));
    el.appendChild(img);
    el.appendChild(span);
  }

  /* A button-like link to one of the owner's own pages; null if the link is not one. */
  function ownButton(label, url, main, id) {
    var href = L.ownLink(url);
    if (!href) return null;
    var a = document.createElement('a');
    a.className = 'btn link' + (main ? '' : ' quiet');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    a.addEventListener('click', function () { trackLink(id); });
    return a;
  }

  function fillLinks(el, items) {
    el.textContent = '';
    items.forEach(function (it) {
      var a = ownButton(it.label, it.url, it.main, it.id);
      if (a) el.appendChild(a);
    });
    el.hidden = el.children.length === 0;
  }

  function say(text, good) {
    var el = $('status');
    el.textContent = text;
    el.classList.toggle('good', !!good);
  }

  /* Same rule as tools\puzzle_lib.py normalize(): "São Paulo" -> SAOPAULO. */
  function gridForm(word) {
    return word.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-'’.]/g, '').toUpperCase();
  }

  /* ---------- round 1: word search ---------- */

  function placementCells(p) {
    var d = DIRS[p.dir], out = [];
    for (var i = 0; i < p.word.length; i++) out.push({ r: p.row + d[0] * i, c: p.col + d[1] * i });
    return out;
  }

  /* Cells on the straight line from a to b, or null if they are not in line. */
  function line(a, b) {
    var dr = b.r - a.r, dc = b.c - a.c;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    var n = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc), out = [];
    for (var i = 0; i <= n; i++) out.push({ r: a.r + sr * i, c: a.c + sc * i });
    return out;
  }

  function sameCells(x, y) {
    if (x.length !== y.length) return false;
    var fwd = true, back = true, n = x.length;
    for (var i = 0; i < n; i++) {
      if (x[i].r !== y[i].r || x[i].c !== y[i].c) fwd = false;
      if (x[i].r !== y[n - 1 - i].r || x[i].c !== y[n - 1 - i].c) back = false;
    }
    return fwd || back;
  }

  function clearPick() {
    cellEls.forEach(function (row) { row.forEach(function (el) { el.classList.remove('pick'); }); });
  }

  function showPick(cells) {
    clearPick();
    (cells || []).forEach(function (p) { cellEls[p.r][p.c].classList.add('pick'); });
  }

  function remaining() {
    return puzzle.placements.filter(function (p) { return day.found.indexOf(p.word) === -1; });
  }

  function markFound(p) {
    placementCells(p).forEach(function (q) { cellEls[q.r][q.c].classList.add('found'); });
    var li = document.querySelector('#words li[data-word="' + p.word + '"]');
    if (li) li.classList.add('found');
  }

  function finishRound1() {
    start = null;
    clearPick();
    $('r1-play').hidden = true;
    $('r1-after').hidden = false;
    var all = remaining().length === 0;
    say(all ? 'Você achou todas as ' + puzzle.placements.length + ' palavras! 🎉'
            : 'Você achou ' + day.found.length + ' de ' + puzzle.placements.length + ' palavras.', all);
    setHost($('r1-host'), puzzle.host_lines[0], all ? 'feliz' : 'normal');
  }

  function tryLine(a, b) {
    var picked = line(a, b);
    var hit = picked && remaining().filter(function (p) { return sameCells(placementCells(p), picked); })[0];
    start = null;
    clearPick();
    if (!hit) {
      var grid = $('grid');
      grid.classList.remove('miss');
      void grid.offsetWidth;
      grid.classList.add('miss');
      say('Quase! Tente de novo.');
      return;
    }
    day.found.push(hit.word);
    save();
    markFound(hit);
    var shown = puzzle.words.filter(function (w) { return gridForm(w) === hit.word; })[0] || hit.word;
    var left = remaining().length;
    if (left === 0) {
      finishRound1();
      $('r1-after').scrollIntoView({ block: 'end', behavior: 'smooth' });
    } else {
      say('Achou ' + shown.toUpperCase() + '! ' + (left === 1 ? 'Falta 1.' : 'Faltam ' + left + '.'), true);
    }
  }

  function cellAt(x, y) {
    var el = document.elementFromPoint(x, y);
    el = el && el.closest ? el.closest('.cell') : null;
    return el ? { r: +el.dataset.r, c: +el.dataset.c } : null;
  }

  function same(a, b) { return a && b && a.r === b.r && a.c === b.c; }

  function onDown(ev) {
    var at = cellAt(ev.clientX, ev.clientY);
    if (!at || L.round1Over(day, puzzle)) return;
    ev.preventDefault();
    notePlay();
    drag = { from: at, to: at, moved: false };
    if (!start) showPick([at]);
  }

  function onMove(ev) {
    if (!drag) return;
    var at = cellAt(ev.clientX, ev.clientY);
    if (!at || same(at, drag.to)) return;
    drag.to = at;
    drag.moved = !same(at, drag.from);
    if (drag.moved) showPick(line(drag.from, at) || [drag.from]);
  }

  function onUp() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (d.moved && !same(d.from, d.to)) {      // a drag: from the first cell to the last
      tryLine(d.from, d.to);
    } else if (start && !same(start, d.from)) { // second tap
      tryLine(start, d.from);
    } else if (start) {                         // same cell tapped again: cancel
      start = null;
      clearPick();
      say('Toque na primeira letra de uma palavra.');
    } else {                                    // first tap
      start = d.from;
      showPick([start]);
      say('Agora toque na última letra da palavra.');
    }
  }

  function hint() {
    var p = remaining()[0];
    if (!p) return;
    notePlay();
    var el = cellEls[p.row][p.col];
    el.classList.remove('hint');
    void el.offsetWidth;
    el.classList.add('hint');
    setTimeout(function () { el.classList.remove('hint'); }, 2200);
    say('Uma palavra começa na letra que está piscando.');
    $('status').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function renderRound1() {
    $('theme').textContent = puzzle.theme;
    tipLinks();
    var grid = $('grid');
    grid.style.setProperty('--n', puzzle.size);
    grid.textContent = '';
    cellEls = puzzle.grid.map(function (row, r) {
      return row.split('').map(function (ch, c) {
        var el = document.createElement('div');
        el.className = 'cell';
        el.dataset.r = r;
        el.dataset.c = c;
        el.textContent = ch;
        grid.appendChild(el);
        return el;
      });
    });
    var list = $('words');
    list.textContent = '';
    puzzle.words.forEach(function (w) {
      var li = document.createElement('li');
      li.dataset.word = gridForm(w);
      li.textContent = w;
      list.appendChild(li);
    });
    puzzle.placements.forEach(function (p) { if (day.found.indexOf(p.word) !== -1) markFound(p); });

    grid.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', function () { drag = null; if (!start) clearPick(); });
    $('hint').addEventListener('click', hint);
    $('skip').addEventListener('click', function () {
      notePlay();
      day.skipped = true;
      save();
      finishRound1();
      openRound2();
    });
    $('r1-next').addEventListener('click', openRound2);

    var left = remaining().length;
    if (L.round1Over(day, puzzle)) finishRound1();
    else if (day.found.length) say('Você já achou ' + day.found.length + '. ' + (left === 1 ? 'Falta 1.' : 'Faltam ' + left + '.'), true);
    else say('Ache as ' + puzzle.placements.length + ' palavras escondidas.');
  }

  /* ---------- rounds 2 and 3: one question each ---------- */

  function fillQuote(el, text, answer) {
    el.textContent = '';
    var parts = text.split(BLANK);
    el.appendChild(document.createTextNode(parts[0]));
    if (parts.length > 1) {
      var blank = document.createElement('span');
      blank.className = 'blank' + (answer ? ' filled' : '');
      blank.textContent = answer || ' ';
      el.appendChild(blank);
      el.appendChild(document.createTextNode(parts.slice(1).join(BLANK)));
    }
  }

  /* cfg: {key, block, textEl, optionsEl, afterEl, resultEl, hostEl, hostLine, onAnswer} */
  function renderQuestion(cfg) {
    var block = cfg.block;
    function reveal() {
      var chosen = day[cfg.key];
      Array.prototype.forEach.call(cfg.optionsEl.children, function (btn) {
        btn.disabled = true;
        if (btn.dataset.option === block.answer) btn.classList.add('right');
        else if (btn.dataset.option === chosen) btn.classList.add('wrong');
      });
      var right = chosen === block.answer;
      cfg.resultEl.textContent = right ? 'Acertou! ✅' : 'Não foi dessa vez. ❌';
      setHost(cfg.hostEl, cfg.hostLine, right ? 'feliz' : 'susto');
      if (cfg.onAnswer) cfg.onAnswer();
      cfg.afterEl.hidden = false;
    }
    cfg.optionsEl.textContent = '';
    block.options.forEach(function (option) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.dataset.option = option;
      btn.textContent = option;
      btn.addEventListener('click', function () {
        if (day[cfg.key] !== null) return;
        notePlay();
        day[cfg.key] = option;
        if (cfg.key === 'a3') finishDay();
        save();
        reveal();
        cfg.afterEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
      });
      cfg.optionsEl.appendChild(btn);
    });
    cfg.afterEl.hidden = true;
    if (day[cfg.key] !== null) reveal();
  }

  function openRound2() {
    var h = puzzle.headline;
    fillQuote($('h-text'), h.text, null);
    renderQuestion({
      key: 'a2', block: h, optionsEl: $('h-options'), afterEl: $('h-after'),
      resultEl: $('h-result'), hostEl: $('h-host'), hostLine: puzzle.host_lines[1],
      onAnswer: function () {
        fillQuote($('h-text'), h.text, h.answer);
        var a = $('h-source');
        a.textContent = h.source_name;
        a.href = /^https:\/\//.test(h.source_url) ? h.source_url : '#';
        fillLinks($('h-video'), puzzle.video_url ? [{ label: '▶ Ver o vídeo dessa fofoca', url: puzzle.video_url, main: false, id: 'video-headline' }] : []);
      }
    });
    show('round2');
  }

  function openRound3() {
    var t = puzzle.trivia;
    $('t-text').textContent = t.question;
    renderQuestion({
      key: 'a3', block: t, optionsEl: $('t-options'), afterEl: $('t-after'),
      resultEl: $('t-result'), hostEl: $('t-host'), hostLine: puzzle.host_lines[2]
    });
    show('round3');
  }

  /* ---------- ads (result screen only) ----------
     Two fixed-size spaces. A space shows the network's ad when one is set up in
     site.js and actually arrives; otherwise it shows the house banner. The
     result screen never shows a name, a headline or the grid (see SPEC). */

  var SITE = window.FOFOCA_SITE || {};
  var adsStarted = false;

  function houseAd(slot) {
    var cfg = ((SITE.ads || {})[slot] || {}).house || {};
    var box = $('ad-' + slot + '-box');
    var href = L.ownLink(cfg.url);
    box.textContent = '';
    if (!href || !cfg.text) { $('ad-' + slot).hidden = true; return; }
    var a = document.createElement('a');
    a.className = 'house';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    if (slot === 'b') {
      var img = document.createElement('img');
      img.src = 'img/host-feliz.png';
      img.alt = '';
      a.appendChild(img);
    }
    var text = document.createElement('span');
    text.textContent = cfg.text;
    a.appendChild(text);
    if (cfg.cta) {
      var cta = document.createElement('span');
      cta.className = 'cta';
      cta.textContent = cfg.cta;
      a.appendChild(cta);
    }
    a.addEventListener('click', function () { trackLink('house-' + slot); });
    box.appendChild(a);
    track('adhouse');
  }

  /* A network's code runs inside its own frame, which may not send the game page
     somewhere else. (It is not fully isolated: a stricter frame stopped the ad
     from showing at all.) If nothing is drawn within 7 seconds, the house banner
     takes the space. */
  function frameAd(slot, html, width, height) {
    var box = $('ad-' + slot + '-box');
    var id = 'ad-' + slot + '-' + Date.now();
    var frame = document.createElement('iframe');
    var done = false;
    var timer = null;
    function settle(filled) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (filled) track('adnet'); else houseAd(slot);
    }
    function onMessage(ev) {
      if (ev.source !== frame.contentWindow || !ev.data || ev.data.fofocaAd !== id) return;
      settle(ev.data.filled === true);
    }
    // allow-same-origin is needed: without it Adsterra's code cannot draw its ad (tested 2026-11-25).
    // Left out on purpose: allow-top-navigation, so the ad cannot send the game page elsewhere.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    frame.title = 'Publicidade';
    frame.width = width;
    frame.height = height;
    frame.scrolling = 'no';
    frame.srcdoc = L.adFrameDoc(html, id);
    window.addEventListener('message', onMessage);
    timer = setTimeout(function () { settle(false); }, 7000);
    box.textContent = '';
    box.appendChild(frame);
  }

  /* AdSense must sit in the page itself (Google does not allow it inside a frame). */
  function adsenseAd(slot, cfg) {
    var box = $('ad-' + slot + '-box');
    var done = false;
    function settle(filled) {
      if (done) return;
      done = true;
      if (filled) track('adnet'); else houseAd(slot);
    }
    box.textContent = '';
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.cssText = 'display:inline-block;width:300px;height:250px';
    ins.setAttribute('data-ad-client', cfg.client);
    ins.setAttribute('data-ad-slot', cfg.slot);
    box.appendChild(ins);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;   // non-personalised ads only (SPEC)
    var script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.client;
    script.onerror = function () { settle(false); };
    document.head.appendChild(script);
    try { window.adsbygoogle.push({}); } catch (err) { /* decided by the check below */ }
    setTimeout(function () { settle(ins.getAttribute('data-ad-status') === 'filled'); }, 7000);
  }

  /* On the developer's machine only: "?adtest=fill" or "?adtest=empty" puts a
     stand-in for a network's code in space A, to test both outcomes. */
  function adTestCode() {
    var kind = isLocal ? new URLSearchParams(location.search).get('adtest') : null;
    if (kind === 'fill') {
      return '<img alt="" width="320" height="50" src="data:image/svg+xml,' +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="50"><rect width="320" height="50" fill="#777"/><text x="160" y="31" fill="#fff" font-size="16" text-anchor="middle">ANUNCIO DE TESTE</text></svg>') + '">';
    }
    if (kind === 'empty') return '<!-- the network sent nothing -->';
    return null;
  }

  function showAds() {
    if (adsStarted) return;
    adsStarted = true;
    var test = adTestCode();
    ['a', 'b'].forEach(function (slot) {
      var cfg = (SITE.ads || {})[slot] || {};
      if (slot === 'a' && test !== null) return frameAd('a', test, 320, 50);
      if (isLocal) return houseAd(slot);                 // never load a real network while developing
      if (cfg.on === true && typeof cfg.html === 'string' && cfg.html.trim()) return frameAd(slot, cfg.html, cfg.width || 320, cfg.height || 50);
      if (L.adsenseOk(cfg.adsense)) return adsenseAd(slot, cfg.adsense);
      houseAd(slot);
    });
  }

  /* ---------- result ---------- */

  function finishDay() {
    if (day.done) return;
    day.done = true;
    saved.streak = L.nextStreak(saved.streak, puzzle.date);
    track('finish');
  }

  /* The result screen shows the score and the host only: no name, headline or grid
     (SPEC: an ad never shares a screen with a real person's name). */
  function openEnd() {
    var s = L.score(day, puzzle);
    $('score').textContent = s.total + ' de ' + s.max;
    $('marks').textContent = L.shareText(day, puzzle, '').split('\n')[1];
    setHost($('end-host'), L.hostVerdict(s), L.hostMood(s));
    var site = window.FOFOCA_SITE || { links: [] };
    var links = (puzzle.video_url ? [{ label: '▶ Ver o vídeo de hoje', url: puzzle.video_url, main: true, id: 'video-end' }] : []).concat(
      site.links.map(function (l, i) { return { label: l.label, url: l.url, main: !puzzle.video_url && l.main, id: l.id }; }));
    fillLinks($('end-links'), links);
    var gameUrl = site.gameUrl || (location.origin + location.pathname);
    $('share').href = L.whatsappUrl(L.shareText(day, puzzle, gameUrl));
    showAds();
    $('streak').textContent = L.streakText(saved.streak ? saved.streak.count : 1);
    show('end');
  }

  /* ---------- start ---------- */

  (function contactLine() {
    // The address is also written in index.html, so readers without scripts see it.
    var mail = (window.FOFOCA_SITE || {}).contact;
    if (!L.emailOk(mail)) return;
    $('contact').textContent = mail;
    $('contact').href = 'mailto:' + mail;
    $('contact-line').hidden = false;
  })();

  /* "Se precisar de mais dicas, é só ver o nosso conteúdo": links under the Dica button. */
  /* The day's own video (YouTube) and post (X) about this story; when a puzzle
     has none, the button goes to the channel's page instead. */
  function tipLinks() {
    var social = (window.FOFOCA_SITE || {}).social || {};
    var box = $('tip-links');
    box.textContent = '';
    [['YouTube', L.ownLink(puzzle.video_url) || social.youtube, 'youtube-dica', 'go-youtube'],
     ['X', L.ownLink(puzzle.x_url) || social.x, 'x-dica', 'go-x']].forEach(function (it) {
      var a = ownButton(it[0], it[1], false, it[2]);
      if (!a) return;
      var icon = $(it[3]).querySelector('svg');      // same drawing as the small icon at the top
      if (icon) a.insertBefore(icon.cloneNode(true), a.firstChild);
      a.setAttribute('aria-label', 'Novela da Fofoca no ' + it[0]);
      box.appendChild(a);
    });
    $('tips').hidden = box.children.length === 0;
  }

  (function socialIcons() {
    var social = (window.FOFOCA_SITE || {}).social || {};
    [['go-youtube', social.youtube], ['go-x', social.x]].forEach(function (pair) {
      var href = L.ownLink(pair[1]);
      if (!href) return;
      $(pair[0]).href = href;
      $(pair[0]).hidden = false;
      $(pair[0]).addEventListener('click', function () { trackLink(pair[0] === 'go-youtube' ? 'youtube-icon' : 'x-icon'); });
    });
  })();

  load().then(function (data) {
    puzzle = data;
    saved = readStore();
    day = L.cleanDay(saved.date === puzzle.date ? saved.day : null, puzzle);
    renderRound1();
    $('h-next').addEventListener('click', openRound3);
    $('t-next').addEventListener('click', openEnd);
    $('share').addEventListener('click', function () { track('share'); });
    var screen = L.screenFor(day, puzzle);
    if (screen === 'round1') show('round1');
    else if (screen === 'round2') openRound2();
    else if (screen === 'round3') openRound3();
    else openEnd();
  }).catch(function () {
    var el = $('notice');
    el.textContent = 'A fofoca de hoje ainda não chegou. Volte mais tarde!';
    el.hidden = false;
  });
})();
