/* ============================================================
   js/app.js — Core Application Logic
   KEDRE TECH Blog Platform
   ============================================================ */

'use strict';

// ── Supabase Setup ───────────────────────────────────────────
const SUPABASE_URL     = 'https://yfwaoxntkeacutkzazmp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gn40BOfOQpZUJeejS3xeug_0azv-af2';

let sb = null;

function getDB() {
  if (!sb && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: true, persistSession: true }
    });
  }
  return sb;
}

// ── State ────────────────────────────────────────────────────
const State = {
  user:    null,
  isAdmin: false,
  theme:   localStorage.getItem('kt-theme') || 'dark'
};

// ── Theme ────────────────────────────────────────────────────
const Theme = {
  apply(t) {
    document.documentElement.setAttribute('data-theme', t);
    State.theme = t;
    localStorage.setItem('kt-theme', t);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  },
  toggle() {
    Theme.apply(State.theme === 'dark' ? 'light' : 'dark');
  },
  init() {
    Theme.apply(State.theme);
  }
};

// ── Toast Notifications ──────────────────────────────────────
const Toast = {
  container: null,

  init() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(msg, type = 'info', duration = 4000) {
    if (!this.container) this.init();
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${msg}</span>
      <button class="toast-close" aria-label="Close">✕</button>
    `;
    el.querySelector('.toast-close').addEventListener('click', () => this.dismiss(el));
    this.container.appendChild(el);
    setTimeout(() => this.dismiss(el), duration);
    return el;
  },

  dismiss(el) {
    if (!el || el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }
};

// ── Auth ─────────────────────────────────────────────────────
const Auth = {
  async init() {
    const db = getDB();
    if (!db) return;
    const { data: { session } } = await db.auth.getSession();
    if (session?.user) await Auth.setUser(session.user);

    db.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await Auth.setUser(session.user);
      } else {
        State.user    = null;
        State.isAdmin = false;
        Auth.updateUI();
      }
    });
  },

  async setUser(user) {
    State.user = user;
    const db = getDB();
    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    State.isAdmin = profile?.is_admin || false;
    State.profile = profile;
    Auth.updateUI();
  },

  updateUI() {
    const authBtns    = document.querySelectorAll('[data-auth="guest"]');
    const userBtns    = document.querySelectorAll('[data-auth="user"]');
    const adminEls    = document.querySelectorAll('[data-auth="admin"]');

    authBtns.forEach(el => el.style.display = State.user ? 'none' : '');
    userBtns.forEach(el => el.style.display = State.user ? '' : 'none');
    adminEls.forEach(el => el.style.display = State.isAdmin ? '' : 'none');

    const nameEl = document.getElementById('user-name');
    if (nameEl && State.profile) nameEl.textContent = State.profile.full_name || State.user?.email?.split('@')[0];
  },

  async signIn(email, password) {
    const db = getDB();
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signUp(email, password, fullName) {
    const db = getDB();
    const { data, error } = await db.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const db = getDB();
    await db.auth.signOut();
    if (window.location.pathname.includes('admin')) {
      window.location.href = '/index.html';
    }
  }
};

// ── Blog API ─────────────────────────────────────────────────
const BlogAPI = {
  PAGE_SIZE: 9,

  async getPosts({ page = 0, category = null, search = '', featured = false } = {}) {
    const db = getDB();
    let query = db
      .from('blog_posts')
      .select(`
        id, title, slug, excerpt, thumbnail_url, tags,
        reading_time, view_count, like_count, comment_count,
        published_at, featured,
        category:categories(id, name, slug, color),
        author:profiles(id, full_name, avatar_url)
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (featured) query = query.eq('featured', true);
    if (category)  query = query.eq('categories.slug', category);
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,excerpt.ilike.%${search}%`
      );
    }

    query = query.range(page * this.PAGE_SIZE, (page + 1) * this.PAGE_SIZE - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    return { posts: data || [], hasMore: (data?.length || 0) === this.PAGE_SIZE };
  },

  async getPost(slug) {
    const db = getDB();
    const { data, error } = await db
      .from('blog_posts')
      .select(`
        *,
        category:categories(*),
        author:profiles(id, full_name, avatar_url, bio)
      `)
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (error) throw error;
    return data;
  },

  async getRelatedPosts(postId, categoryId, limit = 3) {
    const db = getDB();
    const { data } = await db
      .from('blog_posts')
      .select('id, title, slug, thumbnail_url, excerpt, published_at, reading_time')
      .eq('status', 'published')
      .eq('category_id', categoryId)
      .neq('id', postId)
      .limit(limit);
    return data || [];
  },

  async recordView(postId) {
    const db = getDB();
    await db.rpc('increment_view_count', { post_id: postId });
  },

  async toggleLike(postId) {
    if (!State.user) {
      Toast.show('Sign in to like posts', 'info');
      return null;
    }
    const db = getDB();
    const { data: existing } = await db
      .from('blog_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', State.user.id)
      .single();

    if (existing) {
      await db.from('blog_likes').delete().eq('id', existing.id);
      return false;
    } else {
      await db.from('blog_likes').insert({ post_id: postId, user_id: State.user.id });
      return true;
    }
  },

  async isLiked(postId) {
    if (!State.user) return false;
    const db = getDB();
    const { data } = await db
      .from('blog_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', State.user.id)
      .single();
    return !!data;
  },

  async toggleBookmark(postId) {
    if (!State.user) {
      Toast.show('Sign in to bookmark posts', 'info');
      return null;
    }
    const db = getDB();
    const { data: existing } = await db
      .from('bookmarks')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', State.user.id)
      .single();

    if (existing) {
      await db.from('bookmarks').delete().eq('id', existing.id);
      Toast.show('Bookmark removed', 'info');
      return false;
    } else {
      await db.from('bookmarks').insert({ post_id: postId, user_id: State.user.id });
      Toast.show('Post bookmarked!', 'success');
      return true;
    }
  },

  async getComments(postId) {
    const db = getDB();
    const { data } = await db
      .from('blog_comments')
      .select(`
        *,
        author:profiles(id, full_name, avatar_url)
      `)
      .eq('post_id', postId)
      .eq('is_approved', true)
      .is('parent_id', null)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async addComment(postId, content, parentId = null) {
    if (!State.user) {
      Toast.show('Sign in to comment', 'info');
      return null;
    }
    const db = getDB();
    const { data, error } = await db
      .from('blog_comments')
      .insert({
        post_id: postId,
        author_id: State.user.id,
        content: content.trim(),
        parent_id: parentId
      })
      .select(`*, author:profiles(id, full_name, avatar_url)`)
      .single();
    if (error) throw error;
    return data;
  },

  async getCategories() {
    const db = getDB();
    const { data } = await db
      .from('categories')
      .select('*')
      .order('post_count', { ascending: false });
    return data || [];
  },

  // Admin
  async createPost(postData) {
    const db = getDB();
    const { data, error } = await db
      .from('blog_posts')
      .insert({ ...postData, author_id: State.user.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updatePost(id, postData) {
    const db = getDB();
    const { data, error } = await db
      .from('blog_posts')
      .update(postData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deletePost(id) {
    const db = getDB();
    const { error } = await db.from('blog_posts').delete().eq('id', id);
    if (error) throw error;
  },

  async uploadThumbnail(file, slug) {
    const db = getDB();
    const ext  = file.name.split('.').pop();
    const path = `${slug}-${Date.now()}.${ext}`;
    const { data, error } = await db.storage
      .from('blog-thumbnails')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = db.storage
      .from('blog-thumbnails')
      .getPublicUrl(path);
    return publicUrl;
  }
};

// ── Contact API ──────────────────────────────────────────────
const ContactAPI = {
  async send(name, email, subject, message) {
    const db = getDB();
    const { error } = await db
      .from('contact_messages')
      .insert({ name, email, subject, message });
    if (error) throw error;
  }
};

// ── Share ─────────────────────────────────────────────────────
const Share = {
  url:   () => window.location.href,
  title: () => document.title,

  copy() {
    navigator.clipboard.writeText(this.url()).then(() => {
      Toast.show('Link copied to clipboard!', 'success');
    });
  },

  twitter(text) {
    const t = text || this.title();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(this.url())}`, '_blank', 'width=600,height=400');
  },

  facebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.url())}`, '_blank', 'width=600,height=400');
  },

  whatsapp(text) {
    const t = text || this.title();
    window.open(`https://wa.me/?text=${encodeURIComponent(t + ' ' + this.url())}`, '_blank');
  },

  telegram(text) {
    const t = text || this.title();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(this.url())}&text=${encodeURIComponent(t)}`, '_blank');
  }
};

// ── DOM Helpers ───────────────────────────────────────────────
const DOM = {
  qs: (sel, ctx = document) => ctx.querySelector(sel),
  qsa: (sel, ctx = document) => [...ctx.querySelectorAll(sel)],

  formatDate(dateStr) {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(new Date(dateStr));
  },

  timeAgo(dateStr) {
    const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    if (s < 604800)return `${Math.floor(s/86400)}d ago`;
    return this.formatDate(dateStr);
  },

  slugify(str) {
    return str.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  sanitize(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  initials(name = '') {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  },

  renderAvatar(profile, size = 28) {
    if (profile?.avatar_url) {
      return `<img src="${profile.avatar_url}" alt="${DOM.sanitize(profile.full_name || '')}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
    }
    return `<div class="author-avatar" style="width:${size}px;height:${size}px;font-size:${size*0.35}px;">${DOM.initials(profile?.full_name)}</div>`;
  }
};

