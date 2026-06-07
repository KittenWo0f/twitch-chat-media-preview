// ==UserScript==
// @name         Twitch Chat Media Preview
// @namespace    https://github.com/KittenWo0f/twitch-chat-media-preview
// @version      1.1.0
// @description  Показывает изображения и видео в чате Twitch: kappa.lol, YouTube, imgur, gyazo и др.
// @author       local
// @match        https://www.twitch.tv/*
// @match        https://dashboard.twitch.tv/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      www.youtube.com
// @connect      img.youtube.com
// @connect      kappa.lol
// @connect      i.imgur.com
// @connect      imgur.com
// @connect      prnt.sc
// @connect      i.gyazo.com
// @connect      gyazo.com
// @connect      ibb.co
// @run-at       document-idle
// @updateURL   https://github.com/KittenWo0f/twitch-chat-media-preview/raw/refs/heads/main/twitch-chat-media-preview.user.js
// @downloadURL https://github.com/KittenWo0f/twitch-chat-media-preview/raw/refs/heads/main/twitch-chat-media-preview.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ──────────────────────────────────────────────────────────────────────────
    // CONFIG
    // ──────────────────────────────────────────────────────────────────────────

    const CONFIG = {
        maxWidth: 320,
        maxHeight: 240,
        borderRadius: 8,
        lazyLoad: true,
        debounceMs: 300,
        videoAutoplay: false,
        youtubeEmbed: true,
    };

    // ──────────────────────────────────────────────────────────────────────────
    // CSS
    // ──────────────────────────────────────────────────────────────────────────

    GM_addStyle(`
        .tcip-wrapper {
            display: block;
            margin-top: 6px;
        }

        .tcip-img-link {
            display: inline-block;
            cursor: zoom-in;
        }

        .tcip-img {
            display: block;
            max-width: ${CONFIG.maxWidth}px;
            max-height: ${CONFIG.maxHeight}px;
            border-radius: ${CONFIG.borderRadius}px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(0,0,0,0.25);
            object-fit: contain;
            transition: transform .15s ease, box-shadow .15s ease;
        }

        .tcip-img:hover {
            transform: scale(1.02);
            box-shadow: 0 4px 24px rgba(0,0,0,.55);
        }

        .tcip-video {
            display: block;
            max-width: ${CONFIG.maxWidth}px;
            max-height: ${CONFIG.maxHeight}px;
            border-radius: ${CONFIG.borderRadius}px;
            border: 1px solid rgba(255,255,255,0.12);
            background: #000;
            outline: none;
        }

        .tcip-yt-card {
            display: inline-flex;
            flex-direction: column;
            overflow: hidden;
            border-radius: ${CONFIG.borderRadius}px;
            border: 1px solid rgba(255,255,255,0.13);
            background: #0e0e0e;
            max-width: ${CONFIG.maxWidth}px;
            cursor: pointer;
            transition: box-shadow .15s ease;
        }

        .tcip-yt-card:hover {
            box-shadow: 0 4px 20px rgba(0,0,0,.6);
        }

        .tcip-yt-thumb-wrap {
            position: relative;
            width: 100%;
        }

        .tcip-yt-thumb {
            display: block;
            width: 100%;
            aspect-ratio: 16/9;
            object-fit: cover;
        }

        .tcip-yt-play {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,.28);
            transition: background .15s;
        }

        .tcip-yt-card:hover .tcip-yt-play {
            background: rgba(0,0,0,.1);
        }

        .tcip-yt-play svg {
            width: 44px;
            height: 44px;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,.7));
        }

        .tcip-yt-meta {
            padding: 6px 8px 7px;
            box-sizing: border-box;
        }

        .tcip-yt-title {
            font-size: 11px;
            font-weight: 600;
            color: #efeff1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tcip-yt-channel {
            font-size: 10px;
            color: #adadb8;
            margin-top: 1px;
        }

        .tcip-yt-iframe-wrap {
            width: ${CONFIG.maxWidth}px;
            border-radius: ${CONFIG.borderRadius}px;
            overflow: hidden;
            background: #000;
            border: 1px solid rgba(255,255,255,.13);
        }

        .tcip-yt-iframe-wrap iframe {
            width: 100%;
            aspect-ratio: 16/9;
            border: none;
            display: block;
        }

        #tcip-lightbox {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: rgba(0,0,0,.85);
            align-items: center;
            justify-content: center;
            cursor: zoom-out;
            backdrop-filter: blur(5px);
        }

        #tcip-lightbox.visible {
            display: flex;
        }

        #tcip-lightbox img {
            max-width: 92vw;
            max-height: 92vh;
            border-radius: 10px;
            box-shadow: 0 8px 60px rgba(0,0,0,.9);
        }

        #tcip-lightbox-close {
            position: fixed;
            top: 18px;
            right: 24px;
            font-size: 32px;
            color: #fff;
            cursor: pointer;
            line-height: 1;
            opacity: .75;
            z-index: 100000;
        }

        .tcip-error {
            font-size: 11px;
            color: #ff6b6b;
            font-style: italic;
            opacity: .7;
            margin-top: 2px;
        }

        .tcip-loading {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,.2);
            border-top-color: #9147ff;
            border-radius: 50%;
            animation: tcip-spin .6s linear infinite;
            vertical-align: middle;
            margin-left: 4px;
        }

        @keyframes tcip-spin {
            to { transform: rotate(360deg); }
        }
    `);

    // ──────────────────────────────────────────────────────────────────────────
    // LIGHTBOX
    // ──────────────────────────────────────────────────────────────────────────

    const lightbox = document.createElement('div');

    lightbox.id = 'tcip-lightbox';

    lightbox.innerHTML = `
        <span id="tcip-lightbox-close">✕</span>
        <img id="tcip-lightbox-img" src="" alt="preview">
    `;

    document.body.appendChild(lightbox);

    const lbImg = lightbox.querySelector('#tcip-lightbox-img');
    const lbClose = lightbox.querySelector('#tcip-lightbox-close');

    function openLightbox(src) {
        lbImg.src = src;
        lightbox.classList.add('visible');
    }

    function closeLightbox() {
        lightbox.classList.remove('visible');
        lbImg.src = '';
    }

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lbClose) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // UTILS
    // ──────────────────────────────────────────────────────────────────────────

    const DIRECT_IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;
    const DIRECT_VIDEO_EXT = /\.(mp4|webm|mov|ogg|ogv)(\?.*)?$/i;

    function resolveRedirectFull(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'HEAD',
                url,
                onload: (resp) => {
                    const ct = resp.responseHeaders.match(/content-type:\s*([^\r\n;]+)/i);

                    resolve({
                        finalUrl: resp.finalUrl || url,
                        contentType: ct ? ct[1].trim() : '',
                    });
                },
                onerror: () => resolve({
                    finalUrl: url,
                    contentType: '',
                }),
            });
        });
    }

    function resolveOGImage(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: (resp) => {
                    const m =
                        resp.responseText.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                        || resp.responseText.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

                    resolve(m ? m[1] : null);
                },
                onerror: () => resolve(null),
            });
        });
    }

    function extractUrls(text) {
        if (!text) return [];

        const re = /(https?:\/\/[^\s<>"']+)/gi;

        const urls = [];
        let match;

        while ((match = re.exec(text)) !== null) {
            let url = match[1];

            url = url.replace(/[),.!?;:]+$/, '');

            urls.push(url);
        }

        return [...new Set(urls)];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // YOUTUBE
    // ──────────────────────────────────────────────────────────────────────────

    const YT_RE =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

    function extractYouTubeId(url) {
        const m = url.match(YT_RE);
        return m ? m[1] : null;
    }

    function fetchYouTubeTitle(videoId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
                onload: (resp) => {
                    try {
                        const data = JSON.parse(resp.responseText);

                        resolve({
                            title: data.title || '',
                            author: data.author_name || '',
                        });
                    } catch {
                        resolve({
                            title: '',
                            author: '',
                        });
                    }
                },
                onerror: () => resolve({
                    title: '',
                    author: '',
                }),
            });
        });
    }

    async function createYouTubeCard(videoId, originalUrl) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tcip-wrapper';

        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        const card = document.createElement('div');
        card.className = 'tcip-yt-card';

        card.innerHTML = `
            <div class="tcip-yt-thumb-wrap">
                <img class="tcip-yt-thumb" src="${thumbUrl}" loading="lazy">
                <div class="tcip-yt-play">
                    <svg viewBox="0 0 68 48">
                        <rect width="68" height="48" rx="12" fill="#FF0000" opacity="0.9"/>
                        <polygon points="28,16 28,32 46,24" fill="#fff"/>
                    </svg>
                </div>
            </div>

            <div class="tcip-yt-meta">
                <div class="tcip-yt-title">YouTube видео</div>
                <div class="tcip-yt-channel"></div>
            </div>
        `;

        fetchYouTubeTitle(videoId).then(({ title, author }) => {
            if (title) {
                card.querySelector('.tcip-yt-title').textContent = title;
            }

            if (author) {
                card.querySelector('.tcip-yt-channel').textContent = author;
            }
        });

        card.addEventListener('click', () => {
            if (CONFIG.youtubeEmbed) {
                const iframeWrap = document.createElement('div');

                iframeWrap.className = 'tcip-yt-iframe-wrap';

                iframeWrap.innerHTML = `
                    <iframe
                        src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                        allow="autoplay; encrypted-media; picture-in-picture"
                        allowfullscreen>
                    </iframe>
                `;

                wrapper.replaceChild(iframeWrap, card);

            } else {
                window.open(originalUrl, '_blank', 'noopener,noreferrer');
            }
        });

        wrapper.appendChild(card);

        return wrapper;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MEDIA
    // ──────────────────────────────────────────────────────────────────────────

    const KAPPA_RE = /https?:\/\/kappa\.lol\/([A-Za-z0-9_-]+)/;

    async function resolveKappa(url) {
        const { finalUrl, contentType } = await resolveRedirectFull(url);

        const isImg =
            DIRECT_IMAGE_EXT.test(finalUrl)
            || /image\//i.test(contentType);

        const isVid =
            DIRECT_VIDEO_EXT.test(finalUrl)
            || /video\//i.test(contentType);

        return {
            finalUrl,
            isImg,
            isVid,
        };
    }

    function createVideoElement(src) {
        const wrapper = document.createElement('div');
        wrapper.className = 'tcip-wrapper';

        const video = document.createElement('video');

        video.className = 'tcip-video';
        video.src = src;
        video.controls = true;
        video.muted = true;
        video.loop = true;
        video.preload = 'metadata';

        if (CONFIG.videoAutoplay) {
            video.autoplay = true;
        }

        video.onerror = () => {
            wrapper.innerHTML = `
                <span class="tcip-error">
                    ⚠ Не удалось воспроизвести видео
                </span>
            `;
        };

        wrapper.appendChild(video);

        return wrapper;
    }

    function createImageElement(src, originalUrl) {
        const wrapper = document.createElement('div');

        wrapper.className = 'tcip-wrapper';

        const link = document.createElement('a');

        link.className = 'tcip-img-link';
        link.href = originalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const img = document.createElement('img');

        img.className = 'tcip-img';
        img.alt = 'chat image';

        if (CONFIG.lazyLoad) {
            img.loading = 'lazy';
        }

        img.src = src;

        img.onerror = () => {
            wrapper.innerHTML = `
                <span class="tcip-error">
                    ⚠ Не удалось загрузить изображение
                </span>
            `;
        };

        img.addEventListener('click', (e) => {
            e.preventDefault();
            openLightbox(src);
        });

        link.appendChild(img);
        wrapper.appendChild(link);

        return wrapper;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // HOSTS
    // ──────────────────────────────────────────────────────────────────────────

    const IMAGE_HOSTED_PATTERNS = [
        {
            re: /https?:\/\/(?:www\.)?imgur\.com\/(?!gallery)([A-Za-z0-9]+)(?:\.[a-z]+)?$/,
            resolve: async (url, m) => ({
                src: `https://i.imgur.com/${m[1]}.jpg`,
                type: 'image',
            }),
        },

        {
            re: /https?:\/\/prnt\.sc\/([A-Za-z0-9_-]+)/,
            resolve: async (url) => ({
                src: await resolveOGImage(url),
                type: 'image',
            }),
        },

        {
            re: /https?:\/\/gyazo\.com\/([a-f0-9]+)/,
            resolve: async (url, m) => ({
                src: `https://i.gyazo.com/${m[1]}.png`,
                type: 'image',
            }),
        },

        {
            re: /https?:\/\/ibb\.co\/([A-Za-z0-9]+)/,
            resolve: async (url) => ({
                src: await resolveOGImage(url),
                type: 'image',
            }),
        },
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // RESOLVER
    // ──────────────────────────────────────────────────────────────────────────

    async function resolveMedia(url) {
        const ytId = extractYouTubeId(url);

        if (ytId) {
            return {
                type: 'youtube',
                videoId: ytId,
            };
        }

        if (KAPPA_RE.test(url)) {
            const {
                finalUrl,
                isImg,
                isVid,
            } = await resolveKappa(url);

            if (isVid) {
                return {
                    type: 'video',
                    src: finalUrl,
                };
            }

            if (isImg) {
                return {
                    type: 'image',
                    src: finalUrl,
                };
            }
        }

        if (DIRECT_VIDEO_EXT.test(url)) {
            return {
                type: 'video',
                src: url,
            };
        }

        if (DIRECT_IMAGE_EXT.test(url)) {
            return {
                type: 'image',
                src: url,
            };
        }

        for (const p of IMAGE_HOSTED_PATTERNS) {
            const match = url.match(p.re);

            if (match) {
                const result = await p.resolve(url, match);

                if (result.src) {
                    return result;
                }
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MESSAGE PROCESSING
    // ──────────────────────────────────────────────────────────────────────────

    const processed = new WeakSet();

    async function processMessage(msgEl) {
        if (processed.has(msgEl)) return;

        processed.add(msgEl);

        const urls = new Set();

        const msgScope =
            msgEl.querySelector('[data-a-target="chat-line-message-body"]')  // нативный Twitch
            || msgEl.querySelector('.seventv-chat-message-body')              // 7TV
            || msgEl.querySelector('.message')                                // FFZ
            || msgEl.querySelector('.chat-line__message-body');               // фолбэк

        if (!msgScope) return;

        const text = msgScope.innerText || msgScope.textContent || '';
        for (const url of extractUrls(text)) {
            urls.add(url);
        }

        msgScope.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && /^https?:\/\//i.test(href)) urls.add(href);
        });

        if (!urls.size) return;

        for (const url of urls) {

            if (/twitch\.tv|jtvnw\.net|static-cdn/.test(url)) continue;

            const spinner = document.createElement('span');
            spinner.className = 'tcip-loading';
            msgEl.appendChild(spinner);

            let mediaEl = null;

            try {
                const media = await resolveMedia(url);

                if (media) {
                    if (media.type === 'image') mediaEl = createImageElement(media.src, url);
                    else if (media.type === 'video') mediaEl = createVideoElement(media.src);
                    else if (media.type === 'youtube') mediaEl = await createYouTubeCard(media.videoId, url);
                }
            } catch (e) {
                console.warn('[TwitchChatMedia] Error:', url, e);
            }

            spinner.remove();
            if (mediaEl) msgEl.appendChild(mediaEl);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // OBSERVER
    // ──────────────────────────────────────────────────────────────────────────

    function debounce(fn, ms) {
        let t;

        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), ms);
        };
    }

    const queue = new Set();

    const flushQueue = debounce(() => {
        queue.forEach(el => processMessage(el));
        queue.clear();
    }, CONFIG.debounceMs);

    const MSG_SELECTORS = `
        .chat-line__message,
        [data-a-target="chat-line-message"],
        .seventv-message
    `;

    const observer = new MutationObserver((mutations) => {

        for (const mut of mutations) {

            for (const node of mut.addedNodes) {

                if (node.nodeType !== 1) continue;

                if (node.matches && node.matches(MSG_SELECTORS)) {
                    queue.add(node);
                    continue;
                }

                const msgs = node.querySelectorAll
                    ? node.querySelectorAll(MSG_SELECTORS)
                    : [];

                msgs.forEach(m => queue.add(m));
            }
        }

        flushQueue();
    });

    function startObserver() {

        const CHAT_SELECTORS = [
            '.chat-scrollable-area__message-container',
            '.simplebar-content',
            '.seventv-chat-scroller',
        ];

        const containers = new Set();

        for (const sel of CHAT_SELECTORS) {
            document.querySelectorAll(sel).forEach(el => containers.add(el));
        }

        if (!containers.size) {
            setTimeout(startObserver, 1500);
            return;
        }

        for (const container of containers) {
            observer.observe(container, {
                childList: true,
                subtree: true,
            });
        }

        console.log(`[TwitchChatMedia] ✓ Observer started on ${containers.size} container(s)`);
    }

    startObserver();

    // ──────────────────────────────────────────────────────────────────────────
    // SPA NAVIGATION
    // ──────────────────────────────────────────────────────────────────────────

    let lastPath = location.pathname;

    setInterval(() => {

        if (location.pathname === lastPath) return;

        lastPath = location.pathname;

        observer.disconnect();

        setTimeout(startObserver, 2000);

    }, 1000);

})();