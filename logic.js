/* Fofoca do Dia: rules with no screen code, so they can be tested with Node
   (tests\test_logic.js) and used by app.js in the browser. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FofocaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* A day's progress. found = grid words found; a2 / a3 = the option chosen in
     rounds 2 and 3 (null = not answered); skipped = left round 1 early. */
  function newDay() {
    return { found: [], skipped: false, a2: null, a3: null, done: false };
  }

  function cleanDay(day, puzzle) {
    var out = newDay();
    if (!day || typeof day !== 'object') return out;
    var valid = puzzle.placements.map(function (p) { return p.word; });
    (Array.isArray(day.found) ? day.found : []).forEach(function (w) {
      if (valid.indexOf(w) !== -1 && out.found.indexOf(w) === -1) out.found.push(w);
    });
    out.skipped = day.skipped === true;
    if (puzzle.headline.options.indexOf(day.a2) !== -1) out.a2 = day.a2;
    if (puzzle.trivia.options.indexOf(day.a3) !== -1) out.a3 = day.a3;
    out.done = day.done === true && out.a2 !== null && out.a3 !== null;
    return out;
  }

  function round1Over(day, puzzle) {
    return day.skipped || day.found.length >= puzzle.placements.length;
  }

  /* Which screen a returning player should see. */
  function screenFor(day, puzzle) {
    if (day.done) return 'end';
    if (!round1Over(day, puzzle)) return 'round1';
    if (day.a2 === null) return 'round2';
    return 'round3';
  }

  function score(day, puzzle) {
    var words = day.found.length;
    var r2 = day.a2 !== null && day.a2 === puzzle.headline.answer;
    var r3 = day.a3 !== null && day.a3 === puzzle.trivia.answer;
    return {
      words: words,
      wordsMax: puzzle.placements.length,
      r2: r2,
      r3: r3,
      total: words + (r2 ? 1 : 0) + (r3 ? 1 : 0),
      max: puzzle.placements.length + 2
    };
  }

  /* The text sent to WhatsApp. It carries the score only: no word from the puzzle. */
  function shareText(day, puzzle, link) {
    var s = score(day, puzzle);
    var d = puzzle.date.split('-');
    var squares = '';
    for (var i = 0; i < s.wordsMax; i++) squares += i < s.words ? '🟩' : '⬜';
    return 'Fofoca do Dia ' + d[2] + '/' + d[1] + ' 🕵️ ' + s.total + '/' + s.max + '\n' +
      squares + ' ' + (s.r2 ? '✅' : '❌') + ' ' + (s.r3 ? '✅' : '❌') + '\n' +
      'Joga também: ' + link;
  }

  function dayBefore(date) {
    var p = date.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1)).toISOString().slice(0, 10);
  }

  /* Streak after finishing the puzzle of `date`. streak = {last, count} or null. */
  function nextStreak(streak, date) {
    var ok = streak && typeof streak.last === 'string' && streak.count > 0;
    if (ok && streak.last === date) return { last: date, count: streak.count };
    if (ok && streak.last === dayBefore(date)) return { last: date, count: streak.count + 1 };
    return { last: date, count: 1 };
  }

  function streakText(count) {
    return count > 1 ? count + ' dias seguidos! 🔥' : 'Primeiro dia da sequência. Volte amanhã!';
  }

  function hostVerdict(s) {
    var ratio = s.total / s.max;
    if (ratio === 1) return 'Lacrou tudo! Nem eu sabia tanta fofoca.';
    if (ratio >= 0.6) return 'Mandou bem! Já pode ser colunista.';
    return 'Hoje a fofoca te pegou. Amanhã tem mais!';
  }

  function hostMood(s) {
    var ratio = s.total / s.max;
    return ratio === 1 ? 'feliz' : ratio >= 0.6 ? 'normal' : 'susto';
  }

  /* The calendar date in Brasília (YYYY-MM-DD) for a moment in time. */
  function brasiliaDate(now) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    var get = function (type) { return parts.filter(function (p) { return p.type === type; })[0].value; };
    return get('year') + '-' + get('month') + '-' + get('day');
  }

  /* The day to show: the newest listed day that is not in the future. Unapproved
     days count only when allowUnapproved is true (the developer's own machine).
     Returns null when there is nothing to show. */
  function pickDate(today, entries, allowUnapproved) {
    var best = null;
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (!e || typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return;
      if (e.approved !== true && !allowUnapproved) return;
      if (e.date <= today && (best === null || e.date > best)) best = e.date;
    });
    return best;
  }

  /* Links out of the game go only to the owner's own pages on these sites. */
  var OWN_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'x.com', 'www.instagram.com', 'instagram.com', 'www.tiktok.com', 'tiktok.com'];
  function ownLink(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && OWN_HOSTS.indexOf(u.hostname) !== -1 ? u.href : null;
    } catch (err) { return null; }
  }

  /* ---- anonymous counts and sharing ---- */

  var LINK_IDS = ['youtube-icon', 'x-icon', 'video-headline', 'video-end', 'youtube-sub', 'x-end', 'instagram-end', 'house-a', 'house-b', 'youtube-dica', 'x-dica'];
  function linkId(id) { return LINK_IDS.indexOf(id) !== -1 ? id : null; }

  function daysBetween(a, b) {
    var utc = function (d) { var p = d.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
    return Math.round((utc(b) - utc(a)) / 86400000);
  }

  /* What to count when a player first touches the game on `today`.
     saved = what this phone remembers: {first, lastPlay, ret1, ret7}.
     play = once per phone per day; new = this phone's first day ever;
     ret1 = came back 1 to 6 days after the first day (counted once);
     ret7 = came back 7 to 13 days after the first day (counted once). */
  function playEvents(saved, today) {
    saved = saved || {};
    var first = typeof saved.first === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.first) ? saved.first : null;
    var out = { events: [], first: first, lastPlay: saved.lastPlay || null, ret1: saved.ret1 === true, ret7: saved.ret7 === true };
    if (saved.lastPlay === today) return out;
    out.lastPlay = today;
    out.events.push('play');
    if (!first) { out.first = today; out.events.push('new'); return out; }
    var d = daysBetween(first, today);
    if (d >= 1 && d <= 6 && !out.ret1) { out.ret1 = true; out.events.push('ret1'); }
    if (d >= 7 && d <= 13 && !out.ret7) { out.ret7 = true; out.events.push('ret7'); }
    return out;
  }

  /* Counter name for an event on a day, for example play-2026-12-01. */
  function countKey(name, date) { return name + '-' + date; }

  function whatsappUrl(text) { return 'https://wa.me/?text=' + encodeURIComponent(text); }

  /* The page shown inside an ad frame: the ad network's code, then a few lines of
     ours that tell the game, after 3.5 seconds, whether anything was drawn.
     The frame is sandboxed, so the network's code cannot touch the game page. */
  function adFrameDoc(html, id) {
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style></head><body>' +
      html +
      '<script>setTimeout(function(){var e=document.querySelectorAll("iframe,img,ins,canvas,video,object,embed,a"),ok=false;' +
      'for(var i=0;i<e.length;i++){var r=e[i].getBoundingClientRect();if(r.width>=20&&r.height>=20){ok=true;break}}' +
      'parent.postMessage({fofocaAd:' + JSON.stringify(String(id)) + ',filled:ok},"*")},3500)<\/script></body></html>';
  }

  function adsenseOk(cfg) {
    return !!cfg && /^ca-pub-\d{10,20}$/.test(cfg.client || '') && /^\d{6,20}$/.test(cfg.slot || '');
  }

  function emailOk(text) {
    return typeof text === 'string' && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(text);
  }

  return {
    adFrameDoc: adFrameDoc, adsenseOk: adsenseOk, emailOk: emailOk,
    linkId: linkId, daysBetween: daysBetween, playEvents: playEvents, countKey: countKey, whatsappUrl: whatsappUrl,
    hostMood: hostMood, brasiliaDate: brasiliaDate, pickDate: pickDate, ownLink: ownLink,
    newDay: newDay, cleanDay: cleanDay, round1Over: round1Over, screenFor: screenFor,
    score: score, shareText: shareText, dayBefore: dayBefore, nextStreak: nextStreak,
    streakText: streakText, hostVerdict: hostVerdict
  };
});
