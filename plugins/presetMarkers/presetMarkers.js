(function () {
  console.log("[PresetMarkers] script loaded, build:", "debug-2");

  const PluginApi = window.PluginApi;
  const React = PluginApi.React;
  const { useState, useEffect, useCallback } = React;

  const PLUGIN_ID = "presetMarkers"; // must match the .yml filename stem (Stash derives the id from it, not a manifest field)

  // Using a raw fetch to Stash's /graphql endpoint rather than guessing the
  // shape of PluginApi.GQL, since that's a generated client whose exact
  // surface (hooks vs raw client) can vary by Stash version. This endpoint
  // is stable and always available from the same origin.
  async function gql(query, variables) {
    const res = await fetch("/graphql", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
  }

  const GET_SETTINGS = `
    query PresetMarkers_GetSettings {
      configuration { plugins }
    }
  `;

  const FIND_TAGS = `
    query PresetMarkers_FindTags {
      findTags(filter: { per_page: -1 }) {
        tags { id name }
      }
    }
  `;

  function parsePresets(raw) {
    try {
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("[PresetMarkers] Invalid presets JSON in plugin settings:", e);
      return [];
    }
  }

  // Reads the current playback position from Stash's own video.js player,
  // the same source its native "create marker" button uses. Returns null
  // if no player is mounted (e.g. panel rendered before playback starts).
  function getCurrentPlayerTime() {
    try {
      const player = PluginApi.utils?.InteractiveUtils?.getPlayer?.();
      const t = player?.currentTime?.();
      return typeof t === "number" && !isNaN(t) ? t : null;
    } catch (e) {
      console.error("[PresetMarkers] Could not read player time:", e);
      return null;
    }
  }

  const MARKERS_TAB_KEY = "scene-markers-panel";

  function isMarkersTabActive() {
    const active = document.querySelector(".nav-link.active[data-rb-event-key]");
    return active?.getAttribute("data-rb-event-key") === MARKERS_TAB_KEY;
  }

  // Mimics Stash's own duration display: "h:mm:ss[.ms]" (hours omitted when 0).
  function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds)) return "";
    const sign = seconds < 0 ? "-" : "";
    seconds = Math.abs(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const secStr =
      Math.abs(s - Math.round(s)) < 0.001
        ? String(Math.round(s)).padStart(2, "0")
        : s.toFixed(3).padStart(6, "0");
    return h > 0
      ? `${sign}${h}:${String(m).padStart(2, "0")}:${secStr}`
      : `${sign}${m}:${secStr}`;
  }

  // Parses "hh:mm:ss.ms", "mm:ss", or a plain number of seconds.
  function parseDuration(str) {
    if (!str) return NaN;
    const parts = str.trim().split(":");
    if (parts.length === 1) return parseFloat(parts[0]);
    let seconds = 0;
    for (const p of parts) seconds = seconds * 60 + parseFloat(p || "0");
    return seconds;
  }

  const e = React.createElement;

  function PresetMarkerPanel({ sceneId }) {
    const { Form, Button } = PluginApi.libraries.Bootstrap;
    const Select = PluginApi.libraries.ReactSelect.default || PluginApi.libraries.ReactSelect;
    const { FontAwesomeIcon } = PluginApi.libraries.ReactFontAwesome;
    const { faClock, faChevronUp, faChevronDown } = PluginApi.libraries.FontAwesomeSolid;

    const [presets, setPresets] = useState([]);
    const [tagMap, setTagMap] = useState({});
    const [status, setStatus] = useState("");
    const [tabActive, setTabActive] = useState(isMarkersTabActive());

    // Using the generated hook (not our raw fetch) so the mutation runs
    // through Stash's real Apollo client — that's what lets us ask it to
    // refetch the marker list query and get a live update, same as the
    // native "create marker" button.
    const [sceneMarkerCreate] = PluginApi.GQL.useSceneMarkerCreateMutation({
      refetchQueries: ["FindSceneMarkers", "FindSceneMarkerTags"],
      awaitRefetchQueries: true,
    });

    useEffect(() => {
      const handler = () => {
        // Bootstrap's nav-link "active" class updates synchronously on click,
        // so check on the next tick after the click has been processed.
        setTimeout(() => setTabActive(isMarkersTabActive()), 0);
      };
      document.addEventListener("click", handler, true);
      return () => document.removeEventListener("click", handler, true);
    }, []);

    // The editable form, populated by clicking a preset. Nothing is saved
    // until the user clicks "Create Marker". primaryTag/tags are stored as
    // react-select option objects ({ value: tagId, label: tagName }).
    const [form, setForm] = useState(null); // { title, primaryTag, tags, start, end }

    useEffect(() => {
      gql(GET_SETTINGS)
        .then((data) => {
          const raw = data?.configuration?.plugins?.[PLUGIN_ID]?.presets;
          const list = parsePresets(raw);
          setPresets(list);

          const names = Array.from(
            new Set(
              list.flatMap((p) => [p.primaryTag, ...(p.tags || [])]).map((n) => n.trim())
            )
          );
          if (names.length === 0) return;

          return gql(FIND_TAGS).then((tagData) => {
            const wanted = new Set(names);
            const map = {};
            (tagData?.findTags?.tags || []).forEach((t) => {
              if (wanted.has(t.name.trim())) map[t.name.trim()] = t.id;
            });
            setTagMap(map);
          });
        })
        .catch((e) => {
          console.error("[PresetMarkers] Failed to load presets/tags:", e);
          setStatus("Failed to load presets — see console.");
        });
    }, []);

    const tagOptions = Object.entries(tagMap).map(([name, id]) => ({
      value: id,
      label: name,
    }));

    // Populate the form from a preset. Doesn't save anything.
    const loadPreset = useCallback(
      (preset) => {
        const current = getCurrentPlayerTime();
        const primaryName = preset.primaryTag.trim();
        const primaryId = tagMap[primaryName];
        const tagOpts = (preset.tags || [])
          .map((n) => n.trim())
          .filter((n) => tagMap[n])
          .map((n) => ({ value: tagMap[n], label: n }));

        setForm({
          title: preset.title,
          primaryTag: primaryId ? { value: primaryId, label: primaryName } : null,
          tags: tagOpts,
          start: current !== null ? formatDuration(current) : "",
          end: "",
        });
        setStatus("");
      },
      [tagMap]
    );

    const updateField = (field) => (e) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

    const setToCurrentTime = (field) => () => {
      const t = getCurrentPlayerTime();
      if (t === null) {
        setStatus("Couldn't read the player's current time — is the video loaded?");
        return;
      }
      setForm((f) => ({ ...f, [field]: formatDuration(t) }));
    };

    const adjustTime = (field, delta) => () => {
      const current = parseDuration(form[field]);
      const next = Math.max(0, (isNaN(current) ? 0 : current) + delta);
      setForm((f) => ({ ...f, [field]: formatDuration(next) }));
    };

    // A duration field styled like Stash's native "duration-control": a text
    // input plus a clock button (sets the current player time) and
    // chevron up/down buttons (nudge by 1 second).
    const renderTimeField = (field, label) =>
      e(
        Form.Group,
        { className: "mb-2 flex-fill" },
        e(Form.Label, null, label),
        e(
          "div",
          { className: "input-group" },
          e(Form.Control, {
            type: "text",
            placeholder: "hh:mm:ss.ms",
            className: "duration-control",
            value: form[field],
            onChange: updateField(field),
          }),
          e(
            "div",
            { className: "input-group-append" },
            e(
              Button,
              { variant: "secondary", onClick: setToCurrentTime(field), title: "Set to current player time" },
              e(FontAwesomeIcon, { icon: faClock })
            ),
            e(
              "div",
              { role: "group", className: "btn-group-vertical" },
              e(
                Button,
                { variant: "secondary", onClick: adjustTime(field, 1), title: "+1 second" },
                e(FontAwesomeIcon, { icon: faChevronUp })
              ),
              e(
                Button,
                { variant: "secondary", onClick: adjustTime(field, -1), title: "-1 second" },
                e(FontAwesomeIcon, { icon: faChevronDown })
              )
            )
          )
        )
      );

    const createMarker = useCallback(() => {
      if (!form) return;
      if (!sceneId) {
        setStatus("No scene id available.");
        return;
      }
      const seconds = parseDuration(form.start);
      if (isNaN(seconds)) {
        setStatus("Enter a valid start time first.");
        return;
      }
      const primaryTagId = form.primaryTag?.value;
      if (!primaryTagId) {
        setStatus("Choose a primary tag first.");
        return;
      }
      const tagIds = (form.tags || []).map((t) => t.value).filter(Boolean);

      const variables = {
        scene_id: sceneId,
        seconds,
        title: form.title,
        primary_tag_id: primaryTagId,
        tag_ids: tagIds,
      };
      const endSeconds = parseDuration(form.end);
      if (!isNaN(endSeconds)) variables.end_seconds = endSeconds; // only sent if you filled it in; drop this field if your Stash version rejects it

      sceneMarkerCreate({ variables })
        .then(() => {
          setStatus(`Created marker "${form.title}" at ${formatDuration(seconds)}.`);
          setForm(null);
        })
        .catch((err) => setStatus(`Error: ${err.message}`));
    }, [form, sceneId, sceneMarkerCreate]);

    if (!tabActive) return null;

    return e(
      "div",
      { className: "preset-markers-panel" },
      e("h6", null, "Preset Markers"),
      e(
        "div",
        { className: "preset-markers-buttons" },
        presets.map((p, i) =>
          e(
            Button,
            { key: i, size: "sm", variant: "secondary", onClick: () => loadPreset(p) },
            p.title
          )
        )
      ),
      form &&
        e(
          "div",
          { className: "preset-markers-form" },
          e(
            Form.Group,
            { className: "mb-2" },
            e(Form.Label, null, "Title"),
            e(Form.Control, {
              type: "text",
              value: form.title,
              onChange: updateField("title"),
            })
          ),
          e(
            Form.Group,
            { className: "mb-2" },
            e(Form.Label, null, "Primary Tag"),
            e(Select, {
              classNamePrefix: "react-select",
              options: tagOptions,
              value: form.primaryTag,
              onChange: (opt) => setForm((f) => ({ ...f, primaryTag: opt })),
            })
          ),
          e(
            Form.Group,
            { className: "mb-2" },
            e(Form.Label, null, "Tags"),
            e(Select, {
              classNamePrefix: "react-select",
              isMulti: true,
              options: tagOptions,
              value: form.tags,
              onChange: (opts) => setForm((f) => ({ ...f, tags: opts || [] })),
            })
          ),
          e(
            "div",
            { className: "d-flex gap-2" },
            renderTimeField("start", "Start"),
            renderTimeField("end", "End (optional)")
          ),
          e(
            "div",
            { className: "d-flex gap-3" },
            e(Button, { size: "sm", variant: "primary", onClick: createMarker }, "Save"),
            e(Button, { size: "sm", variant: "secondary", onClick: () => setForm(null) }, "Cancel")
          ),
          status && e("div", { className: "preset-markers-status" }, status)
        )
    );
  }

  PluginApi.patch.before("ScenePage.TabContent", function (props) {
    const sceneId = props?.scene?.id;

    return [
      {
        ...props,
        children: React.createElement(
          React.Fragment,
          null,
          React.createElement(PresetMarkerPanel, { sceneId }),
          props.children
        ),
      },
    ];
  });
})();