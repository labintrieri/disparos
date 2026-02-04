#!/usr/bin/env node

import { scanFeed, getAvailableFeeds } from './scanner.js';
import { extractArticle, formatMessage } from './extractor.js';
import { shortenWithFallback } from './shortener.js';
import {
  createInterface,
  prompt,
  printHeader,
  printArticlePreview,
  printOptions,
  copyToClipboard,
  printSuccess,
  printError,
  printInfo,
  printProgress,
  clearProgress,
  editMessage,
  printStats,
} from './cli.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    feed: 'poder',
    limit: 10,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--feed=')) {
      options.feed = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1], 10) || 10;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           DISPAROS FOLHA - Scanner de Matérias             ║
╚════════════════════════════════════════════════════════════╝

Uso: npm start [opções]

Opções:
  --feed=NOME    Feed para escanear (padrão: poder)
  --limit=N      Número de matérias (padrão: 10)
  --help, -h     Mostra esta ajuda

Feeds disponíveis:
  ${getAvailableFeeds().join(', ')}

Exemplos:
  npm start                    # Escaneia Política (poder)
  npm start --feed=mercado     # Escaneia Economia
  npm start --limit=5          # Apenas 5 matérias
  npm run politica             # Atalho para Política
  npm run economia             # Atalho para Economia
`);
}

async function processArticle(rl, item, index, total, stats) {
  printProgress('Extraindo conteúdo');

  let article;
  try {
    article = await extractArticle(item.link);
    clearProgress();
  } catch (error) {
    clearProgress();
    printError(`Erro ao extrair: ${error.message}`);
    stats.errors++;
    return true; // continua para próxima
  }

  printProgress('Encurtando link');

  let shortUrl;
  try {
    shortUrl = await shortenWithFallback(article.url);
    clearProgress();
  } catch (error) {
    clearProgress();
    printError(`Erro ao encurtar: ${error.message}`);
    // Usa URL original se encurtamento falhar
    shortUrl = article.url;
    printInfo('Usando URL original');
  }

  let message = formatMessage(article, shortUrl);

  while (true) {
    printArticlePreview(index, total, article, message);
    printOptions();

    const answer = await prompt(rl, '  Sua escolha: ');

    switch (answer) {
      case 's':
      case 'sim':
        const copied = await copyToClipboard(message);
        if (copied) {
          printSuccess('Mensagem copiada para o clipboard!');
          printInfo('Cole no WhatsApp Web ou app para disparar.');
          stats.sent++;
        } else {
          printError('Falha ao copiar. Mensagem:');
          console.log('\n' + message + '\n');
        }
        return true;

      case 'n':
      case 'nao':
      case 'não':
        printInfo('Pulando matéria...');
        stats.skipped++;
        return true;

      case 'e':
      case 'editar':
        message = await editMessage(rl, message);
        printSuccess('Mensagem atualizada!');
        break; // volta ao loop para mostrar preview

      case 'v':
      case 'ver':
        console.log(`\n  🔗 URL original: ${item.link}`);
        console.log(`  🔗 URL com UTM: ${article.url}`);
        console.log(`  🔗 URL curta: ${shortUrl}`);
        break; // volta ao loop

      case 'q':
      case 'sair':
      case 'quit':
        return false; // sai do programa

      default:
        printError('Opção inválida. Use S, N, E, V ou Q.');
    }
  }
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  printHeader(`🗞️  DISPAROS FOLHA - Feed: ${options.feed.toUpperCase()}`);

  const rl = createInterface();
  const stats = { total: 0, sent: 0, skipped: 0, errors: 0 };

  try {
    printProgress('Escaneando feed');
    const items = await scanFeed(options.feed, options.limit);
    clearProgress();

    printSuccess(`Encontradas ${items.length} matérias no feed de ${options.feed}`);
    stats.total = items.length;

    for (let i = 0; i < items.length; i++) {
      const shouldContinue = await processArticle(rl, items[i], i, items.length, stats);
      if (!shouldContinue) {
        printInfo('Encerrando...');
        break;
      }
    }

    printStats(stats);
  } catch (error) {
    clearProgress();
    printError(`Erro fatal: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
