let currentModhash = null;
let currentUserData = null;

(async function initClassicReddit() {
  if (/^\/(chat|settings|poll|mod|message)/.test(window.location.pathname)) {
    document.documentElement.id = "classic-bypass";
    return;
  }

  window.addEventListener('popstate', () => location.reload());

  // 1. Instantly wait for body and display the loading spinner
  await waitForBody();
  document.body.innerHTML = `<div id="classic-loading">loading classic reddit</div>`;

  currentUserData = await fetchRedditUser();

  // Intercept Submission Page Route
  if (isSubmitRoute(window.location.pathname)) {
    purgeShredditStyles();
    renderSubmitPage();
    return;
  }

  // Intercept User Profiles & Saved Pages
  const pathname = window.location.pathname;
  if (pathname.startsWith('/user/') || pathname === '/saved') {
    purgeShredditStyles();
    await handleProfileOrSavedRoute(pathname);
    return;
  }

  const search = window.location.search;

  if (/^\/media\/?$/.test(pathname)) {
    purgeShredditStyles();
    document.documentElement.id = "classic-reddit-ready";
    renderMediaPage(new URLSearchParams(search).get('url'));
    return;
  }

  const jsonUrl = buildListingUrl(pathname, search);
  const requestedPostId = commentIdFromPath(pathname);

  const subName = getSubredditName();

  try {
    const mainPromise = fetch(jsonUrl, { credentials: 'include' }).then(r => r.json());
    const sidebarPromise = subName
      ? fetch(`${window.location.origin}/r/${subName}/about.json`, { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
      : Promise.resolve(null);

    const [rawData, subAbout] = await Promise.all([mainPromise, sidebarPromise]);
    const sidebarData = subAbout?.data || null;
    const thread = requestedPostId ? postFromPayload(rawData, requestedPostId) : null;

    if (requestedPostId && !thread) {
      document.documentElement.id = "classic-bypass";
      return;
    }

    purgeShredditStyles();
    injectSubredditCSS(sidebarData);
    document.documentElement.id = "classic-reddit-ready";

    if (thread) {
      currentModhash = (Array.isArray(rawData) ? rawData[0]?.data?.modhash : rawData?.data?.modhash) || null;
      renderCommentPage(thread.post, thread.comments, sidebarData);
    } else if (rawData?.data?.children) {
      currentModhash = rawData.data.modhash || null;
      renderFeedPage(rawData.data, sidebarData);
    } else {
      document.documentElement.id = "classic-bypass";
    }
  } catch (err) {
    console.error("Classic Reddit Error:", err);
    document.documentElement.id = "classic-bypass";
  }
})();

function waitForBody() {
  return new Promise(resolve => {
    if (document.body) return resolve();
    const checkInterval = setInterval(() => {
      if (document.body) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 5);
  });
}

function readUserPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload.data && typeof payload.data === 'object' && payload.data.name
    ? payload.data
    : payload;
  if (!data.name) return null;
  return data;
}

async function fetchRedditUser() {
  // /api/v1/me is OAuth-only and returns 401 for a normal browser session.
  // /api/me.json is the cookie session. /user/me/about.json is the fallback
  // that also carries karma when the legacy payload is empty.
  const endpoints = ['/api/me.json', '/user/me/about.json'];
  let confirmedLoggedOut = false;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) continue;
      const user = readUserPayload(await res.json());
      if (!user) {
        confirmedLoggedOut = true;
        continue;
      }
      localStorage.setItem('classic_reddit_username', user.name);
      if (user.modhash) currentModhash = user.modhash;
      return user;
    } catch (e) { }
  }

  if (confirmedLoggedOut) {
    localStorage.removeItem('classic_reddit_username');
    return null;
  }

  const cachedName = localStorage.getItem('classic_reddit_username');
  if (cachedName) {
    return { name: cachedName, total_karma: 0, link_karma: 0, comment_karma: 0 };
  }
  return null;
}

function purgeShredditStyles() {
  document.head.querySelectorAll('link[rel="stylesheet"], style:not(#subreddit-custom-css)').forEach(el => el.remove());
}

function injectSubredditCSS(sub) {
  const existingStyle = document.getElementById('subreddit-custom-css');
  if (existingStyle) existingStyle.remove();

  if (sub && sub.stylesheet) {
    const styleEl = document.createElement('style');
    styleEl.id = 'subreddit-custom-css';
    styleEl.textContent = decodeHTML(sub.stylesheet);
    document.head.appendChild(styleEl);
  }
}

function isSubmitRoute(pathname) {
  return pathname === '/submit' || pathname === '/submit/' || /^\/r\/[^/]+\/submit\/?$/.test(pathname);
}

function commentIdFromPath(pathname) {
  const path = (pathname || '').replace(/\/+$/, '');
  const comment = path.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i);
  if (comment) return comment[1];
  const gallery = path.match(/^\/gallery\/([a-z0-9]+)/i);
  return gallery ? gallery[1] : null;
}

function buildListingUrl(pathname, search) {
  const path = (pathname || '/').replace(/\/+$/, '') || '/';
  const postId = commentIdFromPath(path);
  if (postId && /\/comments\//i.test(path)) {
    const subMatch = path.match(/^\/r\/([^/]+)\/comments\//i);
    const base = subMatch ? `/r/${subMatch[1]}/comments/${postId}` : `/comments/${postId}`;
    return `${location.origin}${base}.json${search || ''}`;
  }
  if (postId) return `${location.origin}/comments/${postId}.json${search || ''}`;
  if (path === '/' || path === '/hot') return `${location.origin}/hot.json${search || ''}`;
  return `${location.origin}${path}.json${search || ''}`;
}

function postFromPayload(rawData, postId) {
  const pick = (children) => {
    if (!Array.isArray(children)) return null;
    const posts = children.filter(child => child?.kind === 't3' && child.data?.id);
    if (!posts.length) return null;
    const wanted = String(postId).toLowerCase();
    return posts.find(child => String(child.data.id).toLowerCase() === wanted) || null;
  };

  if (Array.isArray(rawData)) {
    const postChild = pick(rawData[0]?.data?.children);
    if (!postChild) return null;
    return { post: postChild.data, comments: rawData[1]?.data?.children || [] };
  }

  const postChild = pick(rawData?.data?.children);
  if (!postChild) return null;
  return { post: postChild.data, comments: [] };
}

function postPermalink(post) {
  const raw = post?.permalink || '';
  if (raw.startsWith('http')) {
    try { return new URL(raw).pathname; } catch (e) { /* use the fallback below */ }
  } else if (raw.startsWith('/')) {
    return raw;
  }
  if (post?.subreddit && post?.id) return `/r/${post.subreddit}/comments/${post.id}/`;
  return '/';
}

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const decoded = url.replace(/&amp;/g, '&');
  try {
    const parsed = new URL(decoded, location.origin);
    const host = parsed.hostname.replace(/^www\./, '');
    if ((host === 'reddit.com' || host.endsWith('.reddit.com')) && /^\/media\/?$/.test(parsed.pathname)) {
      return parsed.searchParams.get('url') || '';
    }
    return decoded;
  } catch (e) {
    return decoded;
  }
}

