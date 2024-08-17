// ==UserScript==
// @name           JAVLibrary Improvements
// @description    Many improvements mainly in details view of a video for recherche: easier collect of Google Drive and Rapidgator links for JDownloader (press <), save/show favorite actresses, recherche links for actresses, auto reload on Cloudflare rate limit, save cover with actress names just by clicking, full size commercial photos
// @version        20240817
// @author         resykano
// @icon           https://icons.duckduckgo.com/ip2/javlibrary.com.ico
// @match          *://*.javlibrary.com/*
// @match          *://*x75p.com/*
// @match          *://javx357.com/*
// @match          *://arcjav.com/*
// @match          *://javgg.me/*
// @match          *://maxjav.com/*
// @match          *://jav.guru/*
// @match          *://supjav.com/*
// @match          *://missav.com/*
// @match          *://video-jav.net/*
// @match          *://www.akiba-online.com/search/*
// @grant          GM_xmlHttpRequest
// @grant          GM_download
// @grant          GM_setClipboard
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_addStyle
// @grant          window.close
// @run-at         document-start
// @compatible     chrome
// @license        GPL3
// @noframes
// ==/UserScript==

"use strict";

// ---------------------------------------------------------------------------------------
// Config/Requirements
// ---------------------------------------------------------------------------------------
let copied = false;
const url = window.location.href;
const originalDocumentTitle = document.title;

function getTitleElement() {
    return document.querySelector("#video_id > table > tbody > tr > td.text");
}
function getAvid() {
    return getTitleElement()?.textContent;
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

// ---------------------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------------------

function addCSS() {
    GM_addStyle(`
        /* Saving space on top and left */
        #toplogo {
            height: 26px;
        }
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
            top: 0em;
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
                #video_info {
                    min-width: 430px;
                }

                .added-links {
                    margin-left: 107px;
                    max-width: 340px;
                }
                .added-links-separator {
                    margin-top: 10px;
                }
                
                /* preview video separated from promo photos */
                a.btn_videoplayer {
                    display: block;
                    text-align: center;
                }

                /* prevent video metadata from becoming too narrow */
                #video_jacket_info > tbody > tr > td:nth-child(2) {
                    min-width: 370px;
                }

                @media screen and (min-width: 1301px) {
                    /* reduce FOUC for cover image */
                    img#video_jacket_img {
                        width: 800px;
                        object-fit: contain;
                        /* not too high, especially portraits */
                        max-height: 800px;
                    }
                }

                @media screen and (max-width: 1300px) {
                    /* same size for cover and metadata area */
                    #video_jacket_info > tbody > tr > td {
                        width: 50%;
                    }

                    img#video_jacket_img {
                        width: 100% !important;
                    }
                }
            `);
            break;
        }
    }
}

function removeRedirects() {
    let externalLinks = document.querySelectorAll("table[id^=comment] > tbody > tr:nth-child(1) > td.t > div a[href^='redirect.php']");
    for (let externalLink of externalLinks) {
        externalLink.href = decodeURIComponent(
            externalLink.href?.replace(/https:\/\/www\.javlibrary\.com\/.*\/redirect\.php\?url=/, "").replace(/\&ver=.*/, "")
        );
    }
}

function addTitleCopyPerClick() {
    let titleElement = getTitleElement();

    titleElement.style.cursor = "pointer";
    titleElement.addEventListener("click", function () {
        copyTitleToClipboard();
    });
}

async function initalCopyVideoTitleToClipboard(source) {
    const authorsMode = await GM_getValue("authorsMode", false);

    if (authorsMode) {
        const textElement = getTitleElement();
        let avid = getAvid();

        if (textElement && !copied && document.hasFocus()) {
            // only put once to clipboard
            console.log(`${source}: ${avid}`);

            copyTitleToClipboard(avid)
                .then(() => {
                    copied = true;
                    // if tab was opened with link
                    if (history.length === 1) {
                        runLocalSearch();
                    }
                })
                .catch(function (err) {
                    console.error("Failed to copy text: ", err);
                    copied = false;
                });
        }
    }
}

