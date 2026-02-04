import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';

const FEEDS = {
  poder: 'https://feeds.folha.uol.com.br/poder/rss091.xml',
  mercado: 'https://feeds.folha.uol.com.br/mercado/rss091.xml',
  mundo: 'https://feeds.folha.uol.com.br/mundo/rss091.xml',
  cotidiano: 'https://feeds.folha.uol.com.br/cotidiano/rss091.xml',
  esporte: 'https://feeds.folha.uol.com.br/esporte/rss091.xml',
};

const PAGES = {
  poder: 'https://www1.folha.uol.com.br/poder/',
  mercado: 'https://www1.folha.uol.com.br/mercado/',
  mundo: 'https://www1.folha.uol.com.br/mundo/',
  cotidiano: 'https://www1.folha.uol.com.br/cotidiano/',
  esporte: 'https://www1.folha.uol.com.br/esporte/',
};

async function scanFromRSS(feedUrl, limit) {
  const response = await axios.get(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    },
    timeout: 10000,
  });

  const result = await parseStringPromise(response.data, { explicitArray: false });
  const channel = result.rss?.channel;

  if (!channel || !channel.item) {
    throw new Error('Feed vazio ou formato inválido');
  }

  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  return items.slice(0, limit).map(item => ({
    title: item.title || '',
    link: item.link || '',
    description: item.description || '',
    pubDate: item.pubDate || '',
  }));
}

async function scanFromPage(pageUrl, limit) {
  const response = await axios.get(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const items = [];

  // Seletores para links de matérias na Folha
  const selectors = [
    'div.c-headline a.c-headline__url',
    'div.c-main-headline a.c-main-headline__url',
    '.c-news a[href*="folha.uol.com.br"]',
    'article a[href*="folha.uol.com.br"]',
    '.u-list-unstyled a[href*="shtml"]',
    'a.c-headline__url',
    'a[href*="/poder/"][href$=".shtml"]',
    'a[href*="/mercado/"][href$=".shtml"]',
    'a[href*="/mundo/"][href$=".shtml"]',
  ];

  const seen = new Set();

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const link = $(el).attr('href');
      const title = $(el).text().trim() || $(el).attr('title') || '';

      if (link && link.includes('folha.uol.com.br') && link.includes('.shtml') && !seen.has(link)) {
        seen.add(link);
        items.push({
          title: title,
          link: link.startsWith('http') ? link : `https://www1.folha.uol.com.br${link}`,
          description: '',
          pubDate: '',
        });
      }
    });

    if (items.length >= limit) break;
  }

  if (items.length === 0) {
    throw new Error('Nenhuma matéria encontrada na página');
  }

  return items.slice(0, limit);
}

export async function scanFeed(feedName = 'poder', limit = 10) {
  const feedUrl = FEEDS[feedName] || FEEDS.poder;
  const pageUrl = PAGES[feedName] || PAGES.poder;

  // Tenta RSS primeiro
  try {
    console.log('  ℹ️  Tentando RSS...');
    return await scanFromRSS(feedUrl, limit);
  } catch (rssError) {
    console.log(`  ⚠️  RSS falhou: ${rssError.message}`);
    console.log('  ℹ️  Tentando scraping da página...');

    // Fallback para scraping da página
    try {
      return await scanFromPage(pageUrl, limit);
    } catch (pageError) {
      throw new Error(`RSS e scraping falharam. RSS: ${rssError.message}. Página: ${pageError.message}`);
    }
  }
}

export function getAvailableFeeds() {
  return Object.keys(FEEDS);
}

export { FEEDS };
