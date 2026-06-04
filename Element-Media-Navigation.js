// ==UserScript==
// @name           Matrix Element Media Navigation
// @description    Enables navigation through images and videos in timeline (up/down & left/right & a/Space keys) and lightbox (same keys + mousewheel) view. Its also a workaround helping against the jumps on timeline pagination/scrolling issue #8565
// @version        20260604
// @author         resykano
// @icon           https://icons.duckduckgo.com/ip2/element.io.ico
// @match          *://*/*
// @grant          GM_addStyle
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_registerMenuCommand
// @grant          GM_unregisterMenuCommand
// @compatible     chrome
// @license        GPL3
// @noframes
// ==/UserScript==

"use strict";

// =======================================================================================
// Elements
// =======================================================================================

const messageContainerSelector = "ol.mx_RoomView_MessageList li.mx_EventTile";
let getHqImages = GM_getValue("getHqImages", false);

let _hqMenuCommandId;
function registerHqMenuCommand() {
    if (_hqMenuCommandId !== undefined) GM_unregisterMenuCommand(_hqMenuCommandId);
    _hqMenuCommandId = GM_registerMenuCommand(`${getHqImages ? "✔️" : "❌"} HQ Images in Lightbox`, () => {
        getHqImages = !getHqImages;
        GM_setValue("getHqImages", getHqImages);
        registerHqMenuCommand();
    });
}
registerHqMenuCommand();

let pendingNavigationDirection = null;
let spinnerObserver = null;

const activeMediaAttribute = "data-active-media";
function getActiveMedia() {
    return document.querySelector(`[${activeMediaAttribute}="true"]`);
}

// =======================================================================================
// Layout
// =======================================================================================

GM_addStyle(`
    /* Lightbox */
    .mx_ImageView_image.mx_ImageView_image_animating,
    .mx_ImageView_image.mx_ImageView_image_animatingLoading {
        transition: transform 0.01s ease;
        transition: none !important;
        transform: unset !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: contain;
    }
    .mx_ImageView > .mx_ImageView_image_wrapper > img {
        cursor: default !important;
    }
    /* unused lightbox header */
    .mx_ImageView_panel {
        display: none;
    }
    
    [${activeMediaAttribute}="true"] > div.mx_EventTile_line.mx_EventTile_mediaLine {
        box-shadow: 0 0 2px 2px #007a62;
        background-color: var(--cpd-color-bg-subtle-secondary);
    }

    /* Loading overlay in lightbox while timeline paginates */
    .mx_ImageView {
        position: relative;
    }
    .mx_nav_loader {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;
    }
    .mx_nav_loader > .mx_Spinner {
        color: #fff;
    }
    .mx_nav_loader--error {
        color: #fff;
        font-size: 14px;
        gap: 8px;
    }

`);

// =======================================================================================
// General Functions
// =======================================================================================

/**
 * Waits for an element to exist in the DOM with an optional timeout.
 * @param {string} selector - CSS selector.
 * @param {number} index - Index in NodeList/HTMLCollection.
 * @param {number} timeout - Maximum wait time in milliseconds.
 * @returns {Promise<Element|null>} - Resolves with the element or null if timeout.
 */
function waitForElement(selector, index = 0, timeout) {
    return new Promise((resolve) => {
        const checkElement = () => document.querySelectorAll(selector)[index];
        const initial = checkElement();
        if (initial) {
            return resolve(initial);
        }

        const observer = new MutationObserver(() => {
            const found = checkElement();
            if (found) {
                observer.disconnect();
                resolve(found);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        if (timeout) {
            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        }
    });
}

/**
 * Determines the wheel direction and triggers the lightbox replacement.
 * @param {WheelEvent} event - Wheel event.
 */
function getWheelDirection(event) {
    event.stopPropagation();

    const direction = event.deltaY < 0 ? "up" : "down";
    navigate(direction);
}

/**
 * Checks if the element is the last in a NodeList.
 * @param {Element} element - DOM element to check.
 * @returns {boolean} - True if last element, false otherwise.
 */
function isLastElement(element) {
    const allElements = document.querySelectorAll(messageContainerSelector);
    return element === allElements[allElements.length - 1];
}

/**
 * Finds the closest element to the vertical center of the viewport.
 * @returns {Element|null} - Closest element or null.
 */
function getCurrentElement() {
    const elements = document.querySelectorAll(messageContainerSelector);
    let closestElement = null;
    let closestDistance = Infinity;

    elements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestElement = element;
        }
    });

    return closestElement;
}