function isOffsiteLink(url) {
  const file = cleanUrl(url);
  if (!file) return false;
  try {
    const parsed = new URL(file, location.origin);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) return false;
    if (host === 'redd.it' || host.endsWith('.redd.it')) return false;
    return /^https?:\/\//i.test(file);
  } catch (e) {
    return false;
  }
}

function postThumbnail(post) {
  const placeholders = ['self', 'default', 'nsfw', 'spoiler', 'image'];
  const candidates = [];
  if (typeof post.thumbnail === 'string' && !placeholders.includes(post.thumbnail)) {
    candidates.push(post.thumbnail);
  }
  const image = post.preview?.images?.[0];
  if (image) {
    const resolutions = image.resolutions || [];
    const small = resolutions.find(item => item.width >= 64 && item.width <= 216) || resolutions[0];
    if (small?.url) candidates.push(small.url);
    if (image.source?.url) candidates.push(image.source.url);
  }
  for (const candidate of candidates) {
    const url = cleanUrl(candidate);
    if (/^https?:\/\//i.test(url)) return url;
  }
  return '';
}

function renderMediaPage(mediaUrl) {
  const file = cleanUrl(mediaUrl || '');
  const playable = /^https?:\/\//i.test(file) ? file : '';
  const isVideo = /\.(mp4|webm)(?:$|\?)/i.test(playable);
  const media = !playable
    ? '<p class="tagline">This media link is empty.</p>'
    : isVideo
      ? '<video controls class="expando-video" src="' + escapeHTML(playable) + '"></video>'
      : '<img class="expando-img" referrerpolicy="no-referrer" src="' + escapeHTML(playable) + '" alt="">';

  document.body.innerHTML = '<div id="classic-app">' +
    getHeaderHTML() +
    '<div class="main-layout">' +
    '<div class="content" style="padding: 15px;">' +
    '<div class="panestack-title">image</div>' +
    media +
    '</div>' +
    buildSidebarHTML(null) +
    '</div></div>';
}

function getSubredditName() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'r' && parts[1] && !['all', 'popular', 'friends'].includes(parts[1].toLowerCase())) {
    return parts[1];
  }
  return null;
}

function getHeaderHTML(options) {
  const onSubmit = !!(options && options.submit);
  const parts = window.location.pathname.split('/').filter(Boolean);
  const subName = parts[0] === 'r' && parts[1] ? parts[1] : 'HOME';
  const subLink = subName === 'HOME' ? '/' : '/r/' + subName;
  const currentSort = parts[2] || parts[0] || 'hot';

  const isBest = currentSort === 'best' ? 'selected' : '';
  const isHot = currentSort === 'hot' || currentSort === '' ? 'selected' : '';
  const isNew = currentSort === 'new' ? 'selected' : '';
  const isRising = currentSort === 'rising' ? 'selected' : '';
  const isControversial = currentSort === 'controversial' ? 'selected' : '';
  const isTop = currentSort === 'top' ? 'selected' : '';
  const isWiki = currentSort === 'wiki' ? 'selected' : '';

  const username = currentUserData?.name || 'login';
  const karmaTotal = currentUserData
    ? (currentUserData.total_karma ?? ((currentUserData.link_karma || 0) + (currentUserData.comment_karma || 0)))
    : 0;
  const totalKarma = Number(karmaTotal || 0).toLocaleString();
  const userLink = currentUserData ? `/user/${username}` : '/login';
  const submitBase = subName === 'HOME' ? '/submit' : `/r/${subName}/submit`;

  return `
    <div id="sr-header-area">
      <div class="sr-list">
        <span class="dropdown-title">MY SUBREDDITS</span><span class="sep">-</span>
        <a href="/">HOME</a><span class="sep">-</span>
        <a href="/r/popular">POPULAR</a><span class="sep">-</span>
        <a href="/r/all">ALL</a><span class="sep">-</span>
        <a href="/saved">SAVED</a>
      </div>
      <div class="user-header-right">
        <span class="user-user"><a href="${userLink}">${username}</a></span>
        <span class="user-karma" title="link and comment karma">(${totalKarma})</span>
        <a href="/message/inbox/" id="mail-count" class="mail" title="Messages">✉</a>
        <span class="separator">|</span>
        <a href="https://www.reddit.com/prefs/">preferences</a>
        <span class="separator">|</span>
        <a href="https://www.reddit.com/logout">logout</a>
      </div>
    </div>
    <div id="header">
      <div id="header-bottom-left">
        <a id="header-img" href="/">reddit</a>
        <ul class="tabmenu">
          ${onSubmit
            ? `<li class="selected"><a href="${submitBase}">submit</a></li>`
            : `<li class="${isBest}"><a href="${subLink === '/' ? '/best' : subLink + '/best'}">best</a></li>
          <li class="${isHot}"><a href="${subLink === '/' ? '/' : subLink + '/hot'}">hot</a></li>
          <li class="${isNew}"><a href="${subLink === '/' ? '/new' : subLink + '/new'}">new</a></li>
          <li class="${isRising}"><a href="${subLink === '/' ? '/rising' : subLink + '/rising'}">rising</a></li>
          <li class="${isControversial}"><a href="${subLink === '/' ? '/controversial' : subLink + '/controversial'}">controversial</a></li>
          <li class="${isTop}"><a href="${subLink === '/' ? '/top' : subLink + '/top'}">top</a></li>
          <li class="${isWiki}"><a href="${subLink === '/' ? '/wiki' : subLink + '/wiki'}">wiki</a></li>`}
        </ul>
      </div>
      ${onSubmit ? '' : `<div id="header-bottom-right">
        <a href="${submitBase}" class="pref-lang">Submit a new link</a>
        <a href="${submitBase}?selftext=true" class="pref-lang">Submit a new text post</a>
      </div>`}
    </div>
  `;
}

