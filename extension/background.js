// Service Worker - processa requests em background
// Nota: Service workers não têm acesso ao DOM, então usamos regex para parsing

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
    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Lê como bytes e decodifica como UTF-8 (com fallback para ISO-8859-1)
    const buffer = await response.arrayBuffer();
    let text;

    // Tenta UTF-8 primeiro
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(buffer);
    } catch {
      // Se falhar, tenta ISO-8859-1 (Latin-1)
      const decoder = new TextDecoder('iso-8859-1');
      text = decoder.decode(buffer);
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
    // 1. Busca a página real e extrai as linhas finas
    const bullets = await extractBulletsFromPage(article.link);

    // 2. Limpa e adiciona UTM à URL
    const cleanedUrl = cleanUrl(article.link);

    // 3. Encurta a URL
    const shortUrl = await shortenUrl(cleanedUrl);

    // 4. Monta a mensagem
    const message = formatMessage(article.title, bullets, shortUrl);

    return { message, shortUrl };

  } catch (error) {
    return { error: error.message };
  }
}

// === Buscar página e extrair linhas finas ===
async function extractBulletsFromPage(url) {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    let html;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      html = decoder.decode(buffer);
    } catch {
      const decoder = new TextDecoder('iso-8859-1');
      html = decoder.decode(buffer);
    }

    // Tenta extrair linhas finas dos seletores conhecidos da Folha
    let bullets = [];

    // 1. Busca .c-news__subheadline (principal seletor da Folha)
    bullets = extractListItemsFromClass(html, 'c-news__subheadline');

    // 2. Fallback: busca .summary
    if (bullets.length < 2) {
      const summaryBullets = extractListItemsFromClass(html, 'summary');
      if (summaryBullets.length >= 2) bullets = summaryBullets;
    }

    // 3. Fallback: busca .bullets ou classe que contenha "bullet"
    if (bullets.length < 2) {
      const bulletBullets = extractListItemsFromClass(html, 'bullet');
      if (bulletBullets.length >= 2) bullets = bulletBullets;
    }

    // 4. Fallback: busca linha-fina
    if (bullets.length < 2) {
      const linhaFinaBullets = extractListItemsFromClass(html, 'linha-fina');
      if (linhaFinaBullets.length >= 2) bullets = linhaFinaBullets;
    }

    // 5. Fallback: busca <article> header <ul> <li>
    if (bullets.length < 2) {
      const articleBullets = extractArticleHeaderBullets(html);
      if (articleBullets.length >= 2) bullets = articleBullets;
    }

    // 6. Último fallback: og:description
    if (bullets.length < 2) {
      const ogDesc = extractMetaContent(html, 'og:description');
      if (ogDesc) {
        const parts = ogDesc
          .split(/(?:•|·|;|—|–|:|\.)(?:\s+|$)/)
          .map(s => cleanText(s))
          .filter(s => s && s.length > 10 && s.length < 220);
        if (parts.length >= 2) bullets = parts.slice(0, 2);
        else if (parts.length === 1) bullets = parts;
      }
    }

    return bullets.slice(0, 2);

  } catch (error) {
    console.error('Erro ao buscar página:', error.message);
    return [];
  }
}

// Extrai <li> de dentro de um elemento com a classe especificada
function extractListItemsFromClass(html, className) {
  // Busca o bloco que contenha a classe (aceita aspas simples ou duplas)
  const classRegex = new RegExp(
    `<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|ul|ol|section|aside|nav|span)>`,
    'i'
  );
  const blockMatch = html.match(classRegex);
  if (!blockMatch) return [];

  return extractLiContents(blockMatch[1]);
}

// Extrai <li> de dentro de <article>...<header>...<ul>
function extractArticleHeaderBullets(html) {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) return [];

  // Busca o header dentro do article
  const headerMatch = articleMatch[1].match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  if (!headerMatch) return [];

  // Busca <ul> dentro do header
  const ulMatch = headerMatch[1].match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (!ulMatch) return [];

  return extractLiContents(ulMatch[1]);
}

// Extrai texto de todos os <li> de um bloco HTML
function extractLiContents(html) {
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  const items = [];
  let match;
  while ((match = liRegex.exec(html)) !== null) {
    const text = cleanText(match[1].replace(/<[^>]*>/g, ''));
    if (text && text.length > 3 && text.length < 220) {
      items.push(text);
    }
  }
  return items;
}

// Extrai conteúdo de uma meta tag (og:description, etc.)
function extractMetaContent(html, property) {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) {
    return cleanText(decodeHTMLEntities(match[1] || match[2] || ''));
  }
  return '';
}

// Limpa texto: remove espaços extras, nbsp, etc.
function cleanText(text) {
  return (text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

// === Encurtar URL ===
async function shortenUrl(url) {
  try {
    // Usa is.gd
    const response = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      throw new Error('is.gd error');
    }

    const shortUrl = await response.text();

    if (shortUrl.startsWith('http')) {
      const finalUrl = shortUrl.trim();

      // "Aquece" o link: faz uma requisição para forçar o is.gd a
      // carregar os metadados Open Graph da página de destino
      try {
        await fetch(finalUrl, { method: 'HEAD', mode: 'no-cors' });
      } catch {
        // Ignora erros do warmup
      }

      return finalUrl;
    }

    throw new Error('Invalid response');

  } catch {
    // Fallback: retorna URL original (sem encurtar)
    return url;
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