/**
 * Navigates to the next or previous element and sets it as active.
 * @param {string} direction - "up" or "down".
 */
function navigate(direction) {
    const currentElement = getActiveMedia() || (console.error("activeMedia not found"), getCurrentElement());
    const siblingType = direction === "down" ? "nextElementSibling" : "previousElementSibling";
    const nextActiveMedia = findSibling(currentElement, siblingType);

    if (nextActiveMedia) {
        setActiveMedia(nextActiveMedia);
        if (document.querySelector(".mx_Dialog_lightbox")) {
            replaceContentInLightbox();
        }
    } else if (document.querySelector("ol.mx_RoomView_MessageList .mx_Spinner")) {
        waitForLoadingAndNavigate(direction);
    }
}

function showLightboxLoader() {
    const imageView = document.querySelector(".mx_ImageView");
    if (!imageView || imageView.querySelector(".mx_nav_loader")) return;
    const loader = document.createElement("div");
    loader.className = "mx_nav_loader";
    loader.innerHTML = `<div class="mx_Spinner"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" width="32" height="32" class="mx_Spinner_icon" aria-label="Loading..." role="progressbar"><circle transform="translate(8 0)" cx="0" cy="16" r="0"><animate attributeName="r" values="0; 4; 0; 0" dur="1.2s" repeatCount="indefinite" begin="0" keyTimes="0;0.2;0.7;1" keySplines="0.2 0.2 0.4 0.8;0.2 0.6 0.4 0.8;0.2 0.6 0.4 0.8" calcMode="spline"></animate></circle><circle transform="translate(16 0)" cx="0" cy="16" r="0"><animate attributeName="r" values="0; 4; 0; 0" dur="1.2s" repeatCount="indefinite" begin="0.3" keyTimes="0;0.2;0.7;1" keySplines="0.2 0.6 0.4 0.8;0.2 0.6 0.4 0.8;0.2 0.6 0.4 0.8" calcMode="spline"></animate></circle><circle transform="translate(24 0)" cx="0" cy="16" r="0"><animate attributeName="r" values="0; 4; 0; 0" dur="1.2s" repeatCount="indefinite" begin="0.6" keyTimes="0;0.2;0.7;1" keySplines="0.2 0.6 0.4 0.8;0.2 0.6 0.4 0.8;0.2 0.6 0.4 0.8" calcMode="spline"></animate></circle></svg></div>`;
    imageView.appendChild(loader);
}

function hideLightboxLoader() {
    document.querySelector(".mx_nav_loader")?.remove();
    const media = document.querySelector(".mx_ImageView .mx_ImageView_image_wrapper > img, .mx_ImageView .mx_ImageView_image_wrapper > video");
    if (media) media.style.display = "";
}

function showLightboxError(mediaEl) {
    hideLightboxLoader();
    const imageView = document.querySelector(".mx_ImageView");
    if (!imageView) return;
    if (mediaEl) mediaEl.style.display = "none";
    const overlay = document.createElement("div");
    overlay.className = "mx_nav_loader mx_nav_loader--error";
    overlay.innerHTML = `<span>⚠</span><span>Media failed to load</span>`;
    imageView.appendChild(overlay);
}

/**
 * Waits for the timeline loading spinner to disappear, then retries navigation.
 * Triggered when navigate() finds no sibling but a spinner is present (pagination loading).
 * Shows a visual overlay in the lightbox while waiting.
 * @param {string} direction - "up" or "down".
 */
