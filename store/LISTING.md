# Store listing

Use this when submitting version 0.1.0. The upload is the zip from `scripts/pack.ps1`, not the git repository.

## Chrome Web Store

- **Name:** ORIB
- **Summary:** Bringing back the old Reddit interface, with a few new enhancements.
- **Category:** Social Networking
- **Language:** English
- **Privacy policy URL:** `https://github.com/rajtilakjee/orib/blob/main/store/PRIVACY.md` after this file is on the default branch
- **Single purpose:** Replace the www.reddit.com page with a classic Reddit layout, and perform the same logged-in actions the site already allows.

### Description

ORIB brings back the old Reddit interface on www.reddit.com.

It shows the classic header, ranked listings, sidebar, and threaded comments. Logged-in actions use your existing Reddit session: voting, saving, hiding, replying, and submitting a link or a text post. Image posts keep their thumbnails, and a few keyboard shortcuts work in the style of Reddit Enhancement Suite.

Chat, settings, polls, mod pages, and messages stay on Reddit's own interface.

ORIB does not add a new account, and it does not send your Reddit activity anywhere except Reddit.

### Permission justification

The extension declares no extra permissions. Its only content script matches `*://www.reddit.com/*`. Requests use the page's own cookies and go to reddit.com. There is no host permission for any other site, no remote code, and no background service worker.

### Data disclosure

The extension handles the signed-in Reddit username and the votes, saves, hides, comments, and posts you make through it. That data is sent only to Reddit. It is not sold, not used for advertising, and not transmitted to the developer. Certify that the extension does not collect user data for the developer.

## Firefox Add-ons

The same zip can be uploaded. The manifest includes `browser_specific_settings.gecko.id` (`orib@rajtilakjee.github.io`) and requires Firefox 128 or newer. Use the same description and privacy policy URL.
