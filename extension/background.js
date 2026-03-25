// Service Worker - processa requests em background
// Usa tabs + content script injection para extrair linhas finas das páginas

// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchFeed') {
    fetchFeed(request.url).then(sendResponse);
    return true;
  }

  if (request.action === 'processArticle') {
    processArticle(request.article).then(sendResponse);
    return true;
  }
});

// === Buscar Feed RSS ===
async function fetchFeed(feedUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(feedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    let text;

    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('iso-8859-1').decode(buffer);
    }

    // Parsing XML com regex (service worker não tem DOMParser)
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(text)) !== null && articles.length < 15) {
      const item = match[1];
      const title = extractTag(item, 'title');
      const link = extractTag(item, 'link');
      const description = extractTag(item, 'description');

      if (title && link) {
        articles.push({ title, link, description });
      }
    }

    return articles;

  } catch (error) {
    return { error: error.message };
  }
}

// Extrai conteúdo de uma tag XML
function extractTag(xml, tagName) {
  const regex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>` +
    `|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'
  );
  const match = xml.match(regex);
  if (!match) return '';
  const content = match[1] || match[2] || '';
  return decodeHTMLEntities(content.replace(/<[^>]*>/g, '').trim());
}

// Decodifica entidades HTML comuns em português
function decodeHTMLEntities(text) {
  const entities = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    '&atilde;': 'ã', '&Atilde;': 'Ã', '&otilde;': 'õ', '&Otilde;': 'Õ',
    '&aacute;': 'á', '&Aacute;': 'Á', '&eacute;': 'é', '&Eacute;': 'É',
    '&iacute;': 'í', '&Iacute;': 'Í', '&oacute;': 'ó', '&Oacute;': 'Ó',
    '&uacute;': 'ú', '&Uacute;': 'Ú',
    '&acirc;': 'â', '&Acirc;': 'Â', '&ecirc;': 'ê', '&Ecirc;': 'Ê',
    '&ocirc;': 'ô', '&Ocirc;': 'Ô', '&agrave;': 'à', '&Agrave;': 'À',
  };

  let result = text.replace(/&[a-zA-Z]+;/g, m => entities[m] || m);
  result = result.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return result;
}

// === Processar Artigo ===
async function processArticle(article) {
  try {
    const pageData = await extractPageData(article.link);
    const cleanedUrl = cleanUrl(article.link);
    const shortUrl = await shortenWithMlabs(cleanedUrl);
    const message = formatMessage(article.title, pageData.bullets, shortUrl);

    return { message, shortUrl };
  } catch (error) {
    return { error: error.message };
  }
}

// === Extrair dados da página via tab injection ===
async function extractPageData(url) {
  const empty = { title: '', bullets: [], description: '', ogImage: '' };
  let tabId = null;

  try {
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    await waitForTabLoad(tabId);

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-extractor.js'],
    });

    await chrome.tabs.remove(tabId);
    tabId = null;

    if (results && results[0] && results[0].result) {
      const r = results[0].result;
      return {
        title: r.title || '',
        bullets: r.bullets || [],
        description: r.description || '',
        ogImage: r.ogImage || '',
      };
    }

    return empty;
  } catch (error) {
    console.error('Erro ao extrair dados da página:', error.message);
    if (tabId) {
      try { await chrome.tabs.remove(tabId); } catch {}
    }
    return empty;
  }
}

// Espera uma aba terminar de carregar (com timeout)
function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }).catch(() => {
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab not found'));
    });
  });
}

// === Limpar URL ===
function cleanUrl(url) {
  let cleaned = url;

  // Extrai URL real de redirects da Folha (redir.folha.com.br/.../*URL_REAL)
  const redirMatch = cleaned.match(/\*(.+)$/);
  if (redirMatch) {
    cleaned = redirMatch[1];
  }

  cleaned = cleaned.split('#')[0];
  cleaned = cleaned.replace(/[?&]utm_[^&]*/g, '');
  cleaned = cleaned.replace(/\/amp\/?$/, '');
  cleaned = cleaned.replace(/\?$/, '');

  const separator = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${separator}utm_source=whatsapp&utm_medium=social&utm_campaign=wppcfolhapol`;
}

// === Encurtar URL via mLabs ===
async function shortenWithMlabs(url) {
  const cookie = await chrome.cookies.get({
    url: "https://publish.mlabs.io",
    name: "authApiToken"
  });

  if (!cookie) {
    throw new Error("Faça login no mLabs (publish.mlabs.io) e tente novamente.");
  }

  const token = decodeURIComponent(cookie.value);

  const response = await fetch("https://core-api.mlabs.io/social/link/short", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "accept": "*/*",
      "accept-version": "v1",
      "current-profile": "3807480",
      "current-timezone": "America/Sao_Paulo",
      "origin": "https://publish.mlabs.io",
      "Authorization": `Bearer ${token}`
    },
    body: `link=${encodeURIComponent(url)}`
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("Sessão do mLabs expirou. Faça login novamente.");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`mLabs erro (${response.status}): ${body}`);
  }

  const data = await response.json();

  // Aquece o link para o mLabs cachear os metadados OG
  try {
    await fetch(data.short_link, { redirect: 'follow' });
    await new Promise(r => setTimeout(r, 3000));
  } catch {}

  return data.short_link;
}

// === Formatar Mensagem ===
function formatMessage(title, bullets, url) {
  const parts = [];

  if (title) {
    parts.push(`*${title}*`);
  }

  if (bullets.length > 0) {
    parts.push(bullets.map(b => `• _${b}_`).join('\n'));
  }

  parts.push(url);

  return parts.join('\n');
}
