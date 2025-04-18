document.addEventListener('DOMContentLoaded', () => {
  const bookmarkList = document.getElementById('bookmarkList');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = new URL(tabs[0].url);
    const videoId = new URLSearchParams(url.search).get('v');
    chrome.storage.local.get([videoId], (result) => {
      const bookmarks = result[videoId] || [];
      bookmarks.sort((a, b) => a - b);
      bookmarks.forEach((time) => {
        const li = document.createElement('li');
        li.textContent = new Date(time * 1000).toISOString().substr(11, 8);
        li.style.cursor = 'pointer';
        li.onclick = () => {
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (t) => {
              const video = document.querySelector('video');
              if (video) {
                video.currentTime = t;
                video.play();
              }
            },
            args: [time]
          });
        };
        bookmarkList.appendChild(li);
      });
    });
  });
});
