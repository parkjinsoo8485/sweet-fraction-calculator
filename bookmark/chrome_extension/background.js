chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_url') {
    const url = message.url;
    
    // 1. 교육, 정부, 나이스 및 주요 인트라넷 사이트들은 접속 우회 (항상 활성 상태로 간주)
    const urlLower = url.toLowerCase();
    const bypassDomains = [
      '.go.kr', '.es.kr', '.ms.kr', '.hs.kr', '.ac.kr', 'neis', '나이스',
      'localhost', '127.0.0.1', 'sharepoint.com', 'office.com', 'microsoft.com',
      'google.com/spreadsheets', 'docs.google.com'
    ];
    
    if (bypassDomains.some(dom => urlLower.includes(dom))) {
      sendResponse({ isAlive: true, reason: 'Bypassed (Edu/Gov/Intranet)' });
      return true; // 비동기 응답용
    }

    // timeout 처리를 위해 AbortController 사용 (3초 제한)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // 먼저 HEAD 요청 시도
    fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    })
    .then(response => {
      clearTimeout(timeoutId);
      // 404, 410은 데드링크
      if (response.status === 404 || response.status === 410) {
        sendResponse({ isAlive: false, reason: `HTTP ${response.status} (Dead)` });
      } else {
        sendResponse({ isAlive: true, reason: `HTTP ${response.status} (HEAD)` });
      }
    })
    .catch(error => {
      // HEAD 요청이 거부되거나 에러가 나면 GET으로 재시도
      clearTimeout(timeoutId);
      
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 3000);
      
      fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: getController.signal
      })
      .then(response => {
        clearTimeout(getTimeoutId);
        if (response.status === 404 || response.status === 410) {
          sendResponse({ isAlive: false, reason: `HTTP ${response.status} (GET Dead)` });
        } else {
          sendResponse({ isAlive: true, reason: `HTTP ${response.status} (GET)` });
        }
      })
      .catch(getError => {
        clearTimeout(getTimeoutId);
        // DNS Lookup Failed 또는 Timeout 등의 에러는 Dead로 판정
        const errMsg = getError.message ? getError.message.toLowerCase() : '';
        if (getError.name === 'AbortError' || errMsg.includes('timeout') || errMsg.includes('failed to fetch')) {
          sendResponse({ isAlive: false, reason: `Connection Failed/Timeout (${getError.name})` });
        } else {
          // 그 외의 특수 에러는 일단 보존
          sendResponse({ isAlive: true, reason: `Keep (Exception: ${getError.message})` });
        }
      });
    });

    return true; // 비동기 응답 처리용
  }
});
