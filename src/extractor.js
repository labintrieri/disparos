import axios from 'axios';
import * as cheerio from 'cheerio';

function clean(text) {
  return (text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanUrl(url) {
  let cleaned = url.split('#')[0];
  cleaned = cleaned.replace(/[?&]utm_[^&]*/g, '');
  cleaned = cleaned.replace(/\/amp\/?$/, '');
  cleaned = cleaned.replace(/\?$/, '');
  return cleaned;
}

function addUtm(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}utm_source=whatsapp&utm_medium=social&utm_campaign=wppcfolhapol`;
}

export async function extractArticle(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // Extrai título
    const title = clean(
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text() ||
      $('title').text() ||
      ''
    );

    // Extrai descrição
    const ogDescription = clean(
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
    );

    // Seletores para bullets (mesmo padrão do bookmarklet)
    const bulletSelectors = [
      '.c-news__subheadline li',
      '.summary li',
      '.bullets li',
      '[class*="bullet"] li',
      '[class*="linha-fina"] li',
      'article header ul li',
      'article .summary ul li',
      'main .summary li',
      'article ul:first-of-type li',
    ];

    let bullets = [];

    for (const selector of bulletSelectors) {
      const found = $(selector)
        .map((_, el) => clean($(el).text()))
        .get()
        .filter(text => text && text.length > 3 && text.length < 220);

      if (found.length >= 2) {
        bullets = found;
        break;
      }
    }

    // Fallback: tenta extrair da descrição
    if (bullets.length < 2 && ogDescription) {
      const parts = ogDescription
        .split(/[•·;—–]/)
        .map(clean)
        .filter(p => p && p.length > 3);

      if (parts.length >= 2) {
        bullets = parts.slice(0, 2);
      } else if (parts.length === 1) {
        bullets = [parts[0]];
      }
    }

    // Limita a 2 bullets
    bullets = bullets.slice(0, 2);

    // Limpa e adiciona UTM à URL
    const cleanedUrl = addUtm(cleanUrl(url));

    return {
      title,
      description: ogDescription,
      bullets,
      url: cleanedUrl,
      originalUrl: url,
    };
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('Acesso bloqueado (paywall ou proteção)');
    }
    if (error.code === 'ETIMEDOUT') {
      throw new Error('Timeout ao acessar a matéria');
    }
    throw error;
  }
}

export function formatMessage(article, shortUrl = null) {
  const parts = [];

  if (article.title) {
    parts.push(`*${article.title}*`);
  }

  if (article.bullets && article.bullets.length > 0) {
    parts.push(article.bullets.map(b => `• ${b}`).join('\n'));
  }

  parts.push(shortUrl || article.url);

  return parts.join('\n');
}