function buildSidebarHTML(sub) {
  if (!sub) {
    return '<div class="side">' +
      '<div class="spacer"><form action="/search" id="search"><input type="text" name="q" placeholder="search reddit"></form></div>' +
      '<div class="spacer"><div class="titlebox"><h1 class="redditname"><a href="/">Frontpage</a></h1><p class="users-online">Classic Old Reddit UI Engine</p></div></div>' +
      '</div>';
  }

  const descHTML = sub.description_html ? safeHTML(sub.description_html) : '';
  const pubDesc = sub.public_description ? '<div class="pub-desc">' + sub.public_description + '</div>' : '';
  const subsCount = (sub.subscribers || 0).toLocaleString();
  const activeCount = (sub.accounts_active || 0).toLocaleString();

  return '<div class="side">' +
    '<div class="spacer"><form action="/search" id="search"><input type="text" name="q" placeholder="search reddit"></form></div>' +
    '<div class="spacer">' +
    '<div class="titlebox">' +
    '<h1 class="redditname"><a href="/r/' + sub.display_name + '">' + sub.display_name + '</a></h1>' +
    '<div class="sub-stats">' +
    '<span class="subscribers"><span class="number">' + subsCount + '</span> readers</span>' +
    '<p class="users-online"><span class="online-dot">●</span> <span class="number">' + activeCount + '</span> users here now</p>' +
    '</div>' +
    pubDesc +
    '<div class="usertext-body md-container">' + descHTML + '</div>' +
    '</div>' +
    '</div>' +
    '</div>';
}

async function handleProfileOrSavedRoute(pathname) {
  const jsonUrl = `${window.location.origin}${pathname}.json${window.location.search}`;

  try {
    const res = await fetch(jsonUrl, { credentials: 'include' });
    const data = await res.json();
    currentModhash = data?.data?.modhash || null;

    document.documentElement.id = "classic-reddit-ready";
    renderProfilePage(pathname, data.data.children);
  } catch (err) {
    console.error("Profile load error:", err);
    document.documentElement.id = "classic-bypass";
  }
}

function renderProfilePage(pathname, children) {
  const isSaved = pathname === '/saved';
  const profileName = isSaved ? 'saved items' : pathname.split('/')[2];

  let itemsHTML = '';
  children.forEach((item, idx) => {
    if (item.kind === 't3') {
      itemsHTML += buildPostHTML(item.data, idx + 1, false);
    } else if (item.kind === 't1') {
      itemsHTML += buildProfileCommentItem(item.data);
    }
  });

  let html = '<div id="classic-app">' +
    getHeaderHTML() +
    '<div class="main-layout">' +
    '<div class="content">' +
    '<div class="panestack-title">' + (isSaved ? 'your saved posts' : 'overview for ' + profileName) + '</div>' +
    '<div class="siteTable">' + (itemsHTML || '<p style="padding: 10px; color: #666;">No items found.</p>') + '</div>' +
    '</div>' +
    buildSidebarHTML(null) +
    '</div>' +
    '</div>';

  document.body.innerHTML = html;
  attachInteractiveListeners();
}

function buildProfileCommentItem(c) {
  return '<div class="thing profile-comment-box" id="comment_' + c.name + '">' +
    '<div class="entry" style="padding: 8px; border: 1px solid #e0e0e0; background: #fafafa; margin-bottom: 8px;">' +
    '<p class="tagline"><a href="' + escapeHTML(c.permalink || '') + '" class="title-link" style="font-weight: bold; color: #336699;">in: ' + escapeHTML(c.link_title || '') + '</a> (r/' + escapeHTML(c.subreddit || '') + ')</p>' +
    '<p class="tagline" style="margin-top: 4px;"><a href="/user/' + encodeURIComponent(c.author || '') + '" class="author">' + escapeHTML(c.author || '') + '</a> <span class="score">' + c.score + ' points</span> <span class="time">' + timeAgo(c.created_utc) + '</span></p>' +
    '<div class="usertext-body" style="margin-top: 6px;">' + safeHTML(c.body_html) + '</div>' +
    '</div>' +
    '</div>';
}

function renderFeedPage(listingData, sidebarData) {
  const posts = listingData.children;
  const urlParams = new URLSearchParams(window.location.search);
  const currentCount = parseInt(urlParams.get('count') || '0', 10);

  let postsHTML = '';
  let shown = 0;
  posts.forEach((item) => {
    if (!item?.data || item.data.promoted) return;
    if (item.kind === 't3' && item.data.id) {
      shown += 1;
      postsHTML += buildPostHTML(item.data, currentCount + shown, false);
    } else if (item.kind === 't1') {
      postsHTML += buildProfileCommentItem(item.data);
    }
  });

  let prevLink = '';
  if (listingData.before) {
    const prevCount = Math.max(0, currentCount - 25);
    prevLink = '<a class="prev-button" href="?count=' + prevCount + '&before=' + listingData.before + '">‹ prev</a>';
  }

  let nextLink = '';
  if (listingData.after) {
    const nextCount = currentCount + 25;
    nextLink = '<a class="next-button" href="?count=' + nextCount + '&after=' + listingData.after + '">next ›</a>';
  }

  let html = '<div id="classic-app">' +
    getHeaderHTML() +
    '<div class="main-layout">' +
    '<div class="content">' +
    '<div class="siteTable">' + postsHTML + '</div>' +
    '<div class="nav-buttons"><span class="nextprev">view more: ' + prevLink + ' ' + nextLink + '</span></div>' +
    '</div>' +
    buildSidebarHTML(sidebarData) +
    '</div>' +
    '</div>';

  document.body.innerHTML = html;
  attachInteractiveListeners();
}

