/* ============================================================
   js/home.js — Homepage Logic
   KEDRE TECH Blog Platform
   ============================================================ */

'use strict';

// ── Particle System ───────────────────────────────────────────
function initParticles() {
  const canvas = document.getElementById('hero-particles');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.1
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: 80 }, createParticle);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(96, 165, 250, ${p.alpha})`;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });

    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.06 * (1 - dist/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', debounce(init, 200));
  init();
  draw();
}

// ── Number Counter Animation ──────────────────────────────────
function animateCounter(el, target, duration = 1500) {
  const start = Date.now();
  const startVal = 0;
  function update() {
    const progress = Math.min((Date.now() - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── Load Statistics ───────────────────────────────────────────
async function loadStats() {
  const db = getDB();
  if (!db) return;
  try {
    const [postsRes, viewsRes] = await Promise.all([
      db.from('blog_posts').select('id', { count: 'exact' }).eq('status', 'published'),
      db.from('blog_posts').select('view_count').eq('status', 'published')
    ]);

    const postCount = postsRes.count || 0;
    const totalViews = (viewsRes.data || []).reduce((sum, p) => sum + (p.view_count || 0), 0);

    const postEl  = document.getElementById('stat-posts');
    const viewEl  = document.getElementById('stat-views');

    if (postEl) animateCounter(postEl, postCount);
    if (viewEl) animateCounter(viewEl, totalViews);
  } catch (e) {
    console.warn('Stats error:', e);
  }
}

// ── Load Featured Hero Card ───────────────────────────────────
async function loadHeroFeatured() {
  const db = getDB();
  if (!db) return;
  const card = document.getElementById('hero-featured-card');
  if (!card) return;

  try {
    const { data } = await db
      .from('blog_posts')
      .select('id, title, slug, excerpt, thumbnail_url, reading_time, category:categories(name, icon), published_at')
      .eq('status', 'published')
      .eq('featured', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      card.innerHTML = `
        <div style="height:340px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;color:var(--text-dim);padding:24px;text-align:center;">
          <div style="font-size:2.5rem;">✍️</div>
          <p style="font-size:0.875rem;">Your featured post will appear here</p>
        </div>`;
      return;
    }

    card.innerHTML = `
      <a href="article.html?slug=${data.slug}" class="hero-card-content" style="display:block;text-decoration:none;">
        ${data.thumbnail_url
          ? `<img class="hero-card-img" src="${data.thumbnail_url}" alt="${DOM.sanitize(data.title)}" loading="eager">`
          : `<div class="hero-card-img-placeholder">${data.category?.icon || '📝'}</div>`}
        <div class="hero-card-body">
          <div class="hero-card-meta">
            ${data.category?.name ? `<span class="category-badge">${DOM.sanitize(data.category.name)}</span>` : ''}
            <span style="font-size:0.75rem;color:var(--text-dim);font-family:var(--font-mono);">${data.reading_time || 1} min read</span>
          </div>
          <h3 class="hero-card-title">${DOM.sanitize(data.title)}</h3>
          <p class="hero-card-excerpt">${DOM.sanitize(data.excerpt || '')}</p>
        </div>
      </a>`;
  } catch {
    card.innerHTML = '';
  }
}

// ── Load Categories ───────────────────────────────────────────
async function loadCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  const cats = await BlogAPI.getCategories();
  if (!cats.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);">No categories found.</p>';
    return;
  }

  grid.innerHTML = cats.map(cat => `
    <a href="blog.html?cat=${cat.slug}" class="category-card reveal" role="listitem"
       style="--cat-color: ${cat.color || 'var(--blue)'};" aria-label="Browse ${cat.name} articles">
      <span class="cat-icon" aria-hidden="true">${cat.icon || '📂'}</span>
      <div class="cat-info">
        <h3>${DOM.sanitize(cat.name)}</h3>
        <span>${cat.post_count || 0} article${cat.post_count !== 1 ? 's' : ''}</span>
      </div>
    </a>
  `).join('');

  initReveal();
}

// ── Posts Loading ─────────────────────────────────────────────
let currentPage  = 0;
let activeFilter = '';
let isLoading    = false;
let hasMore      = true;

async function loadPosts(reset = false) {
  if (isLoading) return;
  const grid   = document.getElementById('posts-grid');
  const empty  = document.getElementById('posts-empty');
  const loader = document.getElementById('posts-loader');
  const moreBtn= document.getElementById('load-more-btn');
  if (!grid) return;

  if (reset) {
    currentPage = 0;
    hasMore = true;
    grid.innerHTML = renderSkeletonCards(6);
    if (empty) empty.style.display = 'none';
  }

  isLoading = true;
  if (loader) loader.style.display = 'flex';

  try {
    const { posts, hasMore: more } = await BlogAPI.getPosts({
      page: currentPage,
      category: activeFilter || null
    });

    hasMore = more;

    if (reset) grid.innerHTML = '';

    if (!posts.length && reset) {
      if (empty) empty.style.display = 'block';
      if (moreBtn) moreBtn.style.display = 'none';
    } else {
      posts.forEach(p => {
        const el = document.createElement('div');
        el.innerHTML = renderBlogCard(p);
        grid.appendChild(el.firstElementChild);
      });
      if (moreBtn) moreBtn.style.display = hasMore ? 'inline-flex' : 'none';
    }

    currentPage++;
    initReveal();
  } catch (e) {
    Toast.show('Failed to load posts', 'error');
    if (reset) grid.innerHTML = '';
  } finally {
    isLoading = false;
    if (loader) loader.style.display = 'none';
  }
}

async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    const { posts } = await BlogAPI.getPosts({ featured: true });
    if (!posts.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⭐</div><h3>No featured posts yet</h3></div>`;
      return;
    }
    grid.innerHTML = posts.slice(0, 3).map(p => renderBlogCard(p)).join('');
    initReveal();
  } catch {
    grid.innerHTML = '';
  }
}

