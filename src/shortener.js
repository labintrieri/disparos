import axios from 'axios';

const SHORTENERS = {
  isgd: {
    name: 'is.gd',
    api: 'https://is.gd/create.php',
    format: (url) => ({
      params: {
        format: 'simple',
        url: url,
      },
    }),
    parse: (response) => response.data,
  },
  vgd: {
    name: 'v.gd',
    api: 'https://v.gd/create.php',
    format: (url) => ({
      params: {
        format: 'simple',
        url: url,
      },
    }),
    parse: (response) => response.data,
  },
  tinyurl: {
    name: 'TinyURL',
    api: 'https://tinyurl.com/api-create.php',
    format: (url) => ({
      params: {
        url: url,
      },
    }),
    parse: (response) => response.data,
  },
};

export async function shortenUrl(url, service = 'isgd') {
  const shortener = SHORTENERS[service] || SHORTENERS.isgd;

  try {
    const config = {
      ...shortener.format(url),
      timeout: 10000,
      headers: {
        'User-Agent': 'DisparosBot/1.0',
      },
    };

    const response = await axios.get(shortener.api, config);
    const shortUrl = shortener.parse(response);

    if (!shortUrl || shortUrl.startsWith('Error')) {
      throw new Error(`Erro do ${shortener.name}: ${shortUrl}`);
    }

    return shortUrl.trim();
  } catch (error) {
    if (error.response) {
      throw new Error(`${shortener.name} retornou erro ${error.response.status}`);
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new Error(`Timeout ao conectar com ${shortener.name}`);
    }
    throw error;
  }
}

export async function shortenWithFallback(url) {
  const services = ['isgd', 'vgd', 'tinyurl'];

  for (const service of services) {
    try {
      return await shortenUrl(url, service);
    } catch (error) {
      console.error(`  ⚠ ${SHORTENERS[service].name} falhou: ${error.message}`);
      if (service === services[services.length - 1]) {
        throw new Error('Todos os encurtadores falharam');
      }
    }
  }
}

export function getAvailableShorteners() {
  return Object.entries(SHORTENERS).map(([key, value]) => ({
    key,
    name: value.name,
  }));
}
