/* ===========================================================
   T&O Development Group LLC — interaction logic
   - scroll-DRIVEN hero: scroll progress (0->1) scrubs the video,
     cross-fades the headline, and highlights the active phase
   - transparent -> solid header (transparent while hero is pinned)
   - scroll-reveal of [data-reveal] elements
   - obfuscated email assembly
   - mobile overlay menu, smooth nav, contact form
   =========================================================== */
(function () {
  'use strict';

  /* ---------- shared hero state ---------- */
  var heroVideo = null;
  var headlines = [];
  var phaseItems = [];
  var targetProgress = 0; // where scroll wants the video (0..1)
  var displayTime = 0;    // smoothed video time we actually render
  var scheduled = false;  // a frame step is queued (rVFC/rAF)
  var currentIdx = -1;    // active headline/phase index, for cheap diffing
  var seekEnabled = false;
  var scrubReady = false; // only seek once the clip is buffered enough

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

  // iOS/Safari need a muted play()->pause() before they will honour
  // programmatic currentTime seeks. Do it once.
  function enableSeek() {
    if (seekEnabled || !heroVideo) return;
    seekEnabled = true;
    heroVideo.muted = true;
    var p = heroVideo.play();
    if (p && typeof p.then === 'function') {
      p.then(function () { heroVideo.pause(); }).catch(function () {});
    } else {
      try { heroVideo.pause(); } catch (e) {}
    }
  }

  // Capture the first frame to use as a poster, so the hero is never black.
  function makePoster() {
    if (!heroVideo) return;
    try {
      var w = heroVideo.videoWidth, h = heroVideo.videoHeight;
      if (!w || !h) return;
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(heroVideo, 0, 0, w, h);
      heroVideo.setAttribute('poster', cv.toDataURL('image/jpeg', 0.82));
    } catch (e) { /* cross-origin / unsupported — fall back to dark bg */ }
  }

  // Has the whole clip buffered? We delay scrubbing until it has, so a seek
  // never lands in an unbuffered region and stutters.
  function fullyBuffered() {
    var v = heroVideo;
    if (!v || !v.duration) return false;
    try {
      for (var i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= 0.1 && v.buffered.end(i) >= v.duration - 0.3) return true;
      }
    } catch (e) {}
    return false;
  }
  function markScrubReady() { if (!scrubReady) { scrubReady = true; schedule(); } }

  // Pace the scrub to real decoded frames: prefer requestVideoFrameCallback
  // (fires when a frame is actually presented) and fall back to rAF. A short
  // watchdog guarantees progress when a sub-frame seek presents no new frame.
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    var ran = false;
    var run = function () { if (ran) return; ran = true; scheduled = false; tick(); };
    if (heroVideo && typeof heroVideo.requestVideoFrameCallback === 'function') {
      heroVideo.requestVideoFrameCallback(run);
      setTimeout(function () { if (!ran) requestAnimationFrame(run); }, 120);
    } else {
      requestAnimationFrame(run);
    }
  }

  // Ease the displayed time toward the scroll target, then write currentTime.
  // Never seek straight from the scroll event.
  function tick() {
    var v = heroVideo;
    if (!v || !v.duration || isNaN(v.duration)) return;
    var targetTime = targetProgress * Math.max(0, v.duration - 0.06);
    displayTime += (targetTime - displayTime) * 0.18;
    if (Math.abs(targetTime - displayTime) < 0.01) displayTime = targetTime;
    if (scrubReady && v.readyState >= 2) { try { v.currentTime = displayTime; } catch (e) {} }
    if (Math.abs(targetTime - displayTime) > 0.008) schedule();
  }

  function onHeroScroll() {
    var p = computeHeroProgress();
    targetProgress = p;
    var idx = clamp(Math.floor(p * 4), 0, 3);
    if (idx !== currentIdx) {
      currentIdx = idx;
      updateHeadline(idx);
      updatePhase(idx);
    }
    schedule();
  }

  function setupScrollHero() {
    heroVideo = document.getElementById('hero-video');
    headlines = Array.prototype.slice.call(document.querySelectorAll('.hero-headline'));
    phaseItems = Array.prototype.slice.call(document.querySelectorAll('.phase-item'));

    if (heroVideo) {
      heroVideo.removeAttribute('autoplay');
      heroVideo.removeAttribute('loop');
      heroVideo.muted = true;
      heroVideo.defaultMuted = true;

      var onMeta = function () {
        try { heroVideo.currentTime = 0.001; } catch (e) {}
        enableSeek();
        sizeHeadlines();
        onHeroScroll();
      };
      if (heroVideo.readyState >= 1) onMeta();
      else heroVideo.addEventListener('loadedmetadata', onMeta, { once: true });

      if (heroVideo.readyState >= 2) makePoster();
      else heroVideo.addEventListener('loadeddata', makePoster, { once: true });

      // Safety: buffer the whole clip before enabling the scrub, so seeking
      // never hits an unbuffered region. Fall back after a few seconds so a
      // slow/stalled network can never freeze the hero permanently.
      heroVideo.preload = 'auto';
      if (fullyBuffered() || heroVideo.readyState >= 4) markScrubReady();
      heroVideo.addEventListener('canplaythrough', markScrubReady);
      heroVideo.addEventListener('progress', function () { if (fullyBuffered()) markScrubReady(); });
      setTimeout(markScrubReady, 8000);

      // Enable seeking on the first user gesture (iOS safeguard)
      var gesture = function () { enableSeek(); };
      window.addEventListener('scroll', gesture, { once: true, passive: true });
      window.addEventListener('touchstart', gesture, { once: true, passive: true });
      window.addEventListener('click', gesture, { once: true });
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

  /* ---------- Mute any audio; the hero video is scrubbed, never played ---------- */
  function silenceMedia() {
    document.querySelectorAll('audio').forEach(function (el) {
      el.muted = true;
      el.pause();
      el.removeAttribute('autoplay');
      el.removeAttribute('src');
    });
    document.querySelectorAll('video').forEach(function (el) {
      el.muted = true;
      el.defaultMuted = true;
      el.volume = 0;
      el.setAttribute('muted', '');
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
    var ids = ['approach', 'process', 'projects', 'about'];
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
    sizeHeadlines();
    onHeroScroll();
  }

  function init() {
    applyHeaderState();
    setupReveal();
    fillEmails();
    silenceMedia();
    setupScrollHero();
    setupScrollSpy();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('load', sizeHeadlines);
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
