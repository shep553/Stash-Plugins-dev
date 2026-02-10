// @author      Maista & AdultSun
// @description Built on the work of AdultSun and peolic - modified by coderdudeo to include tags in markers and use stash interface
// @namespace   com.maista.userscripts
// @version     0.0.5
(async () => {
  "use strict";

  const script_name = "ColorCodedTags";
  const userSettings = await csLib.getConfiguration("ColorCodedTags", {});
  const CONFIG = parseSettings(userSettings ?? "");

  function parseSettings(settings) {
    return Object.keys(settings).reduce((acc, key) => {
      if (
        key === "showCategoryCode"
      ) {
        acc[key] = settings[key];
      } else {
        // does nothing for now
      }
      return acc;
    }, {});
  }

  // The default tag image probably has a static etag so it's hardcoded here
  async function has_default_image(img) {
    return await fetch(img.src, {headers: {'If-None-Match': "9b35426b50fa0f91cb084b3d50833497"}}).then((res) => res.status === 304);
  }

  // All colors converted from RGB to filter using https://angel-rs.github.io/css-color-filter-generator/
  const categoryColors = {
    // Hidden tags
    h: {
      hidden: true
    },
    u: {
      hidden: true
    },
	  // SCENE
		// GROUP MAKEUP
	  a: {
		color: "black",
		backgroundColor: "#ffb86c",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(1078%) hue-rotate(89deg) brightness(85%) contrast(89%)",
	  },
		// SHOT TYPE
	  aa: {
		color: "black",
		backgroundColor: "#f1fa8c",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(1078%) hue-rotate(89deg) brightness(85%) contrast(89%)",
	  },
		// LOCATIONS
	  ad: {
		color: "black",
		backgroundColor: "#50fa7b",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(1078%) hue-rotate(89deg) brightness(85%) contrast(89%)",
	  },
		// SURFACES
	  af: {
		color: "black",
		backgroundColor: "#06C135",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(1078%) hue-rotate(89deg) brightness(85%) contrast(89%)",
	  },
		// THEME
	  as: {
		color: "black",
		backgroundColor: "#55DDFC",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(1078%) hue-rotate(89deg) brightness(85%) contrast(89%)",
	  },
	  // PEOPLE
		// RACE
	  b: {
		color: "black",
		backgroundColor: "#04CEFB",
		filter: "brightness(0) saturate(100%) invert(89%) sepia(16%) saturate(3141%) hue-rotate(231deg) brightness(91%) contrast(84%)",
	  },
		// AGE GROUP
	  ba: {
		color: "black",
		backgroundColor: "#04B9E2",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(3719%) hue-rotate(181deg) brightness(96%) contrast(88%)",
	  },
		// GENITALS
	  bd: {
		color: "black",
		backgroundColor: "#BD93F9",
		filter: "brightness(0) saturate(100%) invert(78%) sepia(18%) saturate(3719%) hue-rotate(181deg) brightness(96%) contrast(88%)",
	  },
		// CLOTHING
	  bf: {
		color: "black",
		backgroundColor: "#A164F6",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
	  // ACTION
		// ACCESORIES
	  c: {
		color: "black",
		backgroundColor: "#FF7AF6",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
		// ACTS
	  ca: {
		color: "black",
		backgroundColor: "#FF10F0",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
		// FINISHERS
	  cd: {
		color: "black",
		backgroundColor: "#CC00BE",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
	  // Highlight neutral tags
	  y: {
		color: "black",
		backgroundColor: "#ff5555",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
	  // Only applied manually for personal bookmarking purposes
	  x: {
		color: "black",
		backgroundColor: "#ff5555",
		filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
	  },
	};


  function style(el, styles) {
    Object.assign(el.style, styles);
    return el;
  }

  // Generic enough for any element that only holds the tag name:
  // Tags in list view
  // Tags in scene list view
  // Parent tag names in grid view
  function renameTag(el) {
    const { realTagName } = parseTag(el.innerText);
    if (realTagName === undefined) return;

    el.title = el.innerText;
    if (!CONFIG.showCategoryCode) el.innerText = realTagName;
  }


  // Tags that show up on scene details and in popovers
  function colorCodeTag(tag) {
    const div = tag.querySelector("a > div");
    const { category, realTagName } = parseTag(div.childNodes[0].textContent);
    if (category === undefined || realTagName === undefined) return;
    const { color, backgroundColor, hidden } = categoryColors[category];
    const indicatingHierarchy = tag.closest('.row')?.innerText.match(/(parent\s|sub-)tags/im) ?? false;
    if (hidden && !indicatingHierarchy) tag.remove();
    const indicatingFolderTree = tag.querySelector("span") ?? false;
    if (indicatingFolderTree) {
        const verticalLine = tag.querySelector("span > span")
        const svg = tag.querySelector("path")
        style(verticalLine, {color});
        style(svg, {color});
    }
    if (!CONFIG.showCategoryCode) div.childNodes[0].nodeValue = realTagName;
    style(div, {color})
    style(tag, {backgroundColor, color});
  }

  // Detail page for individual tag
  async function colorCodeDetails(header) {
    const { category, realTagName } = parseTag(header.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(header);

    const img = header.previousSibling;
    if (await has_default_image(img)) {
      const { filter } = categoryColors[category];
      style(header.previousSibling, { filter });
    }
  }

  // Tags that have been added to edit boxes
  function colorCodeMultivalueLabel(label) {
    const { category, realTagName } = parseTag(label.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(label);

    const { color, backgroundColor } = categoryColors[category];
    style(label.parentElement, { backgroundColor, color });
  }

  // Tags in grid view
  async function colorCodeCard(card) {
    const tagName = card.querySelector("h5 div");
    const { category, realTagName } = parseTag(tagName.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(tagName);

    const img = card.querySelector("img");
    if (await has_default_image(img)) {
      const { filter } = categoryColors[category];
      style(img, { filter });
    }
  }

  // Tags in scene markers
  async function colorCodeSceneMarker(label) {
    //const tagName = marker.querySelector(".tag-item");
    const { category, realTagName } = parseTag(label.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(label);

    const { color, backgroundColor } = categoryColors[category];
    style(label, { backgroundColor, color });
  }

  // Tags in Wall View (markers)
  async function colorCodeWallTag(label) {
    //const tagName = marker.querySelector(".tag-item");
    const { category, realTagName } = parseTag(label.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(label);

    const { backgroundColor } = categoryColors[category];
    style(label, { backgroundColor });
  }

  function parseTag(string) {
    const [_, category, realTagName, nameOverride] =
      string.match(/(?:(\w+)(?:[^.]+)\.)\s+([^[]+)(?:\[([^[]+)])?/) ?? [];
    if (!(category in categoryColors)) return {};

    return { category, realTagName, stashDbName: nameOverride || realTagName };
  }

  // Hack to fix mismatched tags after submitting a new scene to StashDB
  // Attempts to map mismatched tags to their StashDB counterparts, either by simply
  // stripping the letter-number prefix or by using the override in [square brackets]
  // a1. Anal => "Anal"
  // p3. Brunette [Brown Hair (Female)] => "Brown Hair (Female)"
  async function mapTagsForDraft(header) {
    if (!header.innerText.match(/unmatched data/i)) return;

    const tagList = [...header.nextSibling.children]
      .find((li) => li.innerText.startsWith("Tags"))
      ?.querySelector("span");
    if (!tagList) return;

    // Correct list of tags that StashDB can understand
    const stashDbTags = tagList.innerText
      .match(/(?:\w(?:[^.]+)\.)\s+([^,]+)/g)
      .map((s) => parseTag(s).stashDbName)
      .filter((s) => s !== undefined);

    console.log(stashDbTags);
    let unmatchedTags = [...stashDbTags];
    tagList.innerText = unmatchedTags.join(", ");

    await onElementReady(".TagSelect", async function (tagSelect) {
      // The input field that we need to input all of our tag attempts into
      const tagInputField = tagSelect.querySelector("input");

      // This is the hackiest part
      for (const tag of stashDbTags) {
        setNativeValue(tagInputField, tag);
        // Resolves when either:
        // - 'No tags found for "Foo Bar"' box appears
        // - The list of tags appear AND one of them matches the tag name
        // - After 1000 milliseconds: a reasonable timeout for my internet connection
        await Promise.race([
          onElementReady(".TagSelect-select-value", (el) => {
              if (el.innerText.toLowerCase() !== tag.toLowerCase()) {
                return false;
              }
              el.click();

              // Remove matched tag from the list of unmatched tags
              unmatchedTags = unmatchedTags.filter((t) => t !== tag);
              tagList.innerText = unmatchedTags.join(", ") || "All tags have been matched";
              return true;
          }, `might match ${tag}`, true),
          onElementReady(".TagSelect .react-select__menu-notice--no-options", () => true, `no results ${tag}`, true), // No matching tags found
          new Promise(resolve => setTimeout(() => { resolve("Timed out") }, 2000))
        ]);
      }

      // Clear the last input in case we failed to match
      setNativeValue(tagInputField, "");
    }, script_name);
  }

  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    )?.set;

    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      throw new Error("The given element does not have a value setter");
    }

    const eventName = element instanceof HTMLSelectElement ? "change" : "input";
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  }


  onElementReady(".tag-item:has(a > div)", colorCodeTag, script_name);
  onElementReady(".scene-markers-panel .tag-item", colorCodeSceneMarker, script_name);
  onElementReady(".wall-tag", colorCodeWallTag, script_name);
  onElementReady(".tag-details h2", colorCodeDetails, script_name);
  onElementReady(".tag-card", colorCodeCard, script_name);
  onElementReady(".tag-list-row a", renameTag, script_name);
  onElementReady(".tag-parent-tags a", renameTag, script_name);
  onElementReady("a[href*=tags] h6", renameTag, script_name);
  onElementReady(".react-select__multi-value__label", colorCodeMultivalueLabel, script_name);

  if (document.documentURI.match(/stashdb/)) {
    onElementReady("h6", mapTagsForDraft, script_name);
  }
})();
