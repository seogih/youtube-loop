// ✅ 설정용 변수
let BOOKMARK_MAX_HEIGHT = 750;
let BOOKMARK_TOGGLE_HEIGHT = 500;
let MASK_START_RATIO_0 = 0.65;
let MASK_HEIGHT_RATIO_0 = 0.27;
let MASK_START_RATIO = MASK_START_RATIO_0;
let MASK_HEIGHT_RATIO = MASK_HEIGHT_RATIO_0;

let bookmarks = [];
let enabled = true;
let overlay;
let speedOverlay;
let bottomOverlay;
let bottomOverlayVisible = false;
let currentVideoId = '';
let wasAutoPaused = false;
let currentInterval = null;
let adTimerOverlay = null;
let wasMutedBeforeAd = false;

const video = document.querySelector('video');

// ----------------------
// 광고 스킵 기능
// ----------------------
function autoSkipAdsAndShowTimer() {
  const adTextElement = document.querySelector('.ytp-ad-text');
  const skipButton = document.querySelector('.ytp-ad-skip-button');

  if (document.querySelector('.ytp-ad-player-overlay') || document.querySelector('.ad-showing')) {
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

    if (!video.muted) {
      wasMutedBeforeAd = false;
      video.muted = true;
    }

    if (skipButton && skipButton.offsetParent !== null) {
      skipButton.click();
    }

    try {
      if (video.currentTime < video.duration - 2) {
        video.currentTime = video.duration;
      }
    } catch (e) {
      console.error('광고 강제 스킵 실패', e);
    }
  } else {
    if (adTimerOverlay) {
      adTimerOverlay.remove();
      adTimerOverlay = null;
    }
    if (video.muted && !wasMutedBeforeAd) {
      video.muted = false;
    }
  }
}

// ----------------------
// 북마크 저장/로드 (localStorage)
// ----------------------
function getVideoId() {
  return new URLSearchParams(window.location.search).get('v');
}

function saveBookmarks() {
  localStorage.setItem(currentVideoId, JSON.stringify({
    bookmarks: bookmarks,
    maskStartRatio: MASK_START_RATIO,
    maskHeightRatio: MASK_HEIGHT_RATIO,
  }));
}

function loadBookmarks() {
  currentVideoId = getVideoId();
  const data = localStorage.getItem(currentVideoId);

  if (data) {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        bookmarks = parsed;
        MASK_START_RATIO = MASK_START_RATIO_0;
        MASK_HEIGHT_RATIO = MASK_HEIGHT_RATIO_0;
      } else {
        bookmarks = parsed.bookmarks || [];
        MASK_START_RATIO = parsed.maskStartRatio ?? MASK_START_RATIO_0;
        MASK_HEIGHT_RATIO = parsed.maskHeightRatio ?? MASK_HEIGHT_RATIO_0;
      }
    } catch (e) {
      console.error('데이터 파싱 오류', e);
      bookmarks = [];
      MASK_START_RATIO = MASK_START_RATIO_0;
      MASK_HEIGHT_RATIO = MASK_HEIGHT_RATIO_0;
    }
  } else {
    bookmarks = [];
    MASK_START_RATIO = MASK_START_RATIO_0;
    MASK_HEIGHT_RATIO = MASK_HEIGHT_RATIO_0;
  }

  bookmarks.sort((a, b) => a - b);
  updateOverlay();
  updateBottomOverlayPosition();
}

// ----------------------
// 북마크 추가/삭제/초기화
// ----------------------
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

// ----------------------
// 북마크 구간 재생 기능
// ----------------------
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

// ----------------------
// 오버레이 업데이트
// ----------------------
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
      maxHeight: `${BOOKMARK_MAX_HEIGHT}px`,
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

// ----------------------
// 속도 오버레이 업데이트
// ----------------------
function updateSpeedOverlay() {
  const rect = video.getBoundingClientRect();

  if (!speedOverlay) {
    speedOverlay = document.createElement('div');
    speedOverlay.id = 'speed-overlay';
    Object.assign(speedOverlay.style, {
      position: 'absolute',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '16px',
      zIndex: 9999,
      pointerEvents: 'none',
    });
    document.body.appendChild(speedOverlay);
  }

  Object.assign(speedOverlay.style, {
    left: `${rect.left + 10}px`,
    top: `${rect.top + 10}px`,
  });

  speedOverlay.textContent = `속도: ${video.playbackRate.toFixed(1)}x`;
  speedOverlay.style.display = enabled ? 'block' : 'none';
}