// ── Filter Buttons ────────────────────────────────────────────
function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      activeFilter = btn.dataset.cat;
      loadPosts(true);
    });
  });

  const moreBtn = document.getElementById('load-more-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      if (hasMore && !isLoading) loadPosts();
    });
  }
}

// ── Contact Form ──────────────────────────────────────────────
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = document.getElementById('contact-submit');
    const btnTxt = document.getElementById('contact-btn-text');
    const name   = document.getElementById('c-name').value.trim();
    const email  = document.getElementById('c-email').value.trim();
    const subject= document.getElementById('c-subject').value.trim();
    const message= document.getElementById('c-message').value.trim();

    if (!name || !email || !message) {
      Toast.show('Please fill in all required fields', 'warning');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show('Please enter a valid email address', 'warning');
      return;
    }

    btn.disabled = true;
    if (btnTxt) btnTxt.textContent = 'Sending…';

    try {
      await ContactAPI.send(name, email, subject, message);
      Toast.show('Message sent! We\'ll get back to you soon.', 'success');
      form.reset();
    } catch {
      Toast.show('Failed to send message. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      if (btnTxt) btnTxt.textContent = 'Send Message';
    }
  });
}

// ── Newsletter Form ───────────────────────────────────────────
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('nl-email').value;
    if (!email) return;
    // Integrate with your email provider (Mailchimp, ConvertKit, etc.)
    Toast.show('You\'re subscribed! Welcome to KEDRE TECH.', 'success');
    form.reset();
  });
}

// ── Auth Modal ────────────────────────────────────────────────
window.openModal  = (id) => {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
};
window.closeModal = (id) => {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
};

function initAuthModal() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(`${target}-panel`);
      if (panel) panel.style.display = 'block';
    });
  });

  // Sign In
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email    = document.getElementById('si-email').value;
      const password = document.getElementById('si-password').value;
      const errEl    = document.getElementById('signin-error');
      const btn      = document.getElementById('signin-submit');

      btn.disabled = true;
      btn.textContent = 'Signing in…';
      if (errEl) { errEl.classList.remove('visible'); }

      try {
        await Auth.signIn(email, password);
        Toast.show('Welcome back!', 'success');
        closeModal('auth-modal');
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Sign in failed';
          errEl.classList.add('visible');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  // Sign Up
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name     = document.getElementById('su-name').value;
      const email    = document.getElementById('su-email').value;
      const password = document.getElementById('su-password').value;
      const errEl    = document.getElementById('signup-error');
      const btn      = document.getElementById('signup-submit');

      if (password.length < 8) {
        if (errEl) { errEl.textContent = 'Password must be at least 8 characters'; errEl.classList.add('visible'); }
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating account…';
      if (errEl) errEl.classList.remove('visible');

      try {
        await Auth.signUp(email, password, name);
        Toast.show('Account created! Please check your email to verify.', 'success');
        closeModal('auth-modal');
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || 'Registration failed';
          errEl.classList.add('visible');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  }

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}

// ── Infinite Scroll ───────────────────────────────────────────
function initInfiniteScroll() {
  const sentinel = document.getElementById('load-more-btn');
  if (!sentinel) return;

  const obs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading) {
      loadPosts();
    }
  }, { rootMargin: '200px' });

  // Observe bottom of posts grid instead of button for auto-load
  const postsGrid = document.getElementById('posts-grid');
  if (postsGrid) obs.observe(postsGrid);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initFilters();
  initContactForm();
  initNewsletter();
  initAuthModal();

  // Load data
  loadHeroFeatured();
  loadCategories();
  loadFeatured();
  loadPosts(true);
  loadStats();
});