function buildPostHTML(post, rank, isCommentPage) {
  const voteClass = post.likes === true ? 'upvoted' : (post.likes === false ? 'downvoted' : 'unvoted');

  let expandoContent = '';
  let hasExpando = false;

  if (post.selftext_html) {
    hasExpando = true;
    expandoContent = '<div class="usertext-body md-box">' + safeHTML(post.selftext_html) + '</div>';
  } else if (post.is_gallery && post.media_metadata) {
    hasExpando = true;
    let galleryImages = '';
    const items = post.gallery_data?.items || [];

    items.forEach((item, index) => {
      const mediaId = item.media_id;
      const meta = post.media_metadata[mediaId];
      if (meta && meta.s) {
        const imageUrl = meta.s.u ? meta.s.u.replace(/&amp;/g, '&') : '';
        if (imageUrl) {
          galleryImages += '<div class="gallery-slide" style="display: ' + (index === 0 ? 'block' : 'none') + ';" data-index="' + index + '">' +
            '<div class="gallery-counter">Image ' + (index + 1) + ' of ' + items.length + '</div>' +
            '<a href="' + imageUrl + '" target="_blank"><img class="expando-img" src="' + imageUrl + '" /></a>' +
            '</div>';
        }
      }
    });

    if (galleryImages) {
      expandoContent = '<div class="gallery-container" id="gallery-' + post.id + '">' + galleryImages +
        (items.length > 1 ? '<div class="gallery-controls"><button class="gallery-prev" onclick="plusGallerySlide(\'' + post.id + '\', -1)">‹ Prev</button><button class="gallery-next" onclick="plusGallerySlide(\'' + post.id + '\', 1)">Next ›</button></div>' : '') +
        '</div>';
    }
  } else if (post.is_video && post.media?.reddit_video) {
    hasExpando = true;
    const videoUrl = post.media.reddit_video.fallback_url;
    const audioUrl = videoUrl.replace(/DASH_[0-9]+\.mp4/, 'DASH_AUDIO_128.mp4');

    expandoContent = '<div class="video-container">' +
      '<video controls preload="metadata" class="expando-video" id="video-' + post.id + '"><source src="' + videoUrl + '" type="video/mp4"></video>' +
      '<audio preload="metadata" id="audio-' + post.id + '" src="' + audioUrl + '"></audio>' +
      '</div>';
  } else {
    const fileUrl = cleanUrl(post.url_overridden_by_dest || post.url || '');
    const isDirectImage = post.post_hint === 'image' || /\.(jpe?g|png|gif|webp)(?:$|\?)/i.test(fileUrl);
    if (isDirectImage && fileUrl) {
      hasExpando = true;
      expandoContent = '<a href="' + escapeHTML(fileUrl) + '" target="_blank" rel="noreferrer"><img class="expando-img" referrerpolicy="no-referrer" src="' + escapeHTML(fileUrl) + '" /></a>';
    }
  }

  const expandoBtn = hasExpando && !isCommentPage ? '<div class="expando-button" data-id="' + escapeHTML(post.name) + '" title="Toggle preview">[+]</div>' : '';
  const thumbUrl = postThumbnail(post);
  const permalink = postPermalink(post);
  const outbound = cleanUrl(post.url_overridden_by_dest || post.url || '');
  const externalUrl = !post.is_self && isOffsiteLink(outbound) ? outbound : '';
  const titleHref = externalUrl || permalink;
  const thumbHref = externalUrl || permalink;

  let thumbHTML = '';
  if (post.over_18 && !thumbUrl) {
    thumbHTML = '<a class="thumbnail nsfw-thumb" href="' + escapeHTML(permalink) + '">18+</a>';
  } else if (thumbUrl) {
    thumbHTML = '<a class="thumbnail" href="' + escapeHTML(thumbHref) + '"><img src="' + escapeHTML(thumbUrl) + '" width="70" height="50" alt="" referrerpolicy="no-referrer"></a>';
  } else {
    thumbHTML = '<a class="thumbnail default-thumb" href="' + escapeHTML(permalink) + '">' + (post.is_self ? 'self' : 'link') + '</a>';
  }

  const nsfwBadge = post.over_18 ? '<span class="nsfw-stamp">18+</span>' : '';
  const nsfwClass = post.over_18 ? 'over-18' : '';

  const flairHTML = post.link_flair_text ? '<span class="linkflairlabel">' + escapeHTML(post.link_flair_text) + '</span>' : '';
  const rankHTML = rank ? '<span class="rank">' + rank + '</span>' : '';
  const stickiedClass = post.stickied ? 'stickied' : '';

  return '<div class="thing ' + stickiedClass + ' ' + nsfwClass + '" id="thing_' + escapeHTML(post.name) + '">' +
    rankHTML +
    '<div class="midcol ' + voteClass + '" data-score="' + post.score + '">' +
    '<div class="arrow up" data-fullname="' + escapeHTML(post.name) + '" data-dir="1">▲</div>' +
    '<div class="score">' + formatScore(post.score) + '</div>' +
    '<div class="arrow down" data-fullname="' + escapeHTML(post.name) + '" data-dir="-1">▼</div>' +
    '</div>' +
    thumbHTML +
    '<div class="entry">' +
    '<p class="title">' +
    nsfwBadge +
    flairHTML +
    '<a class="title-link" href="' + escapeHTML(titleHref) + '">' + escapeHTML(post.title) + '</a>' +
    '<span class="domain">(<a href="/domain/' + encodeURIComponent(post.domain || '') + '">' + escapeHTML(post.domain || '') + '</a>)</span>' +
    '</p>' +
    '<div class="sub-row">' +
    expandoBtn +
    '<div class="meta">' +
    '<p class="tagline">submitted ' + timeAgo(post.created_utc) + ' by <a href="/user/' + encodeURIComponent(post.author || '') + '" class="author">' + escapeHTML(post.author || '') + '</a> to <a href="/r/' + encodeURIComponent(post.subreddit || '') + '" class="subreddit">r/' + escapeHTML(post.subreddit || '') + '</a></p>' +
    '<ul class="flat-list buttons">' +
    '<li class="first"><a href="' + escapeHTML(permalink) + '" class="comments">' + post.num_comments + ' comments</a></li>' +
    '<li><a href="javascript:void(0)" class="share-button">share</a></li>' +
    '<li><a href="javascript:void(0)" class="save-button" data-fullname="' + post.name + '">save</a></li>' +
    '<li><a href="javascript:void(0)" class="hide-button" data-fullname="' + post.name + '">hide</a></li>' +
    '<li><a href="javascript:void(0)" class="report-button">report</a></li>' +
    '<li><a href="javascript:void(0)" class="crosspost-button">crosspost</a></li>' +
    '</ul>' +
    '</div>' +
    '</div>' +
    '<div class="expando ' + (isCommentPage && expandoContent ? 'open' : '') + '" id="expando-' + escapeHTML(post.name) + '">' + expandoContent + '</div>' +
    '</div>' +
    '</div>';
}

function renderCommentPage(post, comments, sidebarData) {
  let commentsHTML = '';
  comments.forEach(c => {
    commentsHTML += buildCommentTree(c, post.author);
  });

  let html = '<div id="classic-app">' +
    getHeaderHTML() +
    '<div class="main-layout">' +
    '<div class="content">' +
    '<div class="siteTable">' + buildPostHTML(post, null, true) + '</div>' +
    '<div class="commentarea">' +
    '<div class="panestack-title">all ' + post.num_comments + ' comments</div>' +
    '<div class="sitetable nestedlisting">' + commentsHTML + '</div>' +
    '</div>' +
    '</div>' +
    buildSidebarHTML(sidebarData) +
    '</div>' +
    '</div>';
  document.body.innerHTML = html;
  attachInteractiveListeners();
}

