const STYLE_ID = 'color-scheme-toggler-style';
const DATASET_KEY = 'forcedColorScheme';
const INVERT_KEY = 'invertColors';
const STORAGE_KEY = `color-scheme-toggler::${location.hostname}`;
const BASE_STYLES = `
:root[data-forced-color-scheme] {
  transition: background-color 0.2s ease, color 0.2s ease, filter 0.2s ease;
}

:root[data-forced-color-scheme='dark'] {
  color-scheme: dark;
  background-color: #0f111a !important;
}

:root[data-forced-color-scheme='light'] {
  color-scheme: light;
  background-color: #ffffff !important;
}

:root[data-invert-colors='true'] {
  filter: invert(0.92) hue-rotate(180deg);
}

:root[data-invert-colors='true'] img,
:root[data-invert-colors='true'] video,
:root[data-invert-colors='true'] picture,
:root[data-invert-colors='true'] svg,
:root[data-invert-colors='true'] canvas,
:root[data-invert-colors='true'] iframe {
  filter: invert(1) hue-rotate(180deg) !important;
}

:root[data-invert-colors='false'],
:root:not([data-invert-colors]) {
  filter: none !important;
}
`;
const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const ensureStyleElement = () => {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = BASE_STYLES;
    (document.head || document.documentElement).appendChild(style);
  }
  return style;
};

const getCurrentScheme = () => {
  return document.documentElement.dataset[DATASET_KEY] || 'system';
};

const persistScheme = (scheme) => {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set({ [STORAGE_KEY]: scheme }, resolve);
  });
};

const removeStoredScheme = () => {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.remove(STORAGE_KEY, resolve);
  });
};

const readStoredScheme = () => {
  return new Promise((resolve) => {
    if (!chrome?.storage?.local) {
      resolve(null);
      return;
    }
    chrome.storage.local.get([STORAGE_KEY], (result = {}) => {
      resolve(result[STORAGE_KEY] || null);
    });
  });
};

const getSystemScheme = () => (systemMediaQuery.matches ? 'dark' : 'light');

const syncInvertFlag = (scheme) => {
  const root = document.documentElement;
  if (scheme === 'system') {
    delete root.dataset[INVERT_KEY];
    root.removeAttribute('data-invert-colors');
    return;
  }
  const shouldInvert = scheme !== getSystemScheme();
  root.dataset[INVERT_KEY] = shouldInvert ? 'true' : 'false';
};

const applyColorScheme = async (scheme, persist = true) => {
  ensureStyleElement();
  const root = document.documentElement;
  if (scheme === 'system') {
    delete root.dataset[DATASET_KEY];
    root.removeAttribute('data-forced-color-scheme');
    root.style.removeProperty('--forced-color-scheme');
    syncInvertFlag('system');
    if (persist) {
      await removeStoredScheme();
    }
  } else {
    root.dataset[DATASET_KEY] = scheme;
    root.style.setProperty('--forced-color-scheme', scheme);
    syncInvertFlag(scheme);
    if (persist) {
      await persistScheme(scheme);
    }
  }
  return getCurrentScheme();
};

const toggleColorScheme = async () => {
  const currentScheme = getCurrentScheme();
  const nextScheme = currentScheme === 'dark' ? 'light' : 'dark';
  return applyColorScheme(nextScheme);
};

const resetColorScheme = () => applyColorScheme('system');

const hydrate = async () => {
  ensureStyleElement();
  const stored = await readStoredScheme();
  if (stored === 'dark' || stored === 'light') {
    await applyColorScheme(stored, false);
  } else {
    await applyColorScheme('system', false);
  }
};

const readyPromise = hydrate();

const handleMediaChange = () => {
  const current = getCurrentScheme();
  if (current === 'system') {
    syncInvertFlag('system');
    return;
  }
  syncInvertFlag(current);
};

if (typeof systemMediaQuery.addEventListener === 'function') {
  systemMediaQuery.addEventListener('change', handleMediaChange);
} else if (typeof systemMediaQuery.addListener === 'function') {
  systemMediaQuery.addListener(handleMediaChange);
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request?.action) {
    return;
  }

  if (request.action === 'toggleColorScheme') {
    readyPromise
      .then(() => toggleColorScheme())
      .then((scheme) => sendResponse({ scheme }))
      .catch(() => sendResponse({ scheme: getCurrentScheme() }));
    return true;
  }

  if (request.action === 'resetColorScheme') {
    readyPromise
      .then(() => resetColorScheme())
      .then((scheme) => sendResponse({ scheme }))
      .catch(() => sendResponse({ scheme: getCurrentScheme() }));
    return true;
  }

  if (request.action === 'getColorScheme') {
    readyPromise
      .then(() => sendResponse({ scheme: getCurrentScheme() }))
      .catch(() => sendResponse({ scheme: getCurrentScheme() }));
    return true;
  }
});
