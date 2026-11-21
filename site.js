/*
  Shared behaviour for every page (loaded in <head>):
  - compact name in the sticky menu bar once it sticks
  - "Menu" button + full-screen menu on phones
  - footer year / last-updated date
  - gentle fade-in for blocks marked data-reveal (homepage)
*/
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var menu = document.getElementById('menu');
    var list = menu && menu.querySelector('ul');

    if (menu && list) {
      // Compact name shown in the bar after it sticks to the top
      var homeLink = list.querySelector('a');
      var name = document.createElement('a');
      name.className = 'menu-name';
      name.href = homeLink ? homeLink.getAttribute('href') : '/';
      name.textContent = 'Kevin Liu';
      name.setAttribute('tabindex', '-1');
      menu.insertBefore(name, menu.firstChild);

      // Phone menu button
      list.id = list.id || 'menu-list';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', list.id);
      button.innerHTML = '<span class="menu-label">Menu</span><span class="menu-icon" aria-hidden="true"><i></i><i></i></span>';
      menu.appendChild(button);

      var label = button.querySelector('.menu-label');
      var setOpen = function (open) {
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        label.textContent = open ? 'Close' : 'Menu';
        menu.classList.toggle('menu-open', open);
        document.body.classList.toggle('menu-open', open);
      };
      button.addEventListener('click', function () {
        var open = button.getAttribute('aria-expanded') !== 'true';
        if (open) {
          // bring the bar to the top first so the full-screen list fits
          var barTop = menu.getBoundingClientRect().top;
          if (barTop > 0) {
            try { window.scrollTo({ top: window.scrollY + barTop, behavior: 'instant' }); }
            catch (err) { window.scrollTo(0, window.scrollY + barTop); }
          }
        }
        setOpen(open);
        if (open) {
          var first = list.querySelector('a');
          if (first) first.focus({ preventScroll: true });
        }
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('menu-open')) {
          setOpen(false);
          button.focus();
        }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 900) setOpen(false);
      });

      // Stuck state for the sticky bar
      var ticking = false;
      var update = function () {
        ticking = false;
        var stuck = menu.getBoundingClientRect().top <= 0 && window.scrollY > 0;
        menu.classList.toggle('is-stuck', stuck);
        name.setAttribute('tabindex', stuck ? '0' : '-1');
      };
      window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
      }, { passive: true });
      update();
    }

    // Footer dates
    var year = document.querySelectorAll('.js-year');
    for (var i = 0; i < year.length; i++) year[i].textContent = new Date().getFullYear();
    var upd = document.querySelectorAll('.js-updated');
    for (var j = 0; j < upd.length; j++) upd[j].textContent = document.lastModified.substr(0, 10);

    // Pictures that text wraps around: keep the same visual gap between the
    // picture and the text beside it and below it. The space beside the
    // picture is set in CSS (--wrap-gap); text below a picture always starts
    // on a whole line, so here each picture is resized very slightly (a few
    // pixels at most) so that a line of text starts exactly one gap below it.
    var wrapped = document.querySelectorAll('#sidebar img[align="right"], #sidebar img[align="left"], .intro .portrait');
    if (wrapped.length) {
      var canvas = document.createElement('canvas').getContext('2d');
      var inkCache = {};
      // How far below the top of a text box the main body of the lowercase
      // letters (a, e, o, x ...) starts; that is where a line of text looks
      // like it begins
      var inkInset = function (el) {
        var cs = getComputedStyle(el);
        var key = cs.fontStyle + '|' + cs.fontWeight + '|' + cs.fontSize + '|' + cs.fontFamily;
        if (key in inkCache) return inkCache[key];
        canvas.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        var m = canvas.measureText('xaeonmrsuvwz');
        var v = m.fontBoundingBoxAscent - m.actualBoundingBoxAscent;
        return (inkCache[key] = isNaN(v) ? 0 : v);
      };

      // Lines of text after the picture, measured from the page itself
      var linesAfter = function (pic, limitY) {
        var scope = pic.closest('td, section, #sidebar') || document.body;
        var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
        var frags = [], node, range = document.createRange();
        while ((node = walker.nextNode())) {
          if (!(pic.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
          if (!/\S/.test(node.nodeValue)) continue;
          var parent = node.parentElement;
          if (!parent || parent.closest('.portrait, script, style')) continue;
          range.selectNodeContents(node);
          var rects = range.getClientRects();
          if (!rects.length) continue;
          var inset = inkInset(parent);
          var lh = parseFloat(getComputedStyle(parent).lineHeight);
          for (var i = 0; i < rects.length; i++) {
            var r = rects[i];
            if (r.height < 1 || r.width < 1) continue;
            if (r.top > limitY) { i = rects.length; node = null; break; }
            var lead = isNaN(lh) ? 0 : Math.max(0, (lh - r.height) / 2);
            frags.push({ top: r.top, lineTop: r.top - lead, lh: isNaN(lh) ? r.height : lh,
                         inkTop: r.top + inset, left: r.left, right: r.right });
          }
          if (node === null) break;
        }
        // merge fragments that sit on the same line
        frags.sort(function (a, b) { return a.top - b.top; });
        var lines = [];
        frags.forEach(function (f) {
          var last = lines[lines.length - 1];
          if (last && Math.abs(f.top - last.top) < 3) {
            last.inkTop = Math.min(last.inkTop, f.inkTop);
            last.lineTop = Math.min(last.lineTop, f.lineTop);
            last.left = Math.min(last.left, f.left);
            last.right = Math.max(last.right, f.right);
            last.lh = Math.max(last.lh, f.lh);
          } else lines.push(f);
        });
        return lines;
      };

      var gapPx = function () {
        var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--wrap-gap'));
        return isNaN(v) ? 20 : v;
      };

      var fitOne = function (pic) {
        pic.style.removeProperty('width');
        pic.style.removeProperty('margin-bottom');
        var pcs = getComputedStyle(pic);
        var side = pcs.float;
        if (side !== 'left' && side !== 'right') return;
        // space below = the picture's own space beside the text
        var G = parseFloat(side === 'right' ? pcs.marginLeft : pcs.marginRight);
        if (isNaN(G)) G = gapPx();
        var box = pic.getBoundingClientRect();
        if (!box.height) return;
        var ratio = box.width / box.height, baseW = box.width;

        for (var pass = 0; pass < 6; pass++) {
          box = pic.getBoundingClientRect();
          var floatBottom = box.bottom + (parseFloat(getComputedStyle(pic).marginBottom) || 0);
          var lines = linesAfter(pic, box.bottom + 300);
          // A line is under the picture if it reaches into the picture's column
          // (beside the picture, lines stop short of it) or starts below its margin.
          var isBelow = function (l) {
            var reaches = side === 'right' ? l.right > box.left + 1 : l.left < box.right - 1;
            return l.top > box.top && (reaches || l.lineTop >= floatBottom - 0.5);
          };
          var nextIdx = -1;
          for (var i = 0; i < lines.length; i++) { if (isBelow(lines[i])) { nextIdx = i; break; } }
          if (nextIdx < 0) break;
          var next = lines[nextIdx];
          var prev = nextIdx > 0 && lines[nextIdx - 1].top >= box.top - 2 ? lines[nextIdx - 1] : null;

          var dNext = next.inkTop - box.bottom - G;
          var dPrev = prev ? prev.inkTop - box.bottom - G : Infinity;
          var target = Math.abs(dPrev) < Math.abs(dNext) ? prev : next;
          var d = target === prev ? dPrev : dNext;
          var newW = (box.height + d) * ratio;
          if (newW < baseW * 0.88 || newW > baseW * 1.12) {
            target = next; d = dNext; newW = (box.height + d) * ratio;
            if (newW < baseW * 0.88 || newW > baseW * 1.12) break;
          }
          // End the picture's margin half a line above the target line, so the
          // target line is clearly below the picture whatever the browser's
          // exact font measurements are.
          var mb = Math.max(0, (target.lineTop - target.lh / 2) - (box.bottom + d));
          pic.style.setProperty('margin-bottom', mb.toFixed(2) + 'px', 'important');
          if (Math.abs(d) >= 0.5) pic.style.setProperty('width', newW.toFixed(2) + 'px');
          else if (target === next) break;     // already exact
        }
      };

      var fitAll = function () {
        inkCache = {};                         // fonts may have finished loading since last time
        for (var w = 0; w < wrapped.length; w++) fitOne(wrapped[w]);
      };
      var fitTimer = null;
      var scheduleFit = function () {
        clearTimeout(fitTimer);
        fitTimer = setTimeout(fitAll, 120);
      };
      scheduleFit();
      window.addEventListener('load', scheduleFit);
      window.addEventListener('resize', scheduleFit);
      if (document.fonts) {
        if (document.fonts.ready) document.fonts.ready.then(scheduleFit);
        if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', scheduleFit);
      }
    }

    // My Group cards: where a card's text is shorter than the photo, use some
    // of that spare room to open up the space between the name and the line
    // below it, up to --card-name-gap (the text is then centred against the
    // photo in CSS). Cards that are already full keep the normal spacing.
    var cardBodies = document.querySelectorAll('#sidebar td[bgcolor] .card-body');
    if (cardBodies.length) {
      var fitCards = function () {
        var cap = parseFloat(getComputedStyle(doc).getPropertyValue('--card-name-gap'));
        if (isNaN(cap)) cap = 16;
        for (var c = 0; c < cardBodies.length; c++) {
          var body = cardBodies[c], name = body.querySelector('h3');
          var row = body.closest('tr'), img = row && row.querySelector('img');
          if (!name || !img || !body.lastElementChild) continue;
          name.style.removeProperty('margin-bottom');
          var ib = img.getBoundingClientRect();
          if (!ib.height) continue;
          var base = parseFloat(getComputedStyle(name).marginBottom) || 0;
          var spare = ib.height - body.getBoundingClientRect().height;
          var extra = Math.min(cap - base, spare);
          if (extra > 0.5) name.style.marginBottom = (base + extra).toFixed(2) + 'px';
        }
      };
      var cardTimer = null;
      var scheduleCards = function () { clearTimeout(cardTimer); cardTimer = setTimeout(fitCards, 80); };
      scheduleCards();
      window.addEventListener('load', scheduleCards);
      window.addEventListener('resize', scheduleCards);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleCards);
    }

    // Bottom of the white panel: leave the same space below the last thing on
    // the page (a line of text, a picture, a rule, a button ...) as at the
    // panel's sides, whatever empty markup the page happens to end with.
    var panel = document.getElementById('page');
    if (panel) {
      var metrics = document.createElement('canvas').getContext('2d');
      var ascents = {};
      var ascent = function (cs) {             // top of a line of text -> its baseline
        var key = cs.fontStyle + '|' + cs.fontWeight + '|' + cs.fontSize + '|' + cs.fontFamily;
        if (!(key in ascents)) {
          metrics.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          var a = metrics.measureText('x').fontBoundingBoxAscent;
          ascents[key] = isNaN(a) ? parseFloat(cs.fontSize) * 0.8 : a;
        }
        return ascents[key];
      };
      var unseen = function (color, paper) {
        return !color || color === 'transparent' || color === paper || /rgba\(.*,\s*0\)$/.test(color);
      };
      var panelKid = function () {             // the panel's last child in the normal flow
        for (var k = panel.lastElementChild; k; k = k.previousElementSibling) {
          var ks = getComputedStyle(k);
          if (ks.display !== 'none' && ks.position !== 'absolute' && ks.position !== 'fixed' &&
              !/^(SCRIPT|STYLE|TEMPLATE)$/.test(k.tagName)) return k;
        }
        return null;
      };
      // blocks still waiting to fade in sit a little lower than they will end up
      var shiftCache = null;
      var shift = function (el) {
        var rv = el.closest('[data-reveal]');
        if (!rv) return 0;
        var k = shiftCache.indexOf(rv);
        if (k >= 0) return shiftCache[k + 1];
        var t = getComputedStyle(rv).transform, y = 0;
        if (t && t !== 'none') { try { y = new DOMMatrixReadOnly(t).m42; } catch (err) { y = 0; } }
        shiftCache.push(rv, y);
        return y;
      };
      var lowestInk = function (limit, paper) {
        var low = -Infinity, i, r;
        shiftCache = [];
        var walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT), node, range = document.createRange();
        while ((node = walker.nextNode())) {
          if (!/\S/.test(node.nodeValue)) continue;
          var el = node.parentElement;
          if (!el || el.closest('script, style, noscript')) continue;
          var cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || unseen(cs.color, paper)) continue;
          range.selectNodeContents(node);
          var rects = range.getClientRects();
          for (i = 0; i < rects.length; i++) {
            r = rects[i];
            if (r.width < 1 || r.height < 1) continue;
            var base = r.top + ascent(cs) - shift(el);
            if (base > low && base <= limit) low = base;
          }
        }
        var els = panel.querySelectorAll('*');
        for (i = 0; i < els.length; i++) {
          var e = els[i], tag = e.tagName.toUpperCase();
          if (/^(SCRIPT|STYLE|NOSCRIPT|BR|TEMPLATE)$/.test(tag)) continue;
          r = e.getBoundingClientRect();
          var dy = shift(e);
          if (r.width < 1 || r.height < 0.5 || r.bottom - dy <= low || r.top - dy > limit) continue;
          var es = getComputedStyle(e);
          if (es.visibility === 'hidden' || es.position === 'fixed') continue;
          var b = -Infinity;
          var bottom = r.bottom - dy, top = r.top - dy;
          if (/^(IMG|SVG|VIDEO|CANVAS|IFRAME|OBJECT|EMBED)$/.test(tag)) b = bottom;
          if (!unseen(es.backgroundColor, paper)) b = bottom;
          if (parseFloat(es.borderBottomWidth) > 0 && es.borderBottomStyle !== 'none' && !unseen(es.borderBottomColor, paper)) b = bottom;
          else if (parseFloat(es.borderTopWidth) > 0 && es.borderTopStyle !== 'none' && !unseen(es.borderTopColor, paper)) b = Math.max(b, top + parseFloat(es.borderTopWidth));
          if (b > low && b <= limit) low = b;
        }
        return low;
      };
      var lastKid = null;
      var fitBottom = function () {
        panel.style.removeProperty('padding-bottom');
        if (lastKid) lastKid.style.removeProperty('margin-bottom');
        lastKid = panelKid();
        var ps = getComputedStyle(panel);
        var side = parseFloat(ps.paddingLeft), pad = parseFloat(ps.paddingBottom);
        var pr = panel.getBoundingClientRect();
        var low = lowestInk(pr.bottom, ps.backgroundColor);
        if (!isFinite(low) || isNaN(side) || isNaN(pad)) return;
        var spare = (pr.bottom - pad) - low;   // empty space below the last thing, above the padding
        var newPad = side - spare;
        if (newPad >= 0) panel.style.paddingBottom = newPad.toFixed(2) + 'px';
        else if (lastKid) {
          panel.style.paddingBottom = '0px';
          var mb = parseFloat(getComputedStyle(lastKid).marginBottom) || 0;
          lastKid.style.marginBottom = (mb + newPad).toFixed(2) + 'px';
        }
      };
      var bottomTimer = null;
      var scheduleBottom = function () { clearTimeout(bottomTimer); bottomTimer = setTimeout(fitBottom, 150); };
      fitBottom();
      scheduleBottom();
      window.addEventListener('load', scheduleBottom);
      window.addEventListener('resize', scheduleBottom);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleBottom);
      // content that grows or shrinks later (pictures loading, "show more" buttons ...)
      if ('ResizeObserver' in window) {
        var watcher = new ResizeObserver(scheduleBottom);
        for (var kid = panel.firstElementChild; kid; kid = kid.nextElementSibling) watcher.observe(kid);
      } else {
        document.addEventListener('click', scheduleBottom);
      }
    }

    // Fade-in on scroll
    var reveal = document.querySelectorAll('[data-reveal]');
    if (reveal.length && !reduceMotion && 'IntersectionObserver' in window) {
      doc.classList.add('reveal-ready');
      var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -6%', threshold: 0 });
      for (var k = 0; k < reveal.length; k++) io.observe(reveal[k]);
    }
  });
})();
