/* Deutsch Cards – shared Quiz + "To learn" list.
   The list is saved in this browser (localStorage). "Share link" puts the list
   in a URL; opening that URL on another device merges it into that device's list. */
(function () {
  'use strict';

  // ---------- helpers ----------
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('study-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'study-toast';
      el.className = 'study-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  // ---------- plausible wrong forms for irregular verbs ----------
  var AUX = { hat: 1, ist: 1 };
  var VOWEL_RE = /(ie|ei|au|äu|eu|[aeiouäöü])/g;
  // verbs whose regular (weak) forms are also correct in some meaning (or look silly) -> never offer them as "wrong"
  var NO_WEAK = ['sein', 'essen', 'hängen', 'bewegen', 'schaffen', 'wiegen', 'erschrecken', 'quellen', 'hauen', 'glimmen',
    'gären', 'klimmen', 'bleichen', 'scheren', 'saugen', 'senden', 'backen', 'melken', 'salzen', 'schallen',
    'dingen', 'mahlen', 'befleißigen'];

  function tokenize(s) { return s.split(/(\s*\/\s*|\s*\(\s*|\s*\)\s*|\s+)/).filter(function (t) { return t !== ''; }); }
  function isSep(t) { return /^[\s\/()]*$/.test(t); }
  function isCore(t) { return !isSep(t) && !AUX[t]; }

  function vowelSwaps(form) {
    var groups = [], m;
    VOWEL_RE.lastIndex = 0;
    while ((m = VOWEL_RE.exec(form))) groups.push({ i: m.index, v: m[0] });
    // ignore the ending -e / -en / -et / -te
    groups = groups.filter(function (g) { return !(g.v === 'e' && /^e(n|t|te|st)?$/.test(form.slice(g.i))); });
    if (!groups.length) return [];
    var g = groups[groups.length - 1];
    return ['a', 'e', 'i', 'o', 'u', 'ie'].filter(function (x) { return x !== g.v; }).map(function (x) {
      return form.slice(0, g.i) + x + form.slice(g.i + g.v.length);
    });
  }

  /* inf: "gehen", correct: "ist gegangen", kind: 'prat' | 'p2', others: same field of other verbs */
  function formDistractors(inf, correct, kind, others) {
    var toks = tokenize(correct);
    var valid = {};
    toks.forEach(function (t) { if (isCore(t)) valid[t] = 1; });
    var cores = Object.keys(valid);
    var auxes = toks.filter(function (t) { return AUX[t]; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    var stem = inf.replace(/e?n$/, '');
    var dental = /[td]$/.test(stem);
    var firstCore = cores[0] || '';
    // does the participle add "ge-"? (gehen -> gegangen yes, genießen -> genossen no)
    var usesGe = firstCore.indexOf('ge') === 0 && !(inf.indexOf('ge') === 0 && firstCore.charAt(2) === inf.charAt(2));
    var weak = kind === 'prat' ? stem + (dental ? 'ete' : 'te') : (usesGe ? 'ge' : '') + stem + (dental ? 'et' : 't');
    var weakOk = NO_WEAK.indexOf(inf) < 0 && !valid[weak];

    function pool(core) {
      var p = vowelSwaps(core);
      if (kind === 'p2') p.push((usesGe ? 'ge' : '') + inf);
      return p.filter(function (x) { return !valid[x]; });
    }
    function build(forceFirst) {
      var k = 0, broken = false, used = [];
      var s = toks.map(function (t) {
        if (!isCore(t)) return t;
        var rep;
        if (k === 0 && forceFirst) rep = forceFirst;
        else {
          var p = pool(t).filter(function (x) { return used.indexOf(x) < 0; });
          if (!p.length) { broken = true; return t; }
          rep = p[Math.floor(Math.random() * p.length)];
        }
        used.push(rep);
        k++;
        return rep;
      }).join('');
      return broken ? null : s;
    }

    var out = [];
    function add(s) { if (s && s !== correct && out.indexOf(s) < 0 && out.length < 3) out.push(s); }

    if (kind === 'p2' && auxes.length === 1 && Math.random() < 0.8) {
      add(toks.map(function (t) { return AUX[t] ? (t === 'hat' ? 'ist' : 'hat') : t; }).join(''));
    }
    if (weakOk) add(build(weak));
    for (var tries = 0; out.length < 3 && tries < 40; tries++) add(build(null));
    shuffle(others.slice()).forEach(add);
    return out;
  }

  // ---------- main ----------
  function createStudy(cfg) {
    var verbs = cfg.verbs, idOf = cfg.idOf;
    var idx = {};
    verbs.forEach(function (v, i) { idx[idOf(v)] = i; });

    var LKEY = 'deutschCards.' + cfg.key + '.learn';
    var SKEY = 'deutschCards.' + cfg.key + '.quiz';
    var learn = load(LKEY, []).filter(function (id) { return id in idx; });

    var settings = load(SKEY, {}) || {};
    var types = {};
    cfg.types.forEach(function (t) {
      types[t.id] = settings.types && t.id in settings.types ? !!settings.types[t.id] : !!t.on;
    });
    settings = {
      source: settings.source === 'learn' ? 'learn' : 'all',
      count: settings.count || 10,
      types: types,
      autoAdd: settings.autoAdd === undefined ? true : !!settings.autoAdd
    };
    function saveSettings() { save(SKEY, settings); }

    var quiz = { phase: 'setup', items: [], pos: 0 };
    var active = null;

    // ----- list -----
    function has(id) { return learn.indexOf(id) >= 0; }
    function changed() {
      save(LKEY, learn);
      updateCounts();
      if (cfg.onChange) cfg.onChange();
      if (active === 'learn') renderLearn();
      if (active === 'quiz') renderQuiz();
    }
    function toggle(id) {
      var i = learn.indexOf(id);
      if (i >= 0) learn.splice(i, 1); else learn.push(id);
      changed();
      return i < 0;
    }
    function addMany(ids) {
      var n = 0;
      ids.forEach(function (id) { if (id in idx && !has(id)) { learn.push(id); n++; } });
      if (n) changed();
      return n;
    }
    function updateCounts() {
      var els = document.querySelectorAll('.learn-count');
      for (var i = 0; i < els.length; i++) els[i].textContent = learn.length;
    }

    function importFromHash() {
      var m = location.hash.match(/[#&]learn=([^&]*)/);
      if (!m) return;
      var ids = [];
      try { ids = decodeURIComponent(m[1]).split('|'); } catch (e) { }
      var n = addMany(ids);
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
      setTimeout(function () {
        toast(n ? 'Added ' + n + ' verb' + (n > 1 ? 's' : '') + ' to your To-learn list'
          : 'Those verbs are already in your To-learn list');
      }, 300);
    }

    function shareLink() {
      if (!learn.length) { toast('Your list is empty'); return; }
      var url = location.href.split('#')[0] + '#learn=' + encodeURIComponent(learn.join('|'));
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (navigator.share && touch) {
        navigator.share({ title: document.title, text: 'My To-learn list', url: url }).catch(function () { });
        return;
      }
      var p = navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject();
      p.then(function () { toast('Link copied – open it on the other device'); },
        function () { window.prompt('Copy this link and open it on the other device:', url); });
    }

    // ----- quiz -----
    function enabledTypes() { return cfg.types.filter(function (t) { return settings.types[t.id]; }); }
    function sourceIdx() {
      if (settings.source === 'learn') return learn.map(function (id) { return idx[id]; });
      return verbs.map(function (v, i) { return i; });
    }
    function makeItem(vi, t) {
      var b = t.build(verbs[vi], vi);
      var opts = shuffle([b.correct].concat(b.distractors.slice(0, 3)));
      return {
        vi: vi, type: t.id,
        q: { ask: b.ask, prompt: b.prompt, sub: b.sub || '', options: opts, correctIndex: opts.indexOf(b.correct) },
        answer: null, ok: false
      };
    }
    function start(viList) {
      var ts = enabledTypes();
      quiz.items = viList.map(function (vi) { return makeItem(vi, ts[Math.floor(Math.random() * ts.length)]); });
      quiz.pos = 0;
      quiz.phase = 'q';
      renderQuiz();
      scrollTop();
    }
    function startFromSettings() {
      var pool = shuffle(sourceIdx());
      var n = settings.count === 'all' ? pool.length : Math.min(settings.count, pool.length);
      if (!n) return;
      start(pool.slice(0, n));
    }
    function answer(k) {
      var it = quiz.items[quiz.pos];
      if (!it || it.answer !== null) return;
      it.answer = k;
      it.ok = k === it.q.correctIndex;
      var id = idOf(verbs[it.vi]);
      if (!it.ok && settings.autoAdd && !has(id)) {
        learn.push(id);
        it.added = true;
        save(LKEY, learn); updateCounts(); if (cfg.onChange) cfg.onChange();
      }
      renderQuiz();
    }
    function next() {
      if (quiz.pos < quiz.items.length - 1) quiz.pos++;
      else quiz.phase = 'done';
      renderQuiz();
    }
    function scrollTop() {
      var r = cfg.quizEl.getBoundingClientRect();
      if (r.top < 0) window.scrollTo({ top: window.scrollY + r.top - 16, behavior: 'smooth' });
    }

    function detailTable(v) {
      return '<table class="study-detail">' + cfg.detailRows(v).map(function (r) {
        return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>';
      }).join('') + '</table>';
    }
    function starBtn(vi, extraClass) {
      var on = has(idOf(verbs[vi]));
      return '<button class="star-btn ' + (extraClass || '') + (on ? ' on' : '') + '" data-act="star" data-vi="' + vi +
        '" title="' + (on ? 'Remove from' : 'Add to') + ' To-learn list" aria-pressed="' + on + '">' + (on ? '★' : '☆') + '</button>';
    }

    function renderSetup() {
      var nLearn = learn.length;
      if (settings.source === 'learn' && !nLearn) settings.source = 'all';
      var pool = sourceIdx().length;
      var chips = [5, 10, 20].filter(function (c) { return c < pool; });
      var countSel = settings.count === 'all' || settings.count >= pool ? 'all' : settings.count;
      var custom = countSel !== 'all' && chips.indexOf(countSel) < 0;

      var h = '<div class="study-box">';
      h += '<h2 class="study-title">Quiz</h2>';
      h += '<p class="study-note">Pick the right answer out of the options. Keys <b>1–4</b> answer, <b>Enter</b> goes on.</p>';

      h += '<div class="study-field"><div class="study-label">Verbs from</div><div class="seg">';
      h += '<button data-act="source" data-val="all" class="' + (settings.source === 'all' ? 'on' : '') + '">All verbs · ' + verbs.length + '</button>';
      h += '<button data-act="source" data-val="learn" class="' + (settings.source === 'learn' ? 'on' : '') + '"' + (nLearn ? '' : ' disabled') +
        '>★ To-learn list · ' + nLearn + '</button>';
      h += '</div></div>';

      h += '<div class="study-field"><div class="study-label">How many verbs</div><div class="seg">';
      chips.forEach(function (c) {
        h += '<button data-act="count" data-val="' + c + '" class="' + (countSel === c ? 'on' : '') + '">' + c + '</button>';
      });
      h += '<button data-act="count" data-val="all" class="' + (countSel === 'all' ? 'on' : '') + '">All ' + pool + '</button>';
      h += '<input type="number" class="count-input' + (custom ? ' on' : '') + '" min="1" max="' + pool + '" placeholder="#" value="' +
        (custom ? countSel : '') + '" aria-label="Custom number of verbs">';
      h += '</div></div>';

      h += '<div class="study-field"><div class="study-label">Ask for</div><div class="seg">';
      cfg.types.forEach(function (t) {
        var on = settings.types[t.id];
        h += '<button data-act="type" data-val="' + t.id + '" class="' + (on ? 'on' : '') + '">' + (on ? '✓ ' : '') + esc(t.label) + '</button>';
      });
      h += '</div></div>';

      h += '<label class="study-check"><input type="checkbox" data-act="autoadd"' + (settings.autoAdd ? ' checked' : '') +
        '> Add verbs I get wrong to my To-learn list</label>';
      h += '<button class="study-primary" data-act="start">Start quiz</button>';
      h += '</div>';
      return h;
    }

    function renderQuestion() {
      var it = quiz.items[quiz.pos], v = verbs[it.vi], q = it.q, answered = it.answer !== null;
      var total = quiz.items.length;
      var right = quiz.items.filter(function (x) { return x.ok; }).length;
      var done = quiz.items.filter(function (x) { return x.answer !== null; }).length;

      var h = '<div class="study-box">';
      h += '<div class="quiz-top"><span>' + (quiz.pos + 1) + ' / ' + total + '</span>' +
        '<span class="quiz-score">✓ ' + right + (done - right ? ' &nbsp;✗ ' + (done - right) : '') + '</span>' +
        '<button class="link-btn" data-act="quit">End quiz</button></div>';
      h += '<div class="quiz-bar"><div style="width:' + Math.round(done / total * 100) + '%"></div></div>';

      h += '<div class="quiz-card">' + starBtn(it.vi, 'quiz-star');
      h += '<div class="quiz-ask">' + esc(q.ask) + '</div>';
      h += '<div class="quiz-prompt">' + esc(q.prompt) + '</div>';
      if (q.sub) h += '<div class="quiz-sub">' + esc(q.sub) + '</div>';
      h += '</div>';

      h += '<div class="quiz-options' + (q.options.length <= 2 ? ' two' : '') + '">';
      q.options.forEach(function (o, k) {
        var cls = '';
        if (answered) {
          if (k === q.correctIndex) cls = 'correct';
          else if (k === it.answer) cls = 'wrong';
          else cls = 'dim';
        }
        h += '<button class="quiz-opt ' + cls + '" data-act="answer" data-i="' + k + '"' + (answered ? ' disabled' : '') +
          '><span class="opt-key">' + (k + 1) + '</span><span class="opt-text">' + esc(o) + '</span></button>';
      });
      h += '</div>';

      if (answered) {
        h += '<div class="quiz-feedback ' + (it.ok ? 'ok' : 'bad') + '">';
        h += '<div class="fb-title">' + (it.ok ? '✓ Richtig!' : '✗ Not quite – it’s <b>' + esc(q.options[q.correctIndex]) + '</b>') + '</div>';
        if (it.added) h += '<div class="fb-note">★ Added to your To-learn list</div>';
        h += '<div class="fb-verb"><b>' + esc(cfg.title(v)) + '</b> <span>' + esc(cfg.subtitle(v)) + '</span></div>';
        h += detailTable(v);
        h += '</div>';
        h += '<button class="study-primary" data-act="next">' + (quiz.pos < total - 1 ? 'Next →' : 'See results') + '</button>';
      }
      h += '</div>';
      return h;
    }

    function renderResults() {
      var total = quiz.items.length;
      var answered = quiz.items.filter(function (x) { return x.answer !== null; });
      var right = answered.filter(function (x) { return x.ok; }).length;
      var wrong = answered.filter(function (x) { return !x.ok; });
      var pct = answered.length ? Math.round(right / answered.length * 100) : 0;
      var msg = pct === 100 ? 'Perfekt! 🎉' : pct >= 80 ? 'Sehr gut!' : pct >= 50 ? 'Gut – keep going.' : 'Übung macht den Meister.';

      var h = '<div class="study-box">';
      h += '<h2 class="study-title">Result</h2>';
      h += '<div class="result-score">' + right + ' <span>/ ' + answered.length + '</span></div>';
      h += '<p class="study-note center">' + pct + '% · ' + msg +
        (answered.length < total ? ' (' + (total - answered.length) + ' skipped)' : '') + '</p>';

      if (wrong.length) {
        h += '<h3 class="study-sub">Mistakes</h3><ul class="mistakes">';
        wrong.forEach(function (it) {
          var v = verbs[it.vi];
          h += '<li>' + starBtn(it.vi) + '<div><div><b>' + esc(cfg.title(v)) + '</b> <span class="muted">· ' + esc(it.q.ask) + '</span></div>' +
            '<div><span class="ans-wrong">' + esc(it.q.options[it.answer]) + '</span> → <span class="ans-right">' +
            esc(it.q.options[it.q.correctIndex]) + '</span></div></div></li>';
        });
        h += '</ul>';
      }
      h += '<div class="study-actions">';
      if (wrong.length) h += '<button class="study-primary" data-act="retry">Retry mistakes (' + wrong.length + ')</button>';
      h += '<button class="study-secondary" data-act="again">New quiz</button>';
      h += '</div></div>';
      return h;
    }

    function renderQuiz() {
      var el = cfg.quizEl;
      if (quiz.phase === 'setup') el.innerHTML = renderSetup();
      else if (quiz.phase === 'q') el.innerHTML = renderQuestion();
      else el.innerHTML = renderResults();
    }

    cfg.quizEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var act = b.getAttribute('data-act'), val = b.getAttribute('data-val');
      if (act === 'source') { settings.source = val; saveSettings(); renderQuiz(); }
      else if (act === 'count') { settings.count = val === 'all' ? 'all' : parseInt(val, 10); saveSettings(); renderQuiz(); }
      else if (act === 'type') {
        var on = enabledTypes().length;
        if (settings.types[val] && on === 1) { toast('Keep at least one question type'); return; }
        settings.types[val] = !settings.types[val]; saveSettings(); renderQuiz();
      }
      else if (act === 'autoadd') { settings.autoAdd = b.checked; saveSettings(); }
      else if (act === 'start') startFromSettings();
      else if (act === 'answer') answer(parseInt(b.getAttribute('data-i'), 10));
      else if (act === 'next') { next(); scrollTop(); }
      else if (act === 'quit') { quiz.phase = quiz.items.some(function (x) { return x.answer !== null; }) ? 'done' : 'setup'; renderQuiz(); }
      else if (act === 'retry') {
        start(quiz.items.filter(function (x) { return x.answer !== null && !x.ok; }).map(function (x) { return x.vi; }));
      }
      else if (act === 'again') { quiz.phase = 'setup'; renderQuiz(); }
      else if (act === 'star') toggle(idOf(verbs[+b.getAttribute('data-vi')]));
    });
    cfg.quizEl.addEventListener('change', function (e) {
      if (e.target.classList.contains('count-input')) {
        var n = parseInt(e.target.value, 10);
        if (n > 0) { settings.count = n; saveSettings(); renderQuiz(); }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (active !== 'quiz' || quiz.phase !== 'q') return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      var it = quiz.items[quiz.pos];
      if (it.answer === null) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= it.q.options.length) { e.preventDefault(); answer(n - 1); }
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        if (tag === 'BUTTON' && e.key !== 'ArrowRight') return; // the focused button handles it
        e.preventDefault(); next();
      }
    });

    // ----- To-learn list view -----
    function renderLearn() {
      var list = learn.map(function (id) { return idx[id]; }).sort(function (a, b) { return a - b; });
      var h = '<div class="study-box">';
      h += '<div class="learn-head"><h2 class="study-title">★ To learn</h2><span class="muted">' + list.length + ' verb' + (list.length === 1 ? '' : 's') + '</span></div>';
      h += '<p class="study-note">Verbs you haven’t memorized yet. Tap ☆ on a flashcard, in the All Verbs table or in the quiz to add one. ' +
        'The list is saved on this device – <b>Share link</b> copies it to another phone or laptop.</p>';

      h += '<div class="learn-add"><input type="text" list="learn-options-' + cfg.key + '" placeholder="Add a verb…" class="learn-input" autocomplete="off">' +
        '<datalist id="learn-options-' + cfg.key + '">';
      verbs.forEach(function (v) { if (!has(idOf(v))) h += '<option value="' + esc(idOf(v)) + '">' + esc(cfg.subtitle(v)) + '</option>'; });
      h += '</datalist><button class="study-secondary" data-act="add">Add</button></div>';

      if (list.length) {
        h += '<div class="study-actions left">' +
          '<button class="study-primary" data-act="flash">Flashcards</button>' +
          '<button class="study-primary" data-act="quiz">Quiz these</button>' +
          '<button class="study-secondary" data-act="share">Share link</button>' +
          '<button class="study-secondary danger" data-act="clear">Clear</button></div>';
        h += '<div class="learn-list">';
        list.forEach(function (vi) {
          var v = verbs[vi];
          h += '<div class="learn-row"><div class="learn-main"><div class="learn-inf">' + esc(cfg.title(v)) + '</div>' +
            '<div class="learn-en">' + esc(cfg.subtitle(v)) + '</div></div>' +
            '<div class="learn-forms">' + detailTable(v) + '</div>' +
            '<button class="remove-btn" data-act="remove" data-vi="' + vi + '" title="Remove – I know it now">✓<span> learned</span></button></div>';
        });
        h += '</div>';
      } else {
        h += '<div class="learn-empty">Your list is empty.<br>Add verbs with the ☆ button, the box above, or let the quiz add the ones you miss.</div>';
      }
      h += '</div>';
      cfg.learnEl.innerHTML = h;
    }

    function addFromInput() {
      var input = cfg.learnEl.querySelector('.learn-input');
      var val = (input.value || '').trim();
      if (!val) return;
      var id = null;
      if (val in idx) id = val;
      else {
        var low = val.toLowerCase();
        for (var i = 0; i < verbs.length; i++) {
          if (idOf(verbs[i]).toLowerCase() === low) { id = idOf(verbs[i]); break; }
        }
        if (!id) {
          var matches = verbs.filter(function (v) { return idOf(v).toLowerCase().indexOf(low) >= 0; });
          if (matches.length === 1) id = idOf(matches[0]);
        }
      }
      if (!id) { toast('No verb “' + val + '” found'); return; }
      if (has(id)) { toast(id + ' is already in the list'); return; }
      learn.push(id);
      changed();
      toast('Added ' + id);
      var again = cfg.learnEl.querySelector('.learn-input');
      if (again) again.focus();
    }

    cfg.learnEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'remove') toggle(idOf(verbs[+b.getAttribute('data-vi')]));
      else if (act === 'add') addFromInput();
      else if (act === 'share') shareLink();
      else if (act === 'clear') { if (window.confirm('Remove all ' + learn.length + ' verbs from your To-learn list?')) { learn = []; changed(); } }
      else if (act === 'flash') { if (cfg.onFlashcards) cfg.onFlashcards(); }
      else if (act === 'quiz') {
        settings.source = 'learn'; settings.count = 'all'; saveSettings();
        quiz.phase = 'setup';
        if (cfg.onGoQuiz) cfg.onGoQuiz();
      }
    });
    cfg.learnEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList.contains('learn-input')) { e.preventDefault(); addFromInput(); }
    });

    // ----- public -----
    updateCounts();
    setTimeout(importFromHash, 0); // after the page has finished wiring things up

    return {
      has: has,
      toggle: toggle,
      ids: function () { return learn.slice(); },
      show: function (which) {
        active = which;
        cfg.quizEl.style.display = which === 'quiz' ? '' : 'none';
        cfg.learnEl.style.display = which === 'learn' ? '' : 'none';
        if (which === 'quiz') { if (quiz.phase !== 'q') quiz.phase = quiz.phase === 'done' ? 'done' : 'setup'; renderQuiz(); }
        if (which === 'learn') renderLearn();
      },
      hide: function () { active = null; cfg.quizEl.style.display = 'none'; cfg.learnEl.style.display = 'none'; },
      toast: toast
    };
  }

  window.createStudy = createStudy;
  window.createStudy.formDistractors = formDistractors;
  window.createStudy.shuffle = shuffle;
  window.createStudy.esc = esc;
})();
