// ==UserScript==
// @name           JAVLibrary Improvements
// @description    Many improvements: copy GDrive/Rapidgator links to clipboard for download managers (via button or hotkey < or \), inline video thumbnails, multiple search groups (Streams, Torrents, Thumbnails, GDrive, Rapidgator) with background prefetch, cast image search, facial recognition, save/show favorite actresses, rating colorization, cover download with actress names, full-size promo images, Cloudflare auto-reload, direct external links (no redirect warnings), Blu-ray filter, color themes (Purple/Pink, Dark Blue), layout improvements. Config via hotkey C, gear icon, or Tampermonkey menu.
// @version        20260509.1
// @author         resykano
// @icon           https://www.javlibrary.com/favicon.ico
// @match          *://*.javlibrary.com/*
// @match          *://x75p.com/*
// @match          *://*.y78k.com/*
// @match          *://javx357.com/*
// @match          *://arcjav.com/*
// @match          *://javgg.me/*
// @match          *://maxjav.com/*
// @match          *://jav.guru/*
// @match          *://supjav.com/*
// @match          *://missav.ai/*
// @match          *://maddawgjav.net/*
// @match          *://video-jav.net/*
// @match          *://www.akiba-online.com/search/*
// @match          *://bt1207so.top/?find*
// @match          *://rapidgator.net/*
// @connect        dmm.co.jp
// @connect        blogjav.net
// @connect        javstore.net
// @connect        3xplanet.com
// @connect        pixhost.to
// @connect        imagetwist.com
// @connect        imagehaha.com
// @connect        hornyjav.com
// @connect        javmost.ws
// @connect        jav-load.com
// @connect        javakiba.org
// @connect        video-jav.net
// @connect        javgg.me
// @connect        javx357.com
// @connect        twojav.com
// @connect        sextb.net
// @connect        jable.tv
// @connect        bigojav.com
// @connect        highporn.net
// @connect        bestjavporn.com
// @connect        mm-cg.com
// @connect        javmenu.com
// @connect        supjav.com
// @connect        *
// @grant          GM_registerMenuCommand
// @grant          GM_xmlhttpRequest
// @grant          GM_setClipboard
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_addStyle
// @grant          GM_openInTab
// @grant          window.close
// @run-at         document-start
// @compatible     chrome
// @license        GPL3
// @noframes
// ==/UserScript==

"use strict";

// =======================================================================================
// Config/Requirements
// =======================================================================================

// bind preserves call site in browser console (wrapper functions would point here instead)
const log = GM_getValue("authorsMode", false) ? console.log.bind(console) : () => {};

const NEWS_VERSION = "20260503";

const newsEntries = [
    {
        version: NEWS_VERSION,
        changes: [
            "Major update: Over 90% of the code was rewritten or restructured, bringing significant improvements in performance, maintainability and features.",
            "Redesigned layout: more compact, cleaner and more pleasing.",
            "Color themes in config: Purple/Pink and Dark Blue.",
            {
                text: "Added two new facial recognition sites to help find actors.",
                detail: "The original site is still there but has been broken for a while. The second site works best now — its page may look broken, but it functions correctly. The third is just an extra option.",
            },
            {
                text: "Configuration menu: open via Tampermonkey → 'Configuration', press C, or use the config button (bottom right) on the details page.",
            },
            {
                text: '"Search all" for Streams, Thumbnails 2 and GDrive now checks sites in the background instead of opening tabs.',
                detail: "Links are color-coded: green = found, red = not found, orange = timeout/error, gray = Cloudflare (visit manually). Links remain clickable regardless of result.",
            },
            {
                text: "Background requests (thumbnail search, prefetch) now run in parallel > results appear faster.",
                detail: "Tampermonkey serialized background requests in recent Chrome MV3 versions. A fix from the Tampermonkey team is now included. Requires Tampermonkey 5.3.2 or newer.",
            },
            "Improved inline thumbnails: added 3xPlanet and removed it from Thumbnails 2 group.",
            "Tabs opened by the script no longer steal focus for Rapidgator.",
            "Removed inaccessible image sources (KawaiiThong, BeautiMetas).",
        ],
        feedback: {
            text: "Found a bug, have a suggestion, or know a link that should be included/removed? Let me know at",
            url: "https://greasyfork.org/en/scripts/502894-javlibrary-improvements/feedback",
        },
    },
];

let avidCopiedToClipboard = false;
const url = window.location.href;
const hostname = window.location.hostname;
const isJavLibrary = hostname.endsWith("javlibrary.com") || hostname === "x75p.com" || hostname.endsWith("y78k.com");
const originalDocumentTitle = document.title;
let avid = null;
const configurationOptions = {
    improvements: {
        label: "Layout and functional improvements",
        default: true,
    },
    theme: {
        label: "Color theme",
        default: "purplePink",
        options: {
            purplePink: "Purple / Pink",
            darkBlue: "Dark Blue / Gray",
        },
        category: "improvements",
    },
    searchByIDFilter: {
        label: "Filter Blu-ray editions and mismatched AVIDs from search results",
        default: false,
        category: "improvements",
    },
    // Master toggle to disable all cast image search buttons
    castButtonsEnabled: {
        label: "Enable cast image search buttons",
        default: true,
        category: "improvements",
    },
    // Cast image search buttons (individual toggles)
    castButtons: {
        category: "improvements",
        minnano: {
            text: "Minnano",
            link: "https://www.minnano-av.com/search_result.php?search_scope=actress&search_word=",
            enabled: true,
        },
        avdbs: { text: "AVDBS", link: "https://www.avdbs.com/menu/search.php?seq=42978591&tab=1&kwd=", enabled: true },
        v2ph: { text: "V2PH", link: "https://www.v2ph.com/search/?q=", enabled: true },
        // kawaiithong: { text: "KawaiiThong", link: "https://kawaiithong.com/search_kawaii_pics/", enabled: true },
        jjgirls: { text: "JJGirls", link: "https://jjgirls.com/match.php?model=", enabled: true },
        yandex: { text: "Yandex", link: "https://yandex.com/images/search?text=", enabled: true },
        xslist: { text: "XsList", link: "https://duckduckgo.com/?iar=images&iax=images&ia=images&q=site:xslist.org ", enabled: true },
    },
    castSearchButtonEnabled: {
        label: "Enable cast search buttons (facial recognition and cast by scene)",
        default: true,
        category: "improvements",
    },
    searchGroups: {
        category: "improvements",
        searchGroupTorrent: {
            label: "Torrent sources",
            default: true,
        },
        searchGroupThumbnails1: {
            label: "Thumbnail search 1",
            default: true,
        },
        searchGroupThumbnails2: {
            label: "Thumbnail search 2",
            default: true,
        },
        searchGroupRapidgator: {
            label: "Rapidgator sources",
            default: true,
        },
        searchGroupGDrive: {
            label: "Google Drive sources",
            default: true,
        },
        searchGroupStream: {
            label: "Stream sources",
            default: true,
        },
        searchGroupResearchPlatforms: {
            label: "Alternative research platforms",
            default: true,
        },
        searchGroupDuckDuckGo: {
            label: "DuckDuckGo searches",
            default: true,
        },
    },
    prefetchOnLoad: {
        category: "improvements",
        prefetchOnLoadThumbnails2: {
            label: "Thumbnails 2",
            default: false,
        },
        prefetchOnLoadGDrive: {
            label: "GDrive",
            default: false,
        },
        prefetchOnLoadStream: {
            label: "Stream",
            default: false,
        },
    },
    prefetchShowNotFound: {
        label: "Keep buttons visible when Search All finds no content",
        default: false,
        category: "improvements",
    },
    videoThumbnails: {
        label: "Display video preview/thumbnail images",
        default: true,
    },
    configIcon: {
        label: "Show configuration icon on details page",
        default: true,
    },
    externalSearchModeTimeout: {
        label: "Allowed execution time of Collect Rapidgator Link & Thumbnails Search (Milliseconds)",
        default: 8000,
        category: "improvements",
    },
    externalDataFetchTimeout: {
        label: "Timeout when retrieving data from other websites, mainly for video thumbnails (Milliseconds)",
        default: 5000,
    },
};

// Apply GM_xmlhttpRequest wrapper to fix redirect handling in background requests (thumbnail search, prefetch) without affecting page scripts. Requires Tampermonkey 5.3.2+ for redirect control support.
(() => {
    // https://github.com/Tampermonkey/tampermonkey/issues/2215
    /* global GM_info, GM_xmlhttpRequest, GM */

    const HAS_GM = typeof GM !== "undefined";
    const NEW_GM = ((scope, GM) => {
        // Check if running in Tampermonkey and if version supports redirect control
        if (GM_info.scriptHandler !== "Tampermonkey" || compareVersions(GM_info.version, "5.3.2") < 0) return;

        // Backup original functions
        const GM_xmlhttpRequestOrig = GM_xmlhttpRequest;
        const GM_xmlHttpRequestOrig = GM.xmlHttpRequest;

        function compareVersions(v1, v2) {
            const parts1 = v1.split(".").map(Number);
            const parts2 = v2.split(".").map(Number);
            const length = Math.max(parts1.length, parts2.length);

            for (let i = 0; i < length; i++) {
                const num1 = parts1[i] || 0;
                const num2 = parts2[i] || 0;

                if (num1 > num2) return 1;
                if (num1 < num2) return -1;
            }
            return 0;
        }

        // Wrapper for GM_xmlhttpRequest
        function GM_xmlhttpRequestWrapper(odetails) {
            // If redirect is manually set, simply pass odetails to the original function
            if (odetails.redirect !== undefined) {
                return GM_xmlhttpRequestOrig(odetails);
            }

            // Warn if onprogress is used with settings incompatible with fetch mode used in background
            if (odetails.onprogress || odetails.fetch === false) {
                console.warn("Fetch mode does not support onprogress in the background.");
            }

            const { onload, onloadend, onerror, onabort, ontimeout, ...details } = odetails;

            // Set redirect to manual and handle redirects
            const handleRedirects = (initialDetails) => {
                const request = GM_xmlhttpRequestOrig({
                    ...initialDetails,
                    redirect: "manual",
                    onload: function (response) {
                        if (response.status >= 300 && response.status < 400) {
                            const m = response.responseHeaders.match(/Location:\s*(\S+)/i);
                            // Follow redirect manually
                            const redirectUrl = m && m[1];
                            if (redirectUrl) {
                                const absoluteUrl = new URL(redirectUrl, initialDetails.url).href;
                                handleRedirects({ ...initialDetails, url: absoluteUrl });
                                return;
                            }
                        }

                        if (onload) onload.call(this, response);
                        if (onloadend) onloadend.call(this, response);
                    },
                    onerror: function (response) {
                        if (onerror) onerror.call(this, response);
                        if (onloadend) onloadend.call(this, response);
                    },
                    onabort: function (response) {
                        if (onabort) onabort.call(this, response);
                        if (onloadend) onloadend.call(this, response);
                    },
                    ontimeout: function (response) {
                        if (ontimeout) ontimeout.call(this, response);
                        if (onloadend) onloadend.call(this, response);
                    },
                });
                return request;
            };

            return handleRedirects(details);
        }

        // Wrapper for GM.xmlHttpRequest
        function GM_xmlHttpRequestWrapper(odetails) {
            let abort;

            const p = new Promise((resolve, reject) => {
                const { onload, ontimeout, onerror, ...send } = odetails;

                send.onerror = function (r) {
                    if (onerror) {
                        resolve(r);
                        onerror.call(this, r);
                    } else {
                        reject(r);
                    }
                };
                send.ontimeout = function (r) {
                    if (ontimeout) {
                        // See comment above
                        resolve(r);
                        ontimeout.call(this, r);
                    } else {
                        reject(r);
                    }
                };
                send.onload = function (r) {
                    resolve(r);
                    if (onload) onload.call(this, r);
                };

                const a = GM_xmlhttpRequestWrapper(send).abort;
                if (abort === true) {
                    a();
                } else {
                    abort = a;
                }
            });

            p.abort = () => {
                if (typeof abort === "function") {
                    abort();
                } else {
                    abort = true;
                }
            };

            return p;
        }

        // Export wrappers
        GM_xmlhttpRequest = GM_xmlhttpRequestWrapper;
        scope.GM_xmlhttpRequestOrig = GM_xmlhttpRequestOrig;

        const gopd = Object.getOwnPropertyDescriptor(GM, "xmlHttpRequest");
        if (gopd && gopd.configurable === false) {
            return {
                __proto__: GM,
                xmlHttpRequest: GM_xmlHttpRequestWrapper,
                xmlHttpRequestOrig: GM_xmlHttpRequestOrig,
            };
        } else {
            GM.xmlHttpRequest = GM_xmlHttpRequestWrapper;
            GM.xmlHttpRequestOrig = GM_xmlHttpRequestOrig;
        }
    })(this, HAS_GM ? GM : {});

    if (HAS_GM && NEW_GM) GM = NEW_GM;
})();

// =======================================================================================
// Helper functions
// =======================================================================================

async function getTitleElement() {
    return await waitForElement("#video_id > table > tbody > tr > td.text");
}
async function getAvid() {
    if (!avid) {
        const titleElement = await getTitleElement();
        if (!titleElement) {
            return null;
        }

        const textContent = titleElement.textContent;
        if (textContent) {
            const match = textContent.match(/^(\S+)/);
            avid = match ? match[1] : textContent;
        }

        // in VR titles, JAVLibrary adds an additional leading zero after hyphen
        // remove these if there are five digits after the hyphen to get correct titles
        // e.g. XYZ-05678 -> XYZ-5678
        if (document.querySelector("span#genre558") && avid && /-\d{5}/.test(avid)) {
            avid = avid.replace(/-(0+)/, "-");
        }
    }
    return avid;
}
function castContainer() {
    return document.querySelector("#video_cast");
}

function createBase64Svg(fillColor) {
    const svgTemplate = `
        <svg class="mr-1 md:mr-2 h-3 w-3 xs:h-4 xs:w-4" xmlns="http://www.w3.org/2000/svg" fill="${fillColor}" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"></path>
        </svg>`;
    return `"data:image/svg+xml;base64,${btoa(svgTemplate)}"`;
}

let favoriteImage = createBase64Svg("red");
let nonFavoriteImage = createBase64Svg("lightgray");

/**
 * Waits for an element until it exists
 *
 * @param {string} selector CSS selector of a NodeList/HTMLCollection
 * @param {number} index
 * @param {number} timeoutMs Optional timeout in milliseconds to stop waiting for the element. If the timeout is reached, the promise will resolve with null. Default is 0, which means no timeout.
 * @see source: {@link https://stackoverflow.com/a/61511955/13427318}
 * @returns Element
 */
function waitForElement(selector, index = 0, timeoutMs = 0) {
    return new Promise((resolve) => {
        if (selector) {
            const initial = document.querySelectorAll(selector);
            if (initial[index]) return resolve(initial[index]);
        }

        const observer = new MutationObserver(() => {
            const elements = document.querySelectorAll(selector);
            if (elements[index]) {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(elements[index]);
                observer.disconnect();
            }
        });

        let timeoutId = null;
        if (timeoutMs && timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeoutMs);
        }

        observer.observe(document, {
            childList: true,
            subtree: true,
        });
    });
}