// ── Scroll Utilities ──────────────────────────────────────────
function initScrollUtils() {
  // Progress bar
  const bar = document.getElementById('scroll-progress');
  const btt = document.getElementById('back-to-top');
  const nav = document.getElementById('navbar');

  function onScroll() {
    const s = document.documentElement;
    const pct = (s.scrollTop / (s.scrollHeight - s.clientHeight)) * 100;
    if (bar) bar.style.width = pct + '%';
    if (btt) btt.classList.toggle('visible', s.scrollTop > 400);
    if (nav) nav.classList.toggle('scrolled', s.scrollTop > 20);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  if (btt) btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── Intersection Observer (Reveal) ────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => obs.observe(el));
}

// ── Mobile Nav ────────────────────────────────────────────────
function initMobileNav() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobile-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !nav.contains(e.target)) {
      nav.classList.remove('open');
    }
  });
}

// ── Debounce ──────────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Skeleton Cards ────────────────────────────────────────────
function renderSkeletonCards(n = 6) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-text w-1/2" style="height:12px;width:45%;margin-bottom:16px;"></div>
        <div class="skeleton skeleton-title" style="height:20px;width:90%;margin-bottom:10px;"></div>
        <div class="skeleton skeleton-text" style="width:100%;margin-bottom:8px;"></div>
        <div class="skeleton skeleton-text" style="width:80%;margin-bottom:8px;"></div>
        <div class="skeleton skeleton-text" style="width:65%;"></div>
      </div>
    </div>
  `).join('');
}

// ── Blog Card Renderer ────────────────────────────────────────
function renderBlogCard(post) {
  const cat     = post.category || {};
  const author  = post.author || {};
  const imgSrc  = post.thumbnail_url;
  const href    = `article.html?slug=${post.slug}`;

  return `
    <article class="blog-card reveal" onclick="window.location='${href}'" role="link" tabindex="0"
      onkeydown="if(event.key==='Enter')window.location='${href}'"
      aria-label="${DOM.sanitize(post.title)}">
      <div class="blog-card-image-wrap">
        ${imgSrc
          ? `<img class="blog-card-image" src="${imgSrc}" alt="${DOM.sanitize(post.title)}" loading="lazy">`
          : `<div class="blog-card-image-placeholder">${cat.icon || '📝'}</div>`}
        ${post.featured ? '<span style="position:absolute;top:12px;right:12px;background:var(--blue);color:white;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:99px;font-family:var(--font-mono)">FEATURED</span>' : ''}
      </div>
      <div class="blog-card-body">
        <div class="blog-card-meta">
          ${cat.name ? `<span class="category-badge">${DOM.sanitize(cat.name)}</span>` : ''}
          <span class="blog-card-date">${DOM.formatDate(post.published_at)}</span>
          <span class="read-time">· ${post.reading_time || 1} min read</span>
        </div>
        <h2 class="blog-card-title">${DOM.sanitize(post.title)}</h2>
        <p class="blog-card-excerpt">${DOM.sanitize(post.excerpt || '')}</p>
        <div class="blog-card-footer">
          <div class="blog-card-author">
            ${DOM.renderAvatar(author, 28)}
            <span>${DOM.sanitize(author.full_name || 'KEDRE TECH')}</span>
          </div>
          <div class="blog-card-stats">
            <span class="stat-pill" title="Views">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${post.view_count || 0}
            </span>
            <span class="stat-pill" title="Likes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              ${post.like_count || 0}
            </span>
            <span class="stat-pill" title="Comments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              ${post.comment_count || 0}
            </span>
          </div>
        </div>
      </div>
    </article>
  `;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();
  Toast.init();
  getDB();
  await Auth.init();

  initScrollUtils();
  initReveal();
  initMobileNav();

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', Theme.toggle);

  // Sign out
  document.querySelectorAll('[data-action="sign-out"]').forEach(btn => {
    btn.addEventListener('click', () => Auth.signOut());
  });
});