function waitForLoadingAndNavigate(direction) {
    pendingNavigationDirection = direction;

    if (spinnerObserver) return;

    if (document.querySelector(".mx_Dialog_lightbox")) {
        showLightboxLoader();
    }

    const messageList = document.querySelector("ol.mx_RoomView_MessageList");

    spinnerObserver = new MutationObserver(() => {
        if (!document.querySelector("ol.mx_RoomView_MessageList .mx_Spinner") && pendingNavigationDirection) {
            const dir = pendingNavigationDirection;
            pendingNavigationDirection = null;
            spinnerObserver.disconnect();
            spinnerObserver = null;
            clearTimeout(safetyTimeout);
            setTimeout(() => navigate(dir), 100);
        }
    });

    spinnerObserver.observe(messageList ?? document.body, { childList: true, subtree: true });

    const safetyTimeout = setTimeout(() => {
        if (spinnerObserver) {
            spinnerObserver.disconnect();
            spinnerObserver = null;
            pendingNavigationDirection = null;
            hideLightboxLoader();
        }
    }, 10000);
}

/**
 * Sets an element as the active one and scrolls it into view.
 * @param {Element} nextActiveMedia - DOM element to set active.
 */
function setActiveMedia(nextActiveMedia) {
    if (nextActiveMedia) {
        removeActiveMedia();

        nextActiveMedia.setAttribute(activeMediaAttribute, "true");
        nextActiveMedia.scrollIntoView({
            block: isLastElement(nextActiveMedia) ? "end" : "center",
            behavior: "auto",
        });
    } else {
        console.error("setActiveMedia: nextActiveMedia not found");
    }
}

/**
 * Removes the activeMediaAttribute attribute from the currently active element.
 * The active element is identified by the presence of the attribute `data-active-media` set to "true".
 * If no such element is found, the function does nothing.
 */
function removeActiveMedia() {
    const activeMedia = getActiveMedia();
    if (activeMedia) {
        activeMedia.removeAttribute(activeMediaAttribute);
    }
}

/**
 * Finds a sibling element matching the media item criteria.
 * @param {Element} startElement - Starting element.
 * @param {string} siblingType - "nextElementSibling" or "previousElementSibling".
 * @returns {Element|null} - Matching sibling or null.
 */
function findSibling(startElement, siblingType) {
    let sibling = startElement?.[siblingType];

    while (sibling) {
        // there must be a picture or video in the post
        if (
            sibling.matches(messageContainerSelector) &&
            sibling.querySelector("div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image, video.mx_MVideoBody")
        ) {
            return sibling;
        }
        sibling = sibling[siblingType];
    }

    return null;
}

// =======================================================================================
// Specific Functions
// =======================================================================================

/**
 * Closes the image lightbox and scrolls the active element into view.
 */
function closeLightbox() {
    const currentElement = getCurrentElement();
    if (!currentElement) return;
    setActiveMedia(currentElement);

    // Close the lightbox by clicking the close button
    const closeButton = document.querySelector(".mx_AccessibleButton.mx_ImageView_button.mx_ImageView_button_close");
    if (closeButton) closeButton.click();

    let attempts = 0;
    const maxAttempts = 10;

    function checkScroll() {
        const rect = currentElement.getBoundingClientRect();
        const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;

        if (!isInView && attempts < maxAttempts) {
            currentElement.scrollIntoView({
                block: isLastElement(currentElement) ? "end" : "center",
                behavior: "auto",
            });
            attempts++;
        } else if (isInView) {
            // Check a second time after a short delay
            setTimeout(() => {
                const rectAfterScroll = currentElement.getBoundingClientRect();
                const isStillInView = rectAfterScroll.top >= 0 && rectAfterScroll.bottom <= window.innerHeight;
                if (!isStillInView && attempts < maxAttempts) {
                    currentElement.scrollIntoView({
                        block: isLastElement(currentElement) ? "end" : "center",
                        behavior: "auto",
                    });
                    attempts++;
                } else {
                    clearInterval(scrollCheckInterval);
                }
            }, 200); // Adjust the delay as needed
        } else {
            clearInterval(scrollCheckInterval);
        }
    }

    const scrollCheckInterval = setInterval(checkScroll, 200);
}

/**
 * Replaces the content of the lightbox with the media from the currently active timeline element.
 */