function buildCommentTree(commentNode, postAuthor) {
  if (commentNode.kind === 'more') {
    return '<div class="morecomments">load more comments (' + commentNode.data.count + ' replies)</div>';
  }
  const c = commentNode.data;
  if (!c || !c.body_html) return '';

  const voteClass = c.likes === true ? 'upvoted' : (c.likes === false ? 'downvoted' : 'unvoted');
  const isOP = c.author === postAuthor && postAuthor !== '[deleted]';

  let repliesHTML = '';
  if (c.replies && c.replies.data && c.replies.data.children) {
    c.replies.data.children.forEach(child => {
      repliesHTML += buildCommentTree(child, postAuthor);
    });
  }

  const authorClass = isOP ? 'author submitter' : 'author';
  const opBadge = isOP ? '<span class="userattrs">[S]</span>' : '';

  return '<div class="comment" id="comment_' + c.name + '">' +
    '<div class="midcol comment-votes ' + voteClass + '" data-score="' + c.score + '">' +
    '<div class="arrow up" data-fullname="' + c.name + '" data-dir="1">▲</div>' +
    '<div class="arrow down" data-fullname="' + c.name + '" data-dir="-1">▼</div>' +
    '</div>' +
    '<div class="entry">' +
    '<p class="tagline">' +
    '<a href="javascript:void(0)" class="expand">[–]</a>' +
    '<a href="/user/' + c.author + '" class="' + authorClass + '">' + c.author + '</a>' +
    opBadge +
    '<span class="score">' + c.score + ' points</span>' +
    '<span class="time">' + timeAgo(c.created_utc) + '</span>' +
    '</p>' +
    '<div class="comment-body">' +
    '<div class="usertext-body">' + safeHTML(c.body_html) + '</div>' +
    '<ul class="flat-list buttons">' +
    '<li><a href="#comment_' + c.name + '">permalink</a></li>' +
    '<li><a href="javascript:void(0)" class="reply-button" data-fullname="' + c.name + '">reply</a></li>' +
    '</ul>' +
    '<div class="child">' + repliesHTML + '</div>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function renderSubmitPage() {
  const isSelf = new URLSearchParams(window.location.search).get('selftext') === 'true';
  const subName = getSubredditName() || '';
  const submitBase = subName ? `/r/${subName}/submit` : '/submit';
  const info = isSelf
    ? 'You are submitting a text-based post. Speak your mind. A title is required, but expanding further in the text field is not. Beginning your title with "vote up if" is a violation of intergalactic law.'
    : 'You are submitting a link. The key to a successful submission is interesting content and a descriptive title.';

  const typeFields = isSelf
    ? '<div class="roundfield">' +
      '<label for="submit-title"><span class="submit-required">*</span>title</label>' +
      '<textarea id="submit-title" rows="3"></textarea>' +
      '</div>' +
      '<div class="roundfield">' +
      '<label for="submit-text">text <span class="submit-optional">(optional)</span></label>' +
      '<textarea id="submit-text" rows="8"></textarea>' +
      '<div class="submit-help-links">' +
      '<a href="https://www.redditinc.com/policies/content-policy" target="_blank" rel="noreferrer">content policy</a>' +
      '<a href="https://www.reddit.com/wiki/commenting" target="_blank" rel="noreferrer">formatting help</a>' +
      '</div>' +
      '</div>'
    : '<div class="roundfield">' +
      '<label for="submit-url">url</label>' +
      '<input type="url" id="submit-url">' +
      '</div>' +
      '<div class="roundfield">' +
      '<div class="roundfield-title">image/video</div>' +
      '<div class="submit-drop" id="submit-drop">' +
      '<span class="submit-drop-icon" aria-hidden="true"></span>' +
      '<span id="submit-drop-label">Drop here or</span>' +
      '<button type="button" id="submit-file-btn" class="submit-file-btn">CHOOSE FILE</button>' +
      '<input type="file" id="submit-file" class="submit-file-input" accept="image/*,video/*">' +
      '</div>' +
      '</div>' +
      '<div class="roundfield">' +
      '<label for="submit-title"><span class="submit-required">*</span>title</label>' +
      '<textarea id="submit-title" rows="3"></textarea>' +
      '</div>';

  const html = '<div id="classic-app">' +
    getHeaderHTML({ submit: true }) +
    '<div class="main-layout">' +
    '<div class="content submit-page">' +
    '<h1>submit to reddit</h1>' +
    '<ul class="submit-tabs">' +
    '<li class="' + (isSelf ? '' : 'selected') + '"><a href="' + submitBase + '">link</a></li>' +
    '<li class="' + (isSelf ? 'selected' : '') + '"><a href="' + submitBase + '?selftext=true">text</a></li>' +
    '</ul>' +
    '<div class="submit-panel">' +
    '<div id="submit-status" class="submit-error" hidden></div>' +
    '<div class="infobar">' + info + '</div>' +
    typeFields +
    '<div class="roundfield">' +
    '<div class="roundfield-title"><span class="submit-required">*</span>choose where to post</div>' +
    '<label class="submit-radio"><input type="radio" name="submit-dest" id="submit-dest-profile" value="profile"> Your profile</label>' +
    '<label class="submit-radio"><input type="radio" name="submit-dest" id="submit-dest-sub" value="subreddit" checked> A subreddit:</label>' +
    '<input type="text" id="submit-sr" value="' + escapeHTML(subName) + '">' +
    '<div class="submit-subs-title">your subscribed subreddits</div>' +
    '<div class="submit-sub-list" id="submit-subs">loading…</div>' +
    '</div>' +
    '<div class="roundfield">' +
    '<div class="roundfield-title">options</div>' +
    '<label class="submit-check"><input type="checkbox" id="submit-sendreplies" checked> send replies to my inbox</label>' +
    '</div>' +
    '<div class="submit-notice">please be mindful of reddit\'s <a href="https://www.redditinc.com/policies/content-policy" target="_blank" rel="noreferrer">content policy</a> and practice good <a href="https://www.reddit.com/wiki/reddiquette" target="_blank" rel="noreferrer">reddiquette</a>.</div>' +
    '<p class="submit-required-note"><span class="submit-required">*</span>required</p>' +
    '<button type="button" id="submit-post-btn" class="submit-native">submit</button>' +
    '</div>' +
    '</div>' +
    buildSubmitSidebarHTML() +
    '</div>' +
    buildSubmitFooterHTML() +
    '</div>';

  document.body.innerHTML = html;
  document.documentElement.id = "classic-reddit-ready";
  attachSubmitListeners(isSelf);
  loadSubscribedSubreddits();
}