/**
 * requires a local script such as AHK, which recognizes the window title
 * as information for the execution of another local script
 * Button and auto execute disabled if GM variable privateMode is not set
 */
async function addLocalSearch() {
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
    return navigator.clipboard.writeText(getAvid());
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
    let newFilename = getAvid() + " - ";
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
                    const coverPictureBlob = download.blob;

                    // Create a Blob URL for the image
                    const blobUrl = window.URL.createObjectURL(coverPictureBlob);

                    // Create an invisible <a> element
                    const downloadLink = document.createElement("a");

                    // Set the Blob URL as the HREF value and the filename for download
                    downloadLink.href = blobUrl;
                    downloadLink.setAttribute("download", newFilename);

                    // Trigger the click event on the invisible <a> element
                    downloadLink.click();

                    // Revoke the Blob URL to free up memory
                    window.URL.revokeObjectURL(blobUrl);
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

/**
 * Adds a search links and open all links buttons
 *
 * @param {*} name Name
 * @param {*} href URL
 * @param {*} separator Adds a space on top
 * @param {*} className Adds a class
 */
function addSearchLinksAndOpenAllButtons(name, href, className, separator = false) {
    GM_addStyle(`
        button.open-group {
            margin-left: 8px;
            padding: 2px 0;
            width: 150px;
            height: 22px;
            user-select = none;
        }
    `);

    if (separator) {
        separator = "added-links-separator";
    }
    if (className === "") className = undefined;

    let existingContainer = castContainer();
    let newElementContainer = document.createElement("div");
    newElementContainer.classList.add("added-links");
    newElementContainer.classList.add(separator);
    newElementContainer.classList.add(className);
    newElementContainer.style.display = "flex";
    newElementContainer.style.alignItems = "flex-end";
    newElementContainer.style.justifyContent = "space-between";

    let newElement = document.createElement("a");
    newElement.href = href;
    newElement.textContent = name;
    newElementContainer.appendChild(newElement);

    // add open all links buttons
    if (separator && className) {
        const openAllButton = document.createElement("button");
        const buttonTitle = className.replace(/-/g, " ");

        openAllButton.textContent = "Open " + buttonTitle;
        openAllButton.className = "smallbutton open-group";

        openAllButton.addEventListener("click", function () {
            let linksToOpen = document.querySelectorAll(`.${className}.added-links a`);
            let reversedLinks = Array.from(linksToOpen).reverse();

            GM_setValue("externalSearchMode", true);

            setTimeout(async () => {
                GM_setValue("externalSearchMode", false);
                console.log("externalSearchMode off");
            }, 6000);

            reversedLinks.forEach(function (link) {
                window.open(link.href);
            });
        });

        newElementContainer.appendChild(openAllButton);
    }

    existingContainer.insertAdjacentElement("afterend", newElementContainer);
}

// Execute when button pressed with collecting comments for importing into Jdownloader
async function executeCollectingComments(event) {
    if (event.key === "<") {
        // press Open RG Group button
        document.querySelector("#video_info > div.added-links.added-links-separator.RG-Group > button")?.click();

        // go to all comments, if not already there
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
            copyContentsToClipboard();
            // alert("No more comments!");
        }
    }
}

// Function to copy the contents of the #video_comments element to the clipboard
// for collecting download links in apps like JDownloader
function copyContentsToClipboard() {
    const commentsElement = document.querySelector("#video_comments");
    if (commentsElement) {
        const commentsContent = commentsElement.innerText;
        GM_setClipboard(commentsContent);
    }
}

