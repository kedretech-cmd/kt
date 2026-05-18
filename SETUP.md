# KEDRE TECH Blog Platform — Setup & Deployment Guide

## Quick Start

### 1. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"** and fill in:
   - Project name: `kedre-tech`
   - Database password: (save this!)
   - Region: Choose closest to your users
3. Wait ~2 minutes for the project to provision

### 2. Run the SQL Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Paste the entire contents of `supabase/schema.sql`
4. Click **"Run"** (Ctrl+Enter)
5. You should see "Success" for each statement

### 3. Get Your API Keys

In Supabase dashboard → **Settings** → **API**:
- Copy **Project URL** → `https://xxxxx.supabase.co`
- Copy **anon/public key** → long JWT string

### 4. Configure the Project

✅ **Already done!** The project is pre-configured with your live Supabase credentials:
```js
const SUPABASE_URL      = 'https://yfwaoxntkeacutkzazmp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Gn40BOfOQpZUJeejS3xeug_0azv-af2';
```
No changes needed in `js/app.js` — it's ready to go.

### 5. Create Your Admin Account

1. Go to Supabase → **Authentication** → **Users** → **"Invite user"**
2. Enter your admin email
3. Check your email and set your password
4. In Supabase **SQL Editor**, run:
```sql
UPDATE public.profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'your-admin@email.com'
);
```

### 6. Configure Storage Buckets

Go to Supabase → **Storage**:
1. Create bucket: `blog-thumbnails` (Public: ✅)
2. Create bucket: `avatars` (Public: ✅)

Or run in SQL Editor (already in schema.sql):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-thumbnails', 'blog-thumbnails', true);
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);
```

---

## Supabase Auth Configuration

In your Supabase dashboard → **Authentication** → **Settings**:
- Project URL: `https://yfwaoxntkeacutkzazmp.supabase.co`

```
Site URL: https://yourdomain.com
Redirect URLs: https://yourdomain.com/**
               http://localhost:3000/**   (for local dev)
```

Enable Email confirmations for production security.

---

## Local Development

No build tools required! Just serve the files:

### Option A — Python
```bash
cd kedre-tech
python3 -m http.server 3000
# Open http://localhost:3000
```

### Option B — Node.js (npx)
```bash
cd kedre-tech
npx serve .
# Open http://localhost:3000
```

### Option C — VS Code Live Server
- Install the "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

---

## Deployment Options

### Option 1: Vercel (Recommended — Free)

```bash
npm i -g vercel
cd kedre-tech
vercel
# Follow prompts, add env vars when asked
```