function buildSubmitSidebarHTML() {
  return '<div class="side">' +
    '<div class="spacer"><form action="/search" id="search"><input type="text" name="q" placeholder="search reddit"></form></div>' +
    '<div class="account-activity"><a href="https://www.reddit.com/account-activity">account activity</a></div>' +
    '</div>';
}

function buildSubmitFooterHTML() {
  return '<div class="footer-parent">' +
    '<div class="footer-columns">' +
    '<div class="footer-col"><div class="footer-col-title">about</div>' +
    '<a href="https://www.redditinc.com/blog">blog</a>' +
    '<a href="https://www.redditinc.com">about</a>' +
    '<a href="https://www.redditinc.com/advertising">advertising</a>' +
    '<a href="https://www.redditinc.com/careers">careers</a></div>' +
    '<div class="footer-col"><div class="footer-col-title">help</div>' +
    '<a href="https://www.redditinc.com/policies/content-policy">site rules</a>' +
    '<a href="https://www.reddithelp.com">reddit help center</a>' +
    '<a href="https://www.reddit.com/wiki/reddiquette">reddiquette</a>' +
    '<a href="https://www.reddit.com/wiki/moderation">mod guidelines</a>' +
    '<a href="https://www.reddithelp.com/en/submit-request">contact us</a></div>' +
    '<div class="footer-col"><div class="footer-col-title">apps &amp; tools</div>' +
    '<a href="https://apps.apple.com/app/reddit/id1064216828">Reddit for iPhone</a>' +
    '<a href="https://play.google.com/store/apps/details?id=com.reddit.frontpage">Reddit for Android</a>' +
    '<a href="https://www.reddit.com">mobile website</a></div>' +
    '<div class="footer-col"><div class="footer-col-title footer-heart">&lt;3</div>' +
    '<a class="footer-premium" href="https://www.reddit.com/premium">reddit premium</a></div>' +
    '</div>' +
    '<p class="footer-legal">Use of this site constitutes acceptance of our <a href="https://www.redditinc.com/policies/user-agreement">User Agreement</a> and <a href="https://www.redditinc.com/policies/privacy-policy">Privacy Policy</a>. © 2026 reddit inc. All rights reserved.<br>REDDIT and the ALIEN Logo are registered trademarks of reddit inc.</p>' +
    '</div>';
}

function showSubmitError(message) {
  const el = document.getElementById('submit-status');
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || '';
}

function attachSubmitListeners(isSelf) {
  const profileRadio = document.getElementById('submit-dest-profile');
  const subRadio = document.getElementById('submit-dest-sub');
  const srInput = document.getElementById('submit-sr');
  const subs = document.getElementById('submit-subs');

  function syncDest() {
    const profile = profileRadio.checked;
    srInput.disabled = profile;
    subs.classList.toggle('disabled', profile);
  }

  profileRadio.addEventListener('change', syncDest);
  subRadio.addEventListener('change', syncDest);
  srInput.addEventListener('focus', () => {
    subRadio.checked = true;
    syncDest();
  });

  if (!isSelf) attachSubmitUpload();

  document.getElementById('submit-post-btn').addEventListener('click', () => submitClassicPost(isSelf));
}

function attachSubmitUpload() {
  const drop = document.getElementById('submit-drop');
  const fileInput = document.getElementById('submit-file');
  const fileBtn = document.getElementById('submit-file-btn');
  if (!drop || !fileInput) return;

  fileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  drop.addEventListener('click', (e) => {
    if (e.target.closest('#submit-file-btn')) return;
    fileInput.click();
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) uploadSubmitMedia(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) uploadSubmitMedia(file);
  });

  document.getElementById('submit-url').addEventListener('input', () => {
    if (drop.dataset.mediaUrl && document.getElementById('submit-url').value.trim() !== drop.dataset.mediaUrl) {
      delete drop.dataset.mediaKind;
      delete drop.dataset.mediaUrl;
    }
  });
}

async function uploadSubmitMedia(file) {
  const drop = document.getElementById('submit-drop');
  const label = document.getElementById('submit-drop-label');
  const urlInput = document.getElementById('submit-url');
  const isVideo = (file.type || '').startsWith('video/');
  const isImage = (file.type || '').startsWith('image/');
  delete drop.dataset.mediaKind;
  delete drop.dataset.mediaUrl;

  if (!isVideo && !isImage) {
    label.textContent = 'Drop here or';
    showSubmitError('Choose an image or video file.');
    return;
  }

  label.textContent = 'uploading ' + file.name + '…';
  showSubmitError('');

  try {
    const uh = currentModhash || getCookie('csrf_token');
    const leaseParams = new URLSearchParams({
      filepath: file.name,
      mimetype: file.type || 'application/octet-stream',
      api_type: 'json'
    });
    if (uh) leaseParams.set('uh', uh);

    const leaseRes = await fetch('/api/media/asset.json', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: leaseParams.toString()
    });
    const leaseJson = await leaseRes.json();
    const payload = leaseJson.args ? leaseJson : (leaseJson.json && leaseJson.json.data);
    if (!payload || !payload.args || !payload.asset) {
      throw new Error('could not start the upload');
    }

    const form = new FormData();
    payload.args.fields.forEach((field) => form.append(field.name, field.value));
    form.append('file', file);

    let action = payload.args.action || '';
    if (action.startsWith('//')) action = 'https:' + action;
    const uploadRes = await fetch(action, { method: 'POST', body: form });
    if (!uploadRes.ok && uploadRes.status !== 201) throw new Error('upload failed');

    const keyField = payload.args.fields.find((field) => field.name === 'key');
    const key = keyField ? keyField.value.replace(/^\//, '') : '';
    const mediaUrl = 'https://reddit-uploaded-media.s3-accelerate.amazonaws.com/' + key;
    drop.dataset.mediaKind = isVideo ? 'video' : 'image';
    drop.dataset.mediaUrl = mediaUrl;
    urlInput.value = mediaUrl;
    label.textContent = file.name;
  } catch (err) {
    label.textContent = 'Drop here or';
    showSubmitError('Could not upload that file. Paste a url instead.');
    console.error('Media upload failed:', err);
  }
}

