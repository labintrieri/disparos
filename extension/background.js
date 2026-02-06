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
    // 1. Busca o conteúdo da página
    const pageContent = await fetchArticlePage(article.link);

    // 2. Extrai bullets
    const bullets = extractBullets(pageContent, article.description);

    // 3. Limpa e adiciona UTM à URL
    const cleanedUrl = cleanUrl(article.link);

    // 4. Encurta a URL
    const shortUrl = await shortenUrl(cleanedUrl);

    // 5. Monta a mensagem
    const message = formatMessage(article.title, bullets, shortUrl);

    return { message, shortUrl };

  } catch (error) {
    return { error: error.message };
  }
}

// === Buscar Página do Artigo ===
async function fetchArticlePage(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    return text;
  } catch {
    return '';
  }
}

// === Extrair Bullets (usando regex, sem DOM) ===
function extractBullets(html, fallbackDescription) {
  // Tenta encontrar lista de bullets no HTML
  // Procura por padrões comuns: <li> dentro de classes específicas

  const patterns = [
    // Classe c-news__subheadline
    /<[^>]*class="[^"]*c-news__subheadline[^"]*"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    // Classe summary
    /<[^>]*class="[^"]*summary[^"]*"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    // Classe bullets
    /<[^>]*class="[^"]*bullet[^"]*"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
    // Qualquer ul dentro de header de article
    /<article[^>]*>[\s\S]*?<header[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const listContent = match[1];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const bullets = [];
      let liMatch;

      while ((liMatch = liRegex.exec(listContent)) !== null && bullets.length < 2) {
        const text = liMatch[1]
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/\s+/g, ' ')    // Normaliza espaços
          .trim();

        if (text.length > 3 && text.length < 220) {
          bullets.push(decodeHTMLEntities(text));
        }
      }

      if (bullets.length >= 2) {
        return bullets;
      }
    }
  }

  // Fallback: tenta extrair da descrição do RSS
  if (fallbackDescription) {
    const parts = fallbackDescription
      .split(/[•·;—–]/)
      .map(s => s.trim())
      .filter(s => s.length > 3 && s.length < 220);

    if (parts.length >= 2) {
      return parts.slice(0, 2);
    }
    if (parts.length === 1) {
      return [parts[0]];
    }
  }

  return [];
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
