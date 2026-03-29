// popup.js

let allLinks = [];
let filteredLinks = [];

// DOM
const btnExtract   = document.getElementById('btnExtract');
const btnCopy      = document.getElementById('btnCopy');
const btnClear     = document.getElementById('btnClear');
const countBadge   = document.getElementById('countBadge');
const searchWrap   = document.getElementById('searchWrap');
const searchInput  = document.getElementById('searchInput');
const listWrap     = document.getElementById('listWrap');
const footerInfo   = document.getElementById('footerInfo');
const footerFilter = document.getElementById('footerFiltered');
const toast        = document.getElementById('toast');

// States
const stateIdle    = document.getElementById('stateIdle');
const stateLoading = document.getElementById('stateLoading');
const stateEmpty   = document.getElementById('stateEmpty');
const stateError   = document.getElementById('stateError');
const errorMsg     = document.getElementById('errorMsg');

function showState(id) {
  ['stateIdle','stateLoading','stateEmpty','stateError'].forEach(s => {
    document.getElementById(s).style.display = s === id ? 'flex' : 'none';
  });
  listWrap.classList.toggle('visible', id === null);
  searchWrap.classList.toggle('visible', id === null);
}

function setBadge(count) {
  countBadge.textContent = `${count} video${count !== 1 ? 's' : ''}`;
  countBadge.classList.toggle('has-count', count > 0);
}

function showToast(msg, duration = 2000) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

function renderList(links) {
  listWrap.innerHTML = '';
  if (!links.length) return;

  links.forEach((link, i) => {
    const thumbUrl = `https://img.youtube.com/vi/${link.id}/mqdefault.jpg`;
    const item = document.createElement('div');
    item.className = 'video-item';
    item.innerHTML = `
      <input type="checkbox" class="item-checkbox" data-id="${link.id}" />
      <span class="item-num">${i + 1}</span>
      <div class="item-thumb" data-action="open" data-url="${escHtml(link.url)}" title="Open video">
        <img src="${escHtml(thumbUrl)}" alt="" loading="lazy" />
        <div class="thumb-shimmer"></div>
        <div class="thumb-play">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="12" fill="rgba(255,0,0,0.85)"/>
            <polygon points="9.5,7 18,12 9.5,17" fill="white"/>
          </svg>
        </div>
      </div>
      <div class="item-info">
        <div class="item-title" title="${escHtml(link.title)}">${escHtml(link.title)}</div>
        <div class="item-url">${escHtml(link.url)}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" title="Open in new tab" data-action="open" data-url="${escHtml(link.url)}">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
          </svg>
        </button>
        <button class="icon-btn" title="Copy link" data-action="copy" data-url="${escHtml(link.url)}">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
          </svg>
        </button>
      </div>
    `;

    // Remove shimmer once thumbnail loads
    const img = item.querySelector('img');
    img.addEventListener('load', () => {
      img.classList.add('loaded');
      const shimmer = item.querySelector('.thumb-shimmer');
      if (shimmer) shimmer.remove();
    });
    img.addEventListener('error', () => {
      const shimmer = item.querySelector('.thumb-shimmer');
      if (shimmer) { shimmer.style.animation = 'none'; shimmer.style.background = '#1e1e1e'; }
      img.style.display = 'none';
    });

    listWrap.appendChild(item);
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Delegate item button clicks (buttons + thumbnail)
listWrap.addEventListener('click', e => {
  const btn = e.target.closest('.icon-btn');
  const thumb = e.target.closest('.item-thumb');
  const target = btn || thumb;
  if (!target) return;
  const action = target.dataset.action;
  const url = target.dataset.url;
  if (action === 'open') chrome.tabs.create({ url });
  if (action === 'copy') {
    navigator.clipboard.writeText(url).then(() => showToast('✓ Link copied!'));
  }
});

listWrap.addEventListener('change', e => {
  if (e.target.classList.contains('item-checkbox')) {
    const anyChecked = document.querySelector('.item-checkbox:checked');
    document.getElementById('btnCopySelected').disabled = !anyChecked;
  }
});

// Extract button
btnExtract.addEventListener('click', async () => {
  showState('stateLoading');
  btnExtract.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('youtube.com')) {
      showState('stateError');
      errorMsg.textContent = 'Please navigate to a YouTube channel page first.';
      btnExtract.disabled = false;
      return;
    }
    // Inject and run extraction directly — no message passing needed
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const videoMap = new Map();
        const gridSelectors = [
          'ytd-rich-grid-renderer',
          'ytd-grid-renderer',
          'ytd-section-list-renderer'
        ];
        let container = null;
        for (const sel of gridSelectors) {
          container = document.querySelector(sel);
          if (container) break;
        }
        const searchRoot = container || document;
        const anchors = searchRoot.querySelectorAll('a[href*="/watch?v="]');
        anchors.forEach(a => {
          const href = a.href || '';
          const watchMatch = href.match(/youtube\.com\/watch\?v=([\w-]{11})/);
          if (!watchMatch) return;
          const videoId = watchMatch[1];
          if (videoMap.has(videoId)) return;
          let title = '';
          const titleEl =
            a.querySelector('#video-title') ||
            a.querySelector('yt-formatted-string#video-title') ||
            a.closest('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-video-renderer')
              ?.querySelector('#video-title, #video-title-link, .title');
          if (titleEl) title = titleEl.textContent.trim();
          if (!title) title = a.getAttribute('aria-label') || a.getAttribute('title') || `Video ${videoMap.size + 1}`;
          videoMap.set(videoId, {
            id: videoId,
            title: title.replace(/\s+/g, ' ').trim(),
            url: `https://www.youtube.com/watch?v=${videoId}`
          });
        });
        return Array.from(videoMap.values());
      }
    });

    allLinks = results[0]?.result || [];
    filteredLinks = [...allLinks];

    if (allLinks.length === 0) {
      showState('stateEmpty');
      setBadge(0);
    } else {
      showState(null);
      renderList(filteredLinks);
      setBadge(allLinks.length);
      btnCopy.disabled = false;
      btnClear.disabled = false;
      footerInfo.classList.remove('visible');
      updateFooterFilter(allLinks.length, allLinks.length);
    }

  } catch (err) {
    showState('stateError');
    errorMsg.textContent = err.message || 'Unknown error. Try refreshing the YouTube page.';
  }

  btnExtract.disabled = false;
});

