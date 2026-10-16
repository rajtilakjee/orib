# Contributing to ORIB

Thank you for your interest in contributing to **ORIB**! We welcome bug fixes, enhancements, and documentation improvements that help bring back the classic Reddit experience.

Before getting started, please take a moment to review this guide, along with [ARCHITECTURE.md](ARCHITECTURE.md) and [DESIGN.md](DESIGN.md).

---

## Table of Contents

- [Project Philosophy](#project-philosophy)
- [Getting Started](#getting-started)
  - [Local Development Setup](#local-development-setup)
  - [Project Structure](#project-structure)
  - [Packaging the Extension](#packaging-the-extension)
- [Commit Message Guidelines (Conventional Commits)](#commit-message-guidelines-conventional-commits)
- [Development & Architectural Rules](#development--architectural-rules)
  - [Vanilla JavaScript & No Build Step](#vanilla-javascript--no-build-step)
  - [Routing & Lifecycle](#routing--lifecycle)
  - [Reddit API & Network Requests](#reddit-api--network-requests)
  - [Design & Visual Integrity](#design--visual-integrity)
- [Pull Request Process](#pull-request-process)
  - [Pre-submission Checklist](#pre-submission-checklist)
- [Reporting Issues](#reporting-issues)

---

## Project Philosophy

ORIB is a lightweight Manifest V3 content script that redraws `www.reddit.com` with the beloved classic Reddit layout and feel. 

Key principles:
- **Zero build tooling:** No bundlers, compilers, or heavy node frameworks.
- **Pure Web Standards:** Vanilla JavaScript, standard DOM manipulation, and a single cohesive stylesheet.
- **Faithful Classic Aesthetics:** The UI should look and feel like old Reddit (dense, left-aligned, Verdana, blue headers, gray chrome), not a modern re-imagination or reskin.

---

## Getting Started

### Local Development Setup

No `npm install` or compilation step is required!

1. Clone the repository:
   ```bash
   git clone https://github.com/rajtilakjee/orib.git
   cd orib
   ```
2. Open your Chromium-based browser (Chrome, Brave, Edge, etc.) and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `extension/` directory from this repository.
5. Navigate to [reddit.com](https://www.reddit.com/). The page will briefly show the loading state and render in classic mode.
6. When you modify files in `extension/`, click the reload icon on the extension card in `chrome://extensions` and refresh Reddit to test your changes.

### Project Structure

| Path | Purpose |
| --- | --- |
| `extension/manifest.json` | Manifest V3 configuration, permissions, host matches |
| `extension/renderer.js` | Routing, fetching JSON data, HTML rendering, event handlers |
| `extension/classic.css` | The single stylesheet for the entire classic UI |
| `extension/icons/` | Extension icons |
| `scripts/pack.ps1` | PowerShell script to bundle the extension zip for store releases |
| `store/` | Store listing copy (`LISTING.md`) and privacy policy (`PRIVACY.md`) |
| `ARCHITECTURE.md` | In-depth runtime flow and API integration details |
| `DESIGN.md` | Color palette, typography, and layout specifications |
| `AGENTS.md` | Guidelines for AI coding agents |

### Packaging the Extension

To produce a production zip file for the Chrome Web Store or Firefox Add-ons:

```powershell
powershell -File scripts/pack.ps1
```

This generates `dist/orib-<version>.zip` containing only the contents of the `extension/` directory, with `manifest.json` at the root.

---

## Commit Message Guidelines (Conventional Commits)

> [!IMPORTANT]
> This repository strictly adheres to the **[Conventional Commits](https://www.conventionalcommits.org/)** specification. All commit messages must follow this structure.

### Format

```text
<type>(<optional scope>): <description>
```

Or without a scope:

```text
<type>: <description>
```

### Commit Types

| Type | Description | Example |
| --- | --- | --- |
| `feat` | Introduces a new feature or functionality | `feat: add keyboard shortcut to toggle comment collapse` |
| `fix` | Patches a bug or unintended behavior | `fix: preserve subreddit custom styles on navigation` |
| `docs` | Documentation changes only | `docs: add contributing guide and architectural diagrams` |
| `style` | Formatting, whitespace, or styling changes that do not alter code logic | `style: fix indentation in renderer.js` |
| `refactor` | Code refactoring that neither fixes a bug nor adds a feature | `refactor: extract comment tree rendering into helper` |
| `perf` | Code changes aimed at improving performance | `perf: avoid redundant JSON fetches during popstate` |
| `test` | Adding or correcting tests | `test: add unit test for comment parser` |
| `build` | Changes to build scripts or packaging tools | `build: update pack.ps1 to support semantic versioning` |
| `ci` | Changes to continuous integration configurations | `ci: add workflow to validate manifest version` |
| `chore` | Routine maintenance tasks or repo housekeeping | `chore: update extension name and metadata` |

### Rules & Best Practices

1. **Imperative Mood:** Write commit descriptions in the imperative mood, present tense ("add", "fix", "update", "remove", not "added", "fixes", or "updating").
2. **Concise and Clear:** Keep the first line under 72 characters.
3. **No Trailing Period:** Do not end the commit subject with a period.
4. **Scope (Optional):** Use a lowercase scope to provide context when helpful, e.g., `feat(keyboard): ...`, `fix(renderer): ...`, `style(css): ...`.

#### Examples

-  `feat(comments): add inline reply box for logged-in users`
-  `fix: handle missing me.json gracefully for logged-out users`
-  `docs: update README with new keyboard shortcuts`
-  `chore: bump version to 1.0.1 in manifest`
- ❌ `Fixed bug where comments were not showing` *(not conventional, past tense)*
- ❌ `WIP` *(vague, no conventional type)*
- ❌ `update stuff.` *(unclear, trailing period, missing type)*

---

## Development & Architectural Rules

Please keep the following constraints in mind when writing code:

### Vanilla JavaScript & No Build Step
- Do not introduce a `package.json`, bundler (Webpack, Vite, Rollup), or JavaScript framework (React, Vue, etc.) for code changes.
- Keep the codebase lightweight, fast, and transparent.
- Construct UI using HTML strings and assign via `innerHTML`, matching the established helper functions in `extension/renderer.js`.

### Routing & Lifecycle
- All route matching lives in `initClassicReddit`.
- **Handled routes** must set `document.documentElement.id = 'classic-reddit-ready'`.
- **Unhandled or bypass routes** (e.g. `/chat`, `/settings`, `/mod`, `/message`, `/poll`) must set `document.documentElement.id = 'classic-bypass'` and exit without rewriting the body.
- If rendering fails, log an error to the console and fall back to `classic-bypass` rather than rendering a broken UI.

### Reddit API & Network Requests
- Fetch Reddit endpoints with `credentials: 'include'`.
- Submissions, votes, hides, and saves must be sent as `application/x-www-form-urlencoded`.
- Include the user's modhash (`uh`) retrieved from `currentModhash` or extracted from the `csrf_token` cookie.
- Ensure logged-out browsing works seamlessly. If `me.json` fails or is absent, the UI must fall back gracefully to the login link or cached state.

### Design & Visual Integrity
- Follow [DESIGN.md](DESIGN.md) strictly.
- **Never remove the loading gate** at the top of `classic.css` (it prevents flashing shreddit before classic Reddit renders).
- When purging shreddit styles via `purgeShredditStyles`, **always preserve `#subreddit-custom-css`**—this is where community themes are injected.
- Maintain the classic color palette (`#cee3f8` header, `#336699` links, `#ff4500` active tab, etc.) and typography (Verdana, 12px body). Avoid cards, shadows, rounded modern containers, or custom dark modes.

---

## Pull Request Process

1. **Create a Branch:** Create a feature or bugfix branch off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bugfix-name
   ```
2. **Make Changes:** Keep commits atomic, well-tested, and formatted according to [Conventional Commits](#commit-message-guidelines-conventional-commits).
3. **Test Manually:** Load the unpacked extension and thoroughly test:
   - Frontpage, subreddit, comment threads, and profile pages.
   - Both logged-in and logged-out states.
   - Navigation via forward/back browser buttons (`popstate`).
   - Routes intended to bypass classic mode (e.g., `/settings`, `/chat`).
4. **Open a PR:** Push your branch to GitHub and open a pull request against `main`. Provide a clear description of what changed and why, linking any relevant issues.

### Pre-submission Checklist

Before submitting your PR, verify the following:

- [ ] All commits follow the [Conventional Commits](#commit-message-guidelines-conventional-commits) specification.
- [ ] The code is pure vanilla JavaScript and CSS without external dependencies or build tools.
- [ ] Changed or newly added routes properly reach either `classic-reddit-ready` or `classic-bypass`.
- [ ] Logged-out browsing continues to render properly without throwing unhandled exceptions.
- [ ] Newly added interactive elements are properly bound in `attachInteractiveListeners` (or dedicated handlers).
- [ ] Subreddit custom stylesheets (`#subreddit-custom-css`) and the CSS loading gate are preserved.
- [ ] Styling strictly adheres to the visual rules in [DESIGN.md](DESIGN.md).

---

## Reporting Issues

Found a bug or have an idea for an enhancement?
- Search existing [GitHub Issues](https://github.com/rajtilakjee/orib/issues) to see if it has already been reported.
- If not, open a new issue with:
  - A clear and descriptive title.
  - Steps to reproduce the problem.
  - The URL / route where the issue occurred.
  - Browser name and version.
  - Any relevant console error logs or screenshots.

