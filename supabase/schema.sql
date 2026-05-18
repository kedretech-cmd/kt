-- ============================================================
-- KEDRE TECH — Complete Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── 1. PROFILES ──────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  username      text unique,
  full_name     text,
  avatar_url    text,
  bio           text,
  website       text,
  is_admin      boolean default false,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

create index if not exists profiles_username_idx on public.profiles(username);

-- RLS: Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ── 2. CATEGORIES ────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  color       text default '#3b82f6',
  icon        text,
  post_count  integer default 0,
  created_at  timestamptz default now() not null
);

create index if not exists categories_slug_idx on public.categories(slug);

-- RLS: Categories
alter table public.categories enable row level security;

create policy "Categories viewable by everyone"
  on public.categories for select using (true);

create policy "Only admins can manage categories"
  on public.categories for all using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

-- Seed default categories
insert into public.categories (name, slug, description, color, icon) values
  ('Technology',    'technology',    'Latest in tech, software, and hardware', '#3b82f6', '💻'),
  ('Design',        'design',        'UI/UX, visual design, and creative work', '#8b5cf6', '🎨'),
  ('AI & ML',       'ai-ml',         'Artificial intelligence and machine learning', '#06b6d4', '🤖'),
  ('Development',   'development',   'Programming, tools, and developer guides', '#10b981', '⚡'),
  ('Business',      'business',      'Startups, entrepreneurship, and growth', '#f59e0b', '🚀'),
  ('Tutorial',      'tutorial',      'Step-by-step learning and how-to guides', '#ef4444', '📚')
on conflict (slug) do nothing;

-- ── 3. BLOG POSTS ────────────────────────────────────────────
create table if not exists public.blog_posts (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  slug            text not null unique,
  excerpt         text,
  content         text,
  thumbnail_url   text,
  thumbnail_alt   text,
  author_id       uuid references public.profiles(id) on delete set null,
  category_id     uuid references public.categories(id) on delete set null,
  tags            text[] default '{}',
  status          text check (status in ('draft','published','archived')) default 'draft',
  featured        boolean default false,
  reading_time    integer default 1,
  view_count      integer default 0,
  like_count      integer default 0,
  comment_count   integer default 0,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index if not exists blog_posts_slug_idx       on public.blog_posts(slug);
create index if not exists blog_posts_status_idx     on public.blog_posts(status);
create index if not exists blog_posts_category_idx   on public.blog_posts(category_id);
create index if not exists blog_posts_author_idx     on public.blog_posts(author_id);
create index if not exists blog_posts_published_idx  on public.blog_posts(published_at desc) where status = 'published';
create index if not exists blog_posts_featured_idx   on public.blog_posts(featured) where featured = true;
create index if not exists blog_posts_tags_gin_idx   on public.blog_posts using gin(tags);

-- Full-text search index
create index if not exists blog_posts_fts_idx on public.blog_posts
  using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));

-- RLS: Blog Posts
alter table public.blog_posts enable row level security;

create policy "Published posts viewable by everyone"
  on public.blog_posts for select
  using (status = 'published' or auth.uid() in (
    select id from public.profiles where is_admin = true
  ));

