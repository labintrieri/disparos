// Service Worker - processa requests em background
// Usa tabs + content script injection para extrair linhas finas das páginas

// Carrega configuração com API keys (config.js é opcional)
try {
  importScripts('config.js');
} catch {
  // config.js não existe - usa valores padrão
}

// Garante que CONFIG existe mesmo sem config.js
if (typeof CONFIG === 'undefined') {
  var CONFIG = {};
}

// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchFeed') {
    fetchFeed(request.url).then(sendResponse);
    return true; // Indica resposta assíncrona
  }

  if (request.action === 'processArticle') {
    processArticle(request.article).then(sendResponse);
    return true;
  }
});

// === Buscar Feed RSS ===
async function fetchFeed(feedUrl) {
  try {
    let text;

    // Tenta fetch direto primeiro (requer host_permissions)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(feedUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();

      // Tenta UTF-8 primeiro
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(buffer);
      } catch {
        const decoder = new TextDecoder('iso-8859-1');
        text = decoder.decode(buffer);
      }
    } catch (directError) {
      console.warn('Fetch direto falhou, tentando proxy CORS:', directError.message);

      // Fallback: usa allorigins como proxy CORS
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Proxy HTTP ${response.status}`);
      }

      text = await response.text();
    }

    // Parsing XML com regex (service worker não tem DOMParser)
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    let count = 0;

    while ((match = itemRegex.exec(text)) !== null && count < 15) {
      const itemContent = match[1];

      const title = extractTag(itemContent, 'title');
      const link = extractTag(itemContent, 'link');
      const description = extractTag(itemContent, 'description');

      if (title && link) {
        articles.push({ title, link, description });
        count++;
      }
    }

    return articles;

  } catch (error) {
    return { error: error.message };
  }
}

// Extrai conteúdo de uma tag XML
function extractTag(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>|<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  if (match) {
    // Retorna CDATA ou conteúdo normal
    const content = match[1] || match[2] || '';
    // Remove tags HTML residuais e decodifica entidades
    return decodeHTMLEntities(content.replace(/<[^>]*>/g, '').trim());
  }
  return '';
}

// Decodifica entidades HTML
function decodeHTMLEntities(text) {
  // Entidades nomeadas comuns
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&ccedil;': 'ç',
    '&Ccedil;': 'Ç',
    '&atilde;': 'ã',
    '&Atilde;': 'Ã',
    '&otilde;': 'õ',
    '&Otilde;': 'Õ',
    '&aacute;': 'á',
    '&Aacute;': 'Á',
    '&eacute;': 'é',
    '&Eacute;': 'É',
    '&iacute;': 'í',
    '&Iacute;': 'Í',
    '&oacute;': 'ó',
    '&Oacute;': 'Ó',
    '&uacute;': 'ú',
    '&Uacute;': 'Ú',
    '&acirc;': 'â',
    '&Acirc;': 'Â',
    '&ecirc;': 'ê',
    '&Ecirc;': 'Ê',
    '&ocirc;': 'ô',
    '&Ocirc;': 'Ô',
    '&agrave;': 'à',
    '&Agrave;': 'À',
  };

  // Primeiro substitui entidades nomeadas
  let result = text.replace(/&[a-zA-Z]+;/g, match => entities[match] || match);

  // Depois decodifica entidades numéricas decimais (&#123;)
  result = result.replace(/&#(\d+);/g, (match, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });

  // Decodifica entidades numéricas hexadecimais (&#x1F;)
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return result;
}

// === Processar Artigo ===
async function processArticle(article) {
  try {
    // 1. Busca a página real e extrai linhas finas + metadados OG
    const pageData = await extractPageData(article.link);

    // 2. Limpa e adiciona UTM à URL
    const cleanedUrl = cleanUrl(article.link);

    // 3. Encurta a URL via Dub.co (com metadados OG para preview no WhatsApp)
    const metadata = {
      ogTitle: pageData.title || article.title,
      ogDescription: pageData.description || '',
      ogImage: pageData.ogImage || ''
    };
    const shortened = await shortenUrl(cleanedUrl, metadata);

    // 4. Monta a mensagem
    const message = formatMessage(article.title, pageData.bullets, shortened.url);

    return {
      message,
      shortUrl: shortened.url,
      shortenerSource: shortened.source,
      dubError: shortened.dubError || null
    };

  } catch (error) {
    return { error: error.message };
  }
}

// === Buscar página e extrair linhas finas + metadados OG via tab injection ===
async function extractPageData(url) {
  const empty = { title: '', bullets: [], description: '', ogImage: '' };
  let tabId = null;
  try {
    // Abre aba em background (não ativa)
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;

    // Espera a página carregar
    await waitForTabLoad(tabId);

    // Injeta o content-extractor.js na página
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-extractor.js'],
    });

    // Fecha a aba
    await chrome.tabs.remove(tabId);
    tabId = null;

    // Pega o resultado do script injetado
    if (results && results[0] && results[0].result) {
      const r = results[0].result;
      return {
        title: r.title || '',
        bullets: r.bullets || [],
        description: r.description || '',
        ogImage: r.ogImage || ''
      };
    }

    return empty;

  } catch (error) {
    console.error('Erro ao extrair dados da página:', error.message);
    // Garante que a aba seja fechada em caso de erro
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
      resolve(); // Resolve mesmo com timeout para tentar extrair o que tiver
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    // Verifica se já está carregada
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
  let cleaned = url.split('#')[0];
  cleaned = cleaned.replace(/[?&]utm_[^&]*/g, '');
  cleaned = cleaned.replace(/\/amp\/?$/, '');
  cleaned = cleaned.replace(/\?$/, '');

  // Adiciona UTM próprio
  const separator = cleaned.includes('?') ? '&' : '?';
  return `${cleaned}${separator}utm_source=whatsapp&utm_medium=social&utm_campaign=wppcfolhapol`;
}

// === Encurtar URL via Dub.co (com metadados OG) ===
async function shortenWithDub(url, metadata) {
  if (!CONFIG.DUB_API_KEY) {
    throw new Error('DUB_NO_KEY');
  }

  const response = await fetch("https://api.dub.co/links", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CONFIG.DUB_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url: url,
      title: metadata.ogTitle || "",
      description: metadata.ogDescription || "",
      image: metadata.ogImage || "",
      domain: "dub.sh"
    })
  });

  // 409 = link já existe, Dub.co retorna o existente
  if (response.status === 409) {
    const data = await response.json();
    if (data.shortLink) return data.shortLink;
    if (data.error?.link?.shortLink) return data.error.link.shortLink;
    throw new Error("DUB_CONFLICT");
  }

  if (response.status === 401) {
    throw new Error("DUB_INVALID_KEY");
  }

  if (response.status === 429) {
    throw new Error("DUB_RATE_LIMIT");
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`DUB_ERROR: ${error.error?.message || response.status}`);
  }

  const data = await response.json();
  return data.shortLink;
}

// === Encurtar URL via is.gd (fallback) ===
async function shortenWithIsgd(url) {
  const response = await fetch(
    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
  );

  if (!response.ok) {
    throw new Error('is.gd error');
  }

  const shortUrl = await response.text();

  if (!shortUrl.startsWith('http')) {
    throw new Error('Invalid is.gd response');
  }

  return shortUrl.trim();
}

// === Encurtar URL (Dub.co com fallback is.gd) ===
async function shortenUrl(url, metadata) {
  // Tenta Dub.co primeiro
  try {
    const shortUrl = await shortenWithDub(url, metadata || {});
    return { url: shortUrl, source: 'dub' };
  } catch (dubError) {
    const errorCode = dubError.message;

    // Tenta is.gd como fallback
    try {
      const shortUrl = await shortenWithIsgd(url);
      return { url: shortUrl, source: 'isgd', dubError: errorCode };
    } catch {
      // Último recurso: URL original
      return { url, source: 'original', dubError: errorCode };
    }
  }
}

// === Formatar Mensagem ===
function formatMessage(title, bullets, url) {
  const parts = [];

  if (title) {
    parts.push(`*${title}*`);
  }

  if (bullets.length > 0) {
    // Bullets em itálico (usando _ do WhatsApp)
    parts.push(bullets.map(b => `• _${b}_`).join('\n'));
  }

  parts.push(url);

  return parts.join('\n');
}
