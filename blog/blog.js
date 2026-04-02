/* ===================================================
   eDEX-UI Web Blog — Core JavaScript
   =================================================== */

'use strict';

// ─── State ───────────────────────────────────────────
let _allPosts = [];
let _currentTag = null;
let _startTime = Date.now();

// ─── Utilities ───────────────────────────────────────
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── Theme System ────────────────────────────────────
const THEMES = [
    'tron', 'matrix', 'navy', 'blade', 'red', 'apollo',
    'nord', 'cyborg', 'interstellar',
    'tron-disrupted', 'navy-disrupted', 'navy-notype',
    'chalkboard', 'apollo-notype'
];

async function loadTheme(name) {
    try {
        const resp = await fetch(`../src/assets/themes/${name}.json`);
        if (!resp.ok) throw new Error('Theme not found');
        const t = await resp.json();
        const s = document.documentElement.style;
        s.setProperty('--color_r', t.colors.r);
        s.setProperty('--color_g', t.colors.g);
        s.setProperty('--color_b', t.colors.b);
        if (t.colors.black)       s.setProperty('--color_black', t.colors.black);
        if (t.colors.light_black) s.setProperty('--color_light_black', t.colors.light_black);
        if (t.colors.grey)        s.setProperty('--color_grey', t.colors.grey);
        for (const [key, val] of Object.entries(t.cssvars || {})) {
            s.setProperty(`--${key}`, val);
        }
        localStorage.setItem('blog_theme', name);
        // Update xterm theme if any terminal is open
        if (window._activeTerminals) {
            const termTheme = {
                background: t.colors.light_black || '#05080d',
                foreground: `rgb(${t.colors.r},${t.colors.g},${t.colors.b})`,
                cursor:     `rgb(${t.colors.r},${t.colors.g},${t.colors.b})`,
            };
            window._activeTerminals.forEach(term => term.setOption('theme', termTheme));
        }
    } catch (e) {
        console.warn(`[blog] Could not load theme "${name}":`, e.message);
    }
}

// ─── Clock ───────────────────────────────────────────
function updateClock() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const h = pad(now.getHours());
    const m = pad(now.getMinutes());
    const s = pad(now.getSeconds());
    const timeStr = `${h}:${m}:${s}`;

    const headerClock = document.getElementById('header_clock');
    if (headerClock) headerClock.textContent = timeStr;

    const clockH1 = document.getElementById('clock_h1');
    if (clockH1) clockH1.textContent = timeStr;

    const clockDate = document.getElementById('clock_date');
    if (clockDate) {
        const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        clockDate.textContent =
            `${days[now.getDay()]} ${pad(now.getDate())} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    // Author uptime counter
    const uptimeEl = document.getElementById('author_uptime');
    if (uptimeEl) {
        const sec = Math.floor((Date.now() - _startTime) / 1000);
        const up_h = Math.floor(sec / 3600);
        const up_m = Math.floor((sec % 3600) / 60);
        const up_s = sec % 60;
        uptimeEl.textContent = `UPTIME: ${pad(up_h)}:${pad(up_m)}:${pad(up_s)}`;
    }

    document.getElementById('stat_year').textContent = now.getFullYear();
}

// ─── Post Rendering ──────────────────────────────────
function renderPostList(posts) {
    const container = document.getElementById('post_list');
    if (!posts || posts.length === 0) {
        container.innerHTML = `<p style="opacity:0.4; font-size:1.2vh; font-family:var(--font_main_light);">
            NO POSTS FOUND.</p>`;
        return;
    }

    const header = `<div style="font-family:var(--font_main_light); font-size:1vh; opacity:0.4;
        margin-bottom:1.5vh; letter-spacing:0.2vh;">
        DISPLAYING ${posts.length} POST${posts.length !== 1 ? 'S' : ''}
        ${_currentTag ? `[ TAG: ${_currentTag.toUpperCase()} ]` : ''}
    </div>`;

    const cards = posts.map(p => `
        <div class="post_card" onclick="openPost('${p.id}')">
            <h2>${p.title}</h2>
            <div class="post_meta">
                ${formatDate(p.date)} &nbsp;·&nbsp; ~${p.readTime} MIN READ
            </div>
            <p>${p.summary}</p>
            <div class="post_tags">
                ${p.tags.map(t => `<span class="tag_chip" onclick="filterByTag(event,'${t}')">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');

    container.innerHTML = header + cards;
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function openPost(postId) {
    const post = _allPosts.find(p => p.id === postId);
    if (!post) return;

    // Load post content
    let bodyHtml = '';
    try {
        const resp = await fetch(`posts/${post.file}`);
        bodyHtml = resp.ok ? await resp.text() : `<p>Error loading post content.</p>`;
    } catch (e) {
        bodyHtml = `<p>Could not load post: ${e.message}</p>`;
    }

    // Populate post view
    document.getElementById('post_title').textContent = post.title;
    document.getElementById('post_meta').textContent =
        `${formatDate(post.date)}  ·  ~${post.readTime} MIN READ  ·  ${post.tags.join(', ').toUpperCase()}`;
    document.getElementById('post_tags').innerHTML =
        post.tags.map(t => `<span class="tag_chip">${t}</span>`).join('');
    document.getElementById('post_body').innerHTML = bodyHtml;

    // Switch views
    document.getElementById('post_list').style.display = 'none';
    document.getElementById('post_view').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = `eDEX :: ${post.title}`;
}

function showPostList() {
    document.getElementById('post_list').style.display = 'block';
    document.getElementById('post_view').style.display = 'none';
    document.title = 'eDEX :: BLOG';
}

function filterByTag(event, tag) {
    event.stopPropagation();
    _currentTag = _currentTag === tag ? null : tag;
    document.querySelectorAll('.tag_chip').forEach(el => el.classList.remove('active'));
    if (_currentTag) {
        document.querySelectorAll(`#tag_list .tag_chip`).forEach(el => {
            if (el.textContent === tag) el.classList.add('active');
        });
        renderPostList(_allPosts.filter(p => p.tags.includes(tag)));
    } else {
        renderPostList(_allPosts);
    }
    showPostList();
}