async function loadSubscribedSubreddits() {
  const box = document.getElementById('submit-subs');
  if (!box) return;

  try {
    const names = [];
    let after = '';
    for (let page = 0; page < 4; page++) {
      const url = '/subreddits/mine/subscriber.json?limit=100&raw_json=1' + (after ? '&after=' + encodeURIComponent(after) : '');
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) break;
      const data = await res.json();
      (data?.data?.children || []).forEach((item) => {
        if (item?.data?.display_name) names.push(item.data.display_name);
      });
      after = data?.data?.after || '';
      if (!after) break;
    }

    if (!names.length) {
      box.textContent = 'log in to see your subscriptions';
      return;
    }

    box.innerHTML = names.map((name) => '<a href="#" data-sub="' + escapeHTML(name) + '">' + escapeHTML(name) + '</a>').join(' ');
    box.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('submit-sr').value = link.dataset.sub;
        document.getElementById('submit-dest-sub').checked = true;
        document.getElementById('submit-sr').disabled = false;
        box.classList.remove('disabled');
      });
    });
  } catch (err) {
    box.textContent = '';
  }
}

async function submitClassicPost(isSelf) {
  const title = document.getElementById('submit-title').value.trim();
  const profile = document.getElementById('submit-dest-profile').checked;
  const srInput = document.getElementById('submit-sr').value.trim();
  const text = isSelf ? document.getElementById('submit-text').value.trim() : '';
  const urlInput = isSelf ? null : document.getElementById('submit-url');
  const url = urlInput ? urlInput.value.trim() : '';
  const drop = document.getElementById('submit-drop');
  const button = document.getElementById('submit-post-btn');

  if (!title) {
    showSubmitError('a title is required');
    return;
  }

  let sr = srInput;
  if (profile) {
    if (!currentUserData?.name) {
      showSubmitError('log in to post to your profile');
      return;
    }
    sr = 'u_' + currentUserData.name;
  } else if (!sr) {
    showSubmitError('choose a subreddit');
    return;
  }

  let kind = isSelf ? 'self' : 'link';
  if (!isSelf && drop && drop.dataset.mediaKind && drop.dataset.mediaUrl === url) {
    kind = drop.dataset.mediaKind;
  }
  if (!isSelf && !url) {
    showSubmitError('a url or an image/video is required');
    return;
  }

  const uh = currentModhash || getCookie('csrf_token');
  const bodyParams = new URLSearchParams({
    api_type: 'json',
    kind: kind,
    sr: sr,
    title: title,
    uh: uh || '',
    sendreplies: document.getElementById('submit-sendreplies').checked ? 'true' : 'false'
  });
  if (isSelf) bodyParams.set('text', text);
  else bodyParams.set('url', url);

  showSubmitError('');
  button.disabled = true;

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: bodyParams.toString()
    });
    const data = await res.json();
    if (data.json && data.json.errors && data.json.errors.length === 0) {
      window.location.href = data.json.data.url;
      return;
    }
    const errors = data.json && data.json.errors;
    const message = Array.isArray(errors) && errors.length
      ? errors.map((item) => item[1] || item[0]).join('\n')
      : 'Submission failed.';
    showSubmitError(message);
    button.disabled = false;
  } catch (err) {
    console.error('Post submission failed:', err);
    showSubmitError('Submission failed.');
    button.disabled = false;
  }
}

function attachInteractiveListeners() {
  document.querySelectorAll('.expando-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(`expando-${btn.dataset.id}`);
      const isOpen = target.classList.toggle('open');
      btn.textContent = isOpen ? '[-]' : '[+]';
    });
  });

  document.querySelectorAll('.comment .expand').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const comment = e.target.closest('.comment');
      const isCollapsed = comment.classList.toggle('collapsed');
      e.target.textContent = isCollapsed ? '[+]' : '[–]';
    });
  });

  document.querySelectorAll('.reply-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const entry = e.target.closest('.entry');
      if (entry.querySelector('.usertext-edit')) return;
      const parentFullname = btn.dataset.fullname;

      const editDiv = document.createElement('div');
      editDiv.className = 'usertext-edit';
      editDiv.innerHTML = '<textarea rows="5" cols="60" class="reply-textarea" placeholder="Write your reply..."></textarea>' +
        '<div class="usertext-buttons"><button type="button" class="save-reply">save</button><button type="button" class="cancel-reply">cancel</button></div>';
      entry.appendChild(editDiv);

      editDiv.querySelector('.cancel-reply').addEventListener('click', () => editDiv.remove());
      editDiv.querySelector('.save-reply').addEventListener('click', async () => {
        const textarea = editDiv.querySelector('.reply-textarea');
        const text = textarea.value.trim();
        if (!text) return;
        textarea.disabled = true;
        const success = await sendCommentAPI(parentFullname, text);
        if (success) location.reload();
        else { alert('Failed to post comment.'); textarea.disabled = false; }
      });
    });
  });

  document.querySelectorAll('.hide-button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const thing = e.target.closest('.thing');
      const fullname = btn.dataset.fullname;
      if (fullname) {
        await hidePostAPI(fullname);
        thing.style.display = 'none';
      }
    });
  });

  document.querySelectorAll('.save-button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const fullname = btn.dataset.fullname;
      if (fullname) {
        const success = await savePostAPI(fullname);
        if (success) btn.textContent = btn.textContent === 'save' ? 'unsave' : 'save';
      }
    });
  });

  document.querySelectorAll('.arrow').forEach(arrow => {
    arrow.addEventListener('click', async () => {
      const midcol = arrow.closest('.midcol');
      const fullname = arrow.dataset.fullname;
      const clickedDir = parseInt(arrow.dataset.dir, 10);

      const isCurrentlyUp = midcol.classList.contains('upvoted');
      const isCurrentlyDown = midcol.classList.contains('downvoted');
      let finalDir = clickedDir;

      if ((clickedDir === 1 && isCurrentlyUp) || (clickedDir === -1 && isCurrentlyDown)) finalDir = 0;

      midcol.classList.remove('upvoted', 'downvoted', 'unvoted');
      midcol.classList.add(finalDir === 1 ? 'upvoted' : (finalDir === -1 ? 'downvoted' : 'unvoted'));

      const scoreEl = midcol.querySelector('.score');
      if (scoreEl) {
        const baseScore = parseInt(midcol.dataset.score || '0', 10);
        scoreEl.textContent = formatScore(baseScore + finalDir);
      }

      await submitVote(fullname, finalDir);
    });
  });

  attachVideoSyncListeners();
  attachKeyboardShortcuts();
}

