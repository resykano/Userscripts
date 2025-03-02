// ==UserScript==
// @name           Matrix Element Media Navigation
// @description    Enables navigation through images and videos in timeline (up/down & left/right & a/Space keys) and lightbox (same keys + mousewheel) view. Its also a workaround helping against the jumps on timeline pagination/scrolling issue #8565
// @version        20250302
// @author         resykano
// @icon           https://icons.duckduckgo.com/ip2/element.io.ico
// @match          *://*/*
// @grant          GM_xmlhttpRequest
// @grant          GM_addStyle
// @compatible     chrome
// @license        GPL3
// @noframes
// ==/UserScript==

"use strict";

// =======================================================================================
// Elements
// =======================================================================================

let messageContainerSelector = "ol.mx_RoomView_MessageList li.mx_EventTile";

const activeMediaAttribute = "data-active-media";
function getActiveMedia() {
    return document.querySelector(`[${activeMediaAttribute}="true"]`);
}

// =======================================================================================
// Layout
// =======================================================================================

GM_addStyle(`
    /* Lightbox */
    img.mx_ImageView_image.mx_ImageView_image_animating,
    img.mx_ImageView_image.mx_ImageView_image_animatingLoading {
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
        if (checkElement()) {
            return resolve(checkElement());
        }

        const observer = new MutationObserver(() => {
            if (checkElement()) {
                observer.disconnect();
                resolve(checkElement());
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
    navigateTo(direction);
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
function navigateTo(direction) {
    let currentElement;
    if (getActiveMedia()) {
        currentElement = getActiveMedia();
    } else {
        console.error("activeMedia not found");
        currentElement = getCurrentElement();
    }
    const siblingType = direction === "down" ? "nextElementSibling" : "previousElementSibling";
    const nextActiveMedia = findSibling(currentElement, siblingType);

    if (nextActiveMedia) {
        // DEBUG
        // console.log("nextActiveMedia: ", nextActiveMedia);
        setActiveMedia(nextActiveMedia);
    }

    if (document.querySelector(".mx_Dialog_lightbox")) {
        replaceContentInLightbox();
    }
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
        // console.error("removeActiveMedia");
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
function closeImageBox() {
    const currentElement = getCurrentElement();
    if (currentElement) {
        setActiveMedia(currentElement);
    }

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
        } else {
            clearInterval(scrollCheckInterval);
        }
    }

    const scrollCheckInterval = setInterval(checkScroll, 200);
}

/**
 * Replaces the content of the lightbox with the next or previous picture depending on Mouse Wheel or cursor direction
 *
 * @param {string} direction u=Up or d=Down
 */
function replaceContentInLightbox() {
    let imageLightboxSelector = document.querySelector(
        ".mx_Dialog_lightbox .mx_ImageView_image_wrapper > img, .mx_Dialog_lightbox .mx_ImageView_image_wrapper > video"
    );
    if (!imageLightboxSelector) return;

    imageLightboxSelector.setAttribute("controls", "");

    let currentElement = getActiveMedia();
    if (!currentElement) {
        currentElement = getCurrentElement();
    }

    // Update the lightbox content with the new media source
    if (currentElement) {
        let imageSource;
        // with HQ images the switch to the next image is slower
        const getHqImages = false;
        if (getHqImages) {
            imageSource = currentElement
                .querySelector(
                    "div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image img.mx_MImageBody_thumbnail, video.mx_MVideoBody"
                )
                ?.src.replace(/thumbnail/, "download");
        } else {
            imageSource = currentElement.querySelector(
                "div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image img.mx_MImageBody_thumbnail, video.mx_MVideoBody"
            )?.src;
        }

        imageLightboxSelector.src = imageSource;

        // Switch between <img> and <video> tags based on the new media element
        if (currentElement.querySelector("video") && imageLightboxSelector?.tagName === "IMG") {
            imageLightboxSelector.parentElement.innerHTML = imageLightboxSelector.parentElement.innerHTML.replace(/^<img/, "<video");

            setTimeout(() => {
                imageLightboxSelector.setAttribute("controls", "");
            }, 300);
        }
        if (currentElement.querySelector("img") && imageLightboxSelector?.tagName === "VIDEO") {
            imageLightboxSelector.parentElement.innerHTML = imageLightboxSelector.parentElement.innerHTML.replace(/^<video/, "<img");
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
                    closeImageBox();
                }
            }

            // Navigation in timeline view
            // navigate only if the focus is not on message composer and input is empty
            const messageComposerInputEmpty = document.querySelector(
                ".mx_BasicMessageComposer_input:not(.mx_BasicMessageComposer_inputEmpty)"
            );
            const isNotInEmptyMessageComposer = document.activeElement !== messageComposerInputEmpty;
            if (isNotInEmptyMessageComposer) {
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    navigateTo("up");
                    document.activeElement.blur(); // remove focus from message composer
                } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                    event.preventDefault();
                    navigateTo("down");
                    document.activeElement.blur(); // remove focus from message composer
                }
            }

            // navigate only if there is an active media element
            if (getActiveMedia()) {
                if (event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation(); // prevent focus on message composer
                    navigateTo("down");
                } else if (event.key === "a") {
                    event.preventDefault();
                    event.stopPropagation(); // prevent focus on message composer
                    navigateTo("up");
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
                            const target = event.target;
                            // Close lightbox if clicking the background
                            if (target.matches(".mx_ImageView > .mx_ImageView_image_wrapper > img")) {
                                closeImageBox();
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
                const src = document.querySelector(".mx_ImageView > .mx_ImageView_image_wrapper > img").src;
                const img = document.querySelector(`ol.mx_RoomView_MessageList img[src="${src}"]`);
                const messageContainer = img.closest("li");
                setActiveMedia(messageContainer);
            }, true);
            // Timeline view mode
        } else if (!lightbox && !timelineListenerAdded) {
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
