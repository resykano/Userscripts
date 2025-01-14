// ==UserScript==
// @name           Matrix Element Media Navigation
// @description    Enables navigation through images and videos in timeline (up/down & left/right keys) and lightbox (same keys + mousewheel) view. Its also a workaround helping a bit against the jumps on timeline pagination/scrolling issue #8565
// @version        20250114
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
// Config/Requirements
// =======================================================================================

let messageContainerSelector = "ol.mx_RoomView_MessageList li.mx_EventTile";
const activeElementClass = "active-element";

// =======================================================================================
// Layout
// =======================================================================================

GM_addStyle(`
    img.mx_ImageView_image.mx_ImageView_image_animating,
    img.mx_ImageView_image.mx_ImageView_image_animatingLoading {
        transition: transform 0.01s ease;
        transition: none !important;
        transform: unset !important;
        width: 100% !important;
        height: 100% !important;
        object-fit: contain;
    }
    
    .active-element > div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image {
        box-shadow: 0 0 2px 2px #007a62;
        background-color: var(--cpd-color-bg-subtle-secondary);
    }

    .mx_ImageView > .mx_ImageView_image_wrapper > img {
        cursor: default !important;
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
function waitForElement(selector, index = 0, timeout = 5000) {
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
    // const currentElement = document.querySelector(`.${activeClass}`) || getCurrentElement();
    let currentElement;
    if (document.querySelector(`.${activeElementClass}`)) {
        currentElement = document.querySelector(`.${activeElementClass}`);
    } else {
        console.error("activeElement not found");
        currentElement = getCurrentElement();
    }
    const siblingType = direction === "down" ? "nextElementSibling" : "previousElementSibling";
    const nextActiveElement = findSibling(currentElement, siblingType);

    if (nextActiveElement) {
        console.log("nextActiveElement: ", nextActiveElement);
        setActiveElement(nextActiveElement);
    }

    if (document.querySelector(".mx_Dialog_lightbox")) {
        replaceContentInLightbox();
    }
}

/**
 * Sets an element as the active one and scrolls it into view.
 * @param {Element} nextActiveElement - DOM element to set active.
 */
function setActiveElement(nextActiveElement) {
    if (nextActiveElement) {
        removeActiveElement();

        nextActiveElement.classList.add(activeElementClass);
        nextActiveElement.scrollIntoView({
            block: isLastElement(nextActiveElement) ? "end" : "center",
            behavior: "auto",
        });
    } else {
        console.error("setActiveElement: nextActiveElement not found");
    }
}

/**
 * Removes the "active-element" class from the currently active element.
 *
 * This function searches for an element with the class name stored in the
 * variable `activeElementClass` and removes the "active-element" class from it.
 * If no such element is found, the function does nothing.
 */
function removeActiveElement() {
    const activeElement = document.querySelector(`.${activeElementClass}`); // Find the currently active element
    if (activeElement) {
        console.error("removeActiveElement");
        activeElement.classList.remove("active-element"); // Remove the active class
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
        setActiveElement(currentElement);
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

    let currentElement = document.querySelector(`.${activeElementClass}`);
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
// Main
// =======================================================================================

function main() {
    document.addEventListener(
        "keydown",
        function (event) {
            // if in lightbox
            if (document.querySelector(".mx_Dialog_lightbox")) {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    closeImageBox();
                }
            }
            // Navigation
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                event.preventDefault();
                navigateTo("up");
            } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                event.preventDefault();
                navigateTo("down");
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
                document.removeEventListener("wheel", removeActiveElement, { passive: false });
                timelineListenerAdded = false;
            }

            waitForElement(".mx_ImageView").then((element) => {
                // Check if the event listeners are already added
                if (!element._listenersAdded) {
                    element.addEventListener("mousedown", (event) => {
                        const target = event.target;
                        // Close lightbox if clicking the background
                        if (target.matches(".mx_ImageView > .mx_ImageView_image_wrapper > img")) {
                            closeImageBox();
                        }
                    });

                    element.addEventListener("wheel", getWheelDirection, { passive: false });

                    // Mark the listener as added
                    element._listenersAdded = true;
                }

                lightboxListenersAdded = true;
            }, true);
            // Timeline view mode
        } else if (!lightbox && !timelineListenerAdded) {
            // remove ActiveElement in timeline view to allow scrolling
            document.addEventListener("wheel", removeActiveElement, { passive: false });

            timelineListenerAdded = true;
            lightboxListenersAdded = false; // Reset the lightbox listener flag when lightbox is closed
        }
    });

    // to detect when the light box is switched on or off
    observer.observe(document.body, { childList: true, subtree: true });
}

if (/^element\.[^.]+\.[^.]+$/.test(document.location.host) || /^matrixclient\.[^.]+\.[^.]+$/.test(document.location.host)) {
    main();
}
