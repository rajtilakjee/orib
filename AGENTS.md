# Agent notes

ORIB is a Manifest V3 content script that redraws `www.reddit.com` as old Reddit. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing behavior and [DESIGN.md](DESIGN.md) before changing appearance.

## Layout

| Path | Touch it when |
| --- | --- |
| `manifest.json` | Host matches, script order, or a new permission is required |
| `renderer.js` | Routing, fetching, HTML, votes, comments, keyboard |
| `classic.css` | Visual changes |
| `icons/` | Extension icons referenced by the manifest |

There is no `package.json`, test runner, or build. Do not add one for a small change. Verify by loading the folder as an unpacked extension and exercising the route you changed.

## Working agreement

- Stay in vanilla JavaScript and one stylesheet. Render with HTML strings and `innerHTML`, matching the functions already in `renderer.js`.
- Put route decisions in `initClassicReddit`. A handled route sets `document.documentElement.id` to `classic-reddit-ready`. A route that must stay on Reddit's UI sets `classic-bypass` and returns without replacing the body.
- Fetch Reddit with `credentials: 'include'`. Send writes as `application/x-www-form-urlencoded` and include `uh` from `currentModhash` or the `csrf_token` cookie.
- Keep `#subreddit-custom-css` when purging styles. That element is the subreddit theme.
- Match the classic visual system in DESIGN.md. Do not restyle the extension toward the current Reddit UI.
- Preserve the loading gate at the top of `classic.css`. Removing it flashes shreddit before the classic page exists.
- `share`, `report`, `crosspost`, and "load more comments" are not wired up. Do not describe them as working, and do not invent handlers unless the task asks for them.
- The save control always calls `/api/save`. Flipping the label is not an unsave.

## Commits

Use Conventional Commits when asked to commit:

```
<type>(<optional scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

Write the subject in the imperative mood, for example `fix: keep subreddit css when purging shreddit styles`.

## Checks before finishing

- The changed route still reaches either `classic-reddit-ready` or `classic-bypass`.
- Logged-out browsing still renders. Missing `me.json` must fall back to the cached username or a login link.
- New click targets are bound in `attachInteractiveListeners` (or the submit button handler), not left as `javascript:void(0)` unless they are intentionally inert.
- New CSS uses the existing palette and type scale.
