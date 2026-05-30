/* ============================================================
   OS — Operating Systems · Study Notes
   Interaction layer
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------------------------------------------------------
     1.  THEME TOGGLE  (persisted in localStorage)
     --------------------------------------------------------- */
  const root     = document.documentElement;
  const themeBtn = $('#theme-btn');

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('ppm-theme', t); } catch (e) {}
  }

  // initial theme: stored preference → system preference → light
  try {
    const saved = localStorage.getItem('ppm-theme');
    if (saved) {
      applyTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    }
  } catch (e) {}

  themeBtn.addEventListener('click', () => {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------------------------------------------------------
     2.  MOBILE MENU
     --------------------------------------------------------- */
  const sidebar = $('#sidebar');
  const menuBtn = $('#menu-btn');
  const scrim   = $('#scrim');

  function closeMenu() { sidebar.classList.remove('open'); scrim.classList.remove('open'); }
  function toggleMenu() { sidebar.classList.toggle('open'); scrim.classList.toggle('open'); }

  menuBtn.addEventListener('click', toggleMenu);
  scrim.addEventListener('click', closeMenu);
  $$('.nav-link', sidebar).forEach(a => a.addEventListener('click', closeMenu));

  /* ---------------------------------------------------------
     3.  READING PROGRESS BAR
     --------------------------------------------------------- */
  const progress = $('#progress');
  const totop    = $('#totop');

  function onScroll() {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const height   = h.scrollHeight - h.clientHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    progress.style.width = pct + '%';
    totop.classList.toggle('show', scrolled > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  totop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------------------------------------------------------
     4.  SCROLL-SPY  (highlight active nav link)
     --------------------------------------------------------- */
  const modules  = $$('.module');
  const navLinks = $$('.nav-link');
  const linkFor  = id => navLinks.find(a => a.getAttribute('href') === '#' + id);

  const spy = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        const id = en.target.id;
        navLinks.forEach(a => a.classList.remove('active'));
        const link = linkFor(id);
        if (link) {
          link.classList.add('active');
          // keep the active link in view within the sidebar
          const r = link.getBoundingClientRect();
          const sr = sidebar.getBoundingClientRect();
          if (r.top < sr.top + 70 || r.bottom > sr.bottom - 20) {
            link.scrollIntoView({ block: 'nearest' });
          }
        }
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  modules.forEach(m => spy.observe(m));

  /* ---------------------------------------------------------
     5.  REVEAL ON SCROLL
     --------------------------------------------------------- */
  const revealer = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  $$('.reveal').forEach((el, i) => {
    // gentle stagger only within the first viewport
    revealer.observe(el);
  });

  /* ---------------------------------------------------------
     6.  SEARCH INDEX  (built from module headings + content)
     --------------------------------------------------------- */
  const searchInput   = $('#search');
  const searchResults = $('#search-results');

  // Build a lightweight index: each entry = a heading (h2/h3/h4) with its module.
  const index = [];
  modules.forEach(mod => {
    const modId    = mod.id;
    const modTitle = ($('.module-head h2', mod) || {}).textContent || modId;
    // module itself
    const headP = $('.module-head p', mod);
    index.push({
      id: modId, modId, modTitle,
      title: modTitle,
      text: (modTitle + ' ' + (headP ? headP.textContent : '')).toLowerCase(),
      target: mod
    });
    // sub-headings
    $$('h3, h4', mod).forEach((h, i) => {
      const anchor = h;
      if (!h.id) h.id = modId + '-h-' + i;
      index.push({
        id: h.id, modId, modTitle,
        title: h.textContent.trim(),
        text: h.textContent.toLowerCase(),
        target: anchor
      });
    });
    // definition tags & key terms for richer matching
    $$('.df-tag, .concept h4, .callout-title, thead th, .pill', mod).forEach(el => {
      const t = el.textContent.trim();
      if (t.length > 2) {
        index.push({
          id: modId, modId, modTitle,
          title: t,
          text: t.toLowerCase(),
          target: el.closest('.concept, .define, .callout, .table-wrap, .pill-row, .diagram') || el,
          sub: true
        });
      }
    });
  });

  let activeIdx = -1;
  let currentResults = [];

  function flash(el) {
    if (!el) return;
    // wrap target heading text in a temporary mark for a moment
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const mk = document.createElement('span');
    el.classList.add('flash-target');
    const prev = el.style.transition;
    el.animate(
      [{ background: 'color-mix(in srgb, var(--gold) 45%, transparent)' },
       { background: 'transparent' }],
      { duration: 1800, easing: 'ease' }
    );
  }

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('open'); searchResults.innerHTML = ''; return; }

    const terms = q.split(/\s+/);
    const scored = [];
    const seen = new Set();
    index.forEach(item => {
      let score = 0;
      terms.forEach(term => {
        const idx = item.text.indexOf(term);
        if (idx === -1) { score -= 100; return; }
        score += 10;
        if (item.text.startsWith(term)) score += 8;     // prefix bonus
        if (!item.sub) score += 4;                       // headings rank higher
        if (item.title.toLowerCase() === term) score += 12;
      });
      if (score > 0) {
        const key = item.title + '|' + item.modId;
        if (!seen.has(key)) { seen.add(key); scored.push({ item, score }); }
      }
    });
    scored.sort((a, b) => b.score - a.score);
    currentResults = scored.slice(0, 9).map(s => s.item);

    if (!currentResults.length) {
      searchResults.innerHTML = '<div class="sr-empty">No matches for “' + escapeHtml(q) + '”.</div>';
      searchResults.classList.add('open');
      return;
    }

    searchResults.innerHTML = currentResults.map((it, i) =>
      '<button class="sr-item" data-i="' + i + '">' +
        '<span class="sr-mod">' + escapeHtml(it.modTitle) + '</span>' +
        highlight(it.title, terms) +
      '</button>'
    ).join('');
    searchResults.classList.add('open');
    activeIdx = -1;
  }

  function highlight(text, terms) {
    let out = escapeHtml(text);
    terms.forEach(t => {
      if (!t) return;
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function goToResult(i) {
    const it = currentResults[i];
    if (!it) return;
    searchResults.classList.remove('open');
    searchInput.blur();
    setTimeout(() => flash(it.target), 120);
  }

  searchInput.addEventListener('input', e => runSearch(e.target.value));
  searchInput.addEventListener('focus', e => { if (e.target.value) runSearch(e.target.value); });

  searchInput.addEventListener('keydown', e => {
    const items = $$('.sr-item', searchResults);
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); goToResult(activeIdx < 0 ? 0 : activeIdx); return; }
    else if (e.key === 'Escape') { searchResults.classList.remove('open'); searchInput.blur(); return; }
    else return;
    items.forEach((it, i) => it.classList.toggle('active', i === activeIdx));
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
  });

  searchResults.addEventListener('click', e => {
    const btn = e.target.closest('.sr-item');
    if (btn) goToResult(+btn.dataset.i);
  });

  // close search on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
  });

  // keyboard shortcut: "/" focuses search
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== searchInput && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); searchInput.focus();
    }
  });

  /* ---------------------------------------------------------
     7.  EXAM Q&A  —  expand / collapse controls + print
     --------------------------------------------------------- */
  const qaItems   = $$('.qa');
  const expandBtn = $('#exam-expand');
  const collapseBtn = $('#exam-collapse');
  const countEl   = $('#exam-count');

  if (qaItems.length) {
    if (countEl) countEl.textContent = qaItems.length + ' questions';
    if (expandBtn)  expandBtn.addEventListener('click',  () => qaItems.forEach(d => d.open = true));
    if (collapseBtn) collapseBtn.addEventListener('click', () => qaItems.forEach(d => d.open = false));

    // when search jumps to a heading/term inside a closed answer, open it
    const openContaining = (el) => {
      const d = el && el.closest('.qa');
      if (d && !d.open) d.open = true;
    };
    const origFlashTarget = searchResults; // hook via goToResult side-effect
    searchResults.addEventListener('click', e => {
      const btn = e.target.closest('.sr-item');
      if (!btn) return;
      const it = currentResults[+btn.dataset.i];
      if (it) openContaining(it.target);
    });

    // ensure all answers are open during print, then restore state
    let snapshot = null;
    window.addEventListener('beforeprint', () => {
      snapshot = qaItems.map(d => d.open);
      qaItems.forEach(d => d.open = true);
    });
    window.addEventListener('afterprint', () => {
      if (snapshot) qaItems.forEach((d, i) => d.open = snapshot[i]);
    });
  }

  /* ---------------------------------------------------------
     8.  COPY BUTTONS ON CODE BLOCKS
     --------------------------------------------------------- */
  $$('.code').forEach(block => {
    // wrap so the button can position relative to the block
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    block.parentNode.insertBefore(wrap, block);
    wrap.appendChild(block);

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code to clipboard');
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const text = block.innerText;
      const done = () => { btn.textContent = 'Copied!'; btn.classList.add('ok'); setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
      } else {
        fallbackCopy(text, done);
      }
    });
  });

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------------------------------------------------------
     9.  KEYBOARD-SHORTCUT HINT  (shows once, dismissible)
     --------------------------------------------------------- */
  try {
    if (!localStorage.getItem('os-hint-seen')) {
      const hint = document.createElement('div');
      hint.className = 'kbd-hint';
      hint.innerHTML = 'Press <kbd>/</kbd> to search · <kbd>Ctrl/⌘ P</kbd> to print all answers';
      document.body.appendChild(hint);
      requestAnimationFrame(() => hint.classList.add('show'));
      const dismiss = () => { hint.classList.remove('show'); setTimeout(() => hint.remove(), 400); try { localStorage.setItem('os-hint-seen', '1'); } catch (e) {} };
      setTimeout(dismiss, 6000);
      hint.addEventListener('click', dismiss);
    }
  } catch (e) {}

})();
