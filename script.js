/* ===========================================================
   T&O Development Group LLC — interaction logic
   - scroll-DRIVEN hero: scroll progress (0->1) scrubs a canvas
     frame-sequence, cross-fades the headline, highlights the phase
   - transparent -> solid header (transparent while hero is pinned)
   - scroll-reveal of [data-reveal] elements
   - obfuscated email assembly
   - mobile overlay menu, smooth nav, contact form
   =========================================================== */
(function () {
  'use strict';

  /* ---------- shared hero state ---------- */
  var headlines = [];
  var phaseItems = [];
  var currentIdx = -1;    // active headline/phase index, for cheap diffing

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------- Header: transparent while the hero is pinned ---------- */
  function applyHeaderState() {
    var h = document.getElementById('site-header');
    if (!h) return;
    var logo = document.getElementById('site-logo');
    var heroScroll = document.getElementById('hero-scroll');
    var scrolled = heroScroll
      ? heroScroll.getBoundingClientRect().bottom <= 72
      : window.scrollY > 60;
    if (scrolled) {
      h.style.background = 'rgba(250,250,248,0.9)';
      h.style.backdropFilter = 'saturate(180%) blur(14px)';
      h.style.webkitBackdropFilter = 'saturate(180%) blur(14px)';
      h.style.boxShadow = '0 1px 0 rgba(22,22,23,.08)';
      h.style.color = '#575758';
      h.style.paddingTop = '13px';
      h.style.paddingBottom = '13px';
      if (logo && !/logo\.png$/.test(logo.getAttribute('src'))) logo.src = 'assets/logo.png';
    } else {
      h.style.background = 'transparent';
      h.style.backdropFilter = 'none';
      h.style.webkitBackdropFilter = 'none';
      h.style.boxShadow = 'none';
      h.style.color = '#fff';
      h.style.paddingTop = '20px';
      h.style.paddingBottom = '20px';
      if (logo && !/logo-light\.png$/.test(logo.getAttribute('src'))) logo.src = 'assets/logo-light.png';
    }
  }

  /* ============================================================
     SCROLL-DRIVEN HERO
     ============================================================ */

  // How far through the pinned hero we have scrolled, 0..1.
  function computeHeroProgress() {
    var wrap = document.getElementById('hero-scroll');
    if (!wrap) return 0;
    var total = wrap.offsetHeight - window.innerHeight; // available scroll distance
    if (total <= 0) return 0;
    var scrolled = -wrap.getBoundingClientRect().top;   // wrapper sits at offsetTop 0
    return clamp(scrolled / total, 0, 1);
  }

  function updateHeadline(idx) {
    for (var i = 0; i < headlines.length; i++) {
      var h = headlines[i];
      h.classList.toggle('is-active', parseInt(h.getAttribute('data-i'), 10) === idx);
    }
  }

  function updatePhase(idx) {
    for (var i = 0; i < phaseItems.length; i++) {
      var p = phaseItems[i];
      p.classList.toggle('is-active', parseInt(p.getAttribute('data-phase'), 10) === idx);
    }
  }

  // Match the absolute-positioned headlines' container to the tallest of them
  // so the subhead/buttons never jump as the copy rotates.
  function sizeHeadlines() {
    var c = document.getElementById('hero-headlines');
    if (!c || !headlines.length) return;
    var max = 0;
    for (var i = 0; i < headlines.length; i++) {
      var hh = headlines[i].offsetHeight;
      if (hh > max) max = hh;
    }
    if (max > 0) c.style.height = max + 'px';
  }

  /* ---------- Canvas frame-sequence (Apple-style scroll scrub) ---------- */
  var FRAME_COUNT = 96;
  var canvas = null, ctx = null;
  var frames = [];          // preloaded Image objects
  var targetFrame = 0;      // frame the scroll wants
  var currentFrame = 0;     // smoothed frame we actually draw
  var rafId = null;

  // Horizontal focus for the "cover" crop: bias toward the house on narrow
  // screens (matches the old object-position: 72%); centered otherwise.
  function focusX() { return window.innerWidth <= 680 ? 0.72 : 0.5; }

  function frameReady(i) {
    var im = frames[i];
    return !!(im && im.complete && im.naturalWidth > 0);
  }
  // Nearest already-loaded frame to idx, so we never blank while loading.
  function nearestLoaded(idx) {
    if (frameReady(idx)) return idx;
    for (var d = 1; d < FRAME_COUNT; d++) {
      if (idx - d >= 0 && frameReady(idx - d)) return idx - d;
      if (idx + d < FRAME_COUNT && frameReady(idx + d)) return idx + d;
    }
    return -1;
  }

  // Draw an image to fill the canvas (object-fit: cover), cropping overflow.
  function drawCover(img) {
    if (!ctx || !canvas) return;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    if (!cw || !ch) return;
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var ir = iw / ih, cr = cw / ch, w, h;
    if (ir > cr) { h = ch; w = ch * ir; } else { w = cw; h = cw / ir; }
    var x = (cw - w) * focusX(), y = (ch - h) * 0.5;
    ctx.drawImage(img, x, y, w, h);
  }

  function draw(i) {
    var idx = clamp(Math.round(i), 0, FRAME_COUNT - 1);
    var use = nearestLoaded(idx);
    if (use >= 0) drawCover(frames[use]);
    // else: the CSS poster background stays visible (never blank)
  }

  // Size the canvas backing store for the device pixel ratio (crisp on
  // retina), then redraw.
  function resizeCanvas() {
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(currentFrame);
  }

  // rAF loop: ease currentFrame toward the scroll target and draw the
  // rounded frame, so the scrub feels fluid rather than stepped.
  function schedule() { if (rafId == null) rafId = requestAnimationFrame(tick); }
  function tick() {
    rafId = null;
    currentFrame += (targetFrame - currentFrame) * 0.2;
    if (Math.abs(targetFrame - currentFrame) < 0.1) currentFrame = targetFrame;
    draw(currentFrame);
    if (Math.abs(targetFrame - currentFrame) > 0.1) schedule();
  }

  function pad3(n) { n = String(n); while (n.length < 3) n = '0' + n; return n; }
  function preloadFrames() {
    for (var i = 1; i <= FRAME_COUNT; i++) {
      var img = new Image();
      img.decoding = 'async';
      (function (im, index) {
        im.onload = function () {
          // If this is the frame we currently want (and we'd been showing a
          // fallback/poster), repaint at the exact frame.
          if (Math.round(currentFrame) === index) draw(currentFrame);
        };
      })(img, i - 1);
      img.src = 'assets/frames/frame_' + pad3(i) + '.jpg';
      frames[i - 1] = img;
    }
  }

  function onHeroScroll() {
    var p = computeHeroProgress();
    targetFrame = p * (FRAME_COUNT - 1);
    var idx = clamp(Math.floor(p * 4), 0, 3);
    if (idx !== currentIdx) {
      currentIdx = idx;
      updateHeadline(idx);
      updatePhase(idx);
    }
    schedule();
  }

  function setupScrollHero() {
    canvas = document.getElementById('hero-canvas');
    headlines = Array.prototype.slice.call(document.querySelectorAll('.hero-headline'));
    phaseItems = Array.prototype.slice.call(document.querySelectorAll('.phase-item'));
    if (canvas) {
      ctx = canvas.getContext('2d');
      preloadFrames();
      resizeCanvas();
    }
    sizeHeadlines();
    onHeroScroll();
  }

  /* ---------- Scroll-reveal of editorial blocks ---------- */
  var io = null;
  var revealFallback = null;
  function setupReveal() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'))
      .filter(function (el) { return !el.__revealInit; });
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach(function (el) {
      el.__revealInit = true;
      if (reduce) { el.style.opacity = '1'; return; }
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = 'opacity .85s cubic-bezier(.2,.7,.2,1), transform .85s cubic-bezier(.2,.7,.2,1)';
      el.style.willChange = 'opacity, transform';
    });
    if (reduce) return;
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var el = en.target;
            var d = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
            setTimeout(function () { el.style.opacity = '1'; el.style.transform = 'none'; }, d);
            io.unobserve(el);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    }
    els.forEach(function (el) { io.observe(el); });
    if (revealFallback) clearTimeout(revealFallback);
    revealFallback = setTimeout(function () {
      document.querySelectorAll('[data-reveal]').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
    }, 3000);
  }

  /* ---------- Assemble obfuscated email addresses ---------- */
  function fillEmails() {
    ['email-link-1', 'email-link-2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__filled) return;
      var addr = el.getAttribute('data-user') + '@' + el.getAttribute('data-domain');
      el.setAttribute('href', 'mailto:' + addr);
      el.textContent = addr;
      el.__filled = true;
    });
  }

  /* ---------- Smooth in-page navigation ---------- */
  function scrollToId(id) {
    // The hero is position:sticky, so its rect.top is always 0 — jump to the
    // very top of its scroll wrapper instead.
    if (id === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var el = document.getElementById(id);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: top, behavior: 'smooth' });
  }

  /* ---------- Mobile overlay menu ---------- */
  function closeMenu() {
    var ov = document.getElementById('mobile-menu');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
  }
  function toggleMenu() {
    var ov = document.getElementById('mobile-menu');
    if (!ov) return;
    var open = ov.style.display !== 'flex';
    ov.style.display = open ? 'flex' : 'none';
    document.body.style.overflow = open ? 'hidden' : '';
  }

  /* ---------- Scroll-spy: mark the nav link of the section in view ---------- */
  function setupScrollSpy() {
    var ids = ['approach', 'process', 'about'];
    var sections = ids
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;
    var links = {};
    document.querySelectorAll('#site-nav a[data-target]').forEach(function (a) {
      links[a.getAttribute('data-target')] = a;
    });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (a) a.classList.toggle('is-active', en.isIntersecting);
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- Contact form: validate + success state ---------- */
  function setError(id, on) {
    var el = document.getElementById(id);
    if (el) el.style.display = on ? 'block' : 'none';
  }
  function onSubmit(e) {
    e.preventDefault();
    var get = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var name = get('f-name');
    var email = get('f-email');
    var message = get('f-message');
    var errName = !name;
    var errEmail = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    var errMessage = !message;
    setError('err-name', errName);
    setError('err-email', errEmail);
    setError('err-message', errMessage);
    if (errName || errEmail || errMessage) return;
    var form = document.getElementById('contact-form');
    var success = document.getElementById('contact-success');
    if (form) form.style.display = 'none';
    if (success) success.style.display = 'flex';
  }

  /* ---------- Wire everything up ---------- */
  function onScroll() {
    applyHeaderState();
    onHeroScroll();
  }
  function onResize() {
    resizeCanvas();
    sizeHeadlines();
    onHeroScroll();
  }

  function init() {
    applyHeaderState();
    setupReveal();
    fillEmails();
    setupScrollHero();
    setupScrollSpy();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', function () { resizeCanvas(); sizeHeadlines(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sizeHeadlines).catch(function () {});
    }

    // In-page nav links (header, hero, projects, footer, mobile menu)
    document.querySelectorAll('a[data-target]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        closeMenu();
        scrollToId(a.getAttribute('data-target'));
      });
    });

    // Hamburger + close button
    var toggle = document.getElementById('nav-toggle');
    if (toggle) toggle.addEventListener('click', toggleMenu);
    document.querySelectorAll('[data-menu-close]').forEach(function (b) {
      b.addEventListener('click', toggleMenu);
    });

    // Contact form
    var form = document.getElementById('contact-form');
    if (form) form.addEventListener('submit', onSubmit);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
