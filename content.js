let bookmarks = [];
let enabled = true;
let overlay;
let currentVideoId = '';
let wasAutoPaused = false;
let bottomOverlayVisible = false;
let bottomOverlay = null;
let currentInterval = null;
let adSkipInterval = null;
let adTimerOverlay = null;
let adDarkOverlay = null;
let skipAttempted = false;
let wasMutedBeforeAd = false;

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

function playSegment(startIndex, stopIndex = startIndex + 1) {
  if (startIndex < 0 || stopIndex >= bookmarks.length) return;

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
    case 'h':
      if (bookmarks.length > 0) {
        video.currentTime = bookmarks[0];
        video.pause();
      }
      break;
    case 'x':
      e.preventDefault();
      if (video.paused) {
        const prev = [...bookmarks].reverse().find(t => t < video.currentTime);
        if (prev !== undefined) {
          const index = bookmarks.findIndex(t => t === prev);
          playSegment(index);
        } else if (Math.abs(video.currentTime - bookmarks[0]) < 1) {
          playSegment(0);
        }
      } else {
        const next = bookmarks.find(t => t - video.currentTime > -0.2);
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

// 광고 관련 기능

function createDarkOverlay() {
  if (!adDarkOverlay) {
    adDarkOverlay = document.createElement('div');
    Object.assign(adDarkOverlay.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 9998,
      pointerEvents: 'none',
    });
    adDarkOverlay.id = 'ad-dark-overlay';
    document.body.appendChild(adDarkOverlay);
  }
}

function removeDarkOverlay() {
  if (adDarkOverlay) {
    adDarkOverlay.remove();
    adDarkOverlay = null;
  }
}

function isAdPlaying() {
  return document.querySelector('.ytp-ad-player-overlay') !== null
      || document.querySelector('.ad-showing') !== null;
}

function forceSkipAd() {
  const adOverlay = document.querySelector('.ytp-ad-player-overlay');
  const adContainer = document.querySelector('.ad-showing');

  if ((adOverlay || adContainer) && video.duration > 0 && !isNaN(video.duration)) {
    if (!skipAttempted) {
      console.log('광고 감지: 강제 스킵 시도!');
      try {
        if (video.currentTime < video.duration - 2) {
          video.currentTime = video.duration;
        }
      } catch (e) {
        console.error('광고 강제 스킵 실패', e);
      }
      skipAttempted = true;
    }
  } else {
    skipAttempted = false;
  }
}

function autoSkipAdsAndShowTimer() {
  const adTextElement = document.querySelector('.ytp-ad-text');
  const skipButton = document.querySelector('.ytp-ad-skip-button');

  if (isAdPlaying()) {
    if (!adTimerOverlay) {
      adTimerOverlay = document.createElement('div');
      Object.assign(adTimerOverlay.style, {
        position: 'fixed',
        top: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '10px',
        fontSize: '20px',
        zIndex: 9999,
        pointerEvents: 'none',
      });
      adTimerOverlay.id = 'ad-timer-overlay';
      document.body.appendChild(adTimerOverlay);
    }

    let adTimeText = '';
    if (adTextElement) {
      adTimeText = adTextElement.innerText;
    }
    adTimerOverlay.textContent = `광고 진행 중... ${adTimeText} (곧 스킵됩니다)`;

    createDarkOverlay();

    if (!video.muted) {
      wasMutedBeforeAd = false;
      video.muted = true;
      console.log('광고 감지: 비디오 음소거됨');
    }

    if (skipButton && skipButton.offsetParent !== null) {
      skipButton.click();
      console.log('광고 건너뛰기 클릭됨!');
    }

    forceSkipAd();
  } else {
    if (adTimerOverlay) {
      adTimerOverlay.remove();
      adTimerOverlay = null;
    }
    removeDarkOverlay();

    if (video.muted && !wasMutedBeforeAd) {
      video.muted = false;
      console.log('광고 종료: 비디오 음소거 해제');
    }

    skipAttempted = false;
  }
}

// URL 변경 감지
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(loadBookmarks, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// 초기 실행
document.addEventListener('keydown', handleKeyDown);
video.addEventListener('timeupdate', updateOverlay);
loadBookmarks();
setInterval(autoSkipAdsAndShowTimer, 500);
