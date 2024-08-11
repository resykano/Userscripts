// ==UserScript==
// @name           JAVLibrary Video Thumbnails
// @description    Inserts a video preview in form of thumbnails
// @version        20240811
// @author         resykano
// @icon           https://icons.duckduckgo.com/ip2/javlibrary.com.ico
// @match          *://*.javlibrary.com/*/?v=*
// @match          *://*x75p.com/*/?v=*
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @run-at         document-start
// @compatible     chrome
// @license        GPL3
// @noframes
// ==/UserScript==

"use strict";

function getAvid() {
    return document.querySelector("#video_id > table > tbody > tr > td.text")?.textContent;
}

// Add the necessary CSS styles
function addCSS() {
    GM_addStyle(`
        /* improve space on smaller viewports */
        @media screen and (max-width: 1300px) {
            #leftmenu {
                display: none;
            }
            #rightcolumn {
                margin-left: 10px;
            }
        }

        /* prevent video metadata from becoming too narrow */
        #video_jacket_info > tbody > tr > td:nth-child(2) {
            min-width: 370px;
        }

        #videoThumbnail {
            width: 100%;
            margin-top: 5px;
        }
        #videoThumbnail > img {
            width: 100%;
        }
        /* no preview info */
        #videoThumbnail > p {
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

function getVideoThumbnailsUrl() {
    const avid = getAvid();
    // search in background
    // let videoThumbnailsUrlFromJavStore = getVideoThumbnailsUrlFromJavStore(avid);
    let videoThumbnailsUrlFromBlogjav = getVideoThumbnailsUrlFromBlogjav(avid);

    getVideoThumbnailsUrlFromJavStore(avid).then((imageUrl) => {
        if (imageUrl === null || imageUrl === undefined) {
            console.log("No preview image found JavStore");
            attemptSecondVideoThumbnailsFetch();
        } else {
            console.log("Image URL from BlogJAV: ", imageUrl);
            addVideoThumbnails(imageUrl);
        }
    });

    function attemptSecondVideoThumbnailsFetch() {
        videoThumbnailsUrlFromBlogjav.then((imageUrl) => {
            if (imageUrl === null || imageUrl === undefined) {
                console.log("No preview image found BlogJAV");
                addVideoThumbnails(null);
            } else {
                console.log("Image URL from JavStore: ", imageUrl);
                addVideoThumbnails(imageUrl);
            }
        });
    }

    function addVideoThumbnails(targetImageUrl) {
        console.log("Image URL being displayed: " + targetImageUrl);
        const targetElement = document.querySelector("#video_jacket");

        if (targetElement) {
            let contentElement;

            if (targetImageUrl === null) {
                contentElement = document.createElement("p");
                contentElement.innerText = "No Video Preview Image found";
            } else {
                contentElement = document.createElement("img");
                contentElement.src = targetImageUrl;
            }

            let container = document.createElement("div");
            container.id = "videoThumbnail";

            container.append(contentElement);
            targetElement.insertAdjacentElement("afterend", container);
        }
    }
}

// Get big preview image URL from Blogjav
async function getVideoThumbnailsUrlFromBlogjav(avid) {
    async function searchLinkOnBlogjavWithBing(avid) {
        // const searchUrl = `https://www.bing.com/search?q=${formatAvidForAmateurIds(avid)}+site:blogjav.net&mkt=ja-JP`;
        const searchUrl = `https://www.bing.com/search?q=${avid}+site:blogjav.net&mkt=ja-JP`;
        const result = await xmlhttpRequest(searchUrl, "", 10000);
        if (!result.loadstuts) {
            console.error("Connection error when searching on Bing");
            return null;
        }
        const link = findLinkInDocument(result.responseText, avid, "#b_results .b_algo h2 a");
        if (link === null) console.log("AVID not found in first results on Bing.");
        return link;
    }

    async function searchLinkOnBlogjav(avid) {
        // const searchUrl = `https://blogjav.net/?s=${formatAvidForAmateurIds(avid)}`;
        const searchUrl = `https://blogjav.net/?s=${avid}`;
        const result = await xmlhttpRequest(searchUrl, "", 10000);
        if (!result.loadstuts) {
            console.error("Connection error when searching on BlogJAV");
            return null;
        }
        return findLinkInDocument(result.responseText, avid, ".entry-title a");
    }

    async function fetchImageUrl(linkUrl) {
        const result = await xmlhttpRequest(linkUrl, "https://pixhost.to/", 10000);
        if (!result.loadstuts) return null;
        const doc = new DOMParser().parseFromString(result.responseText, "text/html");
        const imageArray = doc.querySelectorAll(
            '.entry-content a img[data-lazy-src*="imagetwist."],.entry-content a img[data-lazy-src*="pixhost."]'
        );
        if (imageArray.length > 0) {
            let targetImageUrl = imageArray[imageArray.length - 1].dataset.lazySrc;
            targetImageUrl = targetImageUrl
                .replace("thumbs", "images")
                .replace("//t", "//img")
                .replace(/[\?*\"*]/g, "")
                .replace("/th/", "/i/");
            if (/imagetwist/gi.test(targetImageUrl)) targetImageUrl = targetImageUrl.replace(".jpg", ".jpeg");

            // check if only a picture removed image is shown
            return xmlhttpRequest(targetImageUrl, targetImageUrl.replace(/^(https?:\/\/[^\/#&]+).*$/, "$1"), 10000)
                .then((result) => {
                    if (result.loadstuts) {
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
        // faster search on Blogjav
        let link = await searchLinkOnBlogjavWithBing(avid);
        if (!link) {
            link = await searchLinkOnBlogjav(avid);
        }
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
async function getVideoThumbnailsUrlFromJavStore(avid) {
    async function searchLinkOnJavStore(avid) {
        const searchUrl = `https://javstore.net/search/${avid}.html`;
        const result = await xmlhttpRequest(searchUrl);

        if (!result.loadstuts) {
            console.error("Connection error when searching on JavStore");
            return null;
        }

        return findLinkInDocument(result.responseText, avid, `.news_1n li h3 span a`);
    }

    async function fetchImageUrl(linkUrl) {
        const result = await xmlhttpRequest(linkUrl, "http://pixhost.to/");

        if (!result.loadstuts) {
            console.error("Connection error when searching on JavStore");
            return null;
        }

        const doc = new DOMParser().parseFromString(result.responseText, "text/html");
        const imageArray = doc.querySelectorAll('.news a font[size*="+1"],.news a img[alt*=".th"]');
        let imageUrl = imageArray[imageArray.length - 1].parentElement.href;

        if (imageArray.length > 0) {
            if (!imageUrl.includes("http://")) {
                if (imageArray[0].tagName === "IMG") {
                    imageUrl = imageArray[imageArray.length - 1].src;
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
                console.log('The image URL obtained from JavStore has been removed or failed to load: "Picture removed" placeholder');
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

function xmlhttpRequest(url, referer, timeout = 10000) {
    return new Promise((resolve, reject) => {
        console.log(`request: ${url}`);
        let details = {
            method: "GET",
            url: url,
            headers: referer ? { Referer: referer } : {},
            timeout: timeout,
            onload: function (response) {
                if (response.status >= 200 && response.status < 300) {
                    resolve({
                        loadstuts: true,
                        responseHeaders: response.responseHeaders,
                        responseText: response.responseText,
                        finalUrl: response.finalUrl,
                    });
                } else {
                    resolve({ loadstuts: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
                }
            },
            onerror: function (response) {
                console.log(`${details.url} : error`);
                reject({ loadstuts: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
            },
            ontimeout: function (response) {
                console.log(`${details.url} ${details.timeout > 0 ? details.timeout : 10000}ms timeout`);
                reject({ loadstuts: false, responseHeaders: response.responseHeaders, responseText: response.responseText });
            },
        };
        GM_xmlhttpRequest(details);
    });
}

/**
 * Convert AV ID into a search query format
 * Example:
 * - FC2-PPV-9999999 becomes FC2+PPV+9999999
 * - HEYZO-9999 becomes HEYZO+9999
 * (Unlikely to be needed on JLibrary)
 *
 * @param {string} avid - The AV ID to be formatted.
 * @returns {string} - The formatted search query.
 */
function formatAvidForAmateurIds(avid) {
    // Replace hyphens with plus signs
    let formatted = avid.replace(/-/g, "+");

    // Check if the string contains no spaces and only alphanumeric characters
    // if (!/\s+/g.test(formatted) && /^(?![0-9]+$)(?![a-zA-Z]+$)[0-9A-Za-z]+$/g.test(formatted)) {
    if (!/\s+/g.test(formatted) && /^[0-9A-Za-z]+$/.test(formatted)) {
        // For example, ABP999 becomes ABP+999
        // Extract the trailing digits
        let number = formatted.match(/\d+$/gi);
        // Extract the prefix (everything before the digits)
        let prefix = formatted.replace(number, "");
        // Format as prefix+number
        formatted = `${prefix}+${number}`;
    }

    return formatted;
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
            // const regexp = new RegExp(avid.replace(/-/g, ".*"), "gi");
            // replacing each hyphen '-' with '-?', making the hyphen optional
            const regexp = new RegExp(avid.replace(/-/g, "-?"), "gi");
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

// do nothing if cloudflare check happens
if (!document.title.includes("Just a moment...")) {
    addCSS();
}

document.addEventListener("DOMContentLoaded", getVideoThumbnailsUrl);