function replaceContentInLightbox() {
    let imageLightboxSelector = document.querySelector(
        ".mx_Dialog_lightbox .mx_ImageView_image_wrapper > img, .mx_Dialog_lightbox .mx_ImageView_image_wrapper > video"
    );
    if (!imageLightboxSelector) return;

    const currentElement = getActiveMedia() ?? getCurrentElement();
    if (!currentElement) return;

    const mediaSrc = currentElement.querySelector(
        "div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image img.mx_MImageBody_thumbnail, video.mx_MVideoBody"
    )?.src;
    const imageSource = getHqImages ? mediaSrc?.replace(/thumbnail/, "download") : mediaSrc;
    if (!imageSource) {
        showLightboxError(imageLightboxSelector);
        return;
    }

    // Switch between <img> and <video> tags based on the new media element
    const hasVideo = currentElement.querySelector("video");
    const hasImg = currentElement.querySelector("img");
    if (hasVideo && imageLightboxSelector.tagName === "IMG") {
        imageLightboxSelector.style.display = ""; // clear before innerHTML serialization to avoid inheriting display:none
        imageLightboxSelector.src = imageSource;
        const parent = imageLightboxSelector.parentElement;
        parent.innerHTML = parent.innerHTML.replace(/^<img/, "<video");

        showLightboxLoader();
        setTimeout(() => {
            // After replacing innerHTML, the old imageLightboxSelector is invalid!
            const newVideo = parent.querySelector("video");
            if (newVideo) {
                newVideo.setAttribute("controls", "");
                newVideo.autoplay = true;
                newVideo.addEventListener("loadeddata", hideLightboxLoader, { once: true });
                newVideo.addEventListener("error", hideLightboxLoader, { once: true });
                if (newVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) hideLightboxLoader();
                newVideo.play();
            }
        }, 300);
        return;
    }
    // Only switch to <img> if the current element contains an image and NOT a video!
    if (hasImg && !hasVideo && imageLightboxSelector.tagName === "VIDEO") {
        imageLightboxSelector.style.display = ""; // clear before innerHTML serialization to avoid inheriting display:none
        imageLightboxSelector.src = imageSource;
        const parent = imageLightboxSelector.parentElement;
        parent.innerHTML = parent.innerHTML.replace(/^<video/, "<img");
        const newImg = parent.querySelector("img");
        if (newImg) {
            showLightboxLoader();
            newImg.addEventListener("load", hideLightboxLoader, { once: true });
            newImg.addEventListener("error", hideLightboxLoader, { once: true });
        }
        return;
    }
    // If the current lightbox element is a video, play automatically
    if (imageLightboxSelector.tagName === "VIDEO") {
        imageLightboxSelector.setAttribute("controls", "");
        imageLightboxSelector.autoplay = true;
        imageLightboxSelector.addEventListener("loadeddata", hideLightboxLoader, { once: true });
        imageLightboxSelector.addEventListener("error", hideLightboxLoader, { once: true });
        imageLightboxSelector.src = imageSource;
        if (imageLightboxSelector.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            showLightboxLoader();
        } else {
            hideLightboxLoader();
        }
        imageLightboxSelector.play();
    } else {
        imageLightboxSelector.addEventListener("load", hideLightboxLoader, { once: true });
        imageLightboxSelector.addEventListener("error", hideLightboxLoader, { once: true });
        imageLightboxSelector.src = imageSource;
        if (!imageLightboxSelector.complete) {
            showLightboxLoader();
        } else {
            hideLightboxLoader();
        }
    }
}

// =======================================================================================
// Event Listeners
// =======================================================================================

