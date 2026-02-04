import * as readline from 'readline';
import clipboard from 'clipboardy';

export function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function prompt(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

export function printHeader(text) {
  const line = '═'.repeat(60);
  console.log(`\n${line}`);
  console.log(`  ${text}`);
  console.log(line);
}

export function printArticlePreview(index, total, article, message) {
  console.log(`\n┌${'─'.repeat(58)}┐`);
  console.log(`│  📰 Matéria ${index + 1} de ${total}`.padEnd(59) + '│');
  console.log(`├${'─'.repeat(58)}┤`);

  // Título truncado se muito longo
  const titleDisplay = article.title.length > 54
    ? article.title.substring(0, 51) + '...'
    : article.title;
  console.log(`│  ${titleDisplay}`.padEnd(59) + '│');
  console.log(`└${'─'.repeat(58)}┘`);

  console.log('\n📋 Prévia da mensagem:\n');
  console.log('┌' + '─'.repeat(58) + '┐');
  message.split('\n').forEach(line => {
    // Quebra linhas longas
    const chunks = chunkString(line, 56);
    chunks.forEach(chunk => {
      console.log('│ ' + chunk.padEnd(57) + '│');
    });
  });
  console.log('└' + '─'.repeat(58) + '┘');
}

function chunkString(str, length) {
  const chunks = [];
  let i = 0;
  while (i < str.length) {
    chunks.push(str.substring(i, i + length));
    i += length;
  }
  return chunks.length ? chunks : [''];
}

export function printOptions() {
  console.log('\n  [S] ✅ Sim, copiar e disparar');
  console.log('  [N] ❌ Não, pular');
  console.log('  [E] ✏️  Editar mensagem');
  console.log('  [V] 👁️  Ver URL original');
  console.log('  [Q] 🚪 Sair\n');
}

export async function copyToClipboard(text) {
  try {
    await clipboard.write(text);
    return true;
  } catch (error) {
    console.error('  ⚠ Erro ao copiar para clipboard:', error.message);
    return false;
  }
}

export function printSuccess(message) {
  console.log(`\n  ✅ ${message}`);
}

export function printError(message) {
  console.log(`\n  ❌ ${message}`);
}

export function printInfo(message) {
  console.log(`\n  ℹ️  ${message}`);
}

export function printProgress(message) {
  process.stdout.write(`  ⏳ ${message}...`);
}

export function clearProgress() {
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
}

export async function editMessage(rl, originalMessage) {
  console.log('\n  Digite a nova mensagem (termine com uma linha vazia):');
  console.log('  (ou digite "cancelar" para manter a original)\n');

  const lines = [];
  let line;

  while (true) {
    line = await prompt(rl, '  > ');
    if (line === '' || line === 'cancelar') break;
    lines.push(line);
  }

  if (line === 'cancelar' || lines.length === 0) {
    return originalMessage;
  }

  return lines.join('\n');
}

export function printStats(stats) {
  console.log('\n' + '═'.repeat(60));
  console.log('  📊 Resumo da sessão:');
  console.log('═'.repeat(60));
  console.log(`  • Matérias escaneadas: ${stats.total}`);
  console.log(`  • Disparadas: ${stats.sent}`);
  console.log(`  • Puladas: ${stats.skipped}`);
  console.log(`  • Erros: ${stats.errors}`);
  console.log('═'.repeat(60) + '\n');
}
