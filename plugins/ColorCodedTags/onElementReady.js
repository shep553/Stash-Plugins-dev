/**
 * @private
 *
 * Converts a given string to a valid attribute name
 *
 * @param {String} string - Any non-empty string
 * @returns {String} - A string that can safely be used as an attribute name in the DOM
 */
function toAttributeName(string) {
    return string
      ?.toLowerCase()
      .replaceAll(/[^a-z-]+/g, " ")
      .split(" ")
      .filter(s => s)
      .join("-");
  }
  
/**
 * @private
 *
 * Query for new DOM nodes matching a specified selector.
 *
 * @param {String} selector - CSS Selector
 * @param {function=} callback - Callback
 * @param {String} [attributeName] - Remember already found elements with this attribute name
 */
let queryForElements = (selector, callback, attributeName = 'was-queried') => {
    // Search for elements by selector
    [...document.querySelectorAll(selector)].forEach((element) => {
      if (element.hasAttribute(attributeName)) { return }
      element.setAttribute(attributeName, 'true')
      callback(element)
    })
  }
  
/**
 * @public
 *
 * Wait for Elements with a given CSS selector to enter the DOM.
 * Returns a Promise resolving with new Elements, and triggers a callback for every Element.
 *
 * @param {String} selector - CSS Selector
 * @param {Boolean=} findOnce - Stop querying after first successful pass: requires callback to return a truthy value to indicate the correct element was indeed found
 * @param {function=} [callback] - Callback with Element
 * @param {String} [attributeName] - Remember already found elements with this attribute name
 * @returns {Promise<Element>} - Resolves with Element
 */
let onElementReady = (selector, callback = () => {}, attributeName, findOnce = false) => {
    let foundElement = undefined;
  
    return new Promise((resolve) => {
        // Initial Query
        queryForElements(selector, (element) => {
            if (callback(element) && findOnce) {
            resolve(element);
            }
        }, toAttributeName(attributeName));
  
        // Continuous Query
        const observer = new MutationObserver(() => {
  
            // DOM Changes detected
            queryForElements(selector, (element) => {
            if (callback(element) && findOnce) {
                resolve(element);
                observer.disconnect()
            }
            }, toAttributeName(attributeName));
        })
  
        // Observe DOM Changes
        observer.observe(document.documentElement, {
            attributes: false,
            childList: true,
            subtree: true
        })
    })
  }