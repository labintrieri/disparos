# Disparos Folha

Extensão para Google Chrome que automatiza a preparação de mensagens para WhatsApp a partir de matérias da Folha de S.Paulo.

## Problema

A equipe de comunicação precisa distribuir rapidamente matérias da Folha via WhatsApp. O processo manual envolve: abrir cada matéria, copiar título, copiar subtítulos, formatar a mensagem, encurtar o link, colar no WhatsApp. Para cada matéria, são vários minutos. Multiplicados por dezenas de matérias por dia, o tempo gasto é significativo.

## O que a extensão faz

1. Lê o feed RSS público da Folha para listar as matérias mais recentes de uma editoria
2. O operador seleciona quais matérias deseja disparar
3. Para cada matéria selecionada, a extensão abre a página em segundo plano, extrai título e subtítulos (linhas finas), encurta o link via is.gd e formata a mensagem no padrão WhatsApp
4. O operador revisa, edita se necessário, e copia para a área de transferência

O resultado é uma mensagem pronta como:

```
*PSD, União e PL ensaiam aliança para derrotar candidato de Motta e Lula ao TCU*
• _O petista Odair Cunha é apoiado pelo presidente da Câmara, como parte de acordo com o PT_
• _Ala do centrão diz não ter compromisso com entendimento e busca bolsonaristas_
https://is.gd/xxxxx
```

## Instalação

Ver arquivo [extension/INSTALACAO.md](extension/INSTALACAO.md) para instruções detalhadas.

Resumo:

1. Abrir `chrome://extensions`
2. Ativar "Modo do desenvolvedor"
3. Clicar em "Carregar sem compactação"
4. Selecionar a pasta `extension/`

## Como usar

1. Clicar no ícone da extensão na barra do navegador
2. Escolher a editoria (Política, Economia, etc.)
3. Clicar em "Escanear"
4. Marcar as matérias desejadas
5. Clicar em "Preparar selecionadas"
6. Revisar a mensagem (é possível editar o texto diretamente)
7. Clicar em "Copiar"
8. Colar no WhatsApp (Ctrl+V)

A extensão avança automaticamente para a próxima matéria após a cópia.

## Editorias disponíveis

| Editoria | Feed RSS |
|---|---|
| Política | `feeds.folha.uol.com.br/poder/rss091.xml` |
| Economia | `feeds.folha.uol.com.br/mercado/rss091.xml` |
| Mundo | `feeds.folha.uol.com.br/mundo/rss091.xml` |
| Cotidiano | `feeds.folha.uol.com.br/cotidiano/rss091.xml` |
| Esporte | `feeds.folha.uol.com.br/esporte/rss091.xml` |

---

## Arquitetura técnica

### Componentes

| Arquivo | Função |
|---|---|
| `manifest.json` | Declaração da extensão (Manifest V3), permissões e pontos de entrada |
| `background.js` | Service worker. Busca o feed RSS, coordena a extração de cada página, encurta URLs |
| `content-extractor.js` | Script injetado nas páginas da Folha para extrair título e subtítulos via DOM |
| `popup.html` | Interface do operador |
| `popup.js` | Lógica da interface: listagem, seleção, prévia e cópia |
| `styles.css` | Estilos da interface |

### Fluxo de execução detalhado

```
Operador clica em "Escanear"
        |
        v
popup.js envia mensagem ao background.js
        |
        v
background.js faz fetch do feed RSS (ex: feeds.folha.uol.com.br/poder/rss091.xml)
        |
        v
background.js parseia o XML com regex e retorna lista de {título, link}
        |
        v
popup.js exibe a lista. Operador seleciona matérias e clica "Preparar"
        |
        v
Para cada matéria selecionada, sequencialmente:
   1. background.js abre aba em segundo plano (chrome.tabs.create, active: false)
   2. Aguarda carregamento completo da página (timeout de 15 segundos)
   3. Injeta content-extractor.js via chrome.scripting.executeScript
   4. content-extractor.js consulta o DOM da página e retorna os subtítulos
   5. background.js fecha a aba imediatamente
   6. background.js limpa a URL e adiciona parâmetros UTM de rastreamento
   7. background.js encurta a URL via API do is.gd
   8. background.js monta a mensagem formatada
        |
        v
popup.js exibe a prévia editável. Operador revisa e clica "Copiar"
        |
        v
Mensagem copiada para a área de transferência via navigator.clipboard.writeText
```

### Permissões declaradas no manifest

| Permissão | Justificativa |
|---|---|
| `activeTab` | Acesso à aba ativa para operações de clipboard |
| `clipboardWrite` | Copiar mensagem formatada para a área de transferência |
| `scripting` | Injetar o content-extractor.js nas páginas da Folha para leitura do DOM |
| `tabs` | Criar e fechar abas em segundo plano durante a extração |
| `host: *.folha.uol.com.br` | Acessar feeds RSS e páginas de matérias da Folha |
| `host: is.gd` | Chamar a API de encurtamento de URLs |

A extensão **não solicita** permissões amplas como `<all_urls>`, `webRequest`, `history`, `bookmarks` ou `cookies`. O acesso é restrito aos dois domínios listados.

### Extração de subtítulos (content-extractor.js)

O script injetado na página tenta os seguintes seletores CSS em cascata, parando no primeiro que retornar ao menos 2 itens:

1. `.c-news__subheadline li` — padrão atual da Folha
2. `.summary li`
3. `.bullets li`
4. `[class*="bullet"] li`
5. `[class*="linha-fina"] li`
6. `article header ul li`
7. `article .summary ul li`
8. `main .summary li`
9. `article ul li`
10. `main ul li`

