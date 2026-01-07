const toggleButton = document.getElementById('toggle');
const resetButton = document.getElementById('reset');
const statusText = document.getElementById('status');
const buttons = [toggleButton, resetButton].filter(Boolean);

const setButtonsDisabled = (state) => {
  buttons.forEach((button) => {
    if (button) {
      button.disabled = state;
    }
  });
};

const getActiveTab = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!tabs.length) {
        reject(new Error('No active tab'));
        return;
      }
      resolve(tabs[0]);
    });
  });
};

const sendMessageToTab = async (message) => {
  const tab = await getActiveTab();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response);
    });
  });
};

const updateStatus = (scheme) => {
  if (!statusText) return;
  const normalized = scheme || 'system';
  const label =
    normalized === 'dark'
      ? 'Dark (forced)'
      : normalized === 'light'
      ? 'Light (forced)'
      : 'System';
  statusText.textContent = `Current: ${label}`;
  if (resetButton) {
    resetButton.disabled = normalized === 'system';
  }
};

const refreshStatus = async () => {
  try {
    const response = await sendMessageToTab({ action: 'getColorScheme' });
    if (response?.scheme) {
      updateStatus(response.scheme);
      toggleButton && (toggleButton.disabled = false);
    }
  } catch (error) {
    console.warn('Unable to read current color scheme', error);
    if (statusText) {
      statusText.textContent = 'Unavailable on this page';
    }
    setButtonsDisabled(true);
  }
};

const handleAction = async (action) => {
  setButtonsDisabled(true);
  try {
    const response = await sendMessageToTab({ action });
    if (response?.scheme) {
      updateStatus(response.scheme);
    }
  } catch (error) {
    console.error(`${action} failed`, error);
  } finally {
    await refreshStatus();
  }
};

toggleButton?.addEventListener('click', () => handleAction('toggleColorScheme'));
resetButton?.addEventListener('click', () => handleAction('resetColorScheme'));

refreshStatus();