function searchPosts(query) {
    const q = query.toLowerCase().trim();
    if (!q) { renderPostList(_allPosts); return; }
    const filtered = _allPosts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
    );
    renderPostList(filtered);
    showPostList();
}

// ─── Sidebar Population ──────────────────────────────
function populateSidebars(posts) {
    document.getElementById('stat_posts').textContent = posts.length;

    // Collect unique tags
    const tagCount = {};
    posts.forEach(p => p.tags.forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const tags = Object.keys(tagCount).sort();
    document.getElementById('stat_tags').textContent = tags.length;

    // Tag list
    document.getElementById('tag_list').innerHTML =
        tags.map(t => `<span class="tag_chip" onclick="filterByTag(event,'${t}')">${t} <small style="opacity:0.5">(${tagCount[t]})</small></span>`).join('');

    // Recent posts (last 5)
    const recent = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    document.getElementById('recent_posts_list').innerHTML = recent.map(p => `
        <li style="margin-bottom:0.6vh;">
            <a onclick="openPost('${p.id}')" style="font-size:1.1vh; line-height:1.5;">${p.title}</a>
            <div style="font-size:0.9vh; opacity:0.4;">${formatDate(p.date)}</div>
        </li>
    `).join('');

    // Categories (unique tags as categories)
    const cats = tags.slice(0, 8);
    document.getElementById('categories_list').innerHTML = cats.map(t => `
        <li style="margin-bottom:0.4vh;">
            <a onclick="filterByTag(event,'${t}')" style="font-size:1.1vh;">
                ${t.toUpperCase()} <span style="opacity:0.4">(${tagCount[t]})</span>
            </a>
        </li>
    `).join('');
}

// ─── Window Tracking (for sidebar) ───────────────────
window._openWindows = {};

function updateWindowList() {
    const list = document.getElementById('open_windows_list');
    const wins = Object.values(window._openWindows);
    if (!wins.length) {
        list.textContent = 'NO ACTIVE WINDOWS';
        return;
    }
    list.innerHTML = wins.map(w => `
        <div style="font-size:1vh; margin-bottom:0.3vh; display:flex; justify-content:space-between; align-items:center;">
            <span>${w.title}</span>
            <span style="cursor:pointer; opacity:0.5;" onclick="_openWindows['${w.id}'] && _openWindows['${w.id}'].close()">✕</span>
        </div>
    `).join('');
}

// ─── BlogWindow Class ─────────────────────────────────
class BlogWindow {
    constructor({ title, bodyHtml, width = '520px', height = '400px', minWidth = '320px' }) {
        this.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
        this.title = title;

        // Center on screen
        this.posX = Math.max(20, (window.innerWidth  - parseInt(width))  / 2 + Math.random() * 60 - 30);
        this.posY = Math.max(60, (window.innerHeight - parseInt(height)) / 2 + Math.random() * 40 - 20);

        this._build(title, bodyHtml, width, height, minWidth);
        this._initDrag();

        window._openWindows[this.id] = this;
        updateWindowList();
    }

    _build(title, bodyHtml, width, height, minWidth) {
        const el = document.createElement('div');
        el.className = 'blog_window';
        el.id = `bwin_${this.id}`;
        el.style.cssText = `
            width: ${width};
            height: ${height};
            min-width: ${minWidth};
            left: ${this.posX}px;
            top:  ${this.posY}px;
            z-index: ${500 + Object.keys(window._openWindows).length};
        `;
        el.innerHTML = `
            <div class="window_titlebar" id="titlebar_${this.id}">
                <h1>${title}</h1>
                <button class="window_close_btn" onclick="document.getElementById('bwin_${this.id}')._winInstance.close()">[ X ]</button>
            </div>
            <div class="window_body" id="winbody_${this.id}">
                ${bodyHtml}
            </div>
        `;
        document.getElementById('modal_layer').appendChild(el);
        el._winInstance = this;

        // Focus on click
        el.addEventListener('mousedown', () => this.focus());

        // Trigger open animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => el.classList.add('window_open'));
        });
    }

    _el() { return document.getElementById(`bwin_${this.id}`); }

    focus() {
        const el = this._el();
        const maxZ = Object.values(window._openWindows).reduce((acc, w) => {
            const z = parseInt(document.getElementById(`bwin_${w.id}`)?.style.zIndex || 500);
            return Math.max(acc, z);
        }, 500);
        el.style.zIndex = maxZ + 1;
    }

    close() {
        const el = this._el();
        if (!el) return;
        el.classList.add('window_closing');
        setTimeout(() => {
            el.remove();
            delete window._openWindows[this.id];
            updateWindowList();
        }, 120);
    }

    _initDrag() {
        const el   = this._el();
        const bar  = document.getElementById(`titlebar_${this.id}`);
        let startX, startY, startLeft, startTop;

        const onMove = e => {
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            this.posX = startLeft + (cx - startX);
            this.posY = Math.max(0, startTop  + (cy - startY));
            el.style.left = `${this.posX}px`;
            el.style.top  = `${this.posY}px`;
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup',   onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend',  onUp);
        };

        const onDown = e => {
            if (e.target.classList.contains('window_close_btn')) return;
            e.preventDefault();
            startX    = e.touches ? e.touches[0].clientX : e.clientX;
            startY    = e.touches ? e.touches[0].clientY : e.clientY;
            startLeft = this.posX;
            startTop  = this.posY;
            this.focus();
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup',   onUp);
            window.addEventListener('touchmove', onMove, { passive: false });
            window.addEventListener('touchend',  onUp);
        };

        bar.addEventListener('mousedown',  onDown);
        bar.addEventListener('touchstart', onDown, { passive: false });
    }
}

