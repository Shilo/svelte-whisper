# 🌐 Svelte Whisper Companion Editor

![Localization Editor Screenshot Placeholder](https://via.placeholder.com/800x400.png?text=Localization+Editor)

Welcome to the **Svelte Whisper Companion Editor**—a beautiful, intuitive, and secure visual localization editor explicitly designed for `svelte-whisper` projects.

## 💡 Inspiration & Use Case

Managing massive `.json` localization files manually in your IDE can quickly become a tedious, error-prone headache, especially across multiple languages and deep keys.

We loved the visual translation approach of the [Inlang Fink](https://fink.inlang.com/) editor but wanted something more closely tied to the frictionless, zero-config philosophy of `svelte-whisper`. We needed a solution that required absolutely **zero database setup**, **no backend API keys**, and could run directly on top of your existing Git workflow.

### The Solution:
The Companion Editor is a 100% Client-Side SPA built with **SvelteKit** and **Material Design 3**. It natively parses your Git repository tree, reads your `src/locales/*.json` files, and presents them in an ultra-fast data grid where you can visually manage translations with ease!

Contributors sign in with **GitHub OAuth** (no token creation required) and submit changes as **Pull Requests** for the repo owner to review. A Personal Access Token fallback is also available.

Because it's a completely static site, it can be deployed via GitHub Pages absolutely free and securely connects directly to the GitHub REST API using GitHub authentication.

---

## 🚀 Getting Started (For Contributors)

1. Visit the live editor at `https://shilo.github.io/svelte-whisper/`
2. Click **"Sign in with GitHub"** — you'll be shown a short code (e.g. `ABCD-1234`)
3. Click **"Open GitHub"** to go to `github.com/login/device` and enter the code
4. Approve the authorization on GitHub and return to the editor — it signs you in automatically
5. Enter the **repository** (e.g. `owner/repo`), **branch**, and **locales path**, then click **Load Translations**
6. Edit translations in the visual grid
7. Click the **"Create PR"** button — a Pull Request is opened automatically for the repo owner to review

> **No token setup required.** If OAuth is not configured for the hosted instance, click **"Use a Personal Access Token"** as a fallback.

---

## 🔐 GitHub OAuth Setup (For Repo Owners / Self-Hosters)

Enabling OAuth allows contributors to sign in with their GitHub account — no token creation required. This requires:

1. A **GitHub OAuth App** (free, takes 2 minutes)
2. A **Cloudflare Worker** as a CORS proxy (free tier, takes 5 minutes)

### Step 1 — Register a GitHub OAuth App

1. Go to **[github.com/settings/developers](https://github.com/settings/developers)**
2. Click **"New OAuth App"**
3. Fill in the form:
   - **Application name**: `Svelte Whisper Editor` (or any name you prefer)
   - **Homepage URL**: your GitHub Pages URL, e.g. `https://your-username.github.io/svelte-whisper`
   - **Authorization callback URL**: same as Homepage URL (Device Flow does not use a redirect callback, but GitHub requires a value — any valid URL works)
4. Click **"Register application"**
5. On the next page, copy the **Client ID** — you will need this shortly
   - Do **not** generate a Client Secret (Device Flow does not use one)

> **Why Device Flow?** The Device Authorization Grant (RFC 8628) is designed for environments that cannot host a redirect URI — exactly what a static SPA needs. The user enters a code on GitHub's website; the app polls for the token. No secret is ever embedded in the client.

### Step 2 — Deploy the Cloudflare Worker CORS Proxy

GitHub's OAuth token endpoints (`github.com/login/oauth/access_token` and `github.com/login/device/code`) do not include CORS headers, so browsers block direct requests from a web page. A tiny Cloudflare Worker forwards these requests server-side and adds the required CORS headers.

**The worker stores no secrets and does nothing except proxy requests to GitHub.**

#### Option A — Cloudflare Dashboard (no CLI required)

1. Sign up or log in at **[dash.cloudflare.com](https://dash.cloudflare.com)** (free account)
2. In the left sidebar, click **Workers & Pages** → **Create**
3. Choose **"Hello World"** starter → click **Deploy**
4. Click **"Edit code"** and replace the entire contents with:

```js
const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
});

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const targetUrl = 'https://github.com' + new URL(req.url).pathname;

    const res = await fetch(targetUrl, {
      method: 'POST',
      body: req.body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
    });

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
    });
  },
};
```

5. Click **"Deploy"**
6. Copy the Worker URL shown at the top of the page — it looks like `https://your-worker-name.your-subdomain.workers.dev`

#### Option B — Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Log in to Cloudflare
wrangler login

# Create a new worker
wrangler init whisper-auth-proxy --no-bundle
cd whisper-auth-proxy
```

Replace the generated `src/index.js` with the worker code above, then deploy:

```bash
wrangler deploy
```

The CLI prints the Worker URL on success.

#### Security Notes

- The Worker only accepts `POST` and `OPTIONS` requests
- It only proxies paths that you call from the app (`/login/device/code` and `/login/oauth/access_token`)
- No GitHub secrets or tokens pass through the Worker — only the public `client_id` is sent
- Cloudflare's free tier allows 100,000 requests/day — more than sufficient for any translation workflow

### Step 3 — Configure Environment Variables

Create a `.env.local` file in the `editor/` directory (this file is gitignored and safe to use locally):

```env
VITE_GITHUB_CLIENT_ID=your_client_id_here
VITE_CORS_PROXY_URL=https://your-worker-name.your-subdomain.workers.dev
```

For production deployments (e.g. GitHub Pages via GitHub Actions), add these as **repository secrets** and expose them as environment variables in your workflow:

```yaml
# .github/workflows/deploy.yml (example snippet)
- name: Build editor
  working-directory: editor
  env:
    VITE_GITHUB_CLIENT_ID: ${{ secrets.VITE_GITHUB_CLIENT_ID }}
    VITE_CORS_PROXY_URL: ${{ secrets.VITE_CORS_PROXY_URL }}
  run: npm run build
```

> **Note:** `VITE_GITHUB_CLIENT_ID` is a **public** value — it is safe to embed in the built JS bundle. GitHub OAuth App Client IDs are not secret. Only Client Secrets are sensitive, and Device Flow never uses one.

### Step 4 — Build and Deploy

```bash
cd editor
npm install
npm run build   # outputs to editor/build/
```

Deploy the `build/` directory to GitHub Pages, Netlify, Cloudflare Pages, or any static host.

Once deployed with both env vars set, users will see the **"Sign in with GitHub"** button and can authenticate without creating a Personal Access Token.

---

## 🔑 Personal Access Token Fallback

If `VITE_GITHUB_CLIENT_ID` is not set (or the user prefers a PAT), they can click **"Use a Personal Access Token"**. The editor opens GitHub's token creation page pre-filled with the required `repo` scope. The PAT is stored in `sessionStorage` only (cleared when the browser tab is closed).

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `VITE_GITHUB_CLIENT_ID` | Optional | GitHub OAuth App Client ID. Enables "Sign in with GitHub" Device Flow. If omitted, only PAT mode is shown. |
| `VITE_CORS_PROXY_URL` | Required if using OAuth | Cloudflare Worker URL that proxies GitHub OAuth endpoints to add CORS headers. |

---

## 🛠️ Local Development

```bash
cd editor
npm install
npm run dev
```

Open `http://localhost:5173`. For local OAuth testing, set the env vars in `editor/.env.local`.

### Stack
- **Framework**: [SvelteKit 5](https://svelte.dev/)
- **Styling**: **Material Design 3** design tokens + Tailwind CSS v4 (`@tailwindcss/vite`), Roboto font
- **Auth**: GitHub Device Flow OAuth + PAT fallback
- **Submissions**: Pull Request workflow (default) or direct push (owner toggle in Settings)
- **Deployment**: `@sveltejs/adapter-static` — fully static HTML/CSS/JS bundle, perfect for GitHub Pages
