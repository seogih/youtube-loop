let bookmarks = [];
let enabled = true;
let overlay;
let currentVideoId = '';
let wasAutoPaused = false;
let bottomOverlayVisible = false;
let bottomOverlay = null;
let currentInterval = null;

const video = document.querySelector('video');

function getVideoId() {
  return new URLSearchParams(window.location.search).get('v');
}

function saveBookmarks() {
  chrome.storage.local.set({ [currentVideoId]: bookmarks });
}

function loadBookmarks() {
  currentVideoId = getVideoId();
  chrome.storage.local.get([currentVideoId], (result) => {
    bookmarks = result[currentVideoId] || [];
    bookmarks.sort((a, b) => a - b);
    updateOverlay();
  });
}

function addBookmark() {
  const time = video.currentTime;
  const existingIndex = bookmarks.findIndex(t => Math.abs(t - time) < 1);
  if (existingIndex !== -1) bookmarks.splice(existingIndex, 1);
  bookmarks.push(time);
  bookmarks.sort((a, b) => a - b);
  saveBookmarks();
  updateOverlay();
}

function deleteBookmark() {
  const time = video.currentTime;
  const index = bookmarks.findIndex(t => Math.abs(t - time) < 1);
  if (index !== -1) {
    bookmarks.splice(index, 1);
    saveBookmarks();
    updateOverlay();
  }
}

function clearBookmarks() {
  bookmarks = [];
  saveBookmarks();
  updateOverlay();
}

// function playSegment(startIndex, stopIndex = startIndex + 1) {
//   if (startIndex < 0 || stopIndex >= bookmarks.length) return;
//   video.currentTime = bookmarks[startIndex];
//   video.play();
//   const end = bookmarks[stopIndex];
//   const interval = setInterval(() => {
//     if (video.currentTime >= end) {
//       video.pause();
//       wasAutoPaused = true;
//       clearInterval(interval);
//     }
//   }, 100);
// }
function playSegment(startIndex, stopIndex = startIndex + 1) {
  if (startIndex < 0 || stopIndex >= bookmarks.length) return;

  // 기존 interval이 살아있으면 지우기
  if (currentInterval !== null) {
    clearInterval(currentInterval);
    currentInterval = null;
  }

  video.currentTime = bookmarks[startIndex];
  video.play();

  const end = bookmarks[stopIndex];
  currentInterval = setInterval(() => {
    if (video.currentTime >= end) {
      video.pause();
      wasAutoPaused = true;
      clearInterval(currentInterval);
      currentInterval = null;
    }
  }, 100);
}

function highlightCurrentTime(div, time) {
  if (Math.abs(video.currentTime - time) < 1) {
    div.style.background = 'gray';
  }
}

function updateOverlay() {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bookmark-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      right: '20px',
      bottom: '50px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '10px',
      fontSize: '14px',
      maxHeight: '750px',
      overflowY: 'auto',
      zIndex: 9999,
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = '';
  overlay.style.display = enabled ? 'block' : 'none';

  bookmarks.forEach((time, i) => {
    const div = document.createElement('div');
    div.textContent = `${i + 1}. ${new Date(time * 1000).toISOString().substr(11, 8)}`;
    div.style.cursor = 'pointer';
    div.style.margin = '4px 0';
    highlightCurrentTime(div, time);
    div.onclick = () => {
      const endTime = bookmarks[i + 1];
      if (endTime) {
        video.currentTime = time;
        video.play();
        const interval = setInterval(() => {
          if (video.currentTime >= endTime) {
            video.pause();
            wasAutoPaused = true;
            clearInterval(interval);
          }
        }, 100);
      }
    };
    overlay.appendChild(div);
  });
}

function toggleEnable() {
  enabled = !enabled;
  updateOverlay();
}

function toggleBottomOverlay() {
  const videoElement = document.querySelector('.html5-main-video');
  if (!videoElement) return;

  if (!bottomOverlay) {
    bottomOverlay = document.createElement('div');
    Object.assign(bottomOverlay.style, {
      position: 'fixed',
      backgroundColor: 'black',
      zIndex: '1000',
      pointerEvents: 'none',
    });
    bottomOverlay.className = 'custom-bottom-mask';
  }

  const rect = videoElement.getBoundingClientRect();
  const totalHeight = rect.height;
  const overlayHeight = totalHeight * 0.27;
  const startTop = rect.top + totalHeight * 0.65;

  Object.assign(bottomOverlay.style, {
    left: rect.left + 'px',
    width: rect.width + 'px',
    height: overlayHeight + 'px',
    top: startTop + 'px',
  });

  if (bottomOverlayVisible) {
    if (document.body.contains(bottomOverlay)) {
      document.body.removeChild(bottomOverlay);
    }
    bottomOverlayVisible = false;
  } else {
    document.body.appendChild(bottomOverlay);
    bottomOverlayVisible = true;
  }
}

function handleKeyDown(e) {
  const key = e.key.toLowerCase();
  if (!enabled && key !== 'q' && key !== 'v') return;

  switch (key) {
    case 'q':
      toggleEnable();
      break;
    case 'a':
      addBookmark();
      break;
    case 's':
      deleteBookmark();
      break;
    case 'e':
      clearBookmarks();
      break;
    case 'x':
      // e.preventDefault();
      // const prev = [...bookmarks].reverse().find(t => t < video.currentTime);
      // if (prev !== undefined) {
      //   const index = bookmarks.findIndex(t => t === prev);
      //   playSegment(index);
      // }
      // break;
      e.preventDefault();
      if (video.paused) {
        // 비디오가 멈춰있으면 이전 북마크 재생
        const prev = [...bookmarks].reverse().find(t => t < video.currentTime);
        if (prev !== undefined) {
          const index = bookmarks.findIndex(t => t === prev);
          playSegment(index);
        }
      } else {
        // 비디오가 재생 중이면 다음 북마크 재생
        const next = bookmarks.find(t => t > video.currentTime);
        if (next !== undefined) {
          const index = bookmarks.findIndex(t => t === next);
          playSegment(index);
        }
      }
      break;
    case 'z':
      e.preventDefault();
      const earlier = [...bookmarks].reverse().filter(t => t < video.currentTime);
      if (earlier.length >= 2) {
        const index = bookmarks.findIndex(t => t === earlier[1]);
        playSegment(index, index + 1);
      }
      break;
    case 'v':
      toggleBottomOverlay();
      break;
    case 'b':
      e.preventDefault();
      if (overlay) {
        if (overlay.style.maxHeight === '750px') {
          overlay.style.maxHeight = '500px';
        } else {
          overlay.style.maxHeight = '750px';
        }
      }
      break;
  }
}

// 유튜브 URL 변경 감지
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(loadBookmarks, 1000);
  }
}).observe(document, { subtree: true, childList: true });

document.addEventListener('keydown', handleKeyDown);
video.addEventListener('timeupdate', updateOverlay);
loadBookmarks();