// Expose globally
window.BlogWindow = BlogWindow;

// ─── Boot Animations ─────────────────────────────────
async function initAnimations() {
    // Header fades in first
    await delay(150);
    document.getElementById('blog_header').classList.add('activated');

    // Main content
    await delay(250);
    document.getElementById('main_content').classList.add('activated');

    // Side panels
    await delay(100);
    document.querySelectorAll('.mod_column').forEach(el => el.classList.add('activated'));

    // Stagger mod_column children
    const leftItems  = Array.from(document.querySelectorAll('#mod_column_left > div'));
    const rightItems = Array.from(document.querySelectorAll('#mod_column_right > div'));
    const maxLen = Math.max(leftItems.length, rightItems.length);
    for (let i = 0; i < maxLen; i++) {
        await delay(400);
        if (leftItems[i])  leftItems[i].style.animationPlayState  = 'running';
        if (rightItems[i]) rightItems[i].style.animationPlayState = 'running';
    }
}

// ─── Bootstrap ───────────────────────────────────────
async function init() {
    // Restore saved theme
    const savedTheme = localStorage.getItem('blog_theme') || 'tron';
    const sel = document.getElementById('theme_switcher');
    if (sel) sel.value = savedTheme;
    await loadTheme(savedTheme);

    // Theme switcher handler
    if (sel) sel.addEventListener('change', e => loadTheme(e.target.value));

    // Clock
    updateClock();
    setInterval(updateClock, 1000);

    // Load posts
    try {
        const resp = await fetch('posts.json');
        const data = await resp.json();
        _allPosts = data.posts || [];
        renderPostList(_allPosts);
        populateSidebars(_allPosts);
    } catch (e) {
        console.error('[blog] Failed to load posts.json:', e);
        document.getElementById('post_list').innerHTML =
            `<p style="opacity:0.4; font-family:var(--font_main_light); font-size:1.2vh;">
            ERROR: Could not load posts.json<br><small>${e.message}</small></p>`;
    }

    // Boot animation
    initAnimations();

    // Initialize terminal registry
    window._activeTerminals = [];
}

document.addEventListener('DOMContentLoaded', init);