Or drag-drop the folder at [vercel.com/new](https://vercel.com/new)

### Option 2: Netlify (Free)

```bash
npm i -g netlify-cli
cd kedre-tech
netlify deploy --prod --dir .
```

Or drag-drop at [app.netlify.com/drop](https://app.netlify.com/drop)

### Option 3: GitHub Pages (Free)

1. Push `kedre-tech/` to a GitHub repo
2. Go to repo **Settings** → **Pages**
3. Source: `main` branch, root `/`
4. Your site will be at `https://username.github.io/repo-name`

### Option 4: Firebase Hosting (Free)

```bash
npm i -g firebase-tools
firebase login
firebase init hosting
# Public dir: . (current)
# Single-page app: No
firebase deploy
```

---

## Project File Structure

```
kedre-tech/
├── index.html          ← Homepage (hero, featured posts, newsletter, contact preview)
├── blog.html           ← Blog listing with search, filters, sidebar
├── article.html        ← Full article reader (comments, likes, share)
├── admin.html          ← Admin dashboard (post editor, analytics, moderation)
├── contact.html        ← Contact form + FAQ
│
├── css/
│   ├── main.css        ← Design system, shared components, utilities
│   └── home.css        ← Homepage-specific styles
│
├── js/
│   ├── app.js          ← Core: Supabase client, Auth, BlogAPI, Toast, DOM utils
│   └── home.js         ← Homepage: particles, post loading, categories, forms
│
├── supabase/
│   ├── config.js       ← Supabase initialization (reference)
│   └── schema.sql      ← Complete database schema with RLS policies
│
└── SETUP.md            ← This file
```

---

## Supabase Database Tables

| Table               | Purpose                              |
|---------------------|--------------------------------------|
| `profiles`          | Extended user profiles, admin flag   |
| `blog_posts`        | Articles with all metadata           |
| `categories`        | Post categories with counts          |
| `blog_likes`        | User likes (unique per user/post)    |
| `blog_comments`     | Threaded comments                    |
| `blog_views`        | View tracking                        |
| `bookmarks`         | Saved posts per user                 |
| `contact_messages`  | Contact form submissions             |

---

## Creating Your First Post

1. Go to `/admin.html` and sign in with your admin credentials
2. Click **"New Post"** in the sidebar
3. Fill in:
   - **Title** (slug auto-generates)
   - **Excerpt** (shown on cards)
   - **Content** (Markdown supported)
   - **Category** from dropdown
   - **Tags** (press Enter after each)
   - **Thumbnail** image (drag & drop)
   - Check **"Mark as Featured"** for hero/featured sections
4. Click **"Publish"** to go live immediately, or **"Save Draft"** to save

---

## Markdown Reference (Post Editor)

```markdown
## Section Heading
### Subsection Heading

**Bold text**  *Italic text*

`inline code`

```code block```

> Blockquote

- List item
- Another item

[Link text](https://url.com)

---   (horizontal rule)
```

---

## Environment Variables (Optional)

For CI/CD pipelines, set these as environment variables instead of hardcoding:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Then in `js/app.js`, load from env:
```js
const SUPABASE_URL      = window.ENV?.SUPABASE_URL || 'YOUR_URL';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'YOUR_KEY';
```

---

## Email / Newsletter Integration

To connect a real newsletter service, update `initNewsletter()` in `js/home.js`:

### Mailchimp
```js
fetch(`https://YOUR_DOMAIN.us1.list-manage.com/subscribe/post`, {
  method: 'POST',
  body: new URLSearchParams({ EMAIL: email, u: 'YOUR_U', id: 'YOUR_LIST_ID' })
});
```

### ConvertKit
```js
fetch(`https://api.convertkit.com/v3/forms/FORM_ID/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: 'YOUR_KEY', email })
});
```

---

## SEO Checklist

- ✅ Semantic HTML5 tags throughout
- ✅ Meta description on all pages
- ✅ Open Graph tags on homepage
- ✅ JSON-LD structured data
- ✅ Canonical URLs
- ✅ `noindex` on admin page
- ✅ `alt` attributes on all images
- ✅ Lazy loading images
- ✅ Fast load (no frameworks)

**Add for production:**
- [ ] Replace `og:image` with your real cover image
- [ ] Update `twitter:site` with your Twitter handle
- [ ] Add Google Analytics / Plausible script
- [ ] Submit sitemap to Google Search Console

---

## Security Notes

- **RLS is enabled** on all tables — users can only access what they're allowed
- **Admin flag** (`is_admin`) is set server-side in `profiles` table — cannot be forged by users
- **Content is sanitized** before rendering via `DOM.sanitize()`
- **Input validation** on all forms (client-side + Supabase constraints)
- Never commit real API keys to version control

---

## Performance Tips

- All fonts are preloaded via `preconnect`
- Images use `loading="lazy"` throughout
- Skeleton loaders on all async content
- Debounced search (400ms delay)
- Infinite scroll uses IntersectionObserver
- No framework overhead — pure vanilla JS

---

## Customization

### Change Brand Colors
Edit `:root` in `css/main.css`:
```css
--blue:   #2563eb;   /* Primary action color */
--blue-2: #3b82f6;   /* Hover states */
--blue-3: #60a5fa;   /* Subtle accents */
```

### Change Fonts
Replace in `<head>` of all HTML files:
```html
<link href="https://fonts.googleapis.com/css2?family=YourFont..." rel="stylesheet">
```
Update CSS variables:
```css
--font-display: 'YourFont', sans-serif;
--font-body:    'YourBodyFont', sans-serif;
```

### Add a New Page
1. Copy `blog.html` as a starting template
2. Update the `<title>` and meta tags
3. Add a nav link in all `navbar` sections
4. Add to the footer links

---

## Troubleshooting

**Posts not loading:**
- Check browser console for errors
- Verify your Supabase URL and anon key in `js/app.js`
- Confirm RLS policies are set up correctly

**Can't sign in as admin:**
- Verify `is_admin = true` in the `profiles` table
- Check Supabase Auth → Users that your account exists

**Images not uploading:**
- Confirm storage buckets exist and are set to Public
- Check storage RLS policies in Supabase dashboard

**Auth redirect issues:**
- Add your domain to Supabase Auth → URL Configuration → Redirect URLs

---

Built with ❤️ for KEDRE TECH | Supabase + Vanilla JS + Pure CSS
