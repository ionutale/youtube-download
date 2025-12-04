document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ serverUrl: 'http://localhost:5173', apiKey: '' }, (items) => {
    document.getElementById('serverUrl').value = items.serverUrl;
    document.getElementById('apiKey').value = items.apiKey;
  });
});

document.getElementById('saveBtn').addEventListener('click', () => {
  const serverUrl = document.getElementById('serverUrl').value.replace(/\/$/, '');
  const apiKey = document.getElementById('apiKey').value;
  
  chrome.storage.sync.set({ serverUrl, apiKey }, () => {
    const status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(() => {
      status.style.display = 'none';
    }, 2000);
  });
});