function addImageSearchToCasts() {
    GM_addStyle(`
        .customButton {
            cursor: default;
            background-color: buttonface;
            padding-block: 2px;
            padding-inline: 6px;
            border-width: 1px;
            border-style: solid;
            border-color: #767676;
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

    let castElements = document.querySelectorAll("[id^=cast]");
    castElements.forEach(function (element) {
        function addButton(text, link) {
            let a = document.createElement("a");
            a.target = "_blank";
            a.textContent = text;
            a.className = "customButton";
            let cast = element.querySelector("span.star > a").textContent;
            // Reverse the order of names for better search results
            if (cast.split(" ").length === 2) {
                cast = cast.split(" ").reverse().join(" ");
            }
            if (link && cast) {
                a.href = link + '"' + cast + '"';
            }

            let span = document.createElement("span");
            span.appendChild(a);

            element.appendChild(span);
        }

        addButton("V2PH", "https://www.v2ph.com/search/?q=");
        addButton("JT", "https://japanesethumbs.com/photo/?model=");
        addButton("JB", "https://japanesebeauties.one/search.php?model=");
        addButton("JJG", "https://jjgirls.com/match.php?model=");
        addButton("KT", "https://kawaiithong.com/search_kawaii_pics/");
        addButton("XSL", "https://duckduckgo.com/?iar=images&iax=images&ia=images&q=site:xslist.org Photo Gallery ");
        addButton("Y", "https://yandex.com/images/search?text=");
        addButton("JW", "https://jav.fandom.com/wiki/Special:Search?query=");
    });
}

async function makeFavoriteCastVisible() {
    const favoriteClass = "favorite-star";

    function addCss() {
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

    addCss();

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

function setPromotionalPhotosToFullSize() {
    const commercialPreviewImageLinks = document.querySelectorAll("#rightcolumn > div.previewthumbs > a:not(.btn_videoplayer)");

    commercialPreviewImageLinks.forEach((anchor) => {
        const img = anchor.querySelector("img");
        if (img) {
            img.src = anchor.href;
            img.removeAttribute("width");
            img.removeAttribute("height");
        }
    });
}

// ---------------------------------------------------------------------------------------
// external search
// ---------------------------------------------------------------------------------------

class ExternalSearch {
    constructor() {
        this.currentURL = window.location.href;
        this.hostname = window.location.hostname;
    }

    openLink(url, target = "_self") {
        return window.open(url, target);
    }

    handleSearchResults() {
        const selectors = ["[id^=post]", "#main div.row", "div.my-2.text-sm.text-nord4.truncate", ".post"];

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
                            openWindowCheck = window.open(link.href, "_blank");
                        }, index * 100);
                    }
                }
            });

            if (openWindowCheck !== null) {
                setTimeout(() => window.close(), 2000);
            } else {
                console.log("window.open blocked");
            }
        }
    }

    handleGDrivePages() {
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

        if (this.hostname === "javgg.me") {
            const postContentElement = document.querySelector("article.status-publish.hentry > div > p");
            if (postContentElement && postContentElement.textContent.includes("drive.google.com/file/")) {
                GM_setClipboard(postContentElement.textContent)
                    .then(() => window.close())
                    .catch((err) => console.error("Error copying content:", err));
            }
        }
    }

    handleRapidgatorPages() {
        console.log("handleRapidgatorPages");

        if (this.hostname === "jav.guru") {
            const sources = document.querySelectorAll("#dl_jav_free");
            for (let source of sources) {
                if (source.innerText.includes("Rapidgator")) {
                    const link = source.querySelector("a");
                    if (link) {
                        let onClickContent = link.getAttribute("onclick");
                        if (onClickContent) {
                            const match = onClickContent.match(/window\.open\s*\(\s*['"]([^'"]*)['"]/);
                            if (match) {
                                const url = match[1];
                                onClickContent = onClickContent.replace(/window\.open\s*\([^)]*\)/, `window.open('${url}', '_self')`);
                                link.setAttribute("onclick", onClickContent);
                                setTimeout(() => link.click(), 100);
                            } else {
                                setTimeout(() => window.open(link.href, "_self"), 100);
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

    main() {
        switch (true) {
            case this.currentURL.includes("/?s=") || this.currentURL.includes("/search"):
                this.handleSearchResults();
                break;
            case ["arcjav.com", "javgg.me", "javx357.com"].includes(this.hostname):
                this.handleGDrivePages();
                break;
            case ["jav.guru", "supjav.com", "missav.com"].includes(this.hostname):
                this.handleRapidgatorPages();
                break;
        }
    }
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

async function main() {
    // Cloudflare restricted access
    if (/.*/.test(url)) {
        if (document.title.includes("Access denied")) {
            setTimeout(() => {
                location.reload();
            }, 10000);
        }
    }

    // do nothing if cloudflare check happens
    if (document.title.includes("Just a moment...")) return;

    switch (true) {
        // JAV Details
        case /[a-z]{2}\/\?v=jav.*/.test(url): {
            console.log("JAV Details");

            // add title textbox
            addTitleCopyPerClick();

            // adds posibility for local search but disabled by default as needs addinal scripts
            addLocalSearch();

            // increase commercial previews
            setPromotionalPhotosToFullSize();

            addSearchLinksAndOpenAllButtons(
                "DuckDuckGo Screens",
                "https://duckduckgo.com/?kp=-2&iax=images&ia=images&q=" + '"' + getAvid() + '"' + " JAV",
                ""
            );
            addSearchLinksAndOpenAllButtons(
                "DuckDuckGo",
                "https://duckduckgo.com/?kp=-2&q=" + '"' + getAvid() + '"' + " JAV",
                "",
                true
            );

            addSearchLinksAndOpenAllButtons("JavPlace | alternative research platform", "https://jav.place/?q=" + getAvid(), "");
            addSearchLinksAndOpenAllButtons(
                "JAV-Menu | alternative research platform",
                "https://jjavbooks.com/en/" + getAvid(),
                "",
                true
            );

            addSearchLinksAndOpenAllButtons("JAV BIGO | Stream", "https://javbigo.com/?s=" + getAvid(), "Stream-Group");
            addSearchLinksAndOpenAllButtons("JAVHDMost | Stream", "https://javhdmost.com/?s=" + getAvid(), "Stream-Group");
            addSearchLinksAndOpenAllButtons("Jable | Stream", "https://jable.tv/search/" + getAvid() + "/", "Stream-Group");
            addSearchLinksAndOpenAllButtons("MDTAIWAN | Stream", "https://mdtaiwan.com/?s=" + getAvid(), "Stream-Group");
            addSearchLinksAndOpenAllButtons("HORNYJAV | Stream", "https://hornyjav.com/?s=" + getAvid(), "Stream-Group", true);

            addSearchLinksAndOpenAllButtons("JAV GDRIVE | Google Drive", "https://javx357.com/?s=" + getAvid(), "GDrive-Group");
            addSearchLinksAndOpenAllButtons("Arc JAV | Google Drive", "https://arcjav.com/?s=" + getAvid(), "GDrive-Group");
            addSearchLinksAndOpenAllButtons("JAVGG | Google Drive", "https://javgg.me/?s=" + getAvid(), "GDrive-Group", true);

            addSearchLinksAndOpenAllButtons("JAVDAILY | RG  (optional)", "https://javdaily31.blogspot.com/search?q=" + getAvid(), "");
            addSearchLinksAndOpenAllButtons("BLOGJAV.NET | RG (optional)", "https://blogjav.net/?s=" + getAvid(), "", true);

            addSearchLinksAndOpenAllButtons("MissAV | RG | Stream", "https://missav.com/en/search/" + getAvid(), "RG-Group");
            addSearchLinksAndOpenAllButtons("Supjav | RG", "https://supjav.com/?s=" + getAvid(), "RG-Group");
            addSearchLinksAndOpenAllButtons("JAV Guru | RG | Stream", "https://jav.guru/?s=" + getAvid(), "RG-Group", true);

            addSearchLinksAndOpenAllButtons("3xPlanet | Preview", "https://3xplanet.com/?s=" + getAvid(), "Preview-Group-2");
            addSearchLinksAndOpenAllButtons("JAVAkiba | Preview", "https://javakiba.org/?s=" + getAvid(), "Preview-Group-2");
            addSearchLinksAndOpenAllButtons("Video-JAV | Preview", "http://video-jav.net/?s=" + getAvid(), "Preview-Group-2", true);

            addSearchLinksAndOpenAllButtons("JAV Max Quality | Preview", "https://maxjav.com/?s=" + getAvid(), "Preview-Group-1");
            addSearchLinksAndOpenAllButtons(
                "Akiba-Online | Preview",
                "https://www.akiba-online.com/search/?q=" + getAvid() + "&c%5Btitle_only%5D=1&o=date&search=" + getAvid(),
                "Preview-Group-1",
                true
            );

            // add Searches
            addSearchLinksAndOpenAllButtons("Torrent-Search", "https://bt4g.org/search/" + getAvid() + "&orderby=size", "", true);

            // add Cover Image Download button
            coverImageDownload();

            // Remove link by converting <a> to <span> element
            (function () {
                let linkElement = document.querySelector("#video_title > h3 > a");

                if (linkElement) {
                    let spanElement = document.createElement("span");
                    spanElement.innerHTML = linkElement.innerHTML;
                    linkElement.insertAdjacentElement("beforebegin", spanElement);
                    linkElement.parentNode.removeChild(linkElement);
                }
            })();

            // remove redirects from external links
            setTimeout(() => {
                removeRedirects();
            }, 500);

            // copy title to clipboard
            const authorsMode = await GM_getValue("authorsMode", false);
            if (authorsMode) {
                (function () {
                    // Handle the case when the window is opened in the background
                    window.addEventListener("focus", function () {
                        initalCopyVideoTitleToClipboard("EventListener");
                    });
                    // Handle the case when the window is opened in the foreground
                    // IntersectionObserver is used for better performance and reliability
                    // compared to repeated DOM queries or fixed timeouts
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                initalCopyVideoTitleToClipboard("IntersectionObserver");
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

            addImageSearchToCasts();
            makeFavoriteCastVisible();

            // window.addEventListener("keydown", executeCollectingComments, { once: true });
            window.addEventListener("keydown", executeCollectingComments);

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
            console.log("Search Page");

            // open Combination Search
            // document.querySelector("#ui-accordion-accordion-header-1 > span")?.click();
            break;
        }
        case /\/vl_searchbyid.php/.test(url): {
            if (document.querySelector("#rightcolumn > p > em") && document.querySelector("#rightcolumn > div.titlebox")) {
                console.log("no search result");

                // TODO: include searches as in video details
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
                copyContentsToClipboard(); // Copy the comments content before loading the next page

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
                    // await sleep(1000);
                    loadNextPage();
                } else {
                    window.addEventListener("keydown", executeCollectingComments);
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
                const externalSearcher = new ExternalSearch();
                externalSearcher.main();
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
                if (posts.length === 1) {
                    let post = posts[0];
                    let childLink = post.querySelector("a");

                    childLink?.click();
                } else if (posts.length >= 2) {
                    const paramName = "q";
                    const searchTerm = new URLSearchParams(window.location.search).get(paramName);
                    let postTitle = document.querySelectorAll("div.block-container > ol > li h3 a");

                    let fileJokerExclusive = document.querySelector("div.block-container > ol > li span.label--royalBlue");
                    if (
                        fileJokerExclusive &&
                        fileJokerExclusive.parentElement.textContent.toLowerCase().includes(searchTerm.toLowerCase())
                    ) {
                        fileJokerExclusive.parentElement?.click();
                        return;
                    }

                    for (let i = 0; i < postTitle.length; i++) {
                        let title = postTitle[i];

                        if (!title.textContent.includes(searchTerm)) {
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

            // use get parameter for search with form as only post parameters are allowed
            search();

            // open result if only one result saves clicking
            autoOpenResults();
            break;
        }
    }
}

function initializeBeforeRender() {
    // GM_setValue("authorsMode", true);

    addCSS();

    switch (true) {
        // JAV Details
        case /[a-z]{2}\/\?v=jav.*/.test(url):
            // on low resolutions cover image get fixed size by site javascript
            removeResizingOfCoverImage();
            break;
    }
}

initializeBeforeRender();
document.addEventListener("DOMContentLoaded", main);