// Scans a document (live page or DOMParser-fetched HTML) for links to the video
// page matching the given AVID. Used to verify that a search results page actually
// contains the target video before navigating there.
// Returns deduplicated, original-case absolute URLs.
function findVideoUrlsForAVID(doc, avid, baseUrl) {
    const lower = avid.toLowerCase();
    const baseDomain = new URL(baseUrl).hostname;
    const seen = new Set();
    const results = [];
    const anchors = doc.querySelectorAll("a[href]");

    for (const a of anchors) {
        let resolved;
        try {
            // turn the href into a full absolute URL, using baseUrl as fallback for relative paths
            const u = new URL(a.getAttribute("href"), baseUrl);
            u.hash = ""; // strip fragments like /#more so they don't create duplicates
            resolved = u.href;
        } catch {
            console.warn(`[findVideoUrlsForAVID] invalid href skipped: "${a.getAttribute("href")}"`);
            continue;
        }

        // ignore links to other domains (ads, cross-site references)
        if (new URL(resolved).hostname !== baseDomain) continue;

        const normalized = resolved.toLowerCase();
        const urlPath = new URL(resolved).pathname.toLowerCase();

        // match by href (AVID in URL path, not just query string), title attribute, or anchor text content — but never search/listing pages
        const titleMatch = (a.getAttribute("title") || "").toLowerCase().includes(lower);
        const textMatch = a.textContent.toLowerCase().includes(lower);
        const hrefMatch = urlPath.includes(lower) && !/\/search(\/|$)/.test(urlPath);

        if ((hrefMatch || titleMatch || textMatch) && !seen.has(normalized)) {
            const matchType = hrefMatch ? "href" : titleMatch ? "title" : "text";
            log(`[findVideoUrlsForAVID] match (${matchType}): ${resolved}`);
            seen.add(normalized);
            results.push(resolved);
        }
    }
    return results;
}

// Multiple tabs can be opened simultaneously, each writing their own content under a unique key.
// After 100 ms all parallel tabs have written their data.
// The tab with the alphabetically smallest key takes the lead:
// it reads all keys, copies the combined content, and cleans up.
// All other tabs just close without copying.
function coordinateTabs(content) {
    const myTabKey = "rgLinks_" + Date.now() + Math.random();
    localStorage.setItem(myTabKey, content);
    setTimeout(() => {
        const keys = Object.keys(localStorage)
            .filter((k) => k.startsWith("rgLinks_"))
            .sort();
        if (keys[0] === myTabKey) {
            GM_setClipboard(keys.map((k) => localStorage.getItem(k)).join(""));
            keys.forEach((k) => localStorage.removeItem(k));
        }
        window.close();
    }, 100);
}

GM_registerMenuCommand("Configuration", configurationMenu, "c");

// =======================================================================================
// Layout Improvements
// =======================================================================================

function addImprovementsCss() {
    const themes = {
        purplePink: { accent: "#667eea", accentHover: "#667eea", accentVisited: "#667eea", btnBg: "#e8687a", btnBgHover: "#d0526a" },
        darkBlue: { accent: "#012f61", accentHover: "#194676", accentVisited: "#012f61", btnBg: "#64748b", btnBgHover: "#475569" },
    };
    const themeKey = GM_getValue("theme", configurationOptions.theme.default);
    const theme = themes[themeKey] ?? themes[configurationOptions.theme.default];
    GM_addStyle(`:root {
        --accent: ${theme.accent};
        --accentHover: ${theme.accentHover};
        --btn-bg: ${theme.btnBg};
        --btn-bg-hover: ${theme.btnBgHover};
        --accent-visited: ${theme.accentVisited};
    }`);

    GM_addStyle(`
        // html, body, * {
        //     font-family: system-ui, sans-serif !important;
        //     font-size: 13px;
        // }
        a {
            color: var(--accent);
        }
        // a:hover:not(.videothumblist .videos .video a) {
        //     color: #e0115f !important;
        // }
        a:visited {
            color: #ababab;
        }

        /* Saving space on top and left */
        #topmenu {
            z-index: 2;
        }
        #toplogo {
            position: absolute;
            top: 0;
            height: 28px;
            left: unset;
            background: unset;
            overflow: unset;
        }
        #toplogo .languagemenu {
            padding-right: 16px;
            top: 34px;
            z-index: 1;
        }
        #toplogo .topbanner1,
        #toplogo .sitelogo {
            display: none;
        }
        div#topbanner11 {
            height: unset;
        }
        #content {
            padding-top: 0;
        }
        div.boxtitle {
            top: 0;
            padding: unset;
        }

        /* improve space on smaller viewports */
        @media screen and (max-width: 1300px) {
            #leftmenu {
                display: none;
            }
            #rightcolumn {
                margin-left: 10px;
            }
        }

        /* search results layout
        /* Prevents text from being cut off vertically in Chromium when non-ASCII characters are present */
        .videothumblist .videos .video .title {
            display: -webkit-box;
            height: unset;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        /* search area layout */
        #video_search tr {
            display: flex;
            align-items: stretch;
        }
        #video_search td.text {
            display: flex;
            flex: 1;
            flex-wrap: wrap;
            align-items: center;
            align-content: center;
            gap: 4px 4px;
            padding-left: 3px !important;
        }
        #video_search td.text .added-links {
            display: inline-flex;
            width: auto;
            height: auto;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 0;
        }
        #video_search td.header {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: flex-start;
            flex-shrink: 0;
        }
        #video_search td.header .search-group-actions {
            margin-top: 4px;
        }
        #video_search td.text > .search-group {
            flex-basis: 100%;
        }
        .search-group-row {
            display: flex;
            gap: 8px;
            width: 100%;
        }
        // .search-group {
        //     display: flex;
        //     flex-wrap: wrap;
        //     gap: 4px 4px;
        //     align-items: center;
        //     flex: 1;
        //     min-width: 0;
        // }
        .search-group-links {
            display: flex;
            flex-wrap: wrap;
            gap: 4px 4px;
            align-items: center;
            flex: 1;
            min-width: 0;
        }
        .search-group-actions {
            display: flex;
            flex-direction: column;
            gap: 2px;
            align-items: flex-end;
        }
        /* search links layout */
        .added-links {
            width: 370px;
            height: 17px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .added-links.Torrent {
            display: inline-block;
            width: auto;
        }

        /* addSearchLinkAndOpenAllButton & addFaceRecognitionSearchToCasts */
        button.smallbutton-mod {
            margin-top: 0;
            margin-bottom: 0;
            padding: 2px 8px;
            width: 90px;
            height: 20px;
            user-select: none;
            background: var(--btn-bg);
            color: white;
            border: none;
            border-radius: 3px;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.15s ease;
            white-space: nowrap;
        }
        button.smallbutton-mod:hover {
            background: var(--btn-bg-hover);
        }
        button.smallbutton-mod:active {
            opacity: 0.85;
        }
        .added-links a,
        a.customButton {
            background: transparent;
            color: var(--accent);
            border: 1px solid #c8d0f0;
            text-decoration: none;
            border-radius: 3px;
            transition: all 0.15s ease;
            padding: 1px 8px;
        }
        .added-links a:hover,
        a.customButton:hover {
            background: var(--accentHover);
            color: white;
            border-color: var(--accent);
        }       
        .added-links a:visited:hover {
            background: color-mix(in srgb, var(--accentHover) 10%, white);
        }
        .added-links a:visited {
            color: #a0aec0;
            border-color: #dde3ee;
        }
        /* prefetch result indicators */
        .prefetch-found { color: #4ade80 !important; }
        .prefetch-found:hover { color: white !important; background: #4ade80 !important; border-color: #4ade80 !important; }

        .prefetch-not-found { color: #de4a4a !important; }
        .prefetch-not-found:hover { color: white !important; background: #de4a4a !important; border-color: #de4a4a !important; }

        .prefetch-error { border-style: dashed !important; border-color: orange !important; color: orange !important; position: relative; }
        .prefetch-error:hover { color: white !important; background: orange !important; border-color: orange !important; }
        .prefetch-error .prefetch-tooltip { background: orange; }

        .prefetch-unavailable { border-style: dashed !important; border-color: #888 !important; color: #888 !important; position: relative; }
        .prefetch-unavailable:hover { color: white !important; background: #888 !important; border-color: #888 !important; }
        .prefetch-unavailable .prefetch-tooltip { background: #888; }

        .prefetch-tooltip {
            position: absolute;
            font-size: 10px;
            padding: 4px;
            border-radius: 4px;
            top: -13px;
            line-height: .75;
            color: white;
            white-space: nowrap;
            pointer-events: none;
        }
    `);

    switch (true) {
        // JAV Details
        case isJavLibrary && /[a-z]{2}\/jav.*/.test(url): {
            GM_addStyle(`
                #toplogo .languagemenu {
                    top: 45px;
                }
                #video_title h3.post-title {
                    padding-right: 117px;
                    top: 30px;
                }
                #video_title {
                    border-bottom: unset !important;
                    margin-bottom: 10px
                }
                
                #video_info {
                    min-width: 430px;
                    padding-right: 0 !important;
                }
                /* compact modern info rows */
                #video_info .item {
                    margin: 0 !important;
                }
                #video_info .item table {
                    margin-top: 0 !important;
                }
                #video_info table,
                #video_info table:hover {
                    border-bottom: unset !important;
                }
                #video_info .item td.header {
                    color: #888;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    align-self: center;
                    padding: 5px 10px 5px 4px;
                    white-space: nowrap;
                }
                #video_info .item td {
                    font-size: 14px;
                    padding: 5px 0;
                    vertical-align: middle;
                }
                #video_info table > tbody > tr > td.icon {
                    display: none;
                }

                /* cast search buttons container */
                .find-cast {
                    display: block;
                    margin-top: 5px;
                }

                /* advertising photos */
                #rightcolumn > div.previewthumbs {
                    display: flex !important;
                    flex-wrap: wrap;
                    gap: 5px;
                    justify-content: center;
                    align-items: center;
                }
                /* preview video separated from advertising photos */
                a.btn_videoplayer {
                    display: block;
                    text-align: center;
                }

                #video_jacket {
                    text-align: left !important;
                    max-width: fit-content;
                }

                /* cover image */
                #video_jacket_info > tbody > tr > td {
                    justify-items: center;
                }

                /* prevent video metadata from becoming too narrow */
                #video_jacket_info > tbody > tr > td:nth-child(2) {
                    min-width: 550px;
                    padding-left: 16px !important;
                }

                @media screen and (min-width: 1571px) {
                    /* reduce FOUC for cover image */
                    img#video_jacket_img {
                        /* not too high, especially portraits */
                        max-height: 800px;
                    }
                }

                @media screen and (max-width: 1570px) {
                    /* same size for cover and metadata area */
                    #video_jacket_info > tbody > tr > td {
                        width: 50%;
                    }

                    img#video_jacket_img {
                        width: 100% !important;
                    }
                }

                /* cast image-search buttons */
                .customButton {
                //     background: #f0f0f0;
                //     color: #444;
                //     border: 1px solid #ddd;
                //     border-radius: 3px;
                //     padding: 1px 8px;
                    font-size: 13px;
                //     margin: 1px 1px 2px 0;
                //     transition: background 0.15s ease;
                //     user-select: none;
                //     cursor: pointer;
                //     text-decoration: none;
                //     display: inline-block;
                }
                // .customButton:hover {
                //     background: #e2e2e2;
                //     color: #222 !important;
                // }
                // .customButton:visited {
                //     color: #999 !important;
                // }

                /* image-search buttons */
                .image-search {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                    align-items: center;
                    align-content: flex-end;
                    padding: 0 3px;
                }

                /* cast row */
                #video_cast .cast-container {
                    display: flex;
                    flex-direction: row;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 4px 6px;
                    margin: 0 2px 2px 0;
                    border-radius: 5px;
                }

                span.cast {
                    display: flex;
                    flex-wrap: nowrap;
                    align-items: center;
                    margin-bottom: 0;
                    margin-right: 0;
                    gap: 4px;
                }

                /* visited link not visible */
                #video_info .maker a:visited,
                #video_info .director a:visited,
                #video_info .label a:visited,
                #video_info .genre a:visited
                {
                    color: var(--accent-visited);
                }

                /* cover shadow + rounding */
                img#video_jacket_img {
                    border-radius: 4px;
                    box-shadow: 2px 2px 6px 0px rgba(0, 0, 0, 0.4)
                }

                /* score — JS colorizes by value; keep font only here */
                #video_review .score {
                    font-size: 13px;
                    font-weight: 700;
                    margin-left: 6px;
                    vertical-align: middle;
                }

                /* favorite buttons as compact horizontal row */
                #video_favorite_edit {
                    margin-top: 8px;
                    padding: 2px 0;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px 0;
                    align-items: center;
                    justify-content: center;
                }
                #video_favorite_edit .favoritetype {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    margin: 0 10px 4px 0;
                    font-size: 12px;
                    color: #888;
                }
                #video_favorite_edit button.smallbutton:not(.hidden) {
                    color: dimgray;
                    border: 1px solid dimgray;
                    border-radius: 3px;
                    padding: 2px 10px;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    cursor: pointer;
                }
                #video_favorite_edit button.smallbutton:not(.hidden):hover {
                    background: dimgray;
                    color: white;
                }

                /* Local-Search button */
                button.smallbutton.localsearch {
                    position:relative;top:3px;
                    background: #f5f5f5;
                    color: #555;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    padding: 1px 8px;
                    font-size: 12px;
                    font-weight: normal;
                    transition: background 0.15s ease;
                    vertical-align: middle;
                    margin-left:10px
                }
                button.smallbutton.localsearch:hover {
                    background: #e8e8e8;
                }
            `);
            break;
        }
        // no video found
        case isJavLibrary && /\/vl_searchbyid.php/.test(url): {
            GM_addStyle(`
                #video_search {
                    font: 14px Arial;
                    margin-top: 20px;
                    margin-left: auto;
                    margin-right: auto;
                    width: fit-content;
                }
                #video_search td.header {
                    width: 100px;
                    font-weight: bold;
                    text-align: right;
                }
            `);
            break;
        }
    }
}

async function removeResizingOfCoverImage() {
    const coverImage = await waitForElement("#video_jacket_img");

    if (!coverImage) return;

    coverImage.removeAttribute("width");
    coverImage.removeAttribute("height");

    const observer = new MutationObserver((mutations) => {
        for (let mutation of mutations) {
            if (mutation.type === "attributes") {
                coverImage.removeAttribute("width");
                coverImage.removeAttribute("height");
                // observer.disconnect();
                return;
            }
        }
    });

    observer.observe(coverImage, { attributes: true });
}

// =======================================================================================
// External Search
// =======================================================================================

