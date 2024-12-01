// ==UserScript==
// @name           Matrix Element Media Navigation
// @description    Enables seamless scrolling through images and videos through keyboard and mouse wheel navigation in timeline (up/down & left/right keys) and lightbox view (same keys + mousewheel). Its also a workaround against the Element jumps on timeline pagination/scrolling issue #8565.
// @version        20241201
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

// =======================================================================================
// Layout
// =======================================================================================

GM_addStyle(`
    .mx_ImageView_image.mx_ImageView_image_animatingLoading {
        transition: transform 0.01s ease;
    }
    .active-element > div.mx_EventTile_line.mx_EventTile_mediaLine.mx_EventTile_image {
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
    const direction = event.deltaY < 0 ? "up" : "down";
    navigateTo(direction);
    replaceContentInLightbox();
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
    const currentElement = document.querySelector("[data-active]") || getCurrentElement();
    const siblingType = direction === "down" ? "nextElementSibling" : "previousElementSibling";
    const nextElement = findSibling(currentElement, siblingType);

    if (nextElement) {
        setActiveElement(nextElement);
    }
}

/**
 * Sets an element as the active one and scrolls it into view.
 * @param {Element} element - DOM element to set active.
 */
function setActiveElement(element) {
    const activeClass = "active-element";
    const currentActive = document.querySelector(`.${activeClass}`);
    if (currentActive) {
        currentActive.classList.remove(activeClass);
        currentActive.removeAttribute("data-active");
    }

    if (element) {
        element.classList.add(activeClass);
        element.setAttribute("data-active", "true");
        element.scrollIntoView({
            block: isLastElement(element) ? "end" : "center",
            behavior: "auto",
        });
    }
}

function removeActiveElement() {
    const activeElement = document.querySelector("[data-active]"); // Find the currently active element
    if (activeElement) {
        activeElement.classList.remove("active-element"); // Remove the active class
        activeElement.removeAttribute("data-active"); // Remove the data-active attribute
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

    let currentElement = document.querySelector("[data-active]");
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
            if (document.querySelector(".mx_Dialog_lightbox")) {
                // Navigation in lightbox
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    navigateTo("up");
                    replaceContentInLightbox();
                } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                    event.preventDefault();
                    navigateTo("down");
                    replaceContentInLightbox();
                } else if (event.key === "Escape") {
                    event.stopPropagation();
                    closeImageBox();
                }
            } else {
                // Navigation in timeline
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    navigateTo("up");
                } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                    event.preventDefault();
                    navigateTo("down");
                }
            }
        },
        true
    );

    const observer = new MutationObserver(() => {
        const lightbox = document.querySelector(".mx_Dialog_lightbox");
        if (lightbox) {
            waitForElement(".mx_ImageView").then((element) => {
                element.addEventListener("mousedown", closeImageBox);
                element.addEventListener("wheel", getWheelDirection, { passive: false });
            }, true);
        } else {
            document.addEventListener("wheel", removeActiveElement, { passive: false });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

if (/^element\.[^.]+\.[^.]+$/.test(document.location.host)) {
    main();
}