Se nenhum seletor retornar resultado, o fallback é a meta tag `og:description` da página.

### Parâmetros UTM

Todas as URLs recebem os seguintes parâmetros antes do encurtamento:

```
utm_source=whatsapp
utm_medium=social
utm_campaign=wppcfolhapol
```

Isso permite rastrear no analytics da Folha o tráfego originado por esses disparos.

### Serviços externos utilizados

| Serviço | Uso | Dados enviados |
|---|---|---|
| feeds.folha.uol.com.br | Leitura do feed RSS (público, sem autenticação) | Nenhum dado do operador |
| www1.folha.uol.com.br | Carregamento das páginas de matérias para extração | Cookies do navegador do operador (sessão da Folha) |
| is.gd | Encurtamento de URL | Apenas a URL da matéria |

---

## Riscos conhecidos e mitigações

### 1. Dependência da estrutura HTML da Folha

**Risco:** A extração dos subtítulos depende de seletores CSS específicos da Folha (`.c-news__subheadline li`, entre outros). Se a Folha alterar a estrutura HTML das páginas de matéria, os subtítulos podem deixar de ser extraídos.

**Probabilidade:** Média. Redesigns acontecem, mas a Folha mantém a estrutura atual há bastante tempo.

**Impacto:** Parcial. As mensagens serão geradas sem subtítulos (apenas título + link). A operação não é interrompida.

**Mitigação:** 10 seletores em cascata e fallback para `og:description`. Em caso de falha total, basta atualizar os seletores em `content-extractor.js`.

### 2. Dependência do serviço is.gd

**Risco:** O encurtamento de URL depende do serviço gratuito is.gd. Se o serviço ficar indisponível, instável ou for descontinuado, os links não serão encurtados.

**Probabilidade:** Baixa a média. O is.gd opera desde 2009, mas é gratuito e sem SLA.

**Impacto:** Mínimo. Em caso de falha, a extensão usa automaticamente a URL original (longa). A operação não é interrompida.

**Alternativa futura:** Substituir por bit.ly (com API key), t.ly, ou domínio próprio com redirecionamento.

### 3. Dependência do feed RSS da Folha

**Risco:** Os feeds RSS da Folha são públicos e sem autenticação, mas podem ser alterados, ter a URL modificada, ou ser descontinuados.

**Probabilidade:** Baixa. Feeds RSS são um padrão consolidado e a Folha os mantém públicos.

**Impacto:** Total. Sem o feed, a extensão não lista matérias.

**Mitigação:** Não há fallback automático. Seria necessário adaptar a extensão para outra fonte de dados (scraping da página de listagem, API, etc.).

### 4. Abertura de abas em segundo plano

**Risco:** Para cada matéria processada, uma aba do navegador é criada, carregada e fechada. O operador verá abas aparecendo brevemente. Em máquinas com pouca memória ou conexão lenta, processar muitas matérias pode causar lentidão.

**Probabilidade:** Baixa em condições normais de uso.

**Impacto:** Desconforto visual e possível lentidão temporária.

**Mitigação:** As matérias são processadas sequencialmente (uma aba por vez). Cada aba é fechada imediatamente após a extração. Há um timeout de 15 segundos por página. O escaneamento é limitado a 15 matérias por vez.

### 5. Privacidade e dados

- A extensão **não coleta, armazena ou transmite dados do operador**
- Não há backend, banco de dados ou servidor próprio
- As únicas requisições externas são para `folha.uol.com.br` (feed e páginas) e `is.gd` (encurtamento)
- As mensagens existem apenas na memória local do navegador enquanto o popup está aberto. Ao fechar, são descartadas
- A extensão não tem acesso a nenhum outro site além dos dois declarados no manifest
- Nenhum dado de navegação, histórico ou credencial é acessado

### 6. Distribuição e confiança

A extensão não está publicada na Chrome Web Store. É instalada manualmente via modo desenvolvedor ("Carregar sem compactação"). Isso significa:

- **Não passa por revisão automatizada do Google.** O código-fonte, no entanto, é aberto e auditável neste repositório.
- **O Chrome pode exibir avisos** sobre extensões em modo desenvolvedor a cada inicialização. Isso é normal e esperado.
- **Atualizações não são automáticas.** Para atualizar, é necessário baixar a nova versão e recarregar na página de extensões.

Para distribuição em escala, seria necessário publicar na Chrome Web Store (requer conta de desenvolvedor Google, taxa única de US$ 5 e submissão para revisão).

---

## Limitações

- Opera exclusivamente com matérias da Folha de S.Paulo
- A mensagem é copiada para a área de transferência; o envio no WhatsApp é manual (colar e enviar)
- O feed RSS retorna as matérias mais recentes, sem controle de data ou busca por palavra-chave
- Matérias com paywall: os subtítulos são extraídos do header da página, que é público mesmo em matérias restritas a assinantes, mas isso depende de a Folha manter essa estrutura
- Limite de 15 matérias por escaneamento

## Estrutura de arquivos

```
disparos/
├── extension/
│   ├── manifest.json           # Configuração da extensão
│   ├── background.js           # Service worker (feed, tabs, URLs)
│   ├── content-extractor.js    # Extração de subtítulos via DOM
│   ├── popup.html              # Interface do operador
│   ├── popup.js                # Lógica da interface
│   ├── styles.css              # Estilos visuais
│   ├── icons/                  # Ícones da extensão
│   │   ├── icon.svg
│   │   └── generate-icons.html # Gerador de PNGs a partir do SVG
│   └── INSTALACAO.md           # Instruções de instalação passo a passo
└── README.md
```