create policy "Only admins can insert posts"
  on public.blog_posts for insert with check (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

create policy "Only admins can update posts"
  on public.blog_posts for update using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

create policy "Only admins can delete posts"
  on public.blog_posts for delete using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

-- ── 4. BLOG LIKES ────────────────────────────────────────────
create table if not exists public.blog_likes (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references public.blog_posts(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade,
  ip_hash    text,
  created_at timestamptz default now() not null,
  unique(post_id, user_id)
);

create index if not exists blog_likes_post_idx on public.blog_likes(post_id);
create index if not exists blog_likes_user_idx on public.blog_likes(user_id);

-- RLS: Likes
alter table public.blog_likes enable row level security;

create policy "Likes viewable by everyone"
  on public.blog_likes for select using (true);

create policy "Authenticated users can like"
  on public.blog_likes for insert with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.blog_likes for delete using (auth.uid() = user_id);

-- ── 5. BLOG COMMENTS ─────────────────────────────────────────
create table if not exists public.blog_comments (
  id          uuid primary key default uuid_generate_v4(),
  post_id     uuid references public.blog_posts(id) on delete cascade not null,
  author_id   uuid references public.profiles(id) on delete set null,
  parent_id   uuid references public.blog_comments(id) on delete cascade,
  content     text not null,
  is_approved boolean default true,
  like_count  integer default 0,
  created_at  timestamptz default now() not null,
  updated_at  timestamptz default now() not null
);

create index if not exists blog_comments_post_idx    on public.blog_comments(post_id);
create index if not exists blog_comments_author_idx  on public.blog_comments(author_id);
create index if not exists blog_comments_parent_idx  on public.blog_comments(parent_id);
create index if not exists blog_comments_approved_idx on public.blog_comments(is_approved);

-- RLS: Comments
alter table public.blog_comments enable row level security;

create policy "Approved comments viewable by everyone"
  on public.blog_comments for select
  using (is_approved = true or auth.uid() in (
    select id from public.profiles where is_admin = true
  ));

create policy "Authenticated users can comment"
  on public.blog_comments for insert with check (auth.uid() = author_id);

create policy "Users can update own comments"
  on public.blog_comments for update using (auth.uid() = author_id);

create policy "Admins can delete any comment"
  on public.blog_comments for delete using (
    auth.uid() = author_id or
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

-- ── 6. BLOG VIEWS ────────────────────────────────────────────
create table if not exists public.blog_views (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references public.blog_posts(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete set null,
  ip_hash    text,
  user_agent text,
  created_at timestamptz default now() not null
);

create index if not exists blog_views_post_idx on public.blog_views(post_id);
create index if not exists blog_views_date_idx on public.blog_views(created_at);

-- RLS: Views
alter table public.blog_views enable row level security;

create policy "Views insertable by everyone"
  on public.blog_views for insert with check (true);

create policy "Admins can view all views"
  on public.blog_views for select using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

-- ── 7. BOOKMARKS ─────────────────────────────────────────────
create table if not exists public.bookmarks (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid references public.blog_posts(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(post_id, user_id)
);

create index if not exists bookmarks_user_idx on public.bookmarks(user_id);
create index if not exists bookmarks_post_idx on public.bookmarks(post_id);

alter table public.bookmarks enable row level security;

create policy "Users can view their own bookmarks"
  on public.bookmarks for select using (auth.uid() = user_id);

create policy "Users can add bookmarks"
  on public.bookmarks for insert with check (auth.uid() = user_id);

create policy "Users can remove their bookmarks"
  on public.bookmarks for delete using (auth.uid() = user_id);

-- ── 8. CONTACT MESSAGES ──────────────────────────────────────
create table if not exists public.contact_messages (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null,
  email      text not null,
  subject    text,
  message    text not null,
  is_read    boolean default false,
  is_replied boolean default false,
  created_at timestamptz default now() not null
);

create index if not exists contact_messages_read_idx on public.contact_messages(is_read);
create index if not exists contact_messages_date_idx on public.contact_messages(created_at desc);

alter table public.contact_messages enable row level security;

create policy "Anyone can submit contact messages"
  on public.contact_messages for insert with check (true);

create policy "Only admins can view contact messages"
  on public.contact_messages for select using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

create policy "Only admins can update contact messages"
  on public.contact_messages for update using (
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

-- ── FUNCTIONS & TRIGGERS ─────────────────────────────────────

-- Auto-update updated_at
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function handle_updated_at();

create trigger blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function handle_updated_at();

create trigger blog_comments_updated_at
  before update on public.blog_comments
  for each row execute function handle_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Increment view count
create or replace function increment_view_count(post_id uuid)
returns void as $$
begin
  update public.blog_posts
  set view_count = view_count + 1
  where id = post_id;
end;
$$ language plpgsql security definer;

-- Update like count
create or replace function update_like_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.blog_posts set like_count = like_count + 1 where id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.blog_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger blog_likes_count
  after insert or delete on public.blog_likes
  for each row execute function update_like_count();

-- Update comment count
create or replace function update_comment_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.blog_posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif (TG_OP = 'DELETE') then
    update public.blog_posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger blog_comments_count
  after insert or delete on public.blog_comments
  for each row execute function update_comment_count();

-- Update category post count
create or replace function update_category_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT' and new.status = 'published') then
    update public.categories set post_count = post_count + 1 where id = new.category_id;
  elsif (TG_OP = 'DELETE' and old.status = 'published') then
    update public.categories set post_count = greatest(post_count - 1, 0) where id = old.category_id;
  elsif (TG_OP = 'UPDATE') then
    if (old.status != 'published' and new.status = 'published') then
      update public.categories set post_count = post_count + 1 where id = new.category_id;
    elsif (old.status = 'published' and new.status != 'published') then
      update public.categories set post_count = greatest(post_count - 1, 0) where id = old.category_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger blog_posts_category_count
  after insert or update or delete on public.blog_posts
  for each row execute function update_category_count();

-- ── STORAGE BUCKETS ───────────────────────────────────────────
-- Run these in Supabase Dashboard → Storage
-- OR via SQL:

insert into storage.buckets (id, name, public)
  values ('blog-thumbnails', 'blog-thumbnails', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Storage policies
create policy "Anyone can view blog thumbnails"
  on storage.objects for select
  using (bucket_id = 'blog-thumbnails');

create policy "Admins can upload blog thumbnails"
  on storage.objects for insert with check (
    bucket_id = 'blog-thumbnails' and
    auth.uid() in (select id from public.profiles where is_admin = true)
  );

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload own avatar"
  on storage.objects for insert with check (
    bucket_id = 'avatars' and
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── MAKE YOURSELF ADMIN ──────────────────────────────────────
-- After signing up, run this with your user ID:
-- update public.profiles set is_admin = true where id = 'YOUR_USER_UUID';