function externalSearch() {
    const currentURL = window.location.href;
    const hostname = window.location.hostname;

    async function handleSearchResults() {
        if (document.title === "Just a moment...") return;

        let searchTerm = new URLSearchParams(window.location.search).get("s");
        if (!searchTerm) {
            const match = window.location.href.match(/\/search\/([^/]+)/);
            searchTerm = match?.[1];
        }
        if (!searchTerm) {
            window.close();
            return;
        }

        // poll until results appear — no reliable event signals when JS-rendered content is ready
        let videoLinks = [];
        for (let i = 0; i < 5; i++) {
            videoLinks = findVideoUrlsForAVID(document, searchTerm, window.location.href);
            if (videoLinks.length > 0) break;
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        log(`[ext-search] found ${videoLinks.length} video link(s) for "${searchTerm}"`, videoLinks);

        if (videoLinks.length === 0) {
            window.close();
            return;
        }

        videoLinks.forEach((href, index) => {
            setTimeout(() => GM_openInTab(href, { active: false }), index * 100);
        });
        setTimeout(() => window.close(), videoLinks.length * 100 + 500);
    }

    function handleRapidgatorPages() {
        log("[RG] handleRapidgatorPages");

        // handle hidden rapidgator links
        if (hostname === "jav.guru") {
            // not on redirecting page
            if (!currentURL.includes("/?r=")) {
                const sources = document.querySelectorAll("#dl_jav_free");
                const rapidgatorSources = Array.from(sources).filter((source) => source.innerText.includes("Rapidgator"));

                if (rapidgatorSources.length === 0) {
                    window.close();
                    return;
                }

                for (let source of rapidgatorSources) {
                    const link = source.querySelector("a");
                    if (link) {
                        if (link.href) {
                            window.open(link.href, "_self");
                        } else {
                            let onClickContent = link.getAttribute("onclick");
                            // if onClickContent is set, replace window.open with window.open('url', '_self')
                            if (onClickContent && onClickContent.includes("window.open")) {
                                const match = onClickContent.match(/window\.open\s*\(\s*['"]([^'"]*)['"]/);
                                if (match) {
                                    const url = match[1];
                                    onClickContent = onClickContent.replace(
                                        /window\.open\s*\([^)]*\)/,
                                        `window.open('${url}', '_self')`,
                                    );
                                    link.setAttribute("onclick", onClickContent);
                                    link.click();
                                }
                            }
                        }
                    }
                }
            } else {
                // copy link from redirecting page and close window
                const metaTag = document.querySelector('meta[http-equiv="refresh"]');

                if (metaTag) {
                    const content = metaTag.getAttribute("content");
                    const urlMatch = content.match(/URL=(.+)/i);

                    if (urlMatch) {
                        GM_setClipboard(urlMatch[1]);
                        setTimeout(() => window.close(), 200);
                    }
                }
            }
        } else if (hostname === "supjav.com") {
            document.querySelectorAll("body > div.main > div > div.video-wrap > div.left > div.downs > div > a").forEach((link) => {
                if (link.textContent.startsWith("RG")) {
                    GM_openInTab(link.href, { active: false });
                }
            });
            setTimeout(() => window.close(), 200);
        } else {
            const rapidgatorLinks = document.querySelectorAll("a[href*=rapidgator]");
            if (rapidgatorLinks.length > 0) {
                let collectedLinks = "";

                rapidgatorLinks.forEach((link) => {
                    collectedLinks += link.href + "\n";
                });

                coordinateTabs(collectedLinks);
            } else {
                window.close();
            }
        }
    }

    function handleGoogleDrivePages() {
        const links = document.querySelectorAll("[id^=post] a");
        let isFirstIteration = true;

        links.forEach((link) => {
            if (
                link.textContent.includes("FHD") ||
                link.textContent.includes("GOOGLE DRIVE – ALL IN ONE") ||
                link.textContent.includes("GB") ||
                link.textContent.includes("1080")
            ) {
                if (isFirstIteration) {
                    isFirstIteration = false;
                    link.scrollIntoView({ block: "center" });
                }
            }
        });

        if (hostname === "javgg.me") {
            const postContentElement = document.querySelector("article.status-publish.hentry > div > p");
            if (postContentElement && postContentElement.textContent.includes("drive.google.com/file/")) {
                GM_setClipboard(postContentElement.textContent)
                    .then(() => window.close())
                    .catch((err) => console.error("Error copying content:", err));
            }
        }
    }

    function runSearch() {
        switch (true) {
            case currentURL.includes("/?s=") || currentURL.includes("/search"):
                handleSearchResults();
                break;
            case ["arcjav.com", "javgg.me", "javx357.com"].includes(hostname):
                handleGoogleDrivePages();
                break;
            case ["jav.guru", "supjav.com", "missav.ai", "maddawgjav.net"].includes(hostname):
                handleRapidgatorPages();
                break;
        }
    }

    runSearch();
}

function getDataFetchTimeout() {
    return GM_getValue("externalDataFetchTimeout", configurationOptions.externalDataFetchTimeout.default);
}

// =======================================================================================
// General Improvements
// =======================================================================================

async function addImprovements() {
    (async function () {
        const configured = GM_getValue("improvements", configurationOptions.improvements.default);
        if (!configured) return;

        switch (true) {
            // JAV Details
            case isJavLibrary && /[a-z]{2}\/jav.*/.test(url): {
                log("[page] JAV Details");

                await getAvid();
                if (!avid) {
                    log("[page] addImprovements details: no AVID");
                    return;
                }

                // add title textbox
                await addTitleCopyPerClick();

                // adds posibility for local search but disabled by default as needs addinal scripts
                await addLocalSearchButton();

                // add search links
                setSearchLinks();

                // increase advertising previews
                setAdvertisingPhotosToFullSize();

                // Big preview screen shots
                // bigPreviewScreenshots();

                // add Cover Image Download button
                coverImageDownload();

                // remove link by converting <a> to <span> element
                removeLinkInTitle();

                // adds buttons to search for more informations about a cast
                addCastImagesSearchButtons();

                // button for facial recognition
                addCastSearchButton();

                // executes collecting all links from comments and opens rapidgator group
                collectingLinksFromCommentsAndRgGroupButton();

                // adds own svg to make favorite cast visible
                makeFavoriteCastVisible();

                // color the score badge by value
                colorizeScore();

                // move watch status below cover image
                moveWatchStatus();

                // show news notification
                showNewsNotification();

                // add configuration icon
                addConfigIcon();

                // remove redirects for external links
                setTimeout(removeRedirects, 500);

                // TODO: needs a more solid solution than just a blind timeout
                // maybe possible with GM_openInTab
                const timeout = GM_getValue("externalSearchModeTimeout", configurationOptions.externalSearchModeTimeout.default);
                if (GM_getValue("externalSearchMode", false)) {
                    setTimeout(() => {
                        GM_setValue("externalSearchMode", false);
                        log("[ext-search] externalSearchMode off");
                    }, timeout);
                }

                // autorun local search
                const authorsMode = GM_getValue("authorsMode", false);
                if (authorsMode) {
                    (async function () {
                        // Handle the case when the window is opened in the background
                        window.addEventListener("focus", function () {
                            executeInitialLocalSearch("EventListener").catch((err) =>
                                console.error("Error in executeInitialLocalSearch:", err),
                            );
                        });
                        // Handle the case when the window is opened in the foreground
                        // IntersectionObserver is used for better performance and reliability
                        // compared to repeated DOM queries or fixed timeouts
                        const observer = new IntersectionObserver((entries) => {
                            entries.forEach((entry) => {
                                if (entry.isIntersecting) {
                                    executeInitialLocalSearch("IntersectionObserver").catch((err) =>
                                        console.error("Error in executeInitialLocalSearch:", err),
                                    );
                                }
                            });
                        });
                        // Set up the observer after a short delay to ensure DOM is loaded
                        setTimeout(async () => {
                            const textElement = await getTitleElement();
                            if (textElement) {
                                observer.observe(textElement);
                            }
                        }, 500);
                    })();
                }

                window.addEventListener("keydown", function (event) {
                    if (event.key === "<" || event.key === "\\") {
                        collectingLinksFromCommentsAndRgGroup();
                    }
                });
                break;
            }
            // Redirect Page
            case isJavLibrary && /\/redirect.php/.test(url): {
                document.querySelector("#ckbSkipURLWarning").click();
                document.querySelector("#redirection").click();
                break;
            }
            // Video Star Listings
            case isJavLibrary && /\/vl_star.php/.test(url): {
                log("[page] Video Star Listings");

                // ToDo: highlight visited videos
                let videoLinks = document.querySelectorAll('div[id^="vid_"] a');
                for (let i = 0; i < videoLinks.length; i++) {
                    if (videoLinks[i].visited) {
                        videoLinks[i].parentNode.style.backgroundColor = "#ffe7d3";
                    }
                }

                // open in same tab
                setTimeout(() => {
                    document.querySelectorAll(".video > a").forEach(function (element) {
                        element.removeAttribute("target");
                    });
                }, 2000);

                break;
            }
            // Advanced Search Page
            case isJavLibrary && /\/search.php/.test(url): {
                // initialize search wait timer
                displaySearchWaitTimer();
                break;
            }
            case isJavLibrary && /\/vl_searchbyid.php/.test(url): {
                // if video is not in JAVLibrary add search links else filter results
                if (
                    (document.querySelector("#rightcolumn > p > em") || document.querySelector("#badalert")) &&
                    document.querySelector("#rightcolumn > div.titlebox")
                ) {
                    log("[page] no search results");

                    avid = new URLSearchParams(window.location.search).get("keyword");
                    if (avid) {
                        setSearchLinks();
                    }
                } else {
                    const searchByIDFilterEnabled = GM_getValue("searchByIDFilter", configurationOptions.searchByIDFilter.default);

                    if (searchByIDFilterEnabled) {
                        /**
                         * Filters video elements based on keyword in URL
                         * Hides videos that don't match the keyword and have "Blu-ray" in the title
                         */
                        const urlParams = new URLSearchParams(window.location.search);
                        const keyword = urlParams.get("keyword")?.toLowerCase();

                        if (window.location.href.includes("vl_searchbyid.php?keyword=") && keyword) {
                            const videoElements = document.querySelectorAll("div.video");

                            videoElements.forEach((video) => {
                                const idElement = video.querySelector("a > div.id");
                                const titleElement = video.querySelector("a");

                                if (idElement) {
                                    const idText = idElement.textContent.trim().toLowerCase();
                                    const titleText = titleElement.title.trim().toLowerCase();

                                    if (idText !== keyword || titleText.includes("blu-ray")) {
                                        video.remove();
                                    }
                                }
                            });
                        }

                        // if only one element remains, open it
                        if (document.querySelectorAll("div.video").length === 1) {
                            document.querySelector("div.video > a").click();
                        }

                        // open found links in same tab
                        document.querySelectorAll(".video > a")?.forEach(function (element) {
                            element.removeAttribute("target");
                        });
                    }
                }

                break;
            }
            case isJavLibrary && /\/videocomments.php/.test(url): {
                log("[page] Comments Page");

                function loadNextPage() {
                    copyLinksFromCommentsToClipboard(); // Copy the comments content before loading the next page

                    let currentPage = new URL(window.location.href).searchParams.get("page");
                    let lastPageUrl = document.querySelector("#rightcolumn > div.page_selector > a.page.last")?.href;
                    let lastPage = GM_getValue("lastPage", null);

                    // If lastPage is not set and the last page URL is available, extract and store the last page number
                    if (!lastPage && lastPageUrl) {
                        lastPage = new URL(lastPageUrl).searchParams.get("page");
                        GM_setValue("lastPage", lastPage);
                    }

                    if (!currentPage) currentPage = 1;
                    else currentPage = parseInt(currentPage);

                    // If the current page is not the last page, load the next page
                    if (currentPage < lastPage) {
                        let nextPage = currentPage + 1;
                        let nextUrl = new URL(window.location.href);
                        nextUrl.searchParams.set("page", nextPage);
                        window.location.href = nextUrl.href;
                    } else {
                        // not if cloudflare check happens
                        if (!document.title.includes("Just a moment...")) {
                            GM_deleteValue("lastPage");
                            GM_deleteValue("executingCollectingComments");

                            // go back to main page
                            const mainPageLink = document.querySelector("#video_jacket > a");
                            log("[comments]", mainPageLink);
                            if (mainPageLink) {
                                // open link
                                window.open(mainPageLink.href, "_self");
                            }
                        }
                    }
                }

                // initialize
                (async function () {
                    let executingCollectingComments = GM_getValue("executingCollectingComments", false);
                    if (executingCollectingComments) {
                        // await new Promise((resolve) => setTimeout(resolve, 100)); // wait before loading the next page to ensure clipboard operation is completed
                        loadNextPage();
                    } else {
                        window.addEventListener("keydown", function (event) {
                            if (event.key === "<") {
                                collectingLinksFromCommentsAndRgGroup();
                            }
                        });
                    }
                })();

                break;
            }
            // for searching for external download links and previews when opening tabs is required
            case /^https?:\/\/javx357\.com\/.*/i.test(url):
            case /^https?:\/\/arcjav\.com\/.*/i.test(url):
            case /^https?:\/\/javgg\.me\/.*/i.test(url):
            case /^https?:\/\/maxjav\.com\/.*/i.test(url):
            case /^https?:\/\/jav\.guru\/.*/i.test(url):
            case /^https?:\/\/supjav\.com\/.*/i.test(url):
            case /^https?:\/\/missav\.ai\/.*/i.test(url):
            case /^https?:\/\/maddawgjav\.net\/.*/i.test(url):
            case /^https?:\/\/video-jav\.net\/.*/i.test(url):
            case /^https?:\/\/javakiba\.org\/.*/i.test(url): {
                let externalSearchMode = GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    externalSearch();
                }
                break;
            }
            // copy GDrive & Rapidgator links into clipboard for JDownloader Linkgrabber and auto close
            case /^https:\/\/drive\.google\.com\/uc.*/i.test(url):
            case /^https:\/\/drive\.google\.com\/file\/.*/i.test(url):
            case /^https:\/\/rapidgator\.net\/.*/i.test(url): {
                let externalSearchMode = GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    const urls = ["https://drive.google.com", "https://rapidgator.net/file/*"];
                    const currentUrl = window.location.href;
                    const match = urls.some((url) => currentUrl.match(url));

                    if (match) {
                        coordinateTabs(location.href + "\n");
                    }

                    if (document.body.textContent.includes("404 File not found")) {
                        window.close();
                    }
                }
                break;
            }
            // Akiba auto search and open
            case /^https?:\/\/www\.akiba-online\.com\/search\/.*/i.test(url): {
                function search() {
                    // Extract the current parameter
                    const paramName = "search";
                    const searchTerm = new URLSearchParams(window.location.search).get(paramName);

                    if (searchTerm) {
                        document
                            .querySelector(
                                "#top > div.p-body > div > div.uix_contentWrapper > div > div > div > form > div > dl > dd > div > div.formSubmitRow-controls > button",
                            )
                            .click();

                        // close window if no result
                        setTimeout(() => {
                            if (document.querySelector("body > div.flashMessage.is-active > div").textContent === "No results found.") {
                                window.close();
                            }
                        }, 500);
                    }
                }

                function autoOpenResults() {
                    const postTitles = document.querySelectorAll("div.block-container > ol > li h3 a");
                    const paramName = "q";
                    const searchTerm = new URLSearchParams(window.location.search).get(paramName)?.toLowerCase();

                    if (postTitles.length === 0) return;

                    // Helper function to check if a title matches the search term
                    const isMatchingTitle = (element, term) => element?.textContent.toLowerCase().includes(term);

                    if (postTitles.length === 1) {
                        if (searchTerm && isMatchingTitle(postTitles[0], searchTerm)) {
                            postTitles[0].click();
                        } else {
                            window.close();
                        }
                        return;
                    }

                    const fileJokerBadge = document.querySelector("div.block-container > ol > li span.label--royalBlue");

                    // Prioritize clicking Filejoker badge if it matches the search term
                    if (fileJokerBadge && searchTerm && isMatchingTitle(fileJokerBadge.parentElement, searchTerm)) {
                        fileJokerBadge.parentElement.click();
                        return;
                    }

                    // Process multiple titles
                    postTitles.forEach((title) => {
                        if (searchTerm && !isMatchingTitle(title, searchTerm)) {
                            title.closest("li").style.display = "none";
                        } else {
                            GM_openInTab(title.href, { active: false });
                        }
                    });

                    setTimeout(() => window.close(), 500);
                }

                let externalSearchMode = GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    // if this url then no result, so close window
                    if (/^https?:\/\/www\.akiba-online\.com\/search\/search/i.test(url)) {
                        window.close();
                    }

                    // use get parameter for search with form as only post parameters are allowed
                    search();

                    // open result if only one result saves clicking
                    autoOpenResults();
                }
                break;
            }
            // BT1207
            case /^https?:\/\/bt1207so\.top\/\?find.*/i.test(url): {
                const searchParams = new URLSearchParams(window.location.search);
                const search = searchParams.get("find") || "";
                const searchInput = document.querySelector("#search-form > div.input-group > input");

                if (searchInput) {
                    searchInput.value = search;

                    if (search) {
                        const searchButton = document.querySelector("#search-form > div.input-group > span > button");
                        if (searchButton) {
                            searchButton.click();
                        }
                    }
                }
                break;
            }
        }
    })();

    function removeRedirects() {
        let externalLinks = document.querySelectorAll(
            "table[id^=comment] > tbody > tr:nth-child(1) > td.t > div a[href^='redirect.php']",
        );
        for (let externalLink of externalLinks) {
            externalLink.href = decodeURIComponent(
                externalLink.href?.replace(/https:\/\/www\.javlibrary\.com\/.*\/redirect\.php\?url=/, "").replace(/\&ver=.*/, ""),
            );
        }
    }

    function removeLinkInTitle() {
        let linkElement = document.querySelector("#video_title > h3 > a");

        if (linkElement) {
            let spanElement = document.createElement("span");
            spanElement.innerHTML = linkElement.innerHTML;
            linkElement.insertAdjacentElement("beforebegin", spanElement);
            linkElement.remove();
        }
    }

    async function addTitleCopyPerClick() {
        let titleElement = await getTitleElement();

        const clipboardSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2.75,4.5 C2.75,3.535 3.535,2.75 4.5,2.75 L8,2.75 L8,1 C8,0.448 7.553,0 7,0 L1,0 C0.447,0 0,0.448 0,1 L0,7 C0,7.552 0.447,8 1,8 L2.75,8 L2.75,4.5 Z"></path><path d="M11,4 L5,4 C4.447,4 4,4.448 4,5 L4,11 C4,11.552 4.447,12 5,12 L11,12 C11.553,12 12,11.552 12,11 L12,5 C12,4.448 11.553,4 11,4"></path></svg>`;
        const checkSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

        GM_addStyle(`
            .copy-icon {
                display: inline-block;
                margin-left: 5px;
                margin-bottom: 2px;
                vertical-align: middle;
                opacity: 0.35;
                transition: opacity 0.2s, color 0.2s;
                color: inherit;
            }
            #video_id > table > tbody > tr > td.text:hover .copy-icon { opacity: 0.75; }
            .copy-icon.copied { color: #4caf50; opacity: 1; }
        `);

        const iconSpan = document.createElement("span");
        iconSpan.className = "copy-icon";
        iconSpan.innerHTML = clipboardSVG;
        titleElement.appendChild(iconSpan);

        titleElement.style.cursor = "pointer";
        titleElement.addEventListener("click", function () {
            copyTitleToClipboard().then(() => {
                iconSpan.innerHTML = checkSVG;
                iconSpan.classList.add("copied");
                setTimeout(() => {
                    iconSpan.innerHTML = clipboardSVG;
                    iconSpan.classList.remove("copied");
                }, 1500);
            });
        });
    }

    async function executeInitialLocalSearch(source) {
        const textElement = await getTitleElement();

        if (textElement && !avidCopiedToClipboard && document.hasFocus()) {
            // if tab was opened with link
            if (history.length === 1) {
                // not on image or best of videos
                if (!document.querySelector("#genre199") && !document.querySelector("#genre39")) {
                    // put once to clipboard
                    // devLog(`${source}: ${avid}`);

                    copyTitleToClipboard()
                        .then(() => {
                            avidCopiedToClipboard = true;
                            setTimeout(runLocalSearch, 50);
                        })
                        .catch(function (err) {
                            console.error("Failed to copy text: ", err);
                            avidCopiedToClipboard = false;
                        });
                }
            }
        }
    }

    /**
     * requires a local script such as AHK, which recognizes the window title
     * as information for the execution of another local script
     * Button and auto execute disabled if GM variable privateMode is not set
     */
    async function addLocalSearchButton() {
        const authorsMode = GM_getValue("authorsMode", false);

        if (authorsMode) {
            let targetElement = await getTitleElement();

            let newButton = document.createElement("button");
            newButton.textContent = "Local-Search";
            newButton.className = "smallbutton localsearch";

            targetElement.insertAdjacentElement("afterend", newButton);

            newButton.addEventListener(
                "click",
                function () {
                    copyTitleToClipboard().then(() => {
                        runLocalSearch();
                    });
                },
                false,
            );
        }
    }

    function runLocalSearch() {
        document.title = "Browser Local-Search";
        setTimeout(() => {
            document.title = originalDocumentTitle;
        }, 50);
    }

    function copyTitleToClipboard() {
        return navigator.clipboard.writeText(avid);
    }

    function coverImageDownload() {
        const downloadedFiles = {};

        // build cover image name
        let casts = document.querySelectorAll("[id^=cast] > span.star > a");
        let newFilename = avid + " - ";
        let iteration = casts.length;
        for (let cast of casts) {
            const replaced = cast.textContent.replace(/[^\x00-\x7F]/g, "");
            newFilename += replaced.length > 0 ? replaced : cast.textContent;

            if (--iteration) newFilename += ", ";
        }
        newFilename = newFilename + ".jpg";

        const coverPicture = document.querySelector("#video_jacket_img");
        const coverPictureUrl = coverPicture?.src;

        if (coverPictureUrl) {
            // Download and cache file
            GM_xmlhttpRequest({
                method: "GET",
                url: coverPictureUrl,
                responseType: "blob",
                headers: { referer: coverPictureUrl, origin: coverPictureUrl },
                onload: function (response) {
                    // Save image as blob
                    downloadedFiles[newFilename] = response.response;
                },
                onerror: function (error) {
                    console.error(`Error downloading ${coverPictureUrl}:`, error);
                },
            });

            // Click event for the download
            coverPicture?.addEventListener(
                "click",
                async function () {
                    const maxRetries = 10;
                    let currentTry = 0;

                    function tryDownload() {
                        const blob = downloadedFiles[newFilename];
                        if (blob) {
                            const blobUrl = URL.createObjectURL(blob);
                            const downloadLink = document.createElement("a");
                            downloadLink.href = blobUrl;
                            downloadLink.download = newFilename;
                            // Trigger of the click on the invisible <a>
                            downloadLink.click();

                            // Release URL after use
                            URL.revokeObjectURL(blobUrl);
                            return true;
                        }
                        return false;
                    }

                    while (currentTry < maxRetries) {
                        const success = tryDownload();
                        if (success) {
                            break;
                        }

                        currentTry++;
                        if (currentTry < maxRetries) {
                            log(`[cover] Download attempt ${currentTry} failed. Retrying...`);
                            // Optional: Add delay between retries
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                        } else {
                            console.error("Max retries reached. Image download failed.");
                        }
                    }
                },
                { once: true },
            );
        }
    }

    function addSearchLinkAndOpenAllButton(name, href, className, containerElement, bgFetch = true) {
        const div = document.createElement("div");
        div.classList.add("added-links");
        if (className) div.classList.add(className);
        const a = document.createElement("a");
        a.href = href;
        a.target = "_blank";
        a.textContent = name;
        a.dataset.bgFetch = String(bgFetch);
        div.appendChild(a);
        containerElement.appendChild(div);
    }

    function addTooltipToLink(link, text) {
        const tip = document.createElement("div");
        tip.className = "prefetch-tooltip";
        tip.textContent = text;
        link.appendChild(tip);
    }

    function prefetchGroupResults(className) {
        if (!avid) return;
        const links = document.querySelectorAll(`.search-group.${className} .search-group-links a`);
        const parser = new DOMParser();
        const timeout = getDataFetchTimeout();

        log(`[prefetch] ${className}: checking ${links.length} link(s)`);

        links.forEach((link) => {
            if (link.dataset.bgFetch === "false") {
                link.classList.add("prefetch-unavailable");
                addTooltipToLink(link, "Unverifiable");
                return;
            }
            if (link.classList.contains("prefetch-found") || link.classList.contains("prefetch-not-found")) {
                log(`[prefetch] ${link.textContent.trim()}: already checked, skipping`);
                return;
            }
            log(`[prefetch] ${link.textContent.trim()}: fetching ${link.href}`);
            GM_xmlhttpRequest({
                method: "GET",
                url: link.href,
                timeout: timeout,
                onload: (response) => {
                    if (isCloudflare(response.responseText)) {
                        log(`[prefetch] ${link.textContent.trim()}: Cloudflare detected`);
                        if (!link.classList.contains("prefetch-unavailable")) {
                            link.classList.add("prefetch-unavailable");
                            addTooltipToLink(link, "Blocked");
                        }
                        return;
                    }
                    if (response.status !== 200) {
                        log(`[prefetch] ${link.textContent.trim()}: HTTP ${response.status}`);
                        link.classList.add("prefetch-error");
                        addTooltipToLink(link, `HTTP ${response.status}`);
                        return;
                    }

                    // Check if the avid is present in any link on the page (case-insensitive)
                    const doc = parser.parseFromString(response.responseText, "text/html");
                    if (!doc.body || doc.body.children.length === 0) {
                        log(`[prefetch] ${link.textContent.trim()}: empty HTML body`);
                        link.classList.add("prefetch-error");
                        addTooltipToLink(link, "Empty response");
                        return;
                    }
                    const found = findVideoUrlsForAVID(doc, avid, link.href).length > 0;
                    log(`[prefetch] ${link.textContent.trim()}: ${found ? "found" : "not found"}`);
                    link.classList.add(found ? "prefetch-found" : "prefetch-not-found");
                    if (!found && !GM_getValue("prefetchShowNotFound", configurationOptions.prefetchShowNotFound.default)) {
                        link.parentElement.style.display = "none";
                    }
                },
                onerror: () => {
                    log(`[prefetch] ${link.textContent.trim()}: request error`);
                    link.classList.add("prefetch-error");
                    addTooltipToLink(link, "Error");
                },
                ontimeout: () => {
                    log(`[prefetch] ${link.textContent.trim()}: timeout`);
                    link.classList.add("prefetch-error");
                    addTooltipToLink(link, "Timeout");
                },
            });
        });
    }

    function bgXhr(url) {
        const timeout = getDataFetchTimeout();

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url,
                timeout: timeout,
                onload: resolve,
                onerror: () => resolve(null),
                ontimeout: () => resolve(null),
            });
        });
    }

    function isCloudflare(html) {
        if (!html) return false;
        return html.includes("Just a moment") || html.includes("cf-browser-verification");
    }

    // Returns array of RG links, or null if Cloudflare was detected (triggers tab fallback)
    async function bgFetchRgLinks(searchUrl, avid) {
        const site = new URL(searchUrl).hostname;
        log(`[RG-BG] ${site}: fetching ${searchUrl}`);

        const resp = await bgXhr(searchUrl);
        if (!resp) {
            log(`[RG-BG] ${site}: request failed (null)`);
            return [];
        }
        if (isCloudflare(resp.responseText)) {
            log(`[RG-BG] ${site}: Cloudflare detected → tab fallback`);
            return null;
        }

        const parser = new DOMParser();
        const searchDoc = parser.parseFromString(resp.responseText, "text/html");

        const videoUrls = findVideoUrlsForAVID(searchDoc, avid, searchUrl);
        if (videoUrls.length === 0) {
            log(`[RG-BG] ${site}: no video pages found for ${avid}`);
            return [];
        }
        log(`[RG-BG] ${site}: found ${videoUrls.length} video page(s)`, videoUrls);

        const allLinks = new Set();
        await Promise.all(
            videoUrls.map(async (videoUrl) => {
                const vResp = await bgXhr(videoUrl);
                if (!vResp) {
                    log(`[RG-BG] ${site}: video page request failed: ${videoUrl}`);
                    return;
                }
                if (isCloudflare(vResp.responseText)) {
                    log(`[RG-BG] ${site}: Cloudflare on video page: ${videoUrl}`);
                    return;
                }
                const videoDoc = parser.parseFromString(vResp.responseText, "text/html");
                [...videoDoc.querySelectorAll("a")]
                    .map((a) => a.getAttribute("href"))
                    .filter((href) => href && /rapidgator\.net\/file\//i.test(href))
                    .forEach((href) => allLinks.add(href));
            }),
        );

        const links = [...allLinks];
        log(`[RG-BG] ${site}: found ${links.length} RG link(s)`, links);
        return links;
    }

    function setExternalSearchMode() {
        GM_setValue("externalSearchMode", true);
        const duration = GM_getValue("externalSearchModeTimeout", configurationOptions.externalSearchModeTimeout.default) + 2000;
        setTimeout(() => {
            GM_setValue("externalSearchMode", false);
            log("[ext-search] externalSearchMode off");
        }, duration);
    }

    async function collectRapidgatorLinksHybrid() {
        const groupLinks = [...document.querySelectorAll(".search-group.Rapidgator-Group .search-group-links a")];
        const bgLinks = groupLinks.filter((a) => a.dataset.bgFetch === "true");
        const tabLinks = groupLinks.filter((a) => a.dataset.bgFetch !== "true");
        log(
            "[RG] Starting collect for",
            avid,
            "— bg:",
            bgLinks.map((a) => a.href),
            "tabs:",
            tabLinks.map((a) => a.href),
        );

        const bgResults = await Promise.all(bgLinks.map((a) => bgFetchRgLinks(a.href, avid).catch(() => null)));

        const collectedLinks = [];
        const cfTabUrls = [];
        bgResults.forEach((result, i) => {
            if (result === null) cfTabUrls.push(bgLinks[i].href);
            else collectedLinks.push(...result);
        });

        log(
            `[RG] Background: ${collectedLinks.length} link(s) collected, ${cfTabUrls.length} CF fallback(s), ${tabLinks.length} tab-only source(s)`,
        );
        if (collectedLinks.length > 0) {
            log("[RG] Copying to clipboard:", collectedLinks);
            GM_setClipboard(collectedLinks.join("\n"));
        }

        setExternalSearchMode();

        const tabsToOpen = [...tabLinks.map((a) => a.href), ...cfTabUrls];
        log("[RG] Opening tabs:", tabsToOpen);
        for (const url of tabsToOpen) {
            GM_openInTab(url, { active: false });
        }
    }

    function setSearchLinks() {
        const searchContainer = document.createElement("div");
        searchContainer.id = "video_search";
        searchContainer.className = "item";

        const table = document.createElement("table");
        const tbody = document.createElement("tbody");
        table.appendChild(tbody);
        searchContainer.appendChild(table);

        // Creates a 2-column row (td.header | td.text).
        // For groups with a groupClassName, td.text contains a flex row:
        //   div.search-group-actions | div.search-group > div.search-group-links
        // Returns { actionTd, linksTd, contentTd }
        function addGroupRow(label, groupClassName) {
            const tr = document.createElement("tr");

            const headerTd = document.createElement("td");
            headerTd.className = "header";
            headerTd.textContent = label;

            const contentTd = document.createElement("td");
            contentTd.className = "text";

            tr.appendChild(headerTd);
            tr.appendChild(contentTd);
            tbody.appendChild(tr);

            if (!groupClassName) {
                return { actionTd: null, linksTd: contentTd, contentTd };
            }

            const actionDiv = document.createElement("div");
            actionDiv.className = `search-group-actions ${groupClassName}`;
            headerTd.appendChild(actionDiv);

            const groupWrapper = document.createElement("div");
            groupWrapper.className = `search-group ${groupClassName}`;
            const linksWrapper = document.createElement("div");
            linksWrapper.className = "search-group-links";
            groupWrapper.appendChild(linksWrapper);
            contentTd.appendChild(groupWrapper);

            return { actionTd: actionDiv, linksTd: linksWrapper, contentTd };
        }

        /**
         * Adds an action button to a search group header.
         * Default behaviour: opens all links in the group as tabs.
         *
         * @param {HTMLElement} actionTd - Container element the button is appended to
         * @param {string} label - Button label
         * @param {string} className - CSS class of the search group whose links are opened
         * @param {Function|null} [onClickOverride] - Replaces the default tab-opening entirely, e.g. for background-fetching or prefetching
         * @param {boolean} [openActive=false] - If true, opened tabs get focus; otherwise they open in the background
         */
        function addGroupActionButton(actionTd, label, className, onClickOverride = null, openActive = false) {
            const button = document.createElement("button");
            button.textContent = label;
            button.className = "smallbutton smallbutton-mod";
            if (onClickOverride) {
                button.addEventListener("click", onClickOverride);
            } else {
                button.addEventListener("click", async function () {
                    const linksToOpen = document.querySelectorAll(`.search-group.${className} .search-group-links a`);
                    const reversedLinks = Array.from(linksToOpen).reverse();

                    setExternalSearchMode();

                    reversedLinks.forEach((link) => GM_openInTab(link.href, { active: openActive }));
                });
            }
            actionTd.appendChild(button);
        }

        const searchInsertTarget = castContainer() || document.querySelector("#rightcolumn > div.titlebox");
        if (searchInsertTarget) {
            searchInsertTarget.insertAdjacentElement("afterend", searchContainer);
        }

        // When adding a button for a new site to any group:
        //   If the script should also run on that site (e.g. to auto-close empty result tabs), add:
        //     (1) @match at the top of this file
        //     (2) a routing case in runSearch() pointing to the appropriate handler

        // Torrent
        if (GM_getValue("searchGroupTorrent", configurationOptions.searchGroups.searchGroupTorrent.default)) {
            const { linksTd } = addGroupRow("Torrents:");
            addSearchLinkAndOpenAllButton("BT4G", "https://bt4gprx.com/search?q=" + avid + "&orderby=size", "Torrent", linksTd);
            addSearchLinkAndOpenAllButton("BTDig", "https://btdig.com/search?order=3&q=" + avid, "Torrent", linksTd);
            addSearchLinkAndOpenAllButton("Sukebei", "https://sukebei.nyaa.si/?f=0&c=0_0&s=size&o=desc&q=" + avid, "Torrent", linksTd);
            addSearchLinkAndOpenAllButton("BT1207", "https://bt1207so.top/?find=" + avid, "Torrent", linksTd);
        }

        // Thumbnails 1
        if (GM_getValue("searchGroupThumbnails1", configurationOptions.searchGroups.searchGroupThumbnails1.default)) {
            const { actionTd, linksTd } = addGroupRow("Thumbnails 1:", "Thumbnails-1-Group");
            addGroupActionButton(actionTd, "Search All", "Thumbnails-1-Group", null, true);
            addSearchLinkAndOpenAllButton(
                "Akiba-Online",
                "https://www.akiba-online.com/search/?q=" + avid + "&c%5Btitle_only%5D=1&o=date&search=" + avid,
                "Thumbnails-1-Group",
                linksTd,
            );
            addSearchLinkAndOpenAllButton("Max JAV", "https://maxjav.com/?s=" + avid, "Thumbnails-1-Group", linksTd);
        }

        // Thumbnails 2
        if (GM_getValue("searchGroupThumbnails2", configurationOptions.searchGroups.searchGroupThumbnails2.default)) {
            const { actionTd, linksTd } = addGroupRow("Thumbnails 2:", "Thumbnails-2-Group");
            addGroupActionButton(actionTd, "Search All", "Thumbnails-2-Group", () => prefetchGroupResults("Thumbnails-2-Group"));
            addSearchLinkAndOpenAllButton("JAV-Load", "https://jav-load.com/?s=" + avid, "Thumbnails-2-Group", linksTd);
            addSearchLinkAndOpenAllButton("Video-JAV", "http://video-jav.net/?s=" + avid, "Thumbnails-2-Group", linksTd);
            addSearchLinkAndOpenAllButton("JAVAkiba", "https://javakiba.org/?s=" + avid, "Thumbnails-2-Group", linksTd);
            if (GM_getValue("prefetchOnLoadThumbnails2", configurationOptions.prefetchOnLoad.prefetchOnLoadThumbnails2.default))
                prefetchGroupResults("Thumbnails-2-Group");
        }

        // Rapidgator
        // When adding a new button here, two additional decisions compared to other groups:
        //
        //   CONTAINER — 4th argument:
        //     linksTd   → button is part of the group; "collect all" will process it
        //     contentTd → "optional" button shown below the row; ignored by "collect all"
        //
        //   bgFetch — 5th argument (default = true):
        //     false → tab mode: the script runs on the site to extract RG links — also add:
        //               @match + runSearch() (see general note above) +
        //               handleRapidgatorPages(): add an else-if for custom extraction,
        //               or the generic else-branch handles plain a[href*=rapidgator] links automatically
        //     true  → background-fetch mode: GM_xmlhttpRequest scrapes RG links directly,
        //             falls back to tab if Cloudflare blocks — no @match or runSearch() needed
        if (GM_getValue("searchGroupRapidgator", configurationOptions.searchGroups.searchGroupRapidgator.default)) {
            const { actionTd, linksTd, contentTd } = addGroupRow("Rapidgator:", "Rapidgator-Group");
            addGroupActionButton(actionTd, "Collect All", "Rapidgator-Group", collectRapidgatorLinksHybrid);
            addSearchLinkAndOpenAllButton("JAV Guru", "https://jav.guru/?s=" + avid, "Rapidgator-Group", linksTd, false);
            addSearchLinkAndOpenAllButton("Supjav", "https://supjav.com/?s=" + avid, "Rapidgator-Group", linksTd, false);
            addSearchLinkAndOpenAllButton("MissAV", "https://missav.ai/en/search/" + avid, "Rapidgator-Group", linksTd, false);
            addSearchLinkAndOpenAllButton("Maddawg JAV", "https://maddawgjav.net/?s=" + avid, "Rapidgator-Group", linksTd, false);
            addSearchLinkAndOpenAllButton("BLOGJAV.NET (optional)", "https://blogjav.net/?s=" + avid, "", contentTd);
            addSearchLinkAndOpenAllButton(
                "JAVDAILY (optional)",
                `https://duckduckgo.com/?q=site:javdaily.eklablog.com+"${avid}"`,
                "",
                contentTd,
            );
            addSearchLinkAndOpenAllButton("JAVStore (optional)", "https://javstore.net/search?q=" + avid, "", contentTd);
        }

        // Google Drive
        if (GM_getValue("searchGroupGDrive", configurationOptions.searchGroups.searchGroupGDrive.default)) {
            const { actionTd, linksTd } = addGroupRow("GDrive:", "GDrive-Group");
            addGroupActionButton(actionTd, "Search All", "GDrive-Group", () => prefetchGroupResults("GDrive-Group"));
            addSearchLinkAndOpenAllButton("JAVGG", "https://javgg.me/?s=" + avid, "GDrive-Group", linksTd);
            addSearchLinkAndOpenAllButton("JAV GDRIVE", "https://javx357.com/?s=" + avid, "GDrive-Group", linksTd);
            if (GM_getValue("prefetchOnLoadGDrive", configurationOptions.prefetchOnLoad.prefetchOnLoadGDrive.default))
                prefetchGroupResults("GDrive-Group");
        }

        // Stream
        if (GM_getValue("searchGroupStream", configurationOptions.searchGroups.searchGroupStream.default)) {
            const { actionTd, linksTd } = addGroupRow("Stream:", "Stream-Group");
            addGroupActionButton(actionTd, "Search All", "Stream-Group", () => prefetchGroupResults("Stream-Group"));
            addSearchLinkAndOpenAllButton("HORNYJAV", "https://hornyjav.com/?s=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("TwoJAV", "https://www.twojav.com/en/search?q=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("JAV Most", "https://www.javmost.ws/search/" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("SEXTB", "https://sextb.net/search/" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("Jable", "https://jable.tv/search/" + avid + "/", "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("BIGO JAV", "https://bigojav.com/?s=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton(
                "HighPorn",
                "https://highporn.net/search/videos?search_query=" + avid,
                "Stream-Group",
                linksTd,
            );
            addSearchLinkAndOpenAllButton("BestJavPorn", "https://www.bestjavporn.com/search/" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("18AV", "https://18av.mm-cg.com/en/fc_search/all/" + avid + "/1.html", "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("JAVMENU", "https://javmenu.com/en/search?wd=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("Supjav", "https://supjav.com/?s=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("JAV Guru", "https://jav.guru/?s=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("AV01", "https://www.av01.media/en/search?q=" + avid, "Stream-Group", linksTd, false);
            addSearchLinkAndOpenAllButton("GGJAV", "https://ggjav.com/en/main/search?string=" + avid, "Stream-Group", linksTd);
            addSearchLinkAndOpenAllButton("123AV", "https://123av.com/en/search?keyword=" + avid, "Stream-Group", linksTd);

            if (GM_getValue("prefetchOnLoadStream", configurationOptions.prefetchOnLoad.prefetchOnLoadStream.default))
                prefetchGroupResults("Stream-Group");
        }

        // Alternative research platforms
        if (GM_getValue("searchGroupResearchPlatforms", configurationOptions.searchGroups.searchGroupResearchPlatforms.default)) {
            const { linksTd } = addGroupRow("Research:");
            addSearchLinkAndOpenAllButton("JAVBOOKS", "https://jjavbooks.com/en/" + avid, "", linksTd);
            addSearchLinkAndOpenAllButton("JavPlace", "https://jav.place/en?q=" + avid, "", linksTd);
        }

        // DuckDuckGo
        if (GM_getValue("searchGroupDuckDuckGo", configurationOptions.searchGroups.searchGroupDuckDuckGo.default)) {
            const { linksTd } = addGroupRow("DuckDuckGo:");
            addSearchLinkAndOpenAllButton(
                "Video Rapidgator Search",
                "https://duckduckgo.com/?kah=jp-jp&kl=jp-jp&kp=-2&q=" + encodeURIComponent(`"${avid}" "Rapidgator"`),
                "",
                linksTd,
            );
            addSearchLinkAndOpenAllButton(
                "Video Image Search",
                "https://duckduckgo.com/?kp=-2&iax=images&ia=images&q=" + '"' + avid + '"' + " JAV",
                "",
                linksTd,
            );
        }
    }

    function collectingLinksFromCommentsAndRgGroupButton() {
        const actionTd = document.querySelector("#video_search .search-group-actions.Rapidgator-Group");
        if (!actionTd) return;

        const button = document.createElement("button");
        button.textContent = "+ Comments";
        button.title = "Hotkey: < or \\";
        button.className = "smallbutton smallbutton-mod";
        button.onclick = collectingLinksFromCommentsAndRgGroup;
        actionTd.appendChild(button);
    }

    function colorizeScore() {
        const scoreEl = document.querySelector("#video_review .score");
        if (!scoreEl) return;

        const match = scoreEl.textContent.match(/[\d.]+/);
        if (!match) return;

        const score = parseFloat(match[0]);
        scoreEl.textContent = match[0];
        const color = score >= 8.0 ? "#22a861" : score >= 6.5 ? "#f59e0b" : "#ef4444";

        Object.assign(scoreEl.style, {
            color: "white",
            background: color,
            padding: "2px 8px",
            borderRadius: "3px",
        });
    }

    // Execute when button pressed with collecting comments for importing into Jdownloader
    async function collectingLinksFromCommentsAndRgGroup() {
        // press Open Rapidgator Group button
        document.querySelector("#video_search .search-group-actions.Rapidgator-Group button")?.click();

        // go to comments page, if not already there
        const allCommentsLink = document.querySelector("#video_comments_all > a");
        if (allCommentsLink) {
            // open link
            await GM_setValue("executingCollectingComments", true);
            window.open(allCommentsLink.href, "_self");
        } else if (document.querySelector("#rightcolumn > div.page_selector > a.page.last")) {
            // if already on comments page
            await GM_setValue("executingCollectingComments", true);
            location.reload();
        } else {
            copyLinksFromCommentsToClipboard();
        }
    }

    // Function to copy the contents of the #video_comments element to the clipboard
    // for collecting download links in apps like JDownloader
    function copyLinksFromCommentsToClipboard() {
        const commentsElement = document.querySelector("#video_comments");
        if (commentsElement) {
            const links = commentsElement.querySelectorAll("a");

            // collect href attributes of links in an array
            const commentsContent = Array.from(links)
                // allows to disable the collection of links from a hoster by using display: none
                // The !! converts link.offsetParent to a boolean value
                .filter((link) => !!link.offsetParent)
                // filter not usable
                .filter((link) => !link.href.match(/(\.gif|\.jpg|\.jpeg|user\.php|userposts\.php|ouo\.io)/i))
                .map((link) => link.href)
                .join("\n");

            GM_setClipboard(commentsContent);
        }
    }

    function addCastImagesSearchButtons() {
        const masterEnabled = GM_getValue("castButtonsEnabled", true);
        if (!masterEnabled) return;

        const castElements = document.querySelectorAll("[id^=cast]");
        for (let castElement of castElements) {
            // create a new div to wrap the cast element
            let containerDiv = document.createElement("div");
            containerDiv.className = "cast-container";
            castElement.parentNode.insertBefore(containerDiv, castElement);
            containerDiv.appendChild(castElement);

            // create a new div for image search buttons
            let imageSearchDiv = document.createElement("div");
            imageSearchDiv.className = "image-search";
            containerDiv.appendChild(imageSearchDiv);

            function addButton(text, link) {
                let a = document.createElement("a");
                a.target = "_blank";
                a.textContent = text;
                a.className = "customButton";
                let castName = castElement.querySelector("span.star > a").textContent;
                // reverse the order of names for better search results
                if (castName.split(" ").length === 2 && !link.includes("minnano")) {
                    castName = castName.split(" ").reverse().join(" ");
                }
                if (link && castName) {
                    if (link.includes("duckduckgo") || link.includes("yandex")) {
                        a.href = link + '"' + castName + '"';
                    } else {
                        a.href = link + castName;
                    }
                }

                imageSearchDiv.appendChild(a);
            }

            // Read button definitions from configurationOptions.castButtons
            for (let [key, buttonDef] of Object.entries(configurationOptions.castButtons)) {
                const enabled = GM_getValue(`castButton_${key}`, buttonDef.enabled);
                if (enabled) addButton(buttonDef.text, buttonDef.link);
            }
        }
    }

    function addCastSearchButton() {
        const configured = GM_getValue("castSearchButtonEnabled", configurationOptions.castSearchButtonEnabled.default);
        if (!configured) return;

        const castContainer = document.querySelector("#video_cast > table > tbody > tr > td.text");
        const span = document.createElement("span");
        span.className = "find-cast";
        castContainer.appendChild(span);

        function addButton(text, link, title = "") {
            const button = document.createElement("button");
            // const button = document.createElement("a");
            button.textContent = text;
            button.title = title;
            button.className = "smallbutton smallbutton-mod";
            // button.className = "customButton";
            button.style.width = "unset";
            button.onclick = function () {
                window.open(link, "_blank");
            };

            span.appendChild(button);
        }

        if (!avid) {
            log("[cast-search] no AVID");
            return;
        }

        addButton("Cast by Face", "https://xslist.org/en/searchByImage");
        addButton("Cast by Face 2", "https://www.av-search.online/", "Looks defect but works");
        addButton("Cast by Face 3", "https://ggjav.com/ja/main/recognize_pornstar");
        addButton("Cast by Scene", "https://avwikidb.com/en/work/" + avid);
    }

    function makeFavoriteCastVisible() {
        const favoriteClass = "favorite-star";

        function addFavoriteCastCss() {
            GM_addStyle(`
            span[class^="icn_fav"].favorite-star {
                background-image: url(${favoriteImage});
            }
            span[class^="icn_fav"] {
                background-image: url(${nonFavoriteImage});
                background-size: contain;
                background-position: unset;
                background-color: #252525;
                border-radius: 4px;
            }
        `);
        }

        function toggleFavoriteCast(event) {
            const element = event.target;
            const elementId = element.id;
            const isFavorite = element.classList.toggle(favoriteClass);

            // hide and auto close modal asking if cast should be added to favorites
            waitForElement("div.noty_bar.center.alert.default").then(() => {
                function addTemporaryCssRule() {
                    var styleElement = GM_addStyle(`
                    div.noty_bar.center.alert.default,
                    div.noty_modal
                    {
                        display: none !important;
                    }
                `);

                    // Remove the CSS after the specified duration
                    setTimeout(function () {
                        styleElement.parentNode.removeChild(styleElement);
                    }, 2000);
                }

                // Hide modal until we have clicked it away
                addTemporaryCssRule();

                // The "ok" and "close" buttons are always created immediately in the DOM and then adjusted afterwards.
                // This means that the decision as to what must be clicked does not work with the if clause.
                // close with ok
                let okButton = document.querySelector(
                    "div.noty_bar.center.alert.default > div.noty_message > div.noty_text > div.noty_buttons > button.button.green",
                );
                okButton?.click();
                // if not closed with ok, then with close button which can only be clicked after a delay
                setTimeout(() => {
                    let closeButton = document.querySelector("div.noty_bar.center.alert.default > div.noty_message > div.noty_close");
                    closeButton?.click();
                }, 1000);
            });

            if (isFavorite) {
                GM_setValue(elementId, true);
            } else {
                GM_deleteValue(elementId);
            }
        }

        addFavoriteCastCss();

        const starElements = document.querySelectorAll("[id^=star]");
        for (const element of starElements) {
            const elementId = element.id;
            const isFavoriteStar = GM_getValue(elementId, false);
            if (isFavoriteStar) {
                element.classList.add(favoriteClass);
            }
            element.addEventListener("click", toggleFavoriteCast);
        }
    }

    function setAdvertisingPhotosToFullSize() {
        const advertisingPreviewImageLinks = document.querySelectorAll("#rightcolumn > div.previewthumbs > a:not(.btn_videoplayer)");

        advertisingPreviewImageLinks.forEach((anchor) => {
            const img = anchor.querySelector("img");
            if (img) {
                img.src = anchor.href;
                img.removeAttribute("width");
                img.removeAttribute("height");

                // Move image element one level and delete anchor
                anchor.parentNode.insertBefore(img, anchor);
                anchor.remove();
            }
        });
    }

    function moveWatchStatus() {
        const videoWatchStatus = document.querySelector("#video_favorite_edit");
        const videoCover = document.querySelector("#video_jacket");

        if (!videoWatchStatus || !videoCover) {
            console.error("One or both elements not found");
            return;
        }

        // Insert videoWatchStatus directly after videoCover
        videoCover.appendChild(videoWatchStatus);
    }

    function displaySearchWaitTimer() {
        let countdownInterval = null;
        let remainingSeconds = 0;
        let infoBox = null;

        (function createInfoBox() {
            infoBox = document.createElement("div");
            infoBox.id = "custom-countdown-box";
            infoBox.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            display: none;
            min-width: 200px;
        `;
            document.body.appendChild(infoBox);
        })();

        (function setupObserver() {
            let isProcessing = false;
            let lastProcessedText = "";

            const observer = new MutationObserver(() => {
                if (isProcessing) return;

                const notificationElement = document.querySelector("body > div.noty_bar.center.alert.default > div > div.noty_text");

                if (notificationElement) {
                    const text = notificationElement.textContent || notificationElement.innerText;

                    // Prevent processing the same notification multiple times
                    if (text === lastProcessedText) return;

                    isProcessing = true;
                    lastProcessedText = text;

                    const match = text.match(/(\d+)\s*seconds/i);
                    const seconds = match ? parseInt(match[1], 10) : null;

                    if (seconds !== null) {
                        remainingSeconds = seconds;

                        if (countdownInterval) clearInterval(countdownInterval);

                        // Update display immediately
                        if (remainingSeconds > 0) {
                            infoBox.textContent = `Wait ${remainingSeconds} seconds before next search`;
                            infoBox.style.display = "block";
                            remainingSeconds--;
                        }

                        // Start countdown interval
                        countdownInterval = setInterval(() => {
                            if (remainingSeconds > 0) {
                                infoBox.textContent = `Wait ${remainingSeconds} seconds before next search`;
                                infoBox.style.display = "block";
                                remainingSeconds--;
                            } else {
                                infoBox.style.display = "none";
                                clearInterval(countdownInterval);
                                countdownInterval = null;
                                const submitButton = document.querySelector("#ui-accordion-accordion-panel-1 > div.center > input");
                                if (submitButton) {
                                    submitButton.click();
                                }
                            }
                        }, 1000);
                    }

                    // Reset processing flag after a short delay
                    setTimeout(() => {
                        isProcessing = false;
                    }, 100);
                } else {
                    // Reset when notification disappears
                    lastProcessedText = "";
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });

            log("[search] Search countdown observer initialized");
        })();
    }
}

// =======================================================================================
// Video Thumbnails
// =======================================================================================

function addVideoThumbnails() {
    const configured = GM_getValue("videoThumbnails", configurationOptions.videoThumbnails.default);
    if (!configured) return;

    function addThumbnailCss() {
        GM_addStyle(`
            #videoThumbnails {
                width: 100%;
                margin-top: 5px;
            }
            #videoThumbnails > img {
                width: 100%;
            }
            /* no preview info */
            #videoThumbnails > p {
                border-radius: 5px;
                border: 2px solid coral;
                padding: 10px;
                height: 90px;
                width: 280px;
                align-content: center;
                margin-top: 50px !important;
                text-align: center;
                margin: auto;
            }
            #videoThumbnails > p > small {
                font-size: 12px;
                color: #999999;
            }
            `);
    }

    async function getVideoThumbnailUrl() {
        // only in details view on javlibrary
        if (!isJavLibrary || !/[a-z]{2}\/jav.*/.test(url)) return;

        await getAvid();
        if (!avid) {
            log("[thumbs] no AVID");
            return;
        }

        function addVideoThumbnails(targetImageUrl) {
            if (document.querySelector("#videoThumbnails")) return;

            log("[thumbs] Image URL being displayed: " + targetImageUrl);
            const targetElement = document.querySelector("#video_jacket");

            if (targetElement) {
                let contentElement;

                if (targetImageUrl === null) {
                    contentElement = document.createElement("p");
                    contentElement.innerHTML = `No Video Thumbnails found<br><small>Please try "Search Thumbnails 1"</small>`;
                } else {
                    contentElement = document.createElement("img");
                    contentElement.src = targetImageUrl;
                }

                let container = document.createElement("div");
                container.id = "videoThumbnails";

                container.append(contentElement);
                targetElement.insertAdjacentElement("afterend", container);
            }
        }

        function isImageTallEnough(url) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img.naturalHeight >= 500);
                img.onerror = () => resolve(false);
                img.src = url;
            });
        }

        async function findThumbnails(avid) {
            const remoteSources = [
                { name: "JavStore", fetcher: getVideoThumbnailUrlFromJavStore },
                { name: "BlogJAV", fetcher: getVideoThumbnailUrlFromBlogjav },
                { name: "3xPlanet", fetcher: getVideoThumbnailUrlFrom3xPlanet },
            ];

            try {
                // JavLibrary is a local DOM lookup — check first without extra requests
                const javLibraryUrl = await getVideoThumbnailUrlFromJavLibrary(avid);
                if (javLibraryUrl) {
                    if (await isImageTallEnough(javLibraryUrl)) {
                        log("[thumbs] Image URL found on JavLibrary:", javLibraryUrl);
                        addVideoThumbnails(javLibraryUrl);
                        return;
                    }
                    log("[thumbs] Image from JavLibrary rejected: height < 500px");
                }
                log("[thumbs] No usable preview image found on JavLibrary");

                // Run remaining sources in parallel, pick first non-null in priority order
                const results = await Promise.all(remoteSources.map((s) => s.fetcher(avid).catch(() => null)));
                for (let i = 0; i < remoteSources.length; i++) {
                    if (results[i] && (await isImageTallEnough(results[i]))) {
                        log(`[thumbs] Image URL found on ${remoteSources[i].name}:`, results[i]);
                        addVideoThumbnails(results[i]);
                        return;
                    }
                    log(`[thumbs] No usable preview image found on ${remoteSources[i].name}`);
                }

                log("[thumbs] No preview image found from any source");
                addVideoThumbnails(null);
            } catch (error) {
                console.error("Error during thumbnail search:", error);
                addVideoThumbnails(null);
            }
        }

        findThumbnails(avid);
    }

    function normalizeImageUrl(url) {
        return url
            .replace("thumbs", "images")
            .replace("//t", "//img")
            .replace(/[\?*\"*]/g, "")
            .replace("/th/", "/i/");
    }

    // Get big preview image URL from JavLibrary
    async function getVideoThumbnailUrlFromJavLibrary(avid) {
        async function searchLinkOnJavLibrary(avid) {
            await waitForElement("#video_comments table.comment a > img", 0, 1000);
            let linkNodeList = document.querySelectorAll("a");
            let targetImageUrl;

            // find imagetwist page URL for direct page scraping
            const avidLower = avid.toLowerCase();
            let imageTwistPageUrl = [...linkNodeList]
                .reverse()
                .find((a) => a.href.toLowerCase().includes(avidLower) && a.href.includes("imagetwist.com"))?.href;
            // extract actual imagetwist URL from JavLibrary redirect wrapper
            if (imageTwistPageUrl) {
                const redirectMatch = imageTwistPageUrl.match(/[?&]url=([^&]+)/);
                if (redirectMatch) imageTwistPageUrl = decodeURIComponent(redirectMatch[1]);
            }

            // search in reverse order as the most recent comments are more likely to contain the correct image link and last one more relevant for VR videos
            for (let i = linkNodeList.length - 1; i >= 0; i--) {
                let linkNode = linkNodeList[i];
                if (
                    linkNode.href.includes("pixhost.to") ||
                    linkNode.href.includes("imagetwist.com") ||
                    linkNode.href.includes("imagehaha.com")
                ) {
                    targetImageUrl = linkNode.querySelector("img")?.src;
                    if (targetImageUrl) {
                        break;
                    }
                }
            }

            if (targetImageUrl) {
                targetImageUrl = normalizeImageUrl(targetImageUrl);
                if (/imagehaha/gi.test(targetImageUrl)) targetImageUrl = targetImageUrl.replace(".jpg", ".jpeg");
                if (/pixhost/gi.test(targetImageUrl))
                    targetImageUrl = targetImageUrl.replace(/\/t(\d+)\.pixhost\.to\//, "/img$1.pixhost.to/");

                const blobUrl = await fetchValidatedImage(targetImageUrl);
                if (blobUrl) return blobUrl;
            }

            // if thumbnail failed or missing, fetch ImageTwist page to extract the direct image URL
            if (imageTwistPageUrl) {
                const directUrl = await fetchImageUrlFromImageTwistPage(imageTwistPageUrl);
                if (directUrl) {
                    const blobUrl = await fetchValidatedImage(directUrl);
                    if (blobUrl) return blobUrl;
                }
            }

            return null;
        }

        async function fetchImageUrlFromImageTwistPage(pageUrl) {
            try {
                const result = await xmlhttpRequest(pageUrl);
                if (!result.isSuccess) return null;
                const match = result.responseText.match(/https?:\/\/[a-z]*\d+\.imagetwist\.com\/i\/\d+\/[^\s"'<>]+/i);
                return match ? match[0] : null;
            } catch (e) {
                return null;
            }
        }

        async function fetchValidatedImage(url) {
            try {
                const blob = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: url,
                        responseType: "blob",
                        onload: (response) => (response.status === 200 ? resolve(response.response) : reject()),
                        onerror: reject,
                    });
                });
                if (!blob || blob.size < 20 * 1024) return undefined;
                return URL.createObjectURL(blob);
            } catch (e) {
                return undefined;
            }
        }

        try {
            return (await searchLinkOnJavLibrary(avid)) ?? null;
        } catch (error) {
            console.error("Error fetching preview image URL from JAV Library:", error);
            return null;
        }
    }

    // Get big preview image URL from Blogjav
    async function getVideoThumbnailUrlFromBlogjav(avid) {
        async function searchLinkOnBlogjav(avid) {
            const searchUrl = `https://blogjav.net/?s=${avid}`;
            const result = await xmlhttpRequest(searchUrl);
            if (!result.isSuccess) {
                console.error("Connection error when searching on BlogJAV");
                return null;
            }
            return findLinkInDocument(result.responseText, avid, ".entry-title a", searchUrl);
        }

        async function fetchImageUrl(linkUrl) {
            const result = await xmlhttpRequest(linkUrl);
            if (!result.isSuccess) return null;
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const imageNodeList = doc.querySelectorAll(
                '.entry-content a img[data-src*="pixhost."], .entry-content a img[data-src*="imagetwist."]',
            );

            if (imageNodeList.length > 0) {
                let targetImageUrl = imageNodeList[imageNodeList.length - 1].dataset.src;
                targetImageUrl = normalizeImageUrl(targetImageUrl);
                if (/imagetwist/gi.test(targetImageUrl)) targetImageUrl = targetImageUrl.replace(".jpg", ".jpeg");

                // check if only a picture removed image is shown
                return xmlhttpRequest(targetImageUrl, targetImageUrl.replace(/^(https?:\/\/[^\/#&]+).*$/, "$1"))
                    .then((result) => {
                        if (result.isSuccess) {
                            const responseHeaders = result.responseHeaders;
                            const finalUrl = result.finalUrl;
                            const responseUrl = responseHeaders["Location"] || finalUrl; // if forwarding

                            if (
                                targetImageUrl.replace(/^https?:\/\//, "") === responseUrl.replace(/^https?:\/\//, "") ||
                                responseUrl.search(/removed.png/i) < 0
                            ) {
                                return targetImageUrl;
                            } else {
                                throw new Error('"Picture removed" placeholder');
                            }
                        } else {
                            throw new Error("Loading image URL");
                        }
                    })
                    .catch((error) => {
                        log("[thumbs] The image URL obtained from BlogJAV has been removed or failed to load: " + error.message);
                        return null;
                    });
            }
            return null;
        }

        try {
            let link = await searchLinkOnBlogjav(avid);
            if (link) {
                return await fetchImageUrl(link);
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching preview image URL from BlogJAV:", error);
            return null;
        }
    }

    // Get big preview image URL from JavStore
    async function getVideoThumbnailUrlFromJavStore(avid) {
        async function searchLink(avid) {
            const searchUrl = `https://javstore.net/search?q=${avid}`;
            const result = await xmlhttpRequest(searchUrl);
            if (!result.isSuccess) {
                console.error("Connection error when searching on JavStore");
                return null;
            }
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const avidSlug = avid.replace(/-/g, ""); // JavStore URLs omit the dash (e.g. "abc123" not "abc-123")
            const linkEl = doc.querySelector(`a[href*="${avidSlug}" i]`);
            if (!linkEl) return null;
            const href = linkEl.getAttribute("href");
            return href.startsWith("http") ? href : new URL(href, "https://javstore.net/").href;
        }

        async function fetchImageUrl(linkUrl) {
            const result = await xmlhttpRequest(linkUrl);
            if (!result.isSuccess) return null;
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const imageLink = doc.querySelector(`a[href*="img.javstore.net"][href*="${avid}_s.jpg" i]`);
            // .href resolves relative URLs against the current tab, not the fetched page — use getAttribute + URL constructor instead
            const rawHref = imageLink?.getAttribute("href");
            return rawHref ? new URL(rawHref, linkUrl).href : null;
        }

        try {
            const link = await searchLink(avid);
            if (link) {
                return await fetchImageUrl(link);
            }
            return null;
        } catch (error) {
            console.error("Error fetching preview image URL from JavStore:", error);
            return null;
        }
    }

    // Get big preview image URL from 3xPlanet
    async function getVideoThumbnailUrlFrom3xPlanet(avid) {
        async function searchLink(avid) {
            const searchUrl = `https://3xplanet.com/?s=${avid}`;
            const result = await xmlhttpRequest(searchUrl);
            if (!result.isSuccess) return null;
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const el = doc.querySelector(`a[href*="${avid}" i]`);
            if (!el) return null;
            // .href resolves relative URLs against the current tab, not the fetched page — use getAttribute + URL constructor instead
            const rawHref = el.getAttribute("href");
            return rawHref ? new URL(rawHref, searchUrl).href : null;
        }

        async function fetchImageUrl(linkUrl) {
            const result = await xmlhttpRequest(linkUrl);
            if (!result.isSuccess) return null;
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const thumbnailImg = doc.querySelectorAll(`img[alt^="${avid}" i]`);
            if (!thumbnailImg || thumbnailImg.length === 0) return null;

            const rawHref = thumbnailImg[thumbnailImg.length - 1].closest("a")?.getAttribute("href");
            const imagePageUrl = rawHref ? new URL(rawHref, linkUrl).href : null;

            if (!imagePageUrl) return null;

            const imagePageResult = await xmlhttpRequest(imagePageUrl);
            if (!imagePageResult.isSuccess) return null;
            const imagePageDoc = new DOMParser().parseFromString(imagePageResult.responseText, "text/html");
            return imagePageDoc.querySelector("#show_image")?.src ?? null;
        }

        try {
            const link = await searchLink(avid);
            if (link) {
                return await fetchImageUrl(link);
            }
            return null;
        } catch (error) {
            console.error("Error fetching preview image URL from 3xPlanet:", error);
            return null;
        }
    }

    function xmlhttpRequest(url, referer = "", timeout = null) {
        if (timeout === null) {
            timeout = getDataFetchTimeout();
        }

        return new Promise((resolve, reject) => {
            log(`[xhr] request: ${url}`);
            let details = {
                method: "GET",
                url: url,
                headers: {
                    Referer: referer,
                    "User-Agent": "Mozilla/5.0 (x64; rv) Gecko Firefox",
                },
                timeout: timeout,
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({
                            isSuccess: true,
                            responseHeaders: response.responseHeaders,
                            responseText: response.responseText,
                            finalUrl: response.finalUrl,
                            response,
                        });
                    } else {
                        resolve({ isSuccess: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                    }
                },
                onerror: function (response) {
                    log(`[xhr] ${details.url} : error`);
                    reject({ isSuccess: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                },
                ontimeout: function (response) {
                    log(`[xhr] ${details.url} ${details.timeout}ms timeout`);
                    reject({ isSuccess: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                },
            };
            GM_xmlhttpRequest(details);
        });
    }

    function findLinkInDocument(responseText, avid, selector, baseUrl) {
        let link = null;
        const doc = new DOMParser().parseFromString(responseText, "text/html");
        const linkElements = doc.querySelectorAll(selector);

        // check only the first 5 results
        for (let i = 0; i < linkElements.length && i < 5; i++) {
            // replace hyphens with optional hyphens
            const flexibleAvid = avid.replace(/-/g, "-?");
            // Matches AVID only if not preceded by a letter, preventing false positives for shorter AVIDs like SS-070
            const regexp = new RegExp(`(?<![a-zA-Z])${flexibleAvid}`, "gi");

            if (linkElements[i].innerHTML.search(regexp) > 0) {
                if (!link) link = linkElements[i];
                // prioritize the full HD version
                if (linkElements[i].innerHTML.search(/FHD/i) > 0) {
                    link = linkElements[i];
                    break;
                }
            }
        }

        if (!link) return null;
        // .href on a DOMParser element resolves relative URLs against the current tab's base URL, not the fetched page.
        // getAttribute gives the raw value; new URL() resolves it correctly against the actual source URL.
        const rawHref = link.getAttribute("href");
        return rawHref ? new URL(rawHref, baseUrl).href : null;
    }

    getVideoThumbnailUrl();
    addThumbnailCss();
}

// =======================================================================================
// Shared Modal Styles
// =======================================================================================

let _sharedModalStylesAdded = false;
function addSharedModalStyles() {
    if (_sharedModalStylesAdded) return;
    _sharedModalStylesAdded = true;
    GM_addStyle(`
        .modal-overlay {
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.32);
            z-index: 9998;
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            transition: opacity 0.25s ease;
        }
        .modal {
            font-family: system-ui, sans-serif;
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid rgba(0, 0, 0, 0.09);
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06);
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.25s ease, transform 0.25s ease;
            overflow: visible;
            display: flex;
            flex-direction: column;
            color: #1a202c;
        }
        .modal::before {
            content: '';
            position: absolute;
            inset: -12px;
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.75);
            z-index: -1;
            pointer-events: none;
        }
        .modal-header {
            padding: 13px 16px 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--accent, #667eea);
            border-radius: 12px 12px 0 0;
        }
        .modal-title {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: white;
        }
        .modal-close {
            background: rgba(0, 0, 0, 0.15);
            border: none;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            cursor: pointer;
            line-height: 1;
            padding: 4px 7px;
            border-radius: 5px;
            transition: all 0.15s ease;
        }
        .modal-close:hover {
            background: rgba(0, 0, 0, 0.25);
            color: white;
        }
        .modal-footer {
            padding: 11px 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.07);
            background: rgba(0, 0, 0, 0.02);
            border-radius: 0 0 12px 12px;
            display: flex;
            justify-content: center;
            gap: 8px;
        }
        @keyframes modalSlideIn {
            from { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
            to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes modalSlideOut {
            from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            to   { opacity: 0; transform: translate(-50%, -48%) scale(0.97); }
        }
        .modal.show { animation: modalSlideIn 0.25s ease forwards; }
        .modal.hide { animation: modalSlideOut 0.25s ease forwards; }
    `);
}

// =======================================================================================
// Configuration Menu
// =======================================================================================

function configurationMenu() {
    const addStyles = () => {
        addSharedModalStyles();
        GM_addStyle(`
            .modal { width: 510px; max-height: 90vh; }
            .modal-content {
                padding: 6px;
                overflow-y: auto;
                flex: 1;
            }
            .modal-content::-webkit-scrollbar { width: 4px; }
            .modal-content::-webkit-scrollbar-track { background: transparent; }
            .modal-content::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 10px; }
            .modal-content::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 1px;
                padding: 6px 10px;
                background: transparent;
                border-radius: 5px;
                transition: background 0.12s ease;
                cursor: pointer;
            }
            .checkbox-label:hover { background: rgba(0, 0, 0, 0.04); }
            .checkbox-label input[type="checkbox"] {
                margin: 0;
                flex-shrink: 0;
                width: 14px;
                height: 14px;
                cursor: pointer;
                accent-color: var(--accent, #667eea);
            }
            .checkbox-label span { font-size: 13px; color: #374151; user-select: none; }
            .buttons-section {
                margin-top: 6px;
                margin-bottom: 3px;
                padding: 4px 8px 8px;
                background: rgba(0, 0, 0, 0.02);
                border-radius: 6px;
            }
            .buttons-section.hidden { display: none; }
            .buttons-section h4 {
                margin: 0 0 6px 0;
                font-weight: 600;
                font-size: 10px;
                color: #9ca3af;
                letter-spacing: 0.8px;
                text-transform: uppercase;
            }
            .buttons-section .checkbox-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 2px;
            }
            .buttons-section .checkbox-label { margin-bottom: 0; padding: 4px 7px; font-size: 12px; }
            .input-label {
                display: flex;
                flex-direction: column;
                gap: 5px;
                margin-bottom: 1px;
                padding: 6px 10px;
                background: transparent;
                border-radius: 5px;
                transition: background 0.12s ease;
            }
            .input-label:hover { background: rgba(0, 0, 0, 0.03); }
            .input-label label { font-size: 12.5px; font-weight: 500; color: #6b7280; }
            .input-label input[type="number"] {
                padding: 5px 8px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
                background: white;
                color: #1a202c;
            }
            .input-label input[type="number"]:focus {
                outline: none;
                border-color: var(--accent, #667eea);
                box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #667eea) 18%, transparent);
            }
            .select-label {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 1px;
                padding: 6px 10px;
                background: transparent;
                border-radius: 5px;
                transition: background 0.12s ease;
            }
            .select-label:hover { background: rgba(0, 0, 0, 0.04); }
            .select-label label { font-size: 13px; font-weight: 500; color: #374151; }
            .custom-select-trigger {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 4px 9px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 13px;
                color: #374151;
                cursor: pointer;
                transition: all 0.15s ease;
                user-select: none;
                white-space: nowrap;
            }
            .custom-select-trigger:hover { background: #f9fafb; border-color: #9ca3af; }
            .custom-select-trigger.open { border-color: var(--accent, #667eea); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #667eea) 18%, transparent); }
            .custom-select-trigger svg { flex-shrink: 0; transition: transform 0.15s ease; }
            .custom-select-trigger.open svg { transform: rotate(180deg); }
            .custom-select-panel {
                position: fixed;
                z-index: 10000;
                min-width: 120px;
                background: white;
                border: 1px solid rgba(0, 0, 0, 0.1);
                border-radius: 6px;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
                padding: 3px;
                animation: selectFadeIn 0.12s ease forwards;
            }
            @keyframes selectFadeIn {
                from { opacity: 0; transform: translateY(-3px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .custom-select-option { padding: 6px 10px; font-size: 13px; color: #374151; border-radius: 4px; cursor: pointer; transition: background 0.1s ease; white-space: nowrap; }
            .custom-select-option:hover { background: color-mix(in srgb, var(--accent, #667eea) 8%, transparent); color: #1a202c; }
            .custom-select-option.selected { background: color-mix(in srgb, var(--accent, #667eea) 12%, transparent); color: var(--accent, #667eea); font-weight: 500; }
            .modal-footer button {
                padding: 7px 18px;
                font-size: 13px;
                font-weight: 500;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.15s ease;
                min-width: 120px;
            }
            .modal-footer button:first-child {
                background: white;
                color: #6b7280;
                border: 1px solid #d1d5db;
            }
            .modal-footer button:first-child:hover { background: #f9fafb; color: #374151; border-color: #9ca3af; }
            .modal-footer button:last-child {
                background: var(--btn-bg, #e8687a);
                color: white;
                border: none;
            }
            .modal-footer button:last-child:hover { background: var(--btn-bg-hover, #d0526a); }
            .modal-footer button:active { transform: translateY(1px); }
        `);
    };

    // ============ DOM CREATION ============
    const createOverlay = () => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.style.opacity = "0";
        setTimeout(() => {
            overlay.style.opacity = "1";
        }, 50);
        return overlay;
    };

    const createModal = () => {
        const modal = document.createElement("div");
        modal.className = "modal";
        setTimeout(() => {
            modal.classList.add("show");
        }, 50);
        return modal;
    };

    const createHeader = () => {
        const header = document.createElement("div");
        header.className = "modal-header";
        const title = document.createElement("h3");
        title.innerText = "Configuration Settings";
        title.className = "modal-title";
        const closeBtn = document.createElement("button");
        closeBtn.className = "modal-close";
        closeBtn.textContent = "✕";
        header.append(title, closeBtn);
        return { header, closeBtn };
    };

    // ============ ELEMENT BUILDERS ============
    const createCheckbox = (key, option) => {
        const label = document.createElement("label");
        label.className = "checkbox-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = GM_getValue(key, option.default);

        checkbox.addEventListener("change", () => {
            checkbox.checked === option.default ? GM_deleteValue(key) : GM_setValue(key, checkbox.checked);
            if (key === "improvements") updateDependentVisibility();
        });

        const span = document.createElement("span");
        span.textContent = option.label;

        label.append(checkbox, span);
        if (option.category) label.dataset.category = option.category;

        return { label, checkbox };
    };

    const createNumberInput = (key, option) => {
        const container = document.createElement("div");
        container.className = "input-label";

        const label = document.createElement("label");
        label.textContent = option.label;

        const input = document.createElement("input");
        input.type = "number";
        input.value = GM_getValue(key, option.default);

        input.addEventListener("change", () => {
            const value = input.value.trim();
            if (value === "") {
                GM_deleteValue(key);
                input.value = option.default;
            } else {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) GM_setValue(key, parsed);
            }
        });

        container.append(label, input);
        if (option.category) container.dataset.category = option.category;

        return container;
    };

    const createCustomSelect = (key, option) => {
        const container = document.createElement("div");
        container.className = "select-label";
        if (option.category) container.dataset.category = option.category;

        const label = document.createElement("label");
        label.textContent = option.label;

        let currentValue = GM_getValue(key, option.default);

        const trigger = document.createElement("div");
        trigger.className = "custom-select-trigger";

        const triggerText = document.createElement("span");
        triggerText.textContent = option.options[currentValue] ?? currentValue;

        const arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        arrowSvg.setAttribute("width", "10");
        arrowSvg.setAttribute("height", "10");
        arrowSvg.setAttribute("viewBox", "0 0 10 10");
        arrowSvg.setAttribute("fill", "none");
        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        arrowPath.setAttribute("points", "1,3 5,7 9,3");
        arrowPath.setAttribute("stroke", "#9ca3af");
        arrowPath.setAttribute("stroke-opacity", "1");
        arrowPath.setAttribute("stroke-width", "1.5");
        arrowPath.setAttribute("stroke-linecap", "round");
        arrowPath.setAttribute("stroke-linejoin", "round");
        arrowSvg.appendChild(arrowPath);
        trigger.append(triggerText, arrowSvg);

        let panel = null;

        const closePanel = () => {
            if (!panel) return;
            panel.remove();
            panel = null;
            trigger.classList.remove("open");
        };

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            if (panel) {
                closePanel();
                return;
            }

            trigger.classList.add("open");
            panel = document.createElement("div");
            panel.className = "custom-select-panel";

            Object.entries(option.options).forEach(([val, text]) => {
                const opt = document.createElement("div");
                opt.className = "custom-select-option" + (val === currentValue ? " selected" : "");
                opt.textContent = text;
                opt.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    currentValue = val;
                    triggerText.textContent = text;
                    val === option.default ? GM_deleteValue(key) : GM_setValue(key, val);
                    closePanel();
                });
                panel.appendChild(opt);
            });

            document.body.appendChild(panel);
            const rect = trigger.getBoundingClientRect();
            panel.style.left = rect.left + "px";
            panel.style.top = rect.bottom + 4 + "px";
            const pr = panel.getBoundingClientRect();
            if (pr.bottom > window.innerHeight - 8) panel.style.top = rect.top - pr.height - 4 + "px";

            setTimeout(() => document.addEventListener("click", closePanel, { once: true }), 0);
        });

        container.append(label, trigger);
        return container;
    };

    const createButtonsGrid = (entries, valuePrefix = "") => {
        const grid = document.createElement("div");
        grid.className = "checkbox-grid";

        entries.forEach(([itemKey, itemOption]) => {
            if (itemKey === "category") return;

            const label = document.createElement("label");
            label.className = "checkbox-label";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            const gmKey = valuePrefix ? `${valuePrefix}_${itemKey}` : itemKey;
            const defaultValue = itemOption.default ?? itemOption.enabled ?? false;
            checkbox.checked = GM_getValue(gmKey, defaultValue);

            checkbox.addEventListener("change", () => {
                checkbox.checked === defaultValue ? GM_deleteValue(gmKey) : GM_setValue(gmKey, checkbox.checked);
            });

            const span = document.createElement("span");
            span.textContent = itemOption.label || itemOption.text;

            label.append(checkbox, span);
            grid.appendChild(label);
        });

        return grid;
    };

    const createButtonsSection = (titleText, entries, valuePrefix, option) => {
        const section = document.createElement("div");
        section.className = "buttons-section";
        if (option?.category) section.dataset.category = option.category;
        const title = document.createElement("h4");
        title.textContent = titleText;
        section.appendChild(title);
        section.appendChild(createButtonsGrid(entries, valuePrefix));
        return section;
    };

    // ============ INITIALIZATION ============
    addStyles();

    const overlay = createOverlay();
    const modal = createModal();
    const { header, closeBtn } = createHeader();
    modal.appendChild(header);

    const content = document.createElement("div");
    content.className = "modal-content";

    let castButtonsEnabledCheckbox = null;
    let improvementsCheckbox = null;
    let updateCastButtonsVis = null;

    // ============ VISIBILITY MANAGEMENT ============
    const updateDependentVisibility = () => {
        const enabled = improvementsCheckbox ? improvementsCheckbox.checked : true;
        modal.querySelectorAll('[data-category="improvements"]').forEach((el) => {
            if (el.classList?.contains("buttons-section")) {
                el.classList.toggle("hidden", !enabled);
            } else {
                el.style.display = enabled ? "" : "none";
            }
        });
        // Update cast buttons visibility after general update (it has special two-condition logic)
        if (updateCastButtonsVis) updateCastButtonsVis();
    };

    // ============ BUILD CONTENT ============
    Object.entries(configurationOptions).forEach(([key, option]) => {
        if (typeof option.default === "boolean") {
            const { label, checkbox } = createCheckbox(key, option);
            content.appendChild(label);

            if (key === "castButtonsEnabled") castButtonsEnabledCheckbox = checkbox;
            if (key === "improvements") improvementsCheckbox = checkbox;
        } else if (typeof option.default === "number") {
            content.appendChild(createNumberInput(key, option));
        } else if (option.options) {
            content.appendChild(createCustomSelect(key, option));
        } else if (key === "searchGroups") {
            content.appendChild(createButtonsSection("Show Search Groups", Object.entries(option), "", option));
        } else if (key === "prefetchOnLoad") {
            const prefetchSection = createButtonsSection("Auto-prefetch on page load", Object.entries(option), "", option);
            const prefetchNote = document.createElement("p");
            prefetchNote.style.cssText = "margin:4px 0 0;font-size:0.8em;opacity:0.7;";
            prefetchNote.textContent = "⚠ Use with caution: May trigger rate limits, e.g. when opening many tabs at once.";
            prefetchSection.appendChild(prefetchNote);
            content.appendChild(prefetchSection);
        } else if (key === "castButtons") {
            const section = createButtonsSection("Show Cast Image Searches", Object.entries(option), "castButton", option);
            content.appendChild(section);

            // Update visibility based on dependencies
            updateCastButtonsVis = () => {
                const improvementsOn = improvementsCheckbox?.checked ?? true;
                const masterOn = castButtonsEnabledCheckbox?.checked ?? true;
                section.classList.toggle("hidden", !(improvementsOn && masterOn));
            };

            updateCastButtonsVis();
            if (castButtonsEnabledCheckbox) castButtonsEnabledCheckbox.addEventListener("change", updateCastButtonsVis);
            if (improvementsCheckbox) improvementsCheckbox.addEventListener("change", updateCastButtonsVis);
        }
    });

    modal.appendChild(content);
    updateDependentVisibility();

    // ============ BUTTONS ============
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "modal-footer";

    const resetButton = document.createElement("button");
    resetButton.innerText = "Reset to Defaults";
    resetButton.className = "smallbutton";
    resetButton.addEventListener("click", () => {
        Object.keys(configurationOptions).forEach((key) => {
            if (key !== "castButtons") GM_deleteValue(key);
        });
        if (configurationOptions.castButtons) {
            Object.keys(configurationOptions.castButtons).forEach((btnKey) => {
                GM_deleteValue(`castButton_${btnKey}`);
            });
        }
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
        location.reload();
    });

    const applyButton = document.createElement("button");
    applyButton.innerText = "Apply & Reload";
    applyButton.className = "smallbutton";
    applyButton.addEventListener("click", () => {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
        location.reload();
    });

    buttonsContainer.append(resetButton, applyButton);
    modal.appendChild(buttonsContainer);

    // ============ MOUNT & EVENTS ============
    document.body.append(overlay, modal);
    document.body.style.overflow = "hidden";
    const closeConfig = () => {
        overlay.style.opacity = "0";
        modal.classList.add("hide");
        document.removeEventListener("keydown", onKeyDown, true);
        setTimeout(() => {
            document.body.removeChild(overlay);
            document.body.removeChild(modal);
            document.body.style.overflow = "";
        }, 300);
    };
    const onKeyDown = (e) => {
        if (e.key === "Escape") closeConfig();
    };
    overlay.addEventListener("click", closeConfig);
    closeBtn.addEventListener("click", closeConfig);
    document.addEventListener("keydown", onKeyDown, true);
}

// =======================================================================================
// News/Information Notification
// =======================================================================================

function showNewsNotification() {
    const lastSeenNewsVersion = GM_getValue("lastSeenNewsVersion", null);
    if (lastSeenNewsVersion === NEWS_VERSION) return;

    addSharedModalStyles();
    GM_addStyle(`
        #news-bell {
            position: fixed;
            bottom: 80px; right: 24px;
            width: 40px; height: 40px;
            background: var(--accent, #667eea);
            color: white;
            border-radius: 50%;
            border: none;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            z-index: 9990;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        #news-bell:hover { transform: scale(1.1); box-shadow: 0 4px 16px rgba(0,0,0,0.25); }
        #news-bell svg { pointer-events: none; }
        .news-badge {
            position: absolute;
            top: 7px; right: 7px;
            width: 9px; height: 9px;
            background: #e53e3e;
            border-radius: 50%;
            border: 2px solid white;
            pointer-events: none;
        }
        #news-modal { width: 700px; max-height: 80vh; }
        .news-body {
            padding: 14px 16px;
            overflow-y: auto;
            flex: 1;
            font-size: 13.5px;
            color: #374151;
        }
        .news-body::-webkit-scrollbar { width: 4px; }
        .news-body::-webkit-scrollbar-track { background: transparent; }
        .news-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
        .news-body::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
        .news-entry + .news-entry { margin-top: 16px; border-top: 1px solid rgba(0,0,0,0.07); padding-top: 16px; }
        .news-date { font-size: 11px; color: #9ca3af; margin-bottom: 10px; letter-spacing: 0.3px; }
        .news-section-label { font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--accent, #667eea); margin: 12px 0 6px; }
        .news-list { margin: 0; padding-left: 16px; }
        .news-list li { margin-bottom: 6px; color: #374151; }
        .news-item-detail { display: none; font-size: 12px; color: #6b7280; margin-top: 3px; line-height: 1.45; }
        .news-item-detail.expanded { display: block; }
        .news-toggle { cursor: pointer; font-size: 11.5px; color: var(--accent, #667eea); user-select: none; margin-left: 4px; }
        .news-feedback { margin-top: 12px; padding: 9px 12px; background: color-mix(in srgb, var(--accent, #667eea) 7%, transparent); border-left: 3px solid var(--accent, #667eea); border-radius: 3px; font-size: 13px; color: #4a5568; }
        #news-modal .modal-footer button {
            padding: 7px 24px;
            background: var(--btn-bg, #e8687a);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: background 0.15s ease;
        }
        #news-modal .modal-footer button:hover { background: var(--btn-bg-hover, #d0526a); }
    `);

    const bell = document.createElement("div");
    bell.id = "news-bell";
    bell.title = "What's New in JAVLibrary Improvements UserScript";
    bell.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span class="news-badge"></span>
    `;

    let onNewsKeyDown = null;

    const dismissModal = () => {
        const overlay = document.getElementById("news-overlay");
        const modal = document.getElementById("news-modal");
        if (!modal) return;
        if (overlay) overlay.style.opacity = "0";
        modal.classList.add("hide");
        if (onNewsKeyDown) document.removeEventListener("keydown", onNewsKeyDown, true);
        setTimeout(() => {
            overlay?.remove();
            modal?.remove();
            document.body.style.overflow = "";
        }, 250);
    };
    const closeAll = async () => {
        await GM_setValue("lastSeenNewsVersion", NEWS_VERSION);
        bell.remove();
        dismissModal();
    };

    const openModal = () => {
        if (document.getElementById("news-modal")) return;
        onNewsKeyDown = (e) => {
            if (e.key === "Escape") dismissModal();
        };
        document.addEventListener("keydown", onNewsKeyDown, true);

        const overlay = document.createElement("div");
        overlay.id = "news-overlay";
        overlay.className = "modal-overlay";
        overlay.addEventListener("click", dismissModal);

        const modal = document.createElement("div");
        modal.id = "news-modal";
        modal.className = "modal";
        setTimeout(() => modal.classList.add("show"), 50);

        const header = document.createElement("div");
        header.className = "modal-header";
        const title = document.createElement("h3");
        title.className = "modal-title";
        title.innerHTML = `What's New<br><span style="font-size:13px;font-weight:400;opacity:0.8;">JAVLibrary Improvements UserScript</span>`;
        const closeBtn = document.createElement("button");
        closeBtn.className = "modal-close";
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", dismissModal);
        header.append(title, closeBtn);

        const body = document.createElement("div");
        body.className = "news-body";
        newsEntries.forEach(({ version, changes, feedback }) => {
            const entry = document.createElement("div");
            entry.className = "news-entry";

            const dDiv = document.createElement("div");
            dDiv.className = "news-date";
            dDiv.textContent = `${version.slice(0, 4)}-${version.slice(4, 6)}-${version.slice(6, 8)}`;
            entry.append(dDiv);

            const addSection = (label, items) => {
                if (!items?.length) return;
                const h = document.createElement("div");
                h.className = "news-section-label";
                h.textContent = label;
                const ul = document.createElement("ul");
                ul.className = "news-list";
                items.forEach((c) => {
                    const li = document.createElement("li");
                    if (typeof c === "object" && c.detail) {
                        const main = document.createElement("span");
                        main.textContent = c.text;
                        const toggle = document.createElement("span");
                        toggle.className = "news-toggle";
                        toggle.textContent = " ▸ details";
                        const detail = document.createElement("span");
                        detail.className = "news-item-detail";
                        detail.textContent = c.detail;
                        toggle.addEventListener("click", () => {
                            const expanded = detail.classList.toggle("expanded");
                            toggle.textContent = expanded ? " ▾ details" : " ▸ details";
                        });
                        li.append(main, toggle, detail);
                    } else {
                        li.textContent = typeof c === "object" ? c.text : c;
                    }
                    ul.appendChild(li);
                });
                entry.append(h, ul);
            };

            addSection("Changes", changes);

            if (feedback) {
                const fb = document.createElement("div");
                fb.className = "news-feedback";
                fb.append(feedback.text + " ");
                const a = document.createElement("a");
                a.href = feedback.url;
                a.textContent = feedback.url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                fb.appendChild(a);
                entry.appendChild(fb);
            }

            body.appendChild(entry);
        });

        const footer = document.createElement("div");
        footer.className = "modal-footer";
        const okBtn = document.createElement("button");
        okBtn.textContent = "Close & Hide Notification";
        okBtn.addEventListener("click", closeAll);
        footer.appendChild(okBtn);

        modal.append(header, body, footer);
        document.body.append(overlay, modal);
    };

    bell.addEventListener("click", openModal);
    document.body.appendChild(bell);
}

// =======================================================================================
// Config Icon
// =======================================================================================

function addConfigIcon() {
    if (!GM_getValue("configIcon", configurationOptions.configIcon.default)) return;

    GM_addStyle(`
        #config-icon {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 48px;
            height: 48px;
            background: #2d3748;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9990;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        #config-icon:hover {
            transform: scale(1.12);
            box-shadow: 0 6px 20px rgba(0,0,0,0.45);
        }
        #config-icon svg { pointer-events: none; }
    `);

    const icon = document.createElement("div");
    icon.id = "config-icon";
    icon.title = "Configuration (C)";
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

    icon.addEventListener("click", configurationMenu);
    document.body.appendChild(icon);
}

// =======================================================================================
// Main
// =======================================================================================

function initializeBeforeRender() {
    const configured = GM_getValue("improvements", configurationOptions.improvements.default);
    if (!configured) return;

    addImprovementsCss();

    switch (true) {
        // JAV Details
        case isJavLibrary && /[a-z]{2}\/jav.*/.test(url):
            // on low resolutions cover image get fixed size by site javascript
            removeResizingOfCoverImage();
            break;
    }
}

function main() {
    // do nothing if cloudflare check happens
    if (!document.title.includes("Just a moment...")) {
        // Cloudflare rate limit handling
        if (document.title.includes("Access denied")) {
            setTimeout(() => {
                location.reload();
            }, 10000);
        } else {
            if (isJavLibrary) initializeBeforeRender();

            const executeFunctions = () => {
                addImprovements();
                if (isJavLibrary) addVideoThumbnails();
            };

            setTimeout(executeFunctions, 100);
        }
    }
}

main();
// GM_setValue("authorsMode", true);
