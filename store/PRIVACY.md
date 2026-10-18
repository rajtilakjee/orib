# ORIB privacy policy

ORIB is a browser extension that redraws `www.reddit.com` with a classic layout. Version 0.3.0.

## What it can see

The extension runs only on `www.reddit.com`. It uses the Reddit session already stored in your browser to:

- show your username and karma
- load listings, comments, your profile, and saved items
- send votes, saves, hides, comments, and new posts to Reddit

Those requests go to Reddit, the same way the site itself would. ORIB does not add its own account system.

## What leaves your browser

Nothing is sent to the ORIB author or to any server other than Reddit. There is no analytics, advertising, or remote code.

Your username may be saved in `localStorage` on `www.reddit.com` under the key `classic_reddit_username`, so the header can still show a name if Reddit's account request fails. That value stays on Reddit's origin in your browser. Removing the extension does not delete it; you can clear site data for `reddit.com` to remove it.

## Contact

Questions about this policy can be opened on the project repository: https://github.com/rajtilakjee/orib
