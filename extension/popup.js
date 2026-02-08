// Estado da aplicação
const state = {
  articles: [],
  selectedArticles: [],
  preparedMessages: [],
  currentMessageIndex: 0,
};

// URLs dos feeds RSS
const FEEDS = {
  poder: 'https://feeds.folha.uol.com.br/poder/rss091.xml',
  mercado: 'https://feeds.folha.uol.com.br/mercado/rss091.xml',
  mundo: 'https://feeds.folha.uol.com.br/mundo/rss091.xml',
  cotidiano: 'https://feeds.folha.uol.com.br/cotidiano/rss091.xml',
  esporte: 'https://feeds.folha.uol.com.br/esporte/rss091.xml',
};

// Elementos do DOM
const elements = {
  feed: document.getElementById('feed'),
  btnScan: document.getElementById('btn-scan'),
  status: document.getElementById('status'),
  articlesSection: document.getElementById('articles-section'),
  articlesCount: document.getElementById('articles-count'),
  articlesList: document.getElementById('articles-list'),
  btnSelectAll: document.getElementById('btn-select-all'),
  btnPrepare: document.getElementById('btn-prepare'),
  previewSection: document.getElementById('preview-section'),
  previewTitle: document.getElementById('preview-title'),
  previewCounter: document.getElementById('preview-counter'),
  previewMessage: document.getElementById('preview-message'),
  btnCopy: document.getElementById('btn-copy'),
  btnSkip: document.getElementById('btn-skip'),
  btnBack: document.getElementById('btn-back'),
  copyFeedback: document.getElementById('copy-feedback'),
};

// === Funções de UI ===

function showStatus(message, type = 'loading') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');
}

function hideStatus() {
  elements.status.classList.add('hidden');
}

function showArticles() {
  elements.articlesSection.classList.remove('hidden');
  elements.previewSection.classList.add('hidden');
}

function showPreview() {
  elements.articlesSection.classList.add('hidden');
  elements.previewSection.classList.remove('hidden');
  elements.copyFeedback.classList.add('hidden');
}

function updateArticlesList() {
  elements.articlesList.innerHTML = '';

  state.articles.forEach((article, index) => {
    const div = document.createElement('div');
    div.className = 'article-item';
    div.dataset.index = index;

    const isSelected = state.selectedArticles.includes(index);
    if (isSelected) div.classList.add('selected');

    div.innerHTML = `
      <input type="checkbox" ${isSelected ? 'checked' : ''}>
      <span class="article-title">${article.title}</span>
    `;

    div.addEventListener('click', () => toggleArticle(index));
    elements.articlesList.appendChild(div);
  });

  elements.articlesCount.textContent = `${state.articles.length} matérias`;
  updatePrepareButton();
}

function toggleArticle(index) {
  const pos = state.selectedArticles.indexOf(index);
  if (pos === -1) {
    state.selectedArticles.push(index);
  } else {
    state.selectedArticles.splice(pos, 1);
  }
  updateArticlesList();
}

function updatePrepareButton() {
  const count = state.selectedArticles.length;
  elements.btnPrepare.disabled = count === 0;
  elements.btnPrepare.textContent = count > 0
    ? `Preparar ${count} matéria${count > 1 ? 's' : ''}`
    : 'Preparar selecionadas';
}

function updatePreview() {
  const msg = state.preparedMessages[state.currentMessageIndex];
  if (!msg) return;

  elements.previewCounter.textContent = `${state.currentMessageIndex + 1} de ${state.preparedMessages.length}`;
  elements.previewMessage.value = msg.message;
  elements.copyFeedback.classList.add('hidden');
}

// === Funções de Dados ===

async function scanFeed() {
  const feedName = elements.feed.value;
  const feedUrl = FEEDS[feedName];

  showStatus('⏳ Escaneando feed...', 'loading');
  elements.articlesSection.classList.add('hidden');

  try {
    // Usa o background script para fazer o fetch (evita CORS)
    const articles = await chrome.runtime.sendMessage({
      action: 'fetchFeed',
      url: feedUrl,
    });

    if (articles.error) {
      throw new Error(articles.error);
    }

    state.articles = articles;
    state.selectedArticles = [];

    showStatus(`✅ ${articles.length} matérias encontradas`, 'success');
    setTimeout(() => {
      hideStatus();
      showArticles();
      updateArticlesList();
    }, 1000);

  } catch (error) {
    showStatus(`❌ Erro: ${error.message}`, 'error');
  }
}

async function prepareMessages() {
  showStatus('⏳ Preparando mensagens...', 'loading');

  state.preparedMessages = [];
  state.currentMessageIndex = 0;

  const selectedArticles = state.selectedArticles
    .sort((a, b) => a - b)
    .map(i => state.articles[i]);

  try {
    for (let i = 0; i < selectedArticles.length; i++) {
      const article = selectedArticles[i];
      showStatus(`⏳ Buscando ${i + 1}/${selectedArticles.length}: ${article.title.substring(0, 30)}...`, 'loading');

      // Busca detalhes da matéria e encurta o link
      const result = await chrome.runtime.sendMessage({
        action: 'processArticle',
        article: article,
      });

      if (result.error) {
        console.error('Erro ao processar:', result.error);
        continue;
      }

      state.preparedMessages.push({
        article: article,
        message: result.message,
        shortUrl: result.shortUrl,
      });
    }

    if (state.preparedMessages.length === 0) {
      showStatus('❌ Nenhuma mensagem preparada', 'error');
      return;
    }

    hideStatus();
    showPreview();
    updatePreview();

  } catch (error) {
    showStatus(`❌ Erro: ${error.message}`, 'error');
  }
}

async function copyMessage() {
  const message = elements.previewMessage.value;

  try {
    await navigator.clipboard.writeText(message);
    elements.copyFeedback.classList.remove('hidden');

    // Avança para próxima após 1.5s
    setTimeout(() => {
      if (state.currentMessageIndex < state.preparedMessages.length - 1) {
        state.currentMessageIndex++;
        updatePreview();
      } else {
        // Última mensagem - volta para lista
        showStatus('✅ Todas as mensagens foram processadas!', 'success');
        showArticles();
        state.selectedArticles = [];
        updateArticlesList();
        setTimeout(hideStatus, 2000);
      }
    }, 1500);

  } catch (error) {
    alert('Erro ao copiar: ' + error.message);
  }
}

function skipMessage() {
  if (state.currentMessageIndex < state.preparedMessages.length - 1) {
    state.currentMessageIndex++;
    updatePreview();
  } else {
    showArticles();
    state.selectedArticles = [];
    updateArticlesList();
  }
}

function goBack() {
  showArticles();
}

function selectAll() {
  if (state.selectedArticles.length === state.articles.length) {
    // Desseleciona todas
    state.selectedArticles = [];
  } else {
    // Seleciona todas
    state.selectedArticles = state.articles.map((_, i) => i);
  }
  updateArticlesList();
}

// === Event Listeners ===

elements.btnScan.addEventListener('click', scanFeed);
elements.btnSelectAll.addEventListener('click', selectAll);
elements.btnPrepare.addEventListener('click', prepareMessages);
elements.btnCopy.addEventListener('click', copyMessage);
elements.btnSkip.addEventListener('click', skipMessage);
elements.btnBack.addEventListener('click', goBack);

// Permite editar a mensagem
elements.previewMessage.addEventListener('input', () => {
  if (state.preparedMessages[state.currentMessageIndex]) {
    state.preparedMessages[state.currentMessageIndex].message = elements.previewMessage.value;
  }
});
