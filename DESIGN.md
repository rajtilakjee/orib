# Design

ORIB should look like old Reddit: dense, left-aligned, Verdana, blue header, gray chrome. New UI should reuse the classes and colors below. Do not introduce a component library, cards, shadows, rounded app shells, or a dark theme.

`classic.css` is the only stylesheet. Subreddit CSS is injected separately as `#subreddit-custom-css` and is allowed to override these rules the way old Reddit did.

## Type

| Use | Value |
| --- | --- |
| UI font | `verdana, arial, helvetica, sans-serif` |
| Body | 12px / 1.35, `#222222` on `#ffffff` |
| Post title | 16px, normal weight |
| Metadata (tagline, domain, buttons) | 10px, `#888888` |
| Section titles (`.panestack-title`) | 14px, bold |

Links in metadata and chrome use `#336699` with no underline. Post titles use classic browser colors: `#0000ff`, visited `#551a8b`. Stickied titles are `#228822` and bold. The original poster in a thread gets a `#0055df` background and a `[S]` mark (`.userattrs`).

## Color

| Token | Hex | Where |
| --- | --- | --- |
| Page | `#ffffff` | `html`, body, sidebar |
| Text | `#222222` | Body copy |
| Blue link | `#336699` | Header links, authors, buttons, loading text |
| Header band | `#cee3f8` | `#header` background |
| Header edge | `#5f99cf` | Header border, selected tab border, keyboard outline |
| Tab / button fill | `#eff7ff` / `#f0f3fc` | Tabs, submit links, expando and form buttons |
| Subreddit bar | `#f0f0f0` | `#sr-header-area` |
| Selected tab label | `#ff4500` | `.tabmenu li.selected a` |
| Upvote | `#ff8b60` | `.midcol.upvoted` arrow and score |
| Downvote | `#9494ff` | `.midcol.downvoted` arrow and score |
| Idle vote | `#c6c6c6` | Arrows, rank, unvoted score |
| NSFW | `#cc0000` on `#ffffff` | `.nsfw-stamp`; thumbnail uses `#ffe6e6` / `#ff9999` |
| Online | `#46d160` | `.online-dot` |
| Hairline | `#cccccc` dotted | Section titles, public description, comment indent |

Buttons are flat: `#f0f3fc` fill, `#c6d4f0` border, `#336699` label, bold 11px. Hover on header actions fills `#336699` with white text.

## Layout

The page is a column, then a row.

1. `#sr-header-area` is an 18px gray bar. "my subreddits" is a dropdown on the left. Subscribed subreddits follow, separated by hyphens, and "edit »" stays at the right.
2. `#header` is the blue band. Sort tabs sit on the bottom left, with the subreddit or user name beside them when the page has one. The front page has no wordmark. The selected tab is white with an orange label and covers the bottom border. Username, post karma, messages, preferences, and logout sit in `#header-bottom-right`. Logged-out visitors see "Want to join? Log in or sign up in seconds." Submit links are the sidebar `.morelink` buttons.
3. `.main-layout` is a flex row with 10px padding and a 15px gap. `.content` grows. `.side` is a fixed 300px column.

A post (`.thing`) is a flex row:

```
.rank (25px) | .midcol (36px) | .thumbnail (70×50) | .entry
```

The thumbnail is the image when Reddit provides an `http` thumbnail. Otherwise it is a gray box labeled `self` or `link`. NSFW posts without a thumbnail use an `18+` thumb.

Comments (`.comment`) drop the rank and thumbnail. The vote column is 22px. Replies nest in `.child` with 14px margin, 12px padding, and a dotted left border. Collapsed comments hide `.comment-body` and italicize the tagline. Comment and self-text bodies cap at `60em`.

The selected keyboard row (`.thing.selected`, `.comment.selected`) gets a `#f8f9fa` background and a 2px `#5f99cf` outline.

## Surfaces

- Expando body (`.usertext-body.md-box`): `#fafafa` background, 1px `#336699` border, 4px radius, 5px 10px padding.
- Sidebar titlebox: white, 1px `#d0d0d0` border.
- Submit form: white panel with a `#c5d9ef` border, `#eef6ff` round fields, and a `#fff8dc` note. Link and text are tabs on that panel. The submit button is a plain gray control.
- Reply box: max-width 600px, `#336699` border.
- Search field: full sidebar width, `#808080` border.
- Flair (`.linkflairlabel`): 10px, `#f5f5f5` fill, `#d0d0d0` border, `#555555` text.

Gallery frames use `#fcfcfc` and a `#d0d0d0` border. Prev/next controls match the expando button.

## Loading and bypass

Before `html` has an id, the body is forced white and `#classic-app` stays `display: none`. `#classic-loading` is centered, bold 14px `#336699`, with a steps animation on `::after` (`·`, `··`, `···`).

When the id is `classic-reddit-ready`, body margin and padding are zero and the classic font is forced with `!important` so shreddit leftovers cannot restyle the page. `classic-bypass` opts the page back out of those overrides.

## Adding UI

- Reuse an existing class before adding one. A new control should look like `.expando-button` or `.btn-classic`, not like a modern primary button.
- Keep type at 10–16px. Do not raise the base size.
- Prefer dotted `#cccccc` rules over solid cards.
- Put new page regions inside `.content` or `.side`. Do not add a third column.
- Subreddit stylesheets must remain free to override ORIB. Do not `!important` decorative rules that a subreddit theme is expected to change. The `!important` uses that already exist protect the ready/bypass gates, vote colors, and the page font.