// ----------------------
// 가림 오버레이
// ----------------------
function updateBottomOverlayPosition() {
  if (!bottomOverlay || !bottomOverlayVisible) return;

  const rect = video.getBoundingClientRect();
  const totalHeight = rect.height;
  const overlayHeight = totalHeight * MASK_HEIGHT_RATIO;
  const startTop = rect.top + totalHeight * MASK_START_RATIO;

  Object.assign(bottomOverlay.style, {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${overlayHeight}px`,
    top: `${startTop}px`,
  });
}

function toggleBottomOverlay() {
  const rect = video.getBoundingClientRect();

  if (!bottomOverlay) {
    bottomOverlay = document.createElement('div');
    bottomOverlay.className = 'custom-bottom-mask';
    Object.assign(bottomOverlay.style, {
      position: 'absolute',
      backgroundColor: 'black',
      zIndex: '1000',
      pointerEvents: 'none',
    });
    document.body.appendChild(bottomOverlay);
  }

  bottomOverlayVisible = !bottomOverlayVisible;

  if (bottomOverlayVisible) {
    updateBottomOverlayPosition();
    bottomOverlay.style.display = 'block';
  } else {
    bottomOverlay.style.display = 'none';
  }
}

// ----------------------
// 키 핸들러
// ----------------------
function toggleEnable() {
  enabled = !enabled;
  updateOverlay();
  updateSpeedOverlay();
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
      const currentIndex = bookmarks.findIndex(t => Math.abs(t - video.currentTime) < 1);
      if (currentIndex !== -1) {
        playSegment(currentIndex);
      } else {
        const prev = [...bookmarks].reverse().find(t => t < video.currentTime);
        if (prev !== undefined) {
          const index = bookmarks.findIndex(t => t === prev);
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
    case ',':
      e.preventDefault();
      video.playbackRate = Math.max(0.1, video.playbackRate - 0.1);
      updateSpeedOverlay();
      break;
    case '.':
      e.preventDefault();
      video.playbackRate = Math.min(16.0, video.playbackRate + 0.1);
      updateSpeedOverlay();
      break;
    case 'v':
      toggleBottomOverlay();
      break;
    case 'b':
      e.preventDefault();
      if (overlay) {
        if (parseInt(overlay.style.maxHeight) === BOOKMARK_MAX_HEIGHT) {
          overlay.style.maxHeight = `${BOOKMARK_TOGGLE_HEIGHT}px`;
        } else {
          overlay.style.maxHeight = `${BOOKMARK_MAX_HEIGHT}px`;
        }
      }
      break;
    case '[':
      e.preventDefault();
      MASK_START_RATIO = Math.max(0, MASK_START_RATIO - 0.01);
      updateBottomOverlayPosition();
      saveBookmarks();
      break;
    case ']':
      e.preventDefault();
      MASK_START_RATIO = Math.min(1 - MASK_HEIGHT_RATIO, MASK_START_RATIO + 0.01);
      updateBottomOverlayPosition();
      saveBookmarks();
      break;
    case ';':
      e.preventDefault();
      MASK_HEIGHT_RATIO = Math.max(0.01, MASK_HEIGHT_RATIO - 0.01);
      updateBottomOverlayPosition();
      saveBookmarks();
      break;
    case "'":
      e.preventDefault();
      MASK_HEIGHT_RATIO = Math.min(1 - MASK_START_RATIO, MASK_HEIGHT_RATIO + 0.01);
      updateBottomOverlayPosition();
      saveBookmarks();
      break;
    case 'p':
      e.preventDefault();
      MASK_START_RATIO = MASK_START_RATIO_0;
      MASK_HEIGHT_RATIO = MASK_HEIGHT_RATIO_0;
      updateBottomOverlayPosition();
      saveBookmarks();
      break;
  }
}

// ----------------------
// URL 변경 감지
// ----------------------
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(() => {
      loadBookmarks();
      updateSpeedOverlay();
      updateBottomOverlayPosition();
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });

// ----------------------
// 초기화
// ----------------------
document.addEventListener('keydown', handleKeyDown);
video.addEventListener('timeupdate', updateOverlay);
loadBookmarks();
updateSpeedOverlay();
setInterval(autoSkipAdsAndShowTimer, 500);
window.addEventListener('resize', () => {
  updateSpeedOverlay();
  updateBottomOverlayPosition();
});
document.addEventListener('fullscreenchange', () => {
  updateSpeedOverlay();
  updateBottomOverlayPosition();
});
