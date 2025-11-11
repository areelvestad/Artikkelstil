const defaults = {
  borderRadius: 5,
  boldCaption: false,
  paddingYDelta: 0,
  paddingXDelta: 0,
  captionColor: "#ffffff",
  captionBg: "#e9e9e9",
  captionBgOpacity: 80
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

let iframeDoc = null;

function init() {
  controls.forEach((control) => {
    const key = control.dataset.key;
    if (!key) return;
    if (control.type === "checkbox") {
      control.checked = state[key];
    } else if (control.type === "range") {
      control.value = state[key];
      updateRangeOutput(control);
    } else {
      control.value = state[key];
    }
    control.addEventListener("input", (event) => handleInputChange(event, key));
  });

  copyBtn.addEventListener("click", handleCopy);
  resetBtn.addEventListener("click", resetTheme);
  loadBtn.addEventListener("click", handleArticleLoad);
  iframe.addEventListener("load", () => {
    iframeDoc = iframe.contentDocument || iframe.contentWindow?.document || null;
    applyStylesToPreview();
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

  if (
    state.captionBg !== defaults.captionBg ||
    state.captionBgOpacity !== defaults.captionBgOpacity
  ) {
    const alpha = clamp(state.captionBgOpacity / 100, 0, 1);
    spanRules.push(
      `--background-caption-fade-gallery:${hexToRgba(state.captionBg, alpha)} !important;`
    );
  }

  if (spanRules.length) {
    rules.push(`${captionSpanSelector} { ${spanRules.join(" ")} }`);
  }

  if (state.captionColor !== defaults.captionColor) {
    rules.push(`${captionSelector} { color:${state.captionColor} !important; }`);
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
}

async function handleCopy() {
  const cssBlock = cssOutput.value.trim();
  if (!cssBlock) {
    copyBtn.textContent = "Nothing to copy";
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
    return;
  }
  try {
    await navigator.clipboard.writeText(cssBlock);
    copyBtn.textContent = "Copied!";
  } catch {
    copyBtn.textContent = "Press Ctrl+C";
  } finally {
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  }
}

function resetTheme() {
  Object.assign(state, { ...defaults });
  controls.forEach((control) => {
    const key = control.dataset.key;
    if (!key) return;
    if (control.type === "checkbox") {
      control.checked = state[key];
    } else if (control.type === "range") {
      control.value = state[key];
      updateRangeOutput(control);
    } else {
      control.value = state[key];
    }
  });
  render();
}

async function handleArticleLoad() {
  const url = articleInput.value.trim();
  if (!url) {
    statusNode.textContent = "Paste a full article URL first.";
    return;
  }
  statusNode.textContent = "Fetching article...";
  try {
    const html = await fetchArticleHtml(url);
    iframe.srcdoc = decorateHtml(html, url);
    statusNode.textContent = "Preview updated.";
  } catch (error) {
    statusNode.textContent = error.message || "Could not load article.";
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
  });
  iframeDoc.querySelectorAll("img[data-srcset]").forEach((img) => {
    if (!img.getAttribute("srcset")) {
      img.setAttribute("srcset", img.dataset.srcset);
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
