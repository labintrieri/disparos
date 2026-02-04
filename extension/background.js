// Service Worker - processa requests em background

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

    const text = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'text/xml');

    const items = xml.querySelectorAll('item');
    const articles = [];

    items.forEach((item, index) => {
      if (index >= 15) return; // Limita a 15 matérias

      const title = item.querySelector('title')?.textContent || '';
      const link = item.querySelector('link')?.textContent || '';
      const description = item.querySelector('description')?.textContent || '';

      if (title && link) {
        articles.push({ title, link, description });
      }
    });

    return articles;

  } catch (error) {
    return { error: error.message };
  }
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

// === Extrair Bullets ===
function extractBullets(html, fallbackDescription) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Seletores para bullets na Folha
  const selectors = [
    '.c-news__subheadline li',
    '.summary li',
    '.bullets li',
    '[class*="bullet"] li',
    '[class*="linha-fina"] li',
    'article header ul li',
  ];

  for (const selector of selectors) {
    const items = doc.querySelectorAll(selector);
    if (items.length >= 2) {
      const bullets = Array.from(items)
        .slice(0, 2)
        .map(el => el.textContent.trim())
        .filter(t => t.length > 3 && t.length < 220);

      if (bullets.length >= 2) {
        return bullets;
      }
    }
  }

  // Fallback: tenta extrair da descrição
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
    const response = await fetch(
      `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
      throw new Error('is.gd error');
    }

    const shortUrl = await response.text();

    if (shortUrl.startsWith('http')) {
      return shortUrl.trim();
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
    parts.push(bullets.map(b => `• ${b}`).join('\n'));
  }

  parts.push(url);

  return parts.join('\n');
}
