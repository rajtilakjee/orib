# ORIB

Bringing back the old Reddit interface, with a few new enhancements.

ORIB is a Manifest V3 browser extension. On `www.reddit.com` it replaces the current page with a classic layout: subreddit bar, blue header, ranked posts, sidebar, and threaded comments. It reads Reddit's public JSON listings and posts votes, saves, hides, comments, and submissions through Reddit's existing session.

The extension itself lives in `extension/`. Docs and the store listing stay outside that folder so they are not part of the upload.

## Install

1. Open `chrome://extensions` (or the equivalent page in another Chromium browser).
2. Turn on Developer mode.
3. Choose **Load unpacked** and select the `extension` directory.
4. Visit [reddit.com](https://www.reddit.com/). The page should show the classic layout after a short "loading classic reddit" state.

The content script matches `*://www.reddit.com/*` and runs at `document_start`.

## What it covers

- Frontpage and subreddit listings, including hot, best, new, rising, controversial, and top
- Comment threads, with collapse and inline reply
- User profiles and `/saved`
- A classic submit form at `/submit`
- Subreddit sidebar (subscriber count, users online, public description, and the subreddit's own stylesheet)
- Expando previews for self text, images, galleries, and Reddit-hosted video
- Upvote, downvote, save, and hide while you are logged in
- Keyboard navigation in the style of Reddit Enhancement Suite

These paths stay on Reddit's own UI: `/chat`, `/settings`, `/poll`, `/mod`, and `/message`.

## Keyboard shortcuts

Shortcuts are ignored while focus is in an input, textarea, or content-editable element. Press `Shift+?` on a classic page for the in-page list.

| Key | Action |
| --- | --- |
| `j` / `k` | Next / previous post or comment |
| `Enter` | Open the selected title in a new tab |
| `x` | Toggle the selected post's expando |
| `Shift+X` | Toggle every expando |
| `c` | Open the selected post's comments |
| `a` / `z` | Upvote / downvote the selection |
| `s` | Save the selected post |
| `h` | Hide the selected post |

## Store package

Version 0.1.0 is what gets submitted. From the repository root:

```powershell
powershell -File scripts/pack.ps1
```

That writes `dist/orib-0.1.0.zip`. The zip contains only `manifest.json`, `renderer.js`, `classic.css`, and `icons/`, with the manifest at the root of the archive. Upload that zip. Do not upload the git repository.

The Chrome Web Store and Firefox Add-ons copy, plus the privacy policy, are in [store/LISTING.md](store/LISTING.md) and [store/PRIVACY.md](store/PRIVACY.md).

## Project layout

| Path | Role |
| --- | --- |
| `extension/manifest.json` | Extension manifest |
| `extension/renderer.js` | Routing, data fetch, HTML, and interactions |
| `extension/classic.css` | Classic visual system |
| `extension/icons/` | Toolbar icons |
| `scripts/pack.ps1` | Builds the store zip |
| `store/` | Listing text and privacy policy |
| `ARCHITECTURE.md` | Runtime flow and API usage |
| `DESIGN.md` | Visual rules for the classic UI |
| `CONTRIBUTING.md` | Contribution workflow and Conventional Commits guide |
| `AGENTS.md` | Notes for coding agents working in this repo |

## Docs

- [Architecture](ARCHITECTURE.md) — how a page is replaced and which endpoints are called
- [Design](DESIGN.md) — colors, type, and layout that keep the UI looking like old Reddit
- [Contributing](CONTRIBUTING.md) — development setup, coding guidelines, and commit standards