// Copy all button
btnCopy.addEventListener('click', () => {
  const linksText = filteredLinks.map(l => l.url).join('\n');
  navigator.clipboard.writeText(linksText).then(() => {
    showToast(`✓ ${filteredLinks.length} links copied to clipboard!`);
  });
});
// Copy selected button
document.getElementById('btnCopySelected').addEventListener('click', () => {
  const checked = [...document.querySelectorAll('.item-checkbox:checked')];
  const ids = checked.map(cb => cb.dataset.id);
  const selected = allLinks.filter(l => ids.includes(l.id));
  const text = selected.map(l => l.url).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast(`✓ ${selected.length} links copied!`));
});

// Clear button
btnClear.addEventListener('click', () => {
  allLinks = [];
  filteredLinks = [];
  listWrap.innerHTML = '';
  searchInput.value = '';
  setBadge(0);
  btnCopy.disabled = true;
  btnClear.disabled = true;
  searchWrap.classList.remove('visible');
  listWrap.classList.remove('visible');
  footerInfo.classList.add('visible');
  footerFilter.classList.remove('visible');
  showState('stateIdle');
});

// Search / filter
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  filteredLinks = q
    ? allLinks.filter(l => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
    : [...allLinks];
  renderList(filteredLinks);
  updateFooterFilter(filteredLinks.length, allLinks.length);
});

function updateFooterFilter(shown, total) {
  footerFilter.textContent = shown === total
    ? `Showing all ${total} videos`
    : `Showing ${shown} of ${total} videos`;
  footerFilter.classList.add('visible');
}

// Init
showState('stateIdle');
