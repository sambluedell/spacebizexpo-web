/* ============================================================
   Space Expo 2026 Shenzhen — 商业航天生态合作大会
   Main JavaScript
   ============================================================ */

// --- Hero starfield ---
(function initStars() {
  const container = document.getElementById('stars');
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 80; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.left = Math.random() * 100 + '%';
    dot.style.top = Math.random() * 100 + '%';
    dot.style.animationDelay = Math.random() * 4 + 's';
    dot.style.animationDuration = (2 + Math.random() * 5) + 's';
    dot.style.width = dot.style.height = (1 + Math.random() * 1.5) + 'px';
    frag.appendChild(dot);
  }
  container.appendChild(frag);
})();

// --- Countdown ---
(function initCountdown() {
  const target = new Date(2026, 7, 19, 9, 0, 0); // Aug 19, 2026 09:00 CST
  const elD = document.getElementById('cd-d');
  const elH = document.getElementById('cd-h');
  const elM = document.getElementById('cd-m');
  const elS = document.getElementById('cd-s');
  if (!elD || !elH || !elM || !elS) return;

  function tick() {
    const diff = Math.max(0, target - Date.now());
    elD.textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
    elH.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    elM.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    elS.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();

// --- Header scroll shadow ---
(function initHeaderScroll() {
  const header = document.getElementById('header');
  if (!header) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        header.classList.toggle('scrolled', window.scrollY > 10);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
})();

// --- Mobile menu ---
(function initMobileMenu() {
  const btn = document.getElementById('menu-btn');
  const nav = document.getElementById('nav-main');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    btn.textContent = nav.classList.contains('open') ? '✕' : '☰';
  });

  // Allow dropdown toggling on mobile
  nav.querySelectorAll('li').forEach(li => {
    if (li.querySelector('.dropdown')) {
      const link = li.querySelector('a');
      link.addEventListener('click', function(e) {
        if (window.innerWidth <= 860) {
          e.preventDefault();
          li.classList.toggle('open');
        }
      });
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#header') && nav.classList.contains('open')) {
      nav.classList.remove('open');
      btn.textContent = '☰';
    }
  });
})();

// --- Smooth anchor offset (account for fixed header) ---
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      const headerH = 68;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH;
      window.scrollTo({ top, behavior: 'smooth' });

      // Close mobile nav after click
      const nav = document.getElementById('nav-main');
      const btn = document.getElementById('menu-btn');
      if (nav && nav.classList.contains('open')) {
        nav.classList.remove('open');
        if (btn) btn.textContent = '☰';
      }
    });
  });
})();

