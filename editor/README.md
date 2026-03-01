# 🌐 Svelte Whisper Companion Editor

![Localization Editor Screenshot Placeholder](https://via.placeholder.com/800x400.png?text=Localization+Editor)

Welcome to the **Svelte Whisper Companion Editor**—a beautiful, intuitive, and secure visual localization editor explicitly designed for `svelte-whisper` projects.

## 💡 Inspiration & Use Case

Managing massive `.json` localization files manually in your IDE can quickly become a tedious, error-prone headache, especially across multiple languages and deep keys. 

We loved the visual translation approach of the [Inlang Fink](https://fink.inlang.com/) editor but wanted something more closely tied to the frictionless, zero-config philosophy of `svelte-whisper`. We needed a solution that required absolutely **zero database setup**, **no backend API keys**, and could run directly on top of your existing Git workflow.

### The Solution:
The Companion Editor is a 100% Client-Side SPA built with **SvelteKit** and **Material Design 3 Expressive**. It natively parses your Git repository tree, reads your `src/locales/*.json` files, and presents them in an ultra-fast data grid where you can visually manage translations with ease!

Because it's a completely static site, it can be deployed via GitHub Pages absolutely free and securely connects directly to the GitHub REST API using your personal authentication.

---

## 🚀 Getting Started

If you are a developer hosting this repository, the editor comes pre-configured to be automatically hosted via GitHub Pages! *(See the main repository `README.md` for deployment instructions).*

### How to use the Editor UI:

1. **Host the App**: Visit the deployed GitHub Pages URL of the editor (e.g. `https://your-username.github.io/svelte-whisper`).
2. **Setup your Personal Access Token**: Go to your GitHub Settings → Developer Settings → Personal Access Tokens (Classic). Generate a new token and give it the tick mark for the full `repo` scope.
3. **Connect**: Open the Editor, input your repository path (e.g. `Shilo/svelte-whisper`), branch name (`main`), and paste your PAT.
   *Security Note: Your token is NEVER sent anywhere except directly to the official `https://api.github.com/` endpoints. It is saved in your browser's local storage securely so you don't have to keep re-entering it.*
4. **Translate**: The app will locate your `src/locales` folder and output all your JSON files across a beautiful CSS Grid. Type in missing translations!
5. **Commit Magic**: Once you finish editing, hit "Commit Changes". The SvelteKit app communicates directly with GitHub's Git Data API to package the edits into base64 blobs, construct a tree, and auto-magically push a commit directly to your branch! 🪄

---

## 🛠️ Local Development

If you want to contribute to the visual design of the editor or run it locally instead of deploying it:

1. Open your terminal and navigate to the `editor` subdirectory:
   ```bash
   cd editor
   ```
2. Install the necessary SvelteKit and TailwindCSS v4 dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5173`. 

### Stack
- **Framework**: [SvelteKit 5](https://svelte.dev/)
- **Styling**: Vanilla CSS with customized **Material Design 3 Expressive** design tokens and Tailwind CSS (`@tailwindcss/vite`).
- **Deployment**: `@sveltejs/adapter-static` ensures this output is a fully static fallback HTML bundle perfect for GitHub Pages.
