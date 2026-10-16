# Architecture

ORIB is a single content script. It does not use a background service worker, popup, bundler, or framework. `manifest.json` injects `classic.css` and `renderer.js` into `*://www.reddit.com/*` at `document_start`.

The script replaces `document.body` with classic HTML built from Reddit JSON. Reddit's own styles are removed so the new Reddit (shreddit) shell does not show through.

## Page states

`document.documentElement.id` is the switch between Reddit's UI and the classic UI.

| `html` id | Meaning |
| --- | --- |
| unset | Script is still waiting. `classic.css` hides classic containers and shows a white page. |
| `classic-reddit-ready` | Classic markup is in the body. Classic styles apply. |
| `classic-bypass` | This path is left to Reddit, or rendering failed. |

`renderer.js` sets the loading markup as soon as `document.body` exists, then fetches data, purges shreddit stylesheets, and writes the classic page.

`popstate` reloads the page so back and forward go through the same route logic.

## Routing

`initClassicReddit` branches on `location.pathname`:

1. **Bypass.** Paths matching `/chat`, `/settings`, `/poll`, `/mod`, or `/message` set `classic-bypass` and return. Do not render classic HTML on these routes.
2. **Submit.** `/submit` renders `renderSubmitPage`.
3. **Profile and saved.** `/user/...` and `/saved` fetch `{pathname}.json` and render `renderProfilePage`. Listings can mix link posts (`t3`) and comments (`t1`).
4. **Listings and threads.** Everything else fetches `{pathname}.json` (the bare frontpage and `/hot` both request `/hot.json`).
   - An array response is a comment page: post at `[0].data.children[0]`, comments at `[1].data.children`.
   - An object with `data.children` is a feed.

A subreddit path (`/r/{name}`, excluding `all`, `popular`, and `friends`) also fetches `/r/{name}/about.json` for the sidebar. That payload's `stylesheet` is injected as `#subreddit-custom-css`. `purgeShredditStyles` removes every other `link[rel=stylesheet]` and `style` element, and must keep that id.

Failures set `classic-bypass` and log to the console. They do not show a classic error page.

## Render pipeline

Pages share one shell:

```
#classic-app
  #sr-header-area
  #header
  .main-layout
    .content
    .side
```

HTML is concatenated strings, then assigned to `document.body.innerHTML`. After a feed, comment, or profile render, `attachInteractiveListeners` wires clicks. The submit page attaches its own button handler.

| Function | Output |
| --- | --- |
| `getHeaderHTML` | Subreddit bar, user, sort tabs, submit links |
| `buildSidebarHTML` | Search plus frontpage note, or subreddit titlebox |
| `buildPostHTML` | One `.thing`: rank, votes, thumbnail, title, buttons, expando |
| `buildCommentTree` | Nested `.comment` nodes, or a "load more" placeholder |
| `renderFeedPage` | Listing plus prev/next using `before` / `after` |
| `renderCommentPage` | Post with the expando open, then the comment tree |
| `renderProfilePage` | Overview or saved items |
| `renderSubmitPage` | Subreddit, title, and optional text form |

Feed pagination assumes 25 items. The next link uses `count + 25` and `after`. The previous link uses `count - 25` and `before`.

`buildPostHTML` chooses expando content in this order: `selftext_html`, gallery (`is_gallery` + `media_metadata`), Reddit video (`media.reddit_video.fallback_url` plus a sibling `DASH_AUDIO_128.mp4` element), then a direct image URL. Galleries advance through `window.plusGallerySlide`. Video and audio stay in sync in `attachVideoSyncListeners`.

Comment trees recurse through `replies.data.children`. A `more` kind renders a count only. It does not fetch the extra comments.

## Session and writes

`fetchRedditUser` calls `/api/v1/me.json` with `credentials: 'include'`. A successful `name` is stored in `localStorage` as `classic_reddit_username`. If the request fails, the header falls back to that cached name with zero karma. Logged-out users see a login link.

Write calls need a modhash. Listings set `currentModhash` from `data.modhash`. If that is missing, `getCookie('csrf_token')` is the fallback. Requests are `application/x-www-form-urlencoded` and include credentials.

| Action | Endpoint | Notes |
| --- | --- | --- |
| Vote | `POST /api/vote` | `dir` is `1`, `-1`, or `0` to clear. Score updates in the DOM before the request. |
| Save | `POST /api/save` | Button label flips between save and unsave. The request is always save. |
| Hide | `POST /api/hide` | The `.thing` is hidden after the request is sent. |
| Reply | `POST /api/comment` | Reloads the page on success. |
| Submit | `POST /api/submit` | `kind` is `self` when the text field is non-empty, otherwise `link`. Redirects to `json.data.url` when `errors` is empty. |

Thing ids are Reddit fullnames (`t3_` posts, `t1_` comments) from `data-fullname`.

## Interactions that are display-only

These controls are in the markup and do not call the API:

- Share, report, and crosspost
- "Load more comments"
- The `r` shortcut named in the `Shift+?` help text (there is no `r` key handler)

Keyboard handling lives in `attachKeyboardShortcuts`. It selects `.thing` and `.comment` nodes, marks the current one `.selected`, and reuses the click handlers for expand, vote, save, and hide. It does nothing while an input, textarea, or content-editable element is focused.

## What not to add

Keep new behavior inside `renderer.js` and `classic.css` unless a manifest permission is actually required. Do not introduce a framework, a DOM library, or a build step. New routes belong in `initClassicReddit`, and they must either render classic HTML and set `classic-reddit-ready` or set `classic-bypass` and leave the page alone.