// --- RES KEYBOARD SHORTCUT ENGINE ---
function attachKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
      return;
    }

    const isShift = e.shiftKey;
    const key = e.key;

    if (isShift && key === '?') {
      e.preventDefault();
      alert("Classic Reddit Keyboard Shortcuts:\n\n" +
        "j / k: Next / Previous post or comment\n" +
        "Enter: Open link or expand comment\n" +
        "x: Toggle post expando\n" +
        "Shift + x: Toggle all expandos\n" +
        "c: Open comments\n" +
        "a / z: Upvote / Downvote\n" +
        "s: Save\n" +
        "h: Hide post\n" +
        "r: Reply to comment");
      return;
    }

    const items = Array.from(document.querySelectorAll('.thing, .comment'));
    if (items.length === 0) return;

    let currentIndex = items.findIndex(item => item.classList.contains('selected'));
    if (currentIndex === -1 && (key === 'j' || key === 'k')) {
      currentIndex = 0;
      items[0].classList.add('selected');
      items[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const currentItem = items[currentIndex];

    if (key === 'j' || key === 'k') {
      e.preventDefault();
      if (currentIndex !== -1) currentItem.classList.remove('selected');

      if (key === 'j') {
        currentIndex = Math.min(items.length - 1, currentIndex + 1);
      } else {
        currentIndex = Math.max(0, currentIndex - 1);
      }

      const nextItem = items[currentIndex];
      nextItem.classList.add('selected');
      nextItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (key === 'x' && !isShift) {
      const expBtn = currentItem?.querySelector('.expando-button');
      if (expBtn) { e.preventDefault(); expBtn.click(); }
    } else if (isShift && key === 'X') {
      e.preventDefault();
      const allBtns = document.querySelectorAll('.expando-button');
      const anyClosed = Array.from(allBtns).some(b => b.textContent.includes('[+]'));
      allBtns.forEach(btn => {
        const isOpen = btn.textContent.includes('[-]');
        if (anyClosed && isOpen) return;
        if (!anyClosed && !isOpen) return;
        btn.click();
      });
    } else if (key === 'c' && !isShift) {
      const commentsLink = currentItem?.querySelector('.comments');
      if (commentsLink) { e.preventDefault(); window.location.href = commentsLink.href; }
    } else if (key === 'a') {
      const upArrow = currentItem?.querySelector('.arrow.up');
      if (upArrow) { e.preventDefault(); upArrow.click(); }
    } else if (key === 'z') {
      const downArrow = currentItem?.querySelector('.arrow.down');
      if (downArrow) { e.preventDefault(); downArrow.click(); }
    } else if (key === 's' && !isShift) {
      const saveBtn = currentItem?.querySelector('.save-button');
      if (saveBtn) { e.preventDefault(); saveBtn.click(); }
    } else if (key === 'h' && !isShift) {
      const hideBtn = currentItem?.querySelector('.hide-button');
      if (hideBtn) { e.preventDefault(); hideBtn.click(); }
    } else if (key === 'Enter') {
      const titleLink = currentItem?.querySelector('.title-link');
      if (titleLink) { e.preventDefault(); window.open(titleLink.href, '_blank'); }
    }
  });
}

async function hidePostAPI(fullname) {
  const uh = currentModhash || getCookie('csrf_token');
  if (!uh) return;
  const bodyParams = new URLSearchParams({ id: fullname, uh: uh });
  try {
    await fetch('/api/hide', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'include', body: bodyParams.toString() });
  } catch (err) { console.error("Hide failed", err); }
}

async function savePostAPI(fullname) {
  const uh = currentModhash || getCookie('csrf_token');
  if (!uh) return false;
  const bodyParams = new URLSearchParams({ id: fullname, uh: uh });
  try {
    const res = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'include', body: bodyParams.toString() });
    return res.ok;
  } catch (err) { return false; }
}

async function sendCommentAPI(thingId, text) {
  const uh = currentModhash || getCookie('csrf_token');
  if (!uh) return false;

  const bodyParams = new URLSearchParams();
  bodyParams.append('api_type', 'json');
  bodyParams.append('thing_id', thingId);
  bodyParams.append('text', text);
  bodyParams.append('uh', uh);

  try {
    const res = await fetch(`${window.location.origin}/api/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: bodyParams.toString()
    });
    const data = await res.json();
    return !data.json.errors.length;
  } catch (err) {
    return false;
  }
}

async function submitVote(fullname, dir) {
  const uh = currentModhash || getCookie('csrf_token');
  if (!uh) return;

  const bodyParams = new URLSearchParams();
  bodyParams.append('id', fullname);
  bodyParams.append('dir', dir.toString());
  bodyParams.append('uh', uh);
  bodyParams.append('api_type', 'json');

  try {
    await fetch(`${window.location.origin}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      credentials: 'include',
      body: bodyParams.toString()
    });
  } catch (err) {
    console.error("Failed to submit vote:", err);
  }
}

window.plusGallerySlide = function (postId, n) {
  const container = document.getElementById(`gallery-${postId}`);
  if (!container) return;
  const slides = container.querySelectorAll('.gallery-slide');
  let currentIndex = 0;

  slides.forEach((slide, idx) => {
    if (slide.style.display === 'block') currentIndex = idx;
    slide.style.display = 'none';
  });

  let newIndex = currentIndex + n;
  if (newIndex >= slides.length) newIndex = 0;
  if (newIndex < 0) newIndex = slides.length - 1;

  slides[newIndex].style.display = 'block';
};

function attachVideoSyncListeners() {
  document.querySelectorAll('video.expando-video').forEach(video => {
    const videoId = video.id;
    const audioId = videoId.replace('video-', 'audio-');
    const audio = document.getElementById(audioId);
    if (!audio) return;

    video.addEventListener('play', () => { audio.currentTime = video.currentTime; audio.play().catch(() => { }); });
    video.addEventListener('pause', () => { audio.pause(); });
    video.addEventListener('seeking', () => { audio.currentTime = video.currentTime; });
    video.addEventListener('volumechange', () => { audio.volume = video.volume; audio.muted = video.muted; });
  });
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeHTML(html) {
  if (!html) return '';
  const decoded = decodeHTML(html);
  const doc = new DOMParser().parseFromString(decoded, 'text/html');
  return doc.body.innerHTML;
}

function decodeHTML(html) {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function formatScore(s) {
  return s >= 10000 ? (s / 1000).toFixed(1) + 'k' : s;
}

function timeAgo(utc) {
  const diff = Math.floor(Date.now() / 1000 - utc);
  if (diff < 60) return `just now`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}