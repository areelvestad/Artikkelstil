const defaults = {
  borderRadius: 5,
  boldCaption: false,
  paddingYDelta: 0,
  paddingXDelta: 0,
  captionColor: null,
  captionBg: null,
  captionBgOpacity: 80,
  articleBgLight: null,
  articleBgDark: null,
  articleTextLight: null,
  articleTextDark: null,
  titleLight: null,
  titleDark: null,
  subtitleLight: null,
  subtitleDark: null,
  subtitleCentered: false,
  markBgLight: null,
  markBgDark: null,
  markTxtLight: null,
  markTxtDark: null,
  whoTitleLight: null,
  whoTitleDark: null,
  whoRemoveBg: false
};

const COLOR_DEFAULTS = {
  articleBgLight: "#ffffff",
  articleBgDark: "#050915",
  articleTextLight: "#0f172a",
  articleTextDark: "#f8fafc",
  titleLight: "#0f172a",
  titleDark: "#f8fafc",
  subtitleLight: "#0f172a",
  subtitleDark: "#f8fafc",
  markBgLight: "#fff3b0",
  markBgDark: "#3f2c00",
  markTxtLight: "#1f2933",
  markTxtDark: "#f8fafc",
  whoTitleLight: "#0f172a",
  whoTitleDark: "#f8fafc",
  captionColor: "#ffffff",
  captionBg: "#e9e9e9"
};

const state = { ...defaults };

const controls = document.querySelectorAll("[data-key]");
const cssOutput = document.getElementById("css-output");
const copyBtn = document.getElementById("copy-css");
const resetBtn = document.getElementById("reset-theme");
const iframe = document.getElementById("article-preview");
const articleInput = document.getElementById("article-url");
const loadBtn = document.getElementById("load-article");
const statusNode = document.getElementById("preview-status");
const placeholderTemplate = document.getElementById("placeholder-article");
const resetButtons = document.querySelectorAll("[data-reset]");
const previewThemeToggle = document.getElementById("preview-theme-toggle");

let iframeDoc = null;
let previewTheme = "light";

function syncControlValue(control, value) {
  const key = control.dataset.key;
  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else if (control.type === "range") {
    const resolved = value ?? defaults[key] ?? 0;
    control.value = resolved;
    updateRangeOutput(control);
  } else if (control.type === "color") {
    const resolved = value || control.dataset.default || COLOR_DEFAULTS[key] || "#ffffff";
    control.value = resolved;
  } else {
    control.value = value ?? "";
  }
}

function init() {
  controls.forEach((control) => {
    const key = control.dataset.key;
    if (!key) return;
    syncControlValue(control, state[key]);
    control.addEventListener("input", (event) => handleInputChange(event, key));
  });

  copyBtn.addEventListener("click", handleCopy);
  resetBtn.addEventListener("click", resetTheme);
  loadBtn.addEventListener("click", handleArticleLoad);
  if (previewThemeToggle) {
    previewThemeToggle.addEventListener("click", togglePreviewTheme);
    updatePreviewThemeButton();
  }
  resetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.reset;
      if (!key) return;
      state[key] = null;
      const target = document.querySelector(`[data-key="${key}"]`);
      if (target) {
        syncControlValue(target, state[key]);
      }
      render();
    });
  });
  iframe.addEventListener("load", () => {
    iframeDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
    applyStylesToPreview();
    applyPreviewThemeToIframe();
    hydrateLazyMedia();
    stripPreloadLinks();
  });

  // Seed preview with placeholder content.
  if (placeholderTemplate) {
    iframe.srcdoc = placeholderTemplate.innerHTML.trim();
  }

  render();
}

function handleInputChange(event, key) {
  const target = event.currentTarget;
  if (!key) return;
  if (target.type === "checkbox") {
    state[key] = target.checked;
  } else if (target.type === "range") {
    state[key] = Number(target.value);
    updateRangeOutput(target);
  } else {
    state[key] = target.value;
  }
  render();
}

function updateRangeOutput(input) {
  const output = input.parentElement.querySelector("output");
  if (!output) return;
  if (input.dataset.display === "paddingY") {
    const value = 3 + Number(input.value);
    output.textContent = `${Math.max(0, value)}px`;
  } else if (input.dataset.display === "paddingX") {
    const value = 7 + Number(input.value);
    output.textContent = `${Math.max(0, value)}px`;
  } else if (input.dataset.display === "radius") {
    output.textContent = `${input.value}px`;
  } else if (input.dataset.display === "opacity") {
    output.textContent = `${input.value}%`;
  } else {
    output.textContent = input.value;
  }
}

function buildRules() {
  const rules = [];
  const captionSpanSelector = ".fade-gallery .content .caption span:not(:empty)";
  const captionSelector = ".fade-gallery .content .caption";
  const baseVertical = 3;
  const baseHorizontal = 7;

  // Article theme
  const rootVars = [];
  const rootProps = [];
  const articleBgLight = getColorValue("articleBgLight");
  const articleBgDark = getColorValue("articleBgDark");
  const articleTextLight = getColorValue("articleTextLight");
  const articleTextDark = getColorValue("articleTextDark");
  if (articleBgLight) {
    rootVars.push(`--theme-bg-light:${articleBgLight};`);
    rootProps.push(`--color-background: var(--theme-bg-light) !important;`);
  }
  if (articleBgDark) rootVars.push(`--theme-bg-dark:${articleBgDark};`);
  if (articleTextLight) {
    rootVars.push(`--theme-txt-light:${articleTextLight};`);
    rootProps.push(`--color-text: var(--theme-txt-light) !important;`);
  }
  if (articleTextDark) rootVars.push(`--theme-txt-dark:${articleTextDark};`);
  if (rootVars.length || rootProps.length) {
    const block = `:root { ${rootVars.concat(rootProps).join(" ")} }`.trim();
    if (block !== ":root {  }") {
      rules.push(block);
    }
  }
  const darkRootProps = [];
  if (articleBgDark) {
    darkRootProps.push(`--color-background: var(--theme-bg-dark) !important;`);
  }
  if (articleTextDark) {
    darkRootProps.push(`--color-text: var(--theme-txt-dark) !important;`);
  }
  if (darkRootProps.length) {
    const darkBlock = darkRootProps.join(" ");
    rules.push(
      `@media (prefers-color-scheme: dark) { [data-darkmode="auto"]:root { ${darkBlock} } }`
    );
    rules.push(`[data-darkmode="on"]:root { ${darkBlock} }`);
  }

  // Title
  const titleParts = [];
  const titleLight = getColorValue("titleLight");
  const titleDark = getColorValue("titleDark");
  if (titleLight) {
    titleParts.push(`--theme-title-light:${titleLight};`);
    titleParts.push(`color: var(--theme-title-light) !important;`);
  }
  if (titleDark) {
    titleParts.push(`--theme-title-dark:${titleDark};`);
  }
  if (titleParts.length) {
    rules.push(`.article-header h1 { ${titleParts.join(" ")} }`);
  }
  if (titleDark) {
    rules.push(
      `@media (prefers-color-scheme: dark) { [data-darkmode="auto"] .article-header h1 { color: var(--theme-title-dark) !important; } }`
    );
    rules.push(
      `[data-darkmode="on"] .article-header h1 { color: var(--theme-title-dark) !important; }`
    );
  }

  // Subtitles
  const subtitleParts = [];
  const subtitleLight = getColorValue("subtitleLight");
  const subtitleDark = getColorValue("subtitleDark");
  if (subtitleLight) {
    subtitleParts.push(`--theme-subtitle-light:${subtitleLight};`);
    subtitleParts.push(`color: var(--theme-subtitle-light) !important;`);
  }
  if (subtitleDark) {
    subtitleParts.push(`--theme-subtitle-dark:${subtitleDark};`);
  }
  if (state.subtitleCentered) {
    subtitleParts.push("text-align:center !important;");
  }
  if (subtitleParts.length) {
    rules.push(`.article-body > h2 { ${subtitleParts.join(" ")} }`);
  }
  if (subtitleDark) {
    rules.push(
      `@media (prefers-color-scheme: dark) { [data-darkmode="auto"] .article-body > h2 { color: var(--theme-subtitle-dark) !important; } }`
    );
    rules.push(
      `[data-darkmode="on"] .article-body > h2 { color: var(--theme-subtitle-dark) !important; }`
    );
  }

  // Markdown highlights
  const markParts = [];
  const markBgLight = getColorValue("markBgLight");
  const markBgDark = getColorValue("markBgDark");
  const markTxtLight = getColorValue("markTxtLight");
  const markTxtDark = getColorValue("markTxtDark");
  if (markBgLight) {
    markParts.push(`--theme-mark-bg-light:${markBgLight};`);
    markParts.push(`background: var(--theme-mark-bg-light) !important;`);
  }
  if (markTxtLight) {
    markParts.push(`--theme-mark-txt-light:${markTxtLight};`);
    markParts.push(`color: var(--theme-mark-txt-light) !important;`);
  }
  if (markBgDark) {
    markParts.push(`--theme-mark-bg-dark:${markBgDark};`);
  }
  if (markTxtDark) {
    markParts.push(`--theme-mark-txt-dark:${markTxtDark};`);
  }
  if (markParts.length) {
    rules.push(`mark { ${markParts.join(" ")} }`);
  }
  if (markBgDark || markTxtDark) {
    const darkMark = [
      markBgDark ? "background: var(--theme-mark-bg-dark) !important;" : "",
      markTxtDark ? "color: var(--theme-mark-txt-dark) !important;" : ""
    ]
      .filter(Boolean)
      .join(" ");
    rules.push(
      `@media (prefers-color-scheme: dark) { [data-darkmode="auto"] mark { ${darkMark} } }`
    );
    rules.push(`[data-darkmode="on"] mark { ${darkMark} }`);
  }

  // Who is who
  const whoTitleParts = [];
  const whoTitleLight = getColorValue("whoTitleLight");
  const whoTitleDark = getColorValue("whoTitleDark");
  if (whoTitleLight) {
    whoTitleParts.push(`--theme-whoiswho-title-light:${whoTitleLight};`);
    whoTitleParts.push(`color: var(--theme-whoiswho-title-light) !important;`);
  }
  if (whoTitleDark) {
    whoTitleParts.push(`--theme-whoiswho-title-dark:${whoTitleDark};`);
  }
  if (whoTitleParts.length) {
    rules.push(`.whoiswho-container .whoiswho h2 { ${whoTitleParts.join(" ")} }`);
  }
  if (whoTitleDark) {
    rules.push(
      `@media (prefers-color-scheme: dark) { [data-darkmode="auto"] .whoiswho-container .whoiswho h2 { color: var(--theme-whoiswho-title-dark) !important; } }`
    );
    rules.push(
      `[data-darkmode="on"] .whoiswho-container .whoiswho h2 { color: var(--theme-whoiswho-title-dark) !important; }`
    );
  }
  if (state.whoRemoveBg) {
    rules.push(
      `.whoiswho-container { background:none !important; box-shadow:none !important; }\n.whoiswho-container .media { border:none !important; }\n.whoiswho-container .whoiswho p { font-weight:400 !important; }`
    );
  }

  const spanRules = [];
  if (state.borderRadius !== defaults.borderRadius) {
    spanRules.push(`border-radius:${state.borderRadius}px !important;`);
  }

  if (state.boldCaption !== defaults.boldCaption) {
    spanRules.push(`font-weight:${state.boldCaption ? 700 : 400} !important;`);
  }

  if (state.paddingYDelta !== defaults.paddingYDelta || state.paddingXDelta !== defaults.paddingXDelta) {
    const paddingY = Math.max(0, baseVertical + Number(state.paddingYDelta));
    const paddingX = Math.max(0, baseHorizontal + Number(state.paddingXDelta));
    spanRules.push(`padding:${paddingY}px ${paddingX}px !important;`);
  }

  const captionColorValue = getColorValue("captionColor");
  const captionBgValue = getColorValue("captionBg");
  if (captionBgValue || state.captionBgOpacity !== defaults.captionBgOpacity) {
    const baseColor = captionBgValue || COLOR_DEFAULTS.captionBg;
    const opacityValue = state.captionBgOpacity ?? defaults.captionBgOpacity;
    const alpha = clamp(opacityValue / 100, 0, 1);
    spanRules.push(
      `--background-caption-fade-gallery:${hexToRgba(baseColor, alpha)} !important;`
    );
  }

  if (spanRules.length) {
    rules.push(`${captionSpanSelector} { ${spanRules.join(" ")} }`);
  }

  if (captionColorValue) {
    rules.push(`${captionSelector} { color:${captionColorValue} !important; }`);
  }

  return rules.join("\n\n").trim();
}

function renderCssOutput() {
  const rules = buildRules();
  cssOutput.value = rules ? `<style>\n${rules}\n</style>` : "";
}

function applyStylesToPreview() {
  if (!iframeDoc) return;
  const rules = buildRules();
  const head = iframeDoc.head || iframeDoc.querySelector("head") || iframeDoc.body;
  if (!head) return;
  let styleEl = iframeDoc.getElementById("theme-editor-style");
  if (rules) {
    if (!styleEl) {
      styleEl = iframeDoc.createElement("style");
      styleEl.id = "theme-editor-style";
      head.appendChild(styleEl);
    }
    styleEl.textContent = rules;
  } else if (styleEl) {
    styleEl.remove();
  }
}

function render() {
  renderCssOutput();
  applyStylesToPreview();
  applyPreviewThemeToIframe();
}

async function handleCopy() {
  const cssBlock = cssOutput.value.trim();
  if (!cssBlock) {
    copyBtn.textContent = "Tomt!";
    setTimeout(() => (copyBtn.textContent = "Kopier"), 1200);
    return;
  }
  try {
    await navigator.clipboard.writeText(cssBlock);
    copyBtn.textContent = "Kopiert!";
  } catch {
    copyBtn.textContent = "Press Ctrl+C";
  } finally {
    setTimeout(() => (copyBtn.textContent = "Kopier"), 1500);
  }
}

function resetTheme() {
  Object.assign(state, { ...defaults });
  controls.forEach((control) => {
    const key = control.dataset.key;
    if (!key) return;
    syncControlValue(control, state[key]);
  });
  render();
}

async function handleArticleLoad() {
  const url = articleInput.value.trim();
  if (!url) {
    statusNode.textContent = "Lim inn en artikkellenke først.";
    return;
  }
  statusNode.textContent = "FHenter artikkel...";
  try {
    const html = await fetchArticleHtml(url);
    iframe.srcdoc = decorateHtml(html, url);
    statusNode.textContent = "Preview oppdatert.";
    // theme applied on load event
  } catch (error) {
    statusNode.textContent = error.message || "Kunne ikke laste inn artikkel.";
  }
}

async function fetchArticleHtml(url) {
  const normalized = url.replace(/^https?:\/\//i, "");
  const attempts = [
    url,
    `https://r.jina.ai/https://${normalized}`,
    `https://cors.isomorphic-git.org/${url}`
  ];
  for (const target of attempts) {
    try {
      const res = await fetch(target, { mode: "cors" });
      if (!res.ok) continue;
      const text = await res.text();
      if (text && text.includes("<html")) {
        return text;
      }
    } catch {
      // Try next proxy.
    }
  }
  throw new Error("Unable to fetch the article (CORS blocked?).");
}

function decorateHtml(html, baseUrl) {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const withoutPreloads = withoutScripts.replace(/<link[^>]+rel=["']preload["'][^>]*>/gi, "");
  if (/<base/i.test(withoutPreloads)) {
    return withoutPreloads.replace(
      /<base[^>]*>/i,
      `<base href="${baseUrl}">`
    );
  }
  if (/<head[^>]*>/i.test(withoutPreloads)) {
    return withoutPreloads.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${baseUrl}">`
    );
  }
  return `<head><base href="${baseUrl}"></head>${withoutPreloads}`;
}

function hydrateLazyMedia() {
  if (!iframeDoc) return;
  iframeDoc.querySelectorAll("img[data-src]").forEach((img) => {
    if (!img.getAttribute("src")) {
      img.setAttribute("src", img.dataset.src);
    }
    if (img.dataset.srcset && !img.getAttribute("srcset")) {
      img.setAttribute("srcset", img.dataset.srcset);
    }
    if (img.getAttribute("loading") === "lazy") {
      img.removeAttribute("loading");
    }
  });
  iframeDoc.querySelectorAll("img[data-srcset]").forEach((img) => {
    if (!img.getAttribute("srcset")) {
      img.setAttribute("srcset", img.dataset.srcset);
    }
    if (img.getAttribute("loading") === "lazy") {
      img.removeAttribute("loading");
    }
  });
  iframeDoc.querySelectorAll("source[data-srcset]").forEach((source) => {
    if (!source.getAttribute("srcset")) {
      source.setAttribute("srcset", source.dataset.srcset);
    }
  });
}

function stripPreloadLinks() {
  if (!iframeDoc) return;
  iframeDoc.querySelectorAll('link[rel="preload"]').forEach((link) => {
    link.remove();
  });
}

function togglePreviewTheme() {
  previewTheme = previewTheme === "light" ? "dark" : "light";
  updatePreviewThemeButton();
  applyPreviewThemeToIframe();
}

function updatePreviewThemeButton() {
  if (!previewThemeToggle) return;
  previewThemeToggle.textContent = previewTheme === "light" ? "🌙 Vis i mørkt modus" : "☀️ Vis i lyst modus";
}

function applyPreviewThemeToIframe() {
  if (!iframeDoc) return;
  const root = iframeDoc.documentElement;
  if (!root) return;
  root.setAttribute("data-darkmode", previewTheme === "dark" ? "on" : "off");
  const previous = iframeDoc.getElementById("preview-mode-style");
  if (previous) previous.remove();
}

function getColorValue(key) {
  const value = state[key];
  if (!value) return null;
  const defaultVal = COLOR_DEFAULTS[key];
  if (defaultVal && value.toLowerCase() === defaultVal.toLowerCase()) {
    return null;
  }
  return value;
}

function hexToRgba(hex, alpha = 1) {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((char) => char + char)
      .join("");
  }
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

init();
