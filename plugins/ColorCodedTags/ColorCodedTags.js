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
    return await fetch(img.src, { headers: { 'If-None-Match': "9b35426b50fa0f91cb084b3d50833497" } }).then((res) => res.status === 304);
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
      color: "white",
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
      color: "white",
      backgroundColor: "#FF10F0",
      filter: "brightness(0) saturate(100%) invert(79%) sepia(84%) saturate(3008%) hue-rotate(332deg) brightness(101%) contrast(92%)",
    },
    // FINISHERS
    cd: {
      color: "white",
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
      color: "white",
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
    const isInput = el.tagName === "INPUT" || el.tagName === "TEXTAREA";
    const text = isInput ? el.value : el.innerText;

    const { realTagName } = parseTag(text);
    if (realTagName === undefined) return;

    el.title = text;
    if (!CONFIG.showCategoryCode) {
      if (isInput) el.value = realTagName;
      else el.innerText = realTagName;
    }
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
      style(verticalLine, { color });
      style(svg, { color });
    }
    if (!CONFIG.showCategoryCode) div.childNodes[0].nodeValue = realTagName;
    style(div, { color })
    style(tag, { backgroundColor, color });
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

    //const { color, backgroundColor } = categoryColors[category];
    //style(label, { backgroundColor, color });
  }

  // Tags in Wall View (markers)
  async function colorCodeWallTag(label) {
    //const tagName = marker.querySelector(".tag-item");
    const { category, realTagName } = parseTag(label.innerText);
    if (category === undefined || realTagName === undefined) return;

    renameTag(label);

    //const { backgroundColor } = categoryColors[category];
    //style(label, { backgroundColor });
  }

  function parseTag(string) {
    const [_, category, realTagName, nameOverride] =
      string.match(/(?:(\w+)(?:[^.]+)\.)\s+([^[]+)(?:\[([^[]+)])?/) ?? [];
    if (!(category in categoryColors)) return {};

    return { category, realTagName, stashDbName: nameOverride || realTagName };
  }

  onElementReady(".tag-item:has(a > div)", colorCodeTag, script_name);
  onElementReady(".scene-markers-panel .primary-card.col-12.col-sm-6.col-xl-6.card h3 ", colorCodeSceneMarker, script_name);
  onElementReady(".wall-tag", colorCodeWallTag, script_name);
  onElementReady(".tag-details h2", colorCodeDetails, script_name);
  onElementReady(".tag-card", colorCodeCard, script_name);
  onElementReady(".tag-list-row a", renameTag, script_name);
  onElementReady(".tag-parent-tags a", renameTag, script_name);
  onElementReady("a[href*=tags] h6", renameTag, script_name);
  onElementReady(".react-select__multi-value__label", colorCodeMultivalueLabel, script_name);
  onElementReady(".TagTagger-header h2", renameTag, script_name);
  onElementReady(".tag-name", renameTag, script_name);
  onElementReady(".TagTagger-details-text .text-input.form-control", renameTag, script_name);


})();
