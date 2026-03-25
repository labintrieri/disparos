# Disparos

Extensão para Google Chrome que automatiza a preparação de mensagens para WhatsApp a partir de matérias da Folha de S.Paulo.

## O que a extensão faz

1. Lê o feed RSS público da Folha para listar as matérias mais recentes de uma editoria
2. O operador seleciona quais matérias deseja disparar
3. Para cada matéria selecionada, a extensão abre a página em segundo plano, extrai título e subtítulos (linhas finas), encurta o link via mLabs (mla.bs) e formata a mensagem no padrão WhatsApp
4. O operador revisa, edita se necessário, e copia para a área de transferência

O resultado é uma mensagem pronta como:

```
*PSD, União e PL ensaiam aliança para derrotar candidato de Motta e Lula ao TCU*
• _O petista Odair Cunha é apoiado pelo presidente da Câmara, como parte de acordo com o PT_
• _Ala do centrão diz não ter compromisso com entendimento e busca bolsonaristas_
https://mla.bs/1daa067a
```

## Instalação

Ver arquivo [extension/INSTALACAO.md](extension/INSTALACAO.md) para instruções detalhadas.

Resumo:

1. Abrir `chrome://extensions`
2. Ativar "Modo do desenvolvedor"
3. Clicar em "Carregar sem compactação"
4. Selecionar a pasta `extension/`

## Pré-requisitos

- **mLabs**: Para que os links encurtados gerem pré-visualização com foto no WhatsApp, o operador deve estar logado em [publish.mlabs.io](https://publish.mlabs.io) no mesmo navegador. O token expira em ~1h; se expirar, basta abrir o mLabs e fazer login novamente.
- Se o mLabs não estiver disponível, a extensão usa automaticamente o is.gd como fallback.

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

---

## Arquitetura técnica

### Componentes

| Arquivo | Função |
|---|---|
| `manifest.json` | Declaração da extensão (Manifest V3), permissões e pontos de entrada |
| `background.js` | Service worker. Busca o feed RSS, coordena a extração de cada página, encurta URLs via mLabs (com fallback is.gd) |
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
   7. background.js encurta a URL via API do mLabs (mla.bs), com fallback para is.gd
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
| `cookies` | Ler o token de autenticação do mLabs (cookie `authApiToken` do domínio `.mlabs.io`) |
| `host: *.folha.uol.com.br` | Acessar feeds RSS e páginas de matérias da Folha |
| `host: core-api.mlabs.io` | Chamar a API de encurtamento de URLs do mLabs |
| `host: *.mlabs.io` | Leitura de cookies de autenticação do mLabs |
| `host: is.gd` | Chamar a API de encurtamento de URLs (fallback) |

A extensão **não solicita** permissões amplas como `<all_urls>`, `webRequest` ou `history`. O acesso a cookies é restrito ao domínio `.mlabs.io` para leitura do token de autenticação.

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
| core-api.mlabs.io | Encurtamento de URL (primário) | URL da matéria + token JWT do mLabs |
| is.gd | Encurtamento de URL (fallback) | Apenas a URL da matéria |

---

### 5. Privacidade e dados

- A extensão **não coleta, armazena ou transmite dados do operador**
- Não há backend, banco de dados ou servidor próprio
- As requisições externas são para `folha.uol.com.br` (feed e páginas), `core-api.mlabs.io` (encurtamento primário) e `is.gd` (encurtamento fallback)
- O token do mLabs é lido diretamente do cookie do navegador a cada uso — nunca é armazenado pela extensão
- As mensagens existem apenas na memória local do navegador enquanto o popup está aberto. Ao fechar, são descartadas
- Nenhum dado de navegação ou histórico é acessado

### 6. Distribuição 
A extensão não está publicada na Chrome Web Store. É instalada manualmente via modo desenvolvedor ("Carregar sem compactação"). Isso significa:

- **Não passa por revisão automatizada do Google.** O código-fonte, no entanto, é aberto e auditável neste repositório.
- **O Chrome pode exibir avisos** sobre extensões em modo desenvolvedor a cada inicialização. Isso é normal e esperado.
- **Atualizações não são automáticas.** Para atualizar, é necessário baixar a nova versão e recarregar na página de extensões.

---

## Limitações

- Opera exclusivamente com matérias da Folha de S.Paulo
- A mensagem é copiada para a área de transferência; o envio no WhatsApp é manual (colar e enviar)
- O feed RSS retorna as matérias mais recentes, sem controle de data ou busca por palavra-chave
- Limite de 15 matérias por escaneamento
- O encurtamento via mLabs requer login ativo em publish.mlabs.io (o token JWT expira em ~1h)
- Se o token expirar, a extensão usa is.gd como fallback (mas links is.gd não geram pré-visualização com foto no WhatsApp)
- O link encurtado via is.gd não funciona para disparos feitos pelo navegador Edge. Funciona no Chrome e Mozilla.

## Estrutura de arquivos

A pasta `extension/` é a que deve ser carregada no Chrome. Os demais arquivos na raiz são apenas documentação e configuração do repositório.

```
disparos/
├── extension/                    ← carregar esta pasta no Chrome
│   ├── manifest.json             # Configuração da extensão
│   ├── background.js             # Service worker (feed, tabs, URLs)
│   ├── content-extractor.js      # Extração de subtítulos via DOM
│   ├── popup.html                # Interface do operador
│   ├── popup.js                  # Lógica da interface
│   ├── styles.css                # Estilos visuais
│   ├── icons/                    # Ícones da extensão
│   │   ├── icon.svg
│   │   └── generate-icons.html   # Gerador de PNGs a partir do SVG
│   └── INSTALACAO.md             # Instruções de instalação passo a passo
├── README.md
└── LICENSE
```
