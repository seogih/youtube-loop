document.addEventListener('DOMContentLoaded', () => {
  const ylIcon = document.getElementById('ylIcon');

  // 초기 상태 설정
  chrome.storage.local.get(['enabled'], (result) => {
    const enabled = result.enabled ?? true;
    updateIcon(enabled);
  });

  // 아이콘 클릭 시 토글
  ylIcon.addEventListener('click', () => {
    chrome.storage.local.get(['enabled'], (result) => {
      const current = result.enabled ?? true;
      const newEnabled = !current;
      chrome.storage.local.set({ enabled: newEnabled }, () => {
        updateIcon(newEnabled);

        // 동시에 툴바 아이콘도 변경
        chrome.action.setIcon({
          path: newEnabled ? {
            "16": "icons/yl_active_16.png",
            "32": "icons/yl_active_32.png",
            "48": "icons/yl_active_48.png",
            "128": "icons/yl_active_128.png"
          } : {
            "16": "icons/yl_inactive_16.png",
            "32": "icons/yl_inactive_32.png",
            "48": "icons/yl_inactive_48.png",
            "128": "icons/yl_inactive_128.png"
          }
        });
      });
    });
  });

  // 아이콘 업데이트 함수
  function updateIcon(enabled) {
    ylIcon.src = enabled ? 'icons/yl_active_32.png' : 'icons/yl_inactive_32.png';
  }
});