function addEventListeners() {
    document.addEventListener(
        "keydown",
        function (event) {
            // Navigation in lightbox view
            if (document.querySelector(".mx_Dialog_lightbox")) {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    closeLightbox();
                } else {
                    // prevent default behavior for regular keys to not write in message composer
                    // but let modifier combos (Ctrl+R, Ctrl+S, ...) and function keys (F12, ...) pass through
                    const isModifierCombo = event.ctrlKey || event.altKey || event.metaKey;
                    const isFunctionKey = /^F\d+$/.test(event.key);
                    if (
                        !isModifierCombo &&
                        !isFunctionKey &&
                        event.key !== "a" &&
                        event.key !== " " &&
                        event.key !== "ArrowUp" &&
                        event.key !== "ArrowDown" &&
                        event.key !== "ArrowLeft" &&
                        event.key !== "ArrowRight"
                    ) {
                        event.preventDefault();
                        event.stopPropagation(); // prevent focus on message composer
                    }
                }
            }

            // Navigation in timeline view
            // navigate only if the focus is not on message composer, input is empty and no dialog is open
            if (document.querySelector("#mx_BaseDialog_title")) return;
            const messageComposerInputEmpty = document.querySelector(
                ".mx_BasicMessageComposer_input:not(.mx_BasicMessageComposer_inputEmpty)"
            );
            const isNotInEmptyMessageComposer = document.activeElement !== messageComposerInputEmpty;
            if (isNotInEmptyMessageComposer) {
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    navigate("up");
                    document.activeElement.blur(); // remove focus from message composer
                } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                    event.preventDefault();
                    navigate("down");
                    document.activeElement.blur(); // remove focus from message composer
                }
            }

            // navigate only with this keys if there is an active media element and remove active media if the key is not a or Space to allow writing again
            if (getActiveMedia()) {
                if (event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation(); // prevent focus on message composer
                    navigate("down");
                } else if (event.key === "a") {
                    event.preventDefault();
                    event.stopPropagation(); // prevent focus on message composer
                    navigate("up");
                }
            }
        },
        true
    );

    // add listeners only once
    let lightboxListenersAdded = false;
    let timelineListenerAdded = false;

    const observer = new MutationObserver(() => {
        const lightbox = document.querySelector(".mx_Dialog_lightbox");

        if (lightbox && !lightboxListenersAdded) {
            // Remove timeline wheel listener when lightbox opens
            if (timelineListenerAdded) {
                document.removeEventListener("wheel", removeActiveMedia, { passive: false });
                timelineListenerAdded = false;
            }

            waitForElement(".mx_ImageView").then((element) => {
                // Check if the event listeners are already added
                if (!element._listenersAdded) {
                    element.addEventListener(
                        "click",
                        (event) => {
                            if (event.target.matches(".mx_ImageView > .mx_ImageView_image_wrapper > img")) {
                                closeLightbox();
                            }
                        },
                        true
                    );

                    element.addEventListener("wheel", getWheelDirection, { passive: false });

                    // Mark the listener as added
                    element._listenersAdded = true;
                }

                lightboxListenersAdded = true;

                // set first opened image in lightbox as active element in timeline view
                const src = document.querySelector(".mx_ImageView > .mx_ImageView_image_wrapper > img")?.src;
                if (src) {
                    const img = document.querySelector(`ol.mx_RoomView_MessageList img[src="${src}"]`);
                    if (img) {
                        const messageContainer = img.closest("li");
                        setActiveMedia(messageContainer);
                    }
                }
            });
        } else if (!lightbox && !timelineListenerAdded) {
            // Workaround: When the lightbox is closed, scroll to the active element as click event does not work after a video
            const activeMedia = getActiveMedia();
            if (activeMedia) {
                activeMedia.scrollIntoView({
                    block: isLastElement(activeMedia) ? "end" : "center",
                    behavior: "auto",
                });
            }

            // remove ActiveMedia in timeline view to allow scrolling
            document.addEventListener("wheel", removeActiveMedia, { passive: false });

            timelineListenerAdded = true;
            lightboxListenersAdded = false; // Reset the lightbox listener flag when lightbox is closed
        }
    });

    // to detect when the light box is switched on or off
    observer.observe(document.body, { childList: true, subtree: true });
}

// =======================================================================================
// Main
// =======================================================================================

function main() {
    console.log(GM_info.script.name, "started");

    // Add event listeners for navigation
    addEventListeners();
}

if (
    /^element\.[^.]+\.[^.]+$/.test(document.location.host) ||
    /^matrixclient\.[^.]+\.[^.]+$/.test(document.location.host) ||
    /^app.schildi.chat/.test(document.location.host) ||
    /app.element.io/.test(document.location.href)
) {
    main();
}
