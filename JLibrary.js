// ==UserScript==
// @name           JAVLibrary Improvements
// @description    Many improvements mainly in details view of a video: video thumbnails below cover (deactivatable through Configuration in Tampermonkeys extension menu), easier collect of Google Drive and Rapidgator links for JDownloader (hotkey <), save/show favorite actresses (since script installation), recherche links for actresses, auto reload on Cloudflare rate limit, save cover with actress names just by clicking, advertising photos in full size, remove redirects, layout improvements
// @version        20241016
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
// @match          *://missav.com/*
// @match          *://video-jav.net/*
// @match          *://www.akiba-online.com/search/*
// @connect        blogjav.net
// @connect        javstore.net
// @connect        pixhost.to
// @connect        imagetwist.com
// @connect        imagehaha.com
// @grant          GM_registerMenuCommand
// @grant          GM_xmlHttpRequest
// @grant          GM_download
// @grant          GM_setClipboard
// @grant          GM_getValue
// @grant          GM_setValue
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

let avidCopiedToClipboard = false;
const url = window.location.href;
const originalDocumentTitle = document.title;
let avid = null;
// allowed execution time of Collect Rapidgator Link & Thumbnails Search
const externalSearchModeTimeout = 8000;
// fetching of data from other websites
const externalSearchTimeout = 20000;
const configurationOptions = ["Improvements", "Video-Thumbnails"];