// --- Active nav section on scroll ---
(function initScrollSpy() {
  const sections = [];
  document.querySelectorAll('section[id]').forEach(sec => sections.push(sec));
  if (sections.length === 0) return;

  const navLinks = document.querySelectorAll('#nav-main > li > a[href^="#"]');
  let ticking = false;

  function update() {
    const scrollY = window.scrollY + 120;
    let currentId = '';
    for (const sec of sections) {
      if (sec.offsetTop <= scrollY) {
        currentId = sec.getAttribute('id');
      }
    }
    navLinks.forEach(link => {
      const li = link.parentElement;
      li.classList.toggle('active', link.getAttribute('href') === '#' + currentId);
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();

// --- Registration form ---
(function initForm() {
  const form = document.getElementById('reg-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.textContent;
    btn.textContent = '提交中...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (result.success) {
        alert('✅ 报名成功！工作人员将在3个工作日内与您联系。');
        form.reset();
      } else {
        alert('❌ ' + (result.message || '提交失败，请重试'));
      }
    } catch {
      alert('❌ 网络错误，请稍后重试');
    } finally {
      btn.textContent = origText;
      btn.disabled = false;
    }
  });
})();

// --- Load exhibitors from API ---
(function loadExhibitors() {
  const grid = document.getElementById('exh-grid');
  if (!grid) return;
  fetch('/api/exhibitors')
    .then(r => r.json())
    .then(items => {
      if (items.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">暂无数据</p>'; return; }
      grid.innerHTML = items.map(i => {
        if (i.logo) {
          return `<a href="${i.url || '#'}" target="${i.url ? '_blank' : '_self'}" class="exh-item${i.isVip ? ' vip' : ''}" style="flex-direction:column;gap:6px;padding:14px;">
            <img src="${i.logo}" alt="${i.name}" style="max-height:36px;max-width:80%;object-fit:contain;">
            <span style="font-size:.75rem;font-weight:400;">${i.name}</span>
          </a>`;
        }
        return `<a href="${i.url || '#'}" target="${i.url ? '_blank' : '_self'}" class="exh-item${i.isVip ? ' vip' : ''}">${i.name}</a>`;
      }).join('');
    })
    .catch(() => { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">加载失败</p>'; });
})();

// --- Load media from API ---
(function loadMedia() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  fetch('/api/media')
    .then(r => r.json())
    .then(items => {
      if (items.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">暂无数据</p>'; return; }
      grid.innerHTML = items.map(i => {
        const el = document.createElement('div');
        if (i.logo) {
          return `<a href="${i.url || '#'}" target="${i.url ? '_blank' : '_self'}" class="media-item" style="display:flex;align-items:center;justify-content:center;padding:16px;">
            <img src="${i.logo}" alt="${i.name}" style="max-height:32px;max-width:80%;object-fit:contain;">
          </a>`;
        }
        return `<div class="media-item">${i.name}</div>`;
      }).join('');
    })
    .catch(() => { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">加载失败</p>'; });
})();

// --- Load news from API ---
(function loadNews() {
  const grid = document.getElementById('news-grid');
  if (!grid) return;
  fetch('/api/news')
    .then(r => r.json())
    .then(items => {
      if (items.length === 0) { grid.innerHTML = '<p style="text-align:center;color:#aaa;">暂无新闻</p>'; return; }
      const featured = items[0];
      const rest = items.slice(1);
      let html = '<div class="news-featured">';
      html += '<div class="img-box">📰</div>';
      html += '<div class="content">';
      const d = featured.date ? featured.date.split('-').slice(0,2).join('年') + '月' : '';
      html += `<div class="date-tag">${d}</div>`;
      html += `<h4>${featured.title}</h4>`;
      html += `<p>${featured.summary || ''}</p>`;
      html += '</div></div>';
      html += '<div class="news-list">';
      rest.slice(0, 5).forEach(item => {
        const parts = (item.date || '').split('-');
        const day = parts[2] || '';
        const ym = parts.slice(0,2).join('-') || '';
        html += `<div class="news-item"><div class="d"><b>${day}</b><span>${ym}</span></div><div class="t"><h5>${item.title}</h5><p>${item.summary || ''}</p></div></div>`;
      });
      html += '</div>';
      grid.innerHTML = html;
    })
    .catch(() => { grid.innerHTML = '<p style="text-align:center;color:#aaa;">加载失败</p>'; });
})();

// --- Load downloads from API ---
(function loadDownloads() {
  const grid = document.getElementById('dl-grid');
  if (!grid) return;
  fetch('/api/downloads')
    .then(r => r.json())
    .then(items => {
      if (items.length === 0) { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">暂无数据</p>'; return; }
      grid.innerHTML = items.map(i => {
        const ext = (i.filePath || '').split('.').pop().toLowerCase();
        const iconMap = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼', zip: '📦', rar: '📦' };
        const icon = iconMap[ext] || '📄';
        return `<div class="dl-card">
          <div class="dl-icon">${icon}</div>
          <div class="dl-info"><h5>${i.title}</h5><span>${i.description || ''}</span></div>
          <a href="${i.filePath}" class="dl-btn" download>下载</a>
        </div>`;
      }).join('');
    })
    .catch(() => { grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#aaa;">加载失败</p>'; });
})();

// --- Stats counter animation + schedule ---
(function initStatsCounter() {
  const statBoxes = document.querySelectorAll('#stats-strip .stat-box .val');
  if (statBoxes.length === 0) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        if (isNaN(target)) return;
        const duration = 1500;
        const start = performance.now();
        function update(now) {
          const p = Math.min((now - start) / duration, 1);
          el.textContent = Math.floor(p * target);
          if (p < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statBoxes.forEach(el => observer.observe(el));
})();

// --- Schedule tab switching ---
(function initScheduleTabs() {
  const tabs = document.querySelectorAll('.schedule-tab');
  if (tabs.length === 0) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.schedule-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.schedule-day').forEach(d => d.classList.remove('active'));
      tab.classList.add('active');
      const day = document.getElementById(tab.dataset.day);
      if (day) day.classList.add('active');
    });
  });
})();

// --- Scroll reveal animation ---
(function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.scope-card, .forum-card, .zone-card, .why-item, .cta-card, .dl-card, .news-item, .exh-item, .aud-group, .media-item, .stat-box, .timeline-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    observer.observe(el);
  });
})();