function getTitleElement() {
    return document.querySelector("#video_id > table > tbody > tr > td.text");
}
function getAvid() {
    if (!avid) {
        avid = getTitleElement()?.textContent;
    }
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
 * @see source: {@link https://stackoverflow.com/a/61511955/13427318}
 * @returns Element
 */
function waitForElement(selector, index = 0) {
    return new Promise((resolve) => {
        if (selector && document.querySelector(selector) && document.querySelectorAll(selector)[index]) {
            return resolve(document.querySelectorAll(selector)[index]);
        }

        const observer = new MutationObserver(() => {
            if (selector && document.querySelectorAll(selector) && document.querySelectorAll(selector)[index]) {
                resolve(document.querySelectorAll(selector)[index]);
                observer.disconnect();
            }
        });

        observer.observe(document, {
            childList: true,
            subtree: true,
        });
    });
}

GM_registerMenuCommand("Configuration", configurationMenu, "c");

// =======================================================================================
// Layout Improvements
// =======================================================================================

function addImprovementsCss() {
    GM_addStyle(`
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
    `);

    switch (true) {
        // JAV Details
        case /[a-z]{2}\/\?v=jav.*/.test(url): {
            GM_addStyle(`
                #toplogo .languagemenu {
                    top: 45px;
                }
                #video_title h3.post-title {
                    padding-right: 78px;
                    top: 30px;
                }
                
                #video_info {
                    min-width: 430px;
                    padding-right: 0 !important;
                }

                /* reduce height between sections */
                #video_info table {
                    margin-top: 6px !important;
                }
                
                /* disable strange hover */
                #video_info table,
                #video_info table:hover {
                    border-bottom: unset !important;
                }

                /* cast layout */
                /* remove unsed space */
                #video_info table > tbody > tr > td.icon {
                    display: none;
                }

                .added-links {
                    margin-left: 112px;
                    width: 370px;
                    height: 17px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                }
                .added-links-separator {
                    margin-top: 10px;
                }

                /* addSearchLinkAndOpenAllButton & addFaceRecognitionSearchToCasts */
                button.smallbutton-mod {
                    margin-left: 5px;
                    margin-top: 0;
                    margin-bottom: 0;
                    padding: 3px;
                    width: 160px;
                    height: 22px;
                    user-select = none;
                }

                /* preview video separated from advertising photos */
                a.btn_videoplayer {
                    display: block;
                    text-align: center;
                }

                #video_jacket {
                    text-align: left !important;
                }
                /* prevent video metadata from becoming too narrow */
                #video_jacket_info > tbody > tr > td:nth-child(2) {
                    min-width: 370px;
                    min-width: 550px;
                }

                @media screen and (min-width: 1571px) {
                    /* reduce FOUC for cover image */
                    img#video_jacket_img {
                        width: 800px;
                        object-fit: contain;
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

                /* addImageSearchToCasts */
                .cast-container {
                    display: flex;
                    flex-wrap: wrap;
                    margin: 0px 2px 2px;
                    border-radius: 5px;
                    /* 
                    background: rgb(243, 243, 243);
                    padding: 2px 3px;
                    */
                }
                span.cast {
                    display: flex;
                    flex-wrap: nowrap;
                    align-items: center;
                    margin-bottom: 0;
                    margin-right: 0;
                }
                .image-search {
                    display: flex;
                    flex-wrap: wrap;
                    align-content: flex-end;
                    padding: 0 3px;
                }
                .customButton {
                    font-size: 12px;
                    background-color: #f9f9f9;
                    padding-block: 2px;
                    padding-inline: 6px;
                    margin: 1px 1px 4px 0;
                    border-width: 1px;
                    border-style: solid;
                    border-color: #c9c9c9;
                    border-radius: 2px;
                    color: black;
                    transition: background-color 0.3s ease;
                    user-select: none;
                }
                .customButton:visited {
                    color: #aaa;
                }
                .customButton:hover {
                    background-color: #e0e0e0;
                }
            `);
            break;
        }
        // no video found
        case /\/vl_searchbyid.php/.test(url): {
            GM_addStyle(`
                .added-links {
                    margin-left: 107px;
                    height: 17px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    max-width: 400px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .added-links-separator {
                    margin-top: 10px;
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

    function handleSearchResults() {
        const selectors = [
            //default
            "[id^=post]",
            //jav.guru
            "#main div.row",
            //missjav.com
            "div.my-2.text-sm.text-nord4.truncate",
            //supjav.com
            ".post",
        ];

        let posts = [];

        for (let selector of selectors) {
            posts = document.querySelectorAll(selector);
            if (posts.length > 0) break;
        }

        if (posts[0]?.textContent.includes("404") || posts.length === 0) {
            if (document.title !== "Just a moment...") {
                window.close();
            }
        } else if (posts.length === 1) {
            const link = posts[0].querySelector("a");
            if (link && !link.href.includes("#")) {
                link.click();
            } else {
                window.close();
            }
        } else if (posts.length <= 30) {
            let openWindowCheck;
            posts.forEach((post, index) => {
                const link = post.querySelector("a");
                let title = post.textContent;

                const paramName = "s";
                let searchTerm = new URLSearchParams(window.location.search).get(paramName);
                if (!searchTerm) {
                    const url = window.location.href;
                    const searchPattern = /\/search\/([^\/]+)/;
                    searchTerm = url.match(searchPattern)[1];
                }

                if (link && title) {
                    const regex = new RegExp(`\\b${searchTerm}\\b`, "i");
                    if (regex.test(title)) {
                        setTimeout(() => {
                            openWindowCheck = GM_openInTab(link.href);
                        }, index * 100);
                    }
                }
            });

            if (openWindowCheck !== null) {
                setTimeout(() => window.close(), 1000);
            } else {
                console.log("window.open blocked");
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

    async function handleRapidgatorPages() {
        console.log("handleRapidgatorPages");

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
                        let onClickContent = link.getAttribute("onclick");
                        if (onClickContent) {
                            const match = onClickContent.match(/window\.open\s*\(\s*['"]([^'"]*)['"]/);
                            if (match) {
                                const url = match[1];
                                onClickContent = onClickContent.replace(/window\.open\s*\([^)]*\)/, `window.open('${url}', '_self')`);
                                link.setAttribute("onclick", onClickContent);
                                link.click();
                            } else {
                                window.open(link.href, "_self");
                            }
                        }
                    }
                }
            }
        } else {
            const link = document.querySelector("a[href*=rapidgator]");
            if (link) {
                console.log("handle details pages to get rapidgator links");
                window.open(link.href, "_self");

                setTimeout(() => {
                    link.click();
                    setTimeout(() => window.close(), 1000);
                }, 100);
            } else {
                window.close();
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
            case ["jav.guru", "supjav.com", "missav.com"].includes(hostname):
                handleRapidgatorPages();
                break;
        }
    }

    runSearch();
}

// =======================================================================================
// General Improvements
// =======================================================================================

async function addImprovements() {
    (async function () {
        const configured = await GM_getValue("Improvements", true);
        if (!configured) return;

        getAvid();

        switch (true) {
            // JAV Details
            case /[a-z]{2}\/\?v=jav.*/.test(url): {
                console.log("JAV Details");

                if (!avid) {
                    console.log("addImprovements details: no AVID");
                    return;
                }

                // add title textbox
                addTitleCopyPerClick();

                // adds posibility for local search but disabled by default as needs addinal scripts
                addLocalSearchButton();

                // add search links
                setSearchLinks();

                // increase advertising previews
                setAdvertisingPhotosToFullSize();

                // add Cover Image Download button
                coverImageDownload();

                // remove link by converting <a> to <span> element
                removeLinkInTitle();

                // adds buttons to search for more informations about a cast
                addCastImagesSearchButtons();

                // button for facial recognition
                addFaceRecognitionSearchButton();

                // executes collecting all links from comments and opens rapidgator group
                collectingLinksFromCommentsAndRgGroupButton();

                // adds own svg to make favorite cast visible
                makeFavoriteCastVisible();

                // remove redirects for external links
                setTimeout(() => {
                    removeRedirects();
                }, 500);

                // TODO: needs a more solid solution than just a blind timeout
                // maybe possible with GM_openInTab
                let externalSearchMode = await GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    setTimeout(async () => {
                        GM_setValue("externalSearchMode", false);
                        console.log("externalSearchMode off");
                    }, externalSearchModeTimeout);
                }

                // autorun local search
                const authorsMode = await GM_getValue("authorsMode", false);
                if (authorsMode) {
                    (function () {
                        // Handle the case when the window is opened in the background
                        window.addEventListener("focus", function () {
                            executeInitialLocalSearch("EventListener");
                        });
                        // Handle the case when the window is opened in the foreground
                        // IntersectionObserver is used for better performance and reliability
                        // compared to repeated DOM queries or fixed timeouts
                        const observer = new IntersectionObserver((entries) => {
                            entries.forEach((entry) => {
                                if (entry.isIntersecting) {
                                    executeInitialLocalSearch("IntersectionObserver");
                                }
                            });
                        });
                        // Set up the observer after a short delay to ensure DOM is loaded
                        setTimeout(() => {
                            const textElement = getTitleElement();
                            if (textElement) {
                                observer.observe(textElement);
                            }
                        }, 500);
                    })();
                }

                window.addEventListener("keydown", function (event) {
                    if (event.key === "<") {
                        collectingLinksFromCommentsAndRgGroup();
                    }
                });
                break;
            }
            // Redirect Page
            case /\/redirect.php/.test(url): {
                document.querySelector("#ckbSkipURLWarning").click();
                document.querySelector("#redirection").click();
                break;
            }
            // Video Star Listings
            case /\/vl_star.php/.test(url): {
                console.log("Video Star Listings");

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
            // Search Page
            case /\/search.php/.test(url): {
                console.log("Advanced Search Section");

                // open Combination Search
                // document.querySelector("#ui-accordion-accordion-header-1 > span")?.click();
                break;
            }
            // if video is not in JAVLibrary
            case /\/vl_searchbyid.php/.test(url): {
                if (
                    (document.querySelector("#rightcolumn > p > em") || document.querySelector("#badalert")) &&
                    document.querySelector("#rightcolumn > div.titlebox")
                ) {
                    console.log("no search results");

                    avid = new URLSearchParams(window.location.search).get("keyword");
                    if (avid) {
                        setSearchLinks();
                    }
                }

                // open found links in same tab
                document.querySelectorAll(".video > a")?.forEach(function (element) {
                    element.removeAttribute("target");
                });
                break;
            }
            case /\/videocomments.php/.test(url): {
                console.log("Comments Page");

                async function loadNextPage() {
                    copyLinksFromCommentsToClipboard(); // Copy the comments content before loading the next page

                    let currentPage = new URL(window.location.href).searchParams.get("page");
                    let lastPageUrl = document.querySelector("#rightcolumn > div.page_selector > a.page.last")?.href;
                    let lastPage = await GM_getValue("lastPage", null);

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
                            console.log(mainPageLink);
                            if (mainPageLink) {
                                // open link
                                window.open(mainPageLink.href, "_self");
                            }
                        }
                    }
                }

                // initialize
                (async function () {
                    let executingCollectingComments = await GM_getValue("executingCollectingComments", false);
                    if (executingCollectingComments) {
                        // await new Promise((resolve) => setTimeout(resolve, 1000));
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
            // batch external download link and preview searches
            case /^https?:\/\/javx357\.com\/.*/i.test(url):
            case /^https?:\/\/arcjav\.com\/.*/i.test(url):
            case /^https?:\/\/javgg\.me\/.*/i.test(url):
            case /^https?:\/\/maxjav\.com\/.*/i.test(url):
            case /^https?:\/\/jav\.guru\/.*/i.test(url):
            case /^https?:\/\/supjav\.com\/.*/i.test(url):
            case /^https?:\/\/missav\.com\/.*/i.test(url):
            case /^https?:\/\/video-jav\.net\/.*/i.test(url):
            case /^https?:\/\/javakiba\.org\/.*/i.test(url): {
                let externalSearchMode = await GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    externalSearch();
                }
                break;
            }
            // copy GDrive & Rapidgator links into clipboard for JDownloader Linkgrabber and auto close
            case /^https:\/\/drive\.google\.com\/uc.*/i.test(url):
            case /^https:\/\/drive\.google\.com\/file\/.*/i.test(url):
            case /^https:\/\/rapidgator\.net\/.*/i.test(url): {
                let externalSearchMode = await GM_getValue("externalSearchMode", false);
                if (externalSearchMode) {
                    const urls = ["https://drive.google.com", "https://rapidgator.net/file/*"];
                    const currentUrl = window.location.href;
                    const match = urls.some((url) => currentUrl.match(url));

                    if (match) {
                        // Clipboard operation and window close function
                        function copyToClipboardAndClose() {
                            // (clipboard needs focus else gone)
                            // navigator.clipboard.writeText(location.href);
                            GM_setClipboard(location.href);
                            setTimeout(() => {
                                window.close();
                            }, 100);
                        }

                        copyToClipboardAndClose();
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
                                "#top > div.p-body > div > div.uix_contentWrapper > div > div > div > form > div > dl > dd > div > div.formSubmitRow-controls > button"
                            )
                            .click();

                        // close window if no result
                        setTimeout(() => {
                            if (document.querySelector("body > div.flashMessage.is-active > div").textContent === "No results found.") {
                                window.close();
                            }
                        }, 200);
                    }
                }

                function autoOpenResults() {
                    let posts = document.querySelectorAll("div.block-container > ol > li");
                    const paramName = "q";
                    const searchTerm = new URLSearchParams(window.location.search).get(paramName);

                    if (posts.length === 1) {
                        let post = posts[0];
                        let childLink = post.querySelector("a");
                        let postTitle = post.querySelector("h3 a");

                        if (postTitle && searchTerm && postTitle.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                            childLink?.click();
                        }
                        setTimeout(function () {
                            window.close();
                        }, 500);
                    } else if (posts.length >= 2) {
                        let postTitle = document.querySelectorAll("div.block-container > ol > li h3 a");

                        // Results with the Filejoker badge are usually the best result, so others can be ignored
                        let fileJokerExclusive = document.querySelector("div.block-container > ol > li span.label--royalBlue");
                        if (
                            fileJokerExclusive &&
                            searchTerm &&
                            fileJokerExclusive.parentElement.textContent.toLowerCase().includes(searchTerm.toLowerCase())
                        ) {
                            fileJokerExclusive.parentElement?.click();
                            return;
                        }

                        for (let i = 0; i < postTitle.length; i++) {
                            let title = postTitle[i];

                            if (searchTerm && !title.textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                                title.parentElement.parentElement.parentElement.parentElement.style.display = "none";
                            } else {
                                window.open(title.href, "_blank");
                            }
                        }
                        setTimeout(function () {
                            window.close();
                        }, 500);
                    }
                }

                let externalSearchMode = await GM_getValue("externalSearchMode", false);
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
        }
    })();

    function removeRedirects() {
        let externalLinks = document.querySelectorAll(
            "table[id^=comment] > tbody > tr:nth-child(1) > td.t > div a[href^='redirect.php']"
        );
        for (let externalLink of externalLinks) {
            externalLink.href = decodeURIComponent(
                externalLink.href?.replace(/https:\/\/www\.javlibrary\.com\/.*\/redirect\.php\?url=/, "").replace(/\&ver=.*/, "")
            );
        }
    }

    function removeLinkInTitle() {
        let linkElement = document.querySelector("#video_title > h3 > a");

        if (linkElement) {
            let spanElement = document.createElement("span");
            spanElement.innerHTML = linkElement.innerHTML;
            linkElement.insertAdjacentElement("beforebegin", spanElement);
            linkElement.parentNode.removeChild(linkElement);
        }
    }

    function addTitleCopyPerClick() {
        let titleElement = getTitleElement();

        titleElement.style.cursor = "pointer";
        titleElement.addEventListener("click", function () {
            copyTitleToClipboard();
        });
    }

    function executeInitialLocalSearch(source) {
        const textElement = getTitleElement();

        if (textElement && !avidCopiedToClipboard && document.hasFocus()) {
            // only put once to clipboard
            console.log(`${source}: ${avid}`);

            // if tab was opened with link
            if (history.length === 1) {
                copyTitleToClipboard(avid)
                    .then(() => {
                        avidCopiedToClipboard = true;
                        runLocalSearch();
                    })
                    .catch(function (err) {
                        console.error("Failed to copy text: ", err);
                        avidCopiedToClipboard = false;
                    });
            }
        }
    }

    /**
     * requires a local script such as AHK, which recognizes the window title
     * as information for the execution of another local script
     * Button and auto execute disabled if GM variable privateMode is not set
     */
    async function addLocalSearchButton() {
        const authorsMode = await GM_getValue("authorsMode", false);

        if (authorsMode) {
            let targetElement = getTitleElement();

            let newButton = document.createElement("button");
            newButton.textContent = "Local-Search";
            newButton.className = "smallbutton localsearch";
            newButton.style = "position:relative;top:-3px;margin-left:10px";

            targetElement.insertAdjacentElement("afterend", newButton);

            newButton.addEventListener(
                "click",
                function () {
                    copyTitleToClipboard().then(() => {
                        runLocalSearch();
                    });
                },
                false
            );
        }
    }

    function runLocalSearch() {
        // not on image videos
        if (!document.querySelector("#genre199")) {
            document.title = "Browser Local-Search";
            setTimeout(() => {
                document.title = originalDocumentTitle;
            }, 50);
        }
    }

    function copyTitleToClipboard() {
        return navigator.clipboard.writeText(avid);
    }

    function coverImageDownload() {
        // big preview screen shots
        const screenShots = document.querySelectorAll("#rightcolumn > div.previewthumbs > img");
        for (let img of screenShots) {
            srcBigPictures = img.src.replace(/(.*)(-[0-9].*)$/i, "$1jp$2");
            img.src = srcBigPictures;
        }

        // rename cover image
        let casts = document.querySelectorAll("[id^=cast] > span.star > a");
        let newFilename = avid + " - ";
        let iteration = casts.length;
        for (let cast of casts) {
            // also replace non-ASCII characters
            newFilename += cast.textContent.replace(/[^\x00-\x7F]/g, "");

            // do as long not last iteration
            if (--iteration) newFilename += ", ";
        }

        const coverPicture = document.querySelector("#video_jacket_img");
        const coverPictureUrl = coverPicture?.src;

        coverPicture?.addEventListener(
            "click",
            function () {
                GM_download({
                    url: coverPictureUrl,
                    headers: { referer: coverPictureUrl, origin: coverPictureUrl },
                    name: newFilename,
                    onload: function (download) {
                        // Create an invisible <a> element
                        const downloadLink = document.createElement("a");

                        // Set the Blob URL as the HREF value and the filename for download
                        downloadLink.setAttribute("download", newFilename);

                        // Trigger the click event on the invisible <a> element
                        downloadLink.click();
                    },
                    onerror: function (error) {
                        console.error("Download failed:", error);
                    },
                });
            },
            {
                once: true,
            }
        );
    }

    function setSearchLinks() {
        // add search links and buttons
        addSearchLinkAndOpenAllButton(
            "DuckDuckGo Screens",
            "https://duckduckgo.com/?kp=-2&iax=images&ia=images&q=" + '"' + avid + '"' + " JAV",
            ""
        );
        addSearchLinkAndOpenAllButton("DuckDuckGo", "https://duckduckgo.com/?kp=-2&q=" + '"' + avid + '"' + " JAV", "", true);

        addSearchLinkAndOpenAllButton("JavPlace | alternative research platform", "https://jav.place/en?q=" + avid, "");
        addSearchLinkAndOpenAllButton("JAV-Menu | alternative research platform", "https://jjavbooks.com/en/" + avid, "", true);

        addSearchLinkAndOpenAllButton("JAV BIGO | Stream", "https://javbigo.com/?s=" + avid, "Open-Stream-Group");
        addSearchLinkAndOpenAllButton("Jable | Stream", "https://jable.tv/search/" + avid + "/", "Open-Stream-Group");
        addSearchLinkAndOpenAllButton("MDTAIWAN | Stream", "https://mdtaiwan.com/?s=" + avid, "Open-Stream-Group");
        addSearchLinkAndOpenAllButton("JAV Most | Stream", "https://www5.javmost.com/search/" + avid, "Open-Stream-Group");
        addSearchLinkAndOpenAllButton("HORNYJAV | Stream", "https://hornyjav.com/?s=" + avid, "Open-Stream-Group", true);

        addSearchLinkAndOpenAllButton("JAV GDRIVE | Google Drive", "https://javx357.com/?s=" + avid, "Open-GDrive-Group");
        addSearchLinkAndOpenAllButton("Arc JAV | Google Drive", "https://arcjav.com/?s=" + avid, "Open-GDrive-Group");
        addSearchLinkAndOpenAllButton("JAVGG | Google Drive", "https://javgg.me/?s=" + avid, "Open-GDrive-Group", true);

        // addSearchLinkAndOpenAllButton(
        //     "JAVDAILY | RG  (optional)",
        //     `https://duckduckgo.com/?q=site:javdaily.eklablog.com+${avid}`,
        //     ""
        // );
        // addSearchLinkAndOpenAllButton(
        //     "JAVDAILY | RG  (optional)",
        //     `https://duckduckgo.com/?q=site:javdaily31.eklablog.com+${avid}`,
        //     ""
        // );
        addSearchLinkAndOpenAllButton("JAVDAILY | RG  (optional)", "https://javdaily31.blogspot.com/search?q=" + avid, "");
        addSearchLinkAndOpenAllButton("BLOGJAV.NET | RG (optional)", "https://blogjav.net/?s=" + avid, "", true);

        addSearchLinkAndOpenAllButton("MissAV | RG | Stream", "https://missav.com/en/search/" + avid, "Collect-Rapidgator-Links");
        addSearchLinkAndOpenAllButton("Supjav | RG", "https://supjav.com/?s=" + avid, "Collect-Rapidgator-Links");
        addSearchLinkAndOpenAllButton("JAV Guru | RG | Stream", "https://jav.guru/?s=" + avid, "Collect-Rapidgator-Links", true);

        addSearchLinkAndOpenAllButton("3xPlanet | Thumbnails", "https://3xplanet.com/?s=" + avid, "Search-Thumbnails-2");
        addSearchLinkAndOpenAllButton("JAVAkiba | Thumbnails", "https://javakiba.org/?s=" + avid, "Search-Thumbnails-2");
        addSearchLinkAndOpenAllButton("Video-JAV | Thumbnails", "http://video-jav.net/?s=" + avid, "Search-Thumbnails-2", true);

        addSearchLinkAndOpenAllButton("JAV Max Quality | Thumbnails", "https://maxjav.com/?s=" + avid, "Search-Thumbnails-1");
        addSearchLinkAndOpenAllButton(
            "Akiba-Online | Thumbnails",
            "https://www.akiba-online.com/search/?q=" + avid + "&c%5Btitle_only%5D=1&o=date&search=" + avid,
            "Search-Thumbnails-1",
            true
        );

        addSearchLinkAndOpenAllButton("Torrent-Search", "https://bt4gprx.com/search?q=" + avid + "&orderby=size", "", true);
    }

    /**
     * Adds a search links and open all links buttons
     *
     * @param {*} name Name
     * @param {*} href URL
     * @param {*} separator Adds a space on top
     * @param {*} className Adds a class
     */
    function addSearchLinkAndOpenAllButton(name, href, className, separator = false) {
        // styles in addCSS

        if (separator) {
            separator = "added-links-separator";
        }
        if (className === "") className = undefined;

        // after the casting container or "search tips" if the search does not return any results
        let existingContainer = castContainer() || document.querySelector("#rightcolumn > div.titlebox");
        let newElementContainer = document.createElement("div");
        newElementContainer.classList.add("added-links");
        newElementContainer.classList.add(separator);
        newElementContainer.classList.add(className);

        let newElement = document.createElement("a");
        newElement.href = href;
        newElement.textContent = name;
        newElementContainer.appendChild(newElement);

        // add open all links buttons
        if (separator && className) {
            const openAllButton = document.createElement("button");
            const buttonTitle = className.replace(/-/g, " ");

            openAllButton.textContent = buttonTitle;
            openAllButton.className = "smallbutton smallbutton-mod";

            openAllButton.addEventListener("click", function () {
                let linksToOpen = document.querySelectorAll(`.${className}.added-links a`);
                let reversedLinks = Array.from(linksToOpen).reverse();

                // allow batch search on external sites
                GM_setValue("externalSearchMode", true);

                // TODO: needs a more solid solution without brute force
                setTimeout(async () => {
                    GM_setValue("externalSearchMode", false);
                    console.log("externalSearchMode off");
                }, externalSearchModeTimeout + 2000);

                // open in background tabs
                if (className === "Collect-Rapidgator-Links") {
                    reversedLinks.forEach(function (link) {
                        GM_openInTab(link.href);
                    });
                } else {
                    reversedLinks.forEach(function (link) {
                        window.open(link.href);
                    });
                }
            });

            newElementContainer.appendChild(openAllButton);
        }

        existingContainer.insertAdjacentElement("afterend", newElementContainer);
    }

    function collectingLinksFromCommentsAndRgGroupButton() {
        const target = document.querySelector("#video_info > div.added-links.added-links-separator.Collect-Rapidgator-Links ~ div");

        function addButton(text, action) {
            let button = document.createElement("button");
            button.textContent = text;
            button.title = "Hotkey <";
            button.className = "smallbutton smallbutton-mod";
            button.style = "position: relative; top: 7px;";
            button.onclick = function () {
                action();
            };

            target.appendChild(button);
        }

        addButton("+ Links from Comments", collectingLinksFromCommentsAndRgGroup);
    }

    // Execute when button pressed with collecting comments for importing into Jdownloader
    function collectingLinksFromCommentsAndRgGroup() {
        // press Open Rapidgator Group button
        document.querySelector("#video_info > div.added-links.added-links-separator.Collect-Rapidgator-Links > button")?.click();

        // go to comments page, if not already there
        const allCommentsLink = document.querySelector("#video_comments_all > a");
        if (allCommentsLink) {
            // open link
            GM_setValue("executingCollectingComments", true);
            setTimeout(() => {
                window.open(allCommentsLink.href, "_self");
            }, 200);
        } else if (document.querySelector("#rightcolumn > div.page_selector > a.page.last")) {
            // if already on comments page
            GM_setValue("executingCollectingComments", true);
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
        let castElements = document.querySelectorAll("[id^=cast]");
        castElements.forEach(function (castElement) {
            // create a new div to wrap the cast element
            let containerDiv = document.createElement("div");
            // containerDiv.className = castElement.id;
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

            addButton("XsList", "https://duckduckgo.com/?iar=images&iax=images&ia=images&q=site:xslist.org ");
            addButton("Yandex", "https://yandex.com/images/search?text=");
            addButton("AVDBS", "https://www.avdbs.com/menu/search.php?seq=42978591&tab=1&kwd=");
            addButton("V2PH", "https://www.v2ph.com/search/?q=");
            addButton("JJGirls", "https://jjgirls.com/match.php?model=");
            addButton("KawaiiThong", "https://kawaiithong.com/search_kawaii_pics/");
            // addButton("BeautiMetas", "https://en.beautifulmetas.com/search_result/");
            addButton("Minnano", "https://www.minnano-av.com/search_result.php?search_scope=actress&search_word=");
        });
    }

    function addFaceRecognitionSearchButton() {
        const castContainer = document.querySelector("#video_cast > table > tbody > tr > td.text");

        function addButton(text, link) {
            let button = document.createElement("button");
            button.textContent = text;
            button.className = "smallbutton smallbutton-mod";
            button.style = "width: unset";
            button.onclick = function () {
                window.open(link, "_blank");
            };

            let span = document.createElement("span");
            span.style = "display: block; margin-top: 5px";
            span.appendChild(button);

            castContainer.appendChild(span);
        }

        addButton("Find cast with facial recognition", "https://xslist.org/en/searchByImage");
    }

    async function makeFavoriteCastVisible() {
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
                margin-left: 4px;
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
                    "div.noty_bar.center.alert.default > div.noty_message > div.noty_text > div.noty_buttons > button.button.green"
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
            const isFavoriteStar = await GM_getValue(elementId, false);
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
                anchor.href;
            }
        });
    }
}

// =======================================================================================
// Video Thumbnails
// =======================================================================================

async function addVideoThumbnails() {
    const configured = await GM_getValue("Video-Thumbnails", true);
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
            `);
    }

    function getVideoThumbnailUrl() {
        // only in details view
        if (!/[a-z]{2}\/\?v=jav.*/.test(url)) return;

        getAvid();
        if (!avid) {
            console.log("getVideoThumbnailUrl: no AVID");
            return;
        }

        function addVideoThumbnails(targetImageUrl) {
            if (document.querySelector("#videoThumbnails")) return;

            console.log("Image URL being displayed: " + targetImageUrl);
            const targetElement = document.querySelector("#video_jacket");

            if (targetElement) {
                let contentElement;

                if (targetImageUrl === null) {
                    contentElement = document.createElement("p");
                    contentElement.innerText = "No Video Thumbnails found";
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

        
        async function findThumbnails(avid) {
            const sources = [
                { name: "JavLibrary", fetcher: getVideoThumbnailUrlFromJavLibrary },
                { name: "BlogJAV", fetcher: getVideoThumbnailUrlFromBlogjav },
                { name: "JavStore", fetcher: getVideoThumbnailUrlFromJavStore },
            ];

            const searches = sources.map((source) =>
                source.fetcher(avid).then((imageUrl) => {
                    if (imageUrl) {
                        console.log(`Image URL found on ${source.name}: ${imageUrl}`);
                        return { source: source.name, imageUrl };
                    }
                    console.log(`No usable preview image found on ${source.name}`);
                    return null;
                })
            );

            try {
                let foundImage = false;
                await Promise.all(
                    searches.map((searchPromise) =>
                        searchPromise.then((result) => {
                            if (result && !foundImage) {
                                foundImage = true;
                                addVideoThumbnails(result.imageUrl);
                            }
                        })
                    )
                );

                if (!foundImage) {
                    console.log("No preview image found from any source");
                    addVideoThumbnails(null);
                }
            } catch (error) {
                console.error("Error during thumbnail search:", error);
                addVideoThumbnails(null);
            }
        }

        findThumbnails(avid);
    }

    // Get big preview image URL from JavLibrary
    async function getVideoThumbnailUrlFromJavLibrary(avid) {
        async function searchLinkOnJavLibrary(avid) {
            let linkNodeList = document.querySelectorAll("a");
            let targetImageUrl;

            for (let linkNode of linkNodeList) {
                if (
                    linkNode.href.toLowerCase().includes(avid.toLowerCase()) &&
                    (linkNode.href.includes("pixhost.to") ||
                        linkNode.href.includes("imagetwist.com") ||
                        linkNode.href.includes("imagehaha.com"))
                ) {
                    targetImageUrl = linkNode.querySelector("img")?.src;
                    if (targetImageUrl) {
                        break;
                    }
                }
            }

            if (targetImageUrl) {
                targetImageUrl = targetImageUrl
                    .replace("thumbs", "images")
                    .replace("//t", "//img")
                    .replace(/[\?*\"*]/g, "")
                    .replace("/th/", "/i/");
                if (/imagehaha/gi.test(targetImageUrl)) targetImageUrl = targetImageUrl.replace(".jpg", ".jpeg");

                return fetchImageAsBlob(targetImageUrl)
                    .then((blob) => {
                        if (blob) {
                            if (blob.size < 20 * 1024) {
                                throw new Error("wrong image as its smaller than 20 KB");
                            }
                            return URL.createObjectURL(blob);
                        } else {
                            throw new Error('"Picture removed" placeholder or failed to load');
                        }
                    })
                    .catch((error) => {
                        console.log("The image URL obtained has been removed or failed to load: " + error.message);
                        return Promise.resolve();
                    });
            }
            return null;
        }

        async function fetchImageAsBlob(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    responseType: "blob",
                    onload: function (response) {
                        if (response.status === 200) {
                            resolve(response.response);
                        } else {
                            reject(new Error(`Failed to fetch image: ${response.status}`));
                        }
                    },
                    onerror: function (error) {
                        reject(error);
                    },
                });
            });
        }

        try {
            let blobUrl = await searchLinkOnJavLibrary(avid);
            if (blobUrl) {
                return blobUrl;
            } else {
                return null;
            }
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
            return findLinkInDocument(result.responseText, avid, ".entry-title a");
        }

        async function fetchImageUrl(linkUrl) {
            const result = await xmlhttpRequest(linkUrl);
            if (!result.isSuccess) return null;
            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const imageNodeList = doc.querySelectorAll(
                '.entry-content a img[data-src*="pixhost."], .entry-content a img[data-src*="imagetwist."]'
            );

            if (imageNodeList.length > 0) {
                let targetImageUrl = imageNodeList[imageNodeList.length - 1].dataset.src;
                targetImageUrl = targetImageUrl
                    .replace("thumbs", "images")
                    .replace("//t", "//img")
                    .replace(/[\?*\"*]/g, "")
                    .replace("/th/", "/i/");
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
                        console.log("The image URL obtained from BlogJAV has been removed or failed to load: " + error.message);
                        return null;
                    });
            }
            return null;
        }

        try {
            let link = await searchLinkOnBlogjav(avid);
            if (link) {
                return await fetchImageUrl(link.href);
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
        async function searchLinkOnJavStore(avid) {
            const searchUrl = `https://javstore.net/search/${avid}.html`;
            const result = await xmlhttpRequest(searchUrl);

            if (!result.isSuccess) {
                console.error("Connection error when searching on JavStore");
                return null;
            }

            return findLinkInDocument(result.responseText, avid, `.news_1n li h3 span a`);
        }

        async function fetchImageUrl(linkUrl) {
            const result = await xmlhttpRequest(linkUrl, "https://pixhost.to/");

            if (!result.isSuccess) {
                console.error("Connection error when searching on JavStore");
                return null;
            }

            const doc = new DOMParser().parseFromString(result.responseText, "text/html");
            const imageNodeList = doc.querySelectorAll('.news a font[size*="+1"],.news a img[alt*=".th"]');
            let imageUrl = imageNodeList[imageNodeList.length - 1].parentElement.href;

            if (imageNodeList.length > 0) {
                if (!imageUrl.includes("http://")) {
                    if (imageNodeList[0].tagName === "IMG") {
                        imageUrl = imageNodeList[imageNodeList.length - 1].src;
                        imageUrl = imageUrl
                            .replace("pixhost.org", "pixhost.to")
                            .replace(".th", "")
                            .replace("thumbs", "images")
                            .replace("//t", "//img")
                            .replace(/[\?*\"*]/g, "");

                        if (/imagetwist/gi.test(imageUrl)) imageUrl = imageUrl.replace(".jpg", ".jpeg");
                    }
                    return imageUrl;
                } else {
                    console.log(
                        'The image URL obtained from JavStore has been removed or failed to load: "Picture removed" placeholder'
                    );
                }
            }
            return null;
        }

        try {
            const link = await searchLinkOnJavStore(avid);
            if (link) {
                const imageUrl = await fetchImageUrl(link.href);
                return imageUrl;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching preview image URL from JavStore:", error);
        }
    }

    function xmlhttpRequest(url, referer = "", timeout = externalSearchTimeout) {
        return new Promise((resolve, reject) => {
            console.log(`request: ${url}`);
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
                    console.log(`${details.url} : error`);
                    reject({ isSuccess: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                },
                ontimeout: function (response) {
                    console.log(`${details.url} ${details.timeout}ms timeout`);
                    reject({ isSuccess: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                },
            };
            GM_xmlhttpRequest(details);
        });
    }

    function findLinkInDocument(responseText, avid, selector) {
        let link = null;
        const doc = new DOMParser().parseFromString(responseText, "text/html");
        const linkElements = doc.querySelectorAll(selector);

        if (linkElements) {
            // for debugging
            // linkElements.forEach((element) => {
            //     console.log(element.textContent);
            // });

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
        }

        return link;
    }

    getVideoThumbnailUrl();
    addThumbnailCss();
}

// =======================================================================================
// Configuration Menu
// =======================================================================================

function configurationMenu() {
    GM_addStyle(`
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 9998;
        transition: background-color 0.5s ease;
    }
    
    .modal {
        font-family: var(--ipt-font-family);
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 300px;
        padding: 20px;
        background-color: #fff;
        border-radius: 10px;
        box-shadow: 0px 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.5s ease;
    }
    
    .modal-title {
        margin-bottom: 20px;
        font-size: 16px;
        font-weight: bold;
    }
    
    .checkbox-label {
        display: block;
        margin-bottom: 10px;
    }
    
    .close-button {
        display: block;
        margin: 30px auto 0;
        font-size: unset;
    }
    `);

    // Darken background
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0)";
    setTimeout(() => {
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    }, 50);

    // Create modal
    const modal = document.createElement("div");
    modal.className = "modal";
    setTimeout(() => {
        modal.style.opacity = "1";
    }, 50);

    // Title of the modal
    const title = document.createElement("h3");
    title.innerText = "Which features should be used?";
    title.className = "modal-title";
    modal.appendChild(title);

    // Add checkboxes
    configurationOptions.forEach((option) => {
        const label = document.createElement("label");
        label.className = "checkbox-label";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = GM_getValue(option, true);

        checkbox.addEventListener("change", () => {
            GM_setValue(option, checkbox.checked);
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${option}`));
        modal.appendChild(label);
    });

    // Add button to close
    const closeButton = document.createElement("button");
    closeButton.innerText = "Apply Settings";
    closeButton.className = "close-button smallbutton";

    closeButton.addEventListener("click", () => {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
        location.reload();
    });

    modal.appendChild(closeButton);

    // Add modal and overlay to the DOM
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // Close modal on click outside
    overlay.addEventListener("click", () => {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
    });
}

// =======================================================================================
// Main
// =======================================================================================

async function initializeBeforeRender() {
    const configured = await GM_getValue("Improvements", true);
    if (!configured) return;

    addImprovementsCss();

    switch (true) {
        // JAV Details
        case /[a-z]{2}\/\?v=jav.*/.test(url):
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
            initializeBeforeRender();

            // // set default configuration
            // configurationOptions.forEach((option) => {
            //     // Query default value (if does not exist, 'null' is returned)
            //     const existingValue = GM_getValue(option, null);
            //     if (existingValue === null) {
            //         // Value does not exist, set default value to true
            //         GM_setValue(option, true);
            //     }
            // });

            // Sometimes the EventListener is not executed to prevent this:
            // Check if the DOM is already loaded before adding the event listener
            // If it's still loading, add the event listener for "DOMContentLoaded"
            // If it's already loaded, execute the main function immediately
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", addImprovements, { once: true });
                document.addEventListener("DOMContentLoaded", addVideoThumbnails, { once: true });
            } else {
                addImprovements();
                addVideoThumbnails();
            }
        }
    }
}

main();
// GM_setValue("authorsMode", true);
