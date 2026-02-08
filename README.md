# Disparos Folha

Extensao para Google Chrome que automatiza a preparacao de mensagens para WhatsApp a partir de materias da Folha de S.Paulo.

## Problema

A equipe de comunicacao precisa distribuir rapidamente materias da Folha via WhatsApp. O processo manual envolve: abrir cada materia, copiar titulo, copiar subtitulos, formatar a mensagem, encurtar o link, colar no WhatsApp. Para cada materia, sao varios minutos. Multiplicados por dezenas de materias por dia, o tempo gasto e significativo.

## O que a extensao faz

1. Le o feed RSS publico da Folha para listar as materias mais recentes de uma editoria
2. O operador seleciona quais materias deseja disparar
3. Para cada materia selecionada, a extensao abre a pagina em segundo plano, extrai titulo e subtitulos (linhas finas), encurta o link via is.gd e formata a mensagem no padrao WhatsApp
4. O operador revisa, edita se necessario, e copia para a area de transferencia

O resultado e uma mensagem pronta como:

```
*PSD, Uniao e PL ensaiam alianca para derrotar candidato de Motta e Lula ao TCU*
• _O petista Odair Cunha e apoiado pelo presidente da Camara, como parte de acordo com o PT_
• _Ala do centrao diz nao ter compromisso com entendimento e busca bolsonaristas_
https://is.gd/xxxxx
```

## Instalacao

Ver arquivo [extension/INSTALACAO.md](extension/INSTALACAO.md) para instrucoes detalhadas.

Resumo:

1. Abrir `chrome://extensions`
2. Ativar "Modo do desenvolvedor"
3. Clicar em "Carregar sem compactacao"
4. Selecionar a pasta `extension/`

## Como usar

1. Clicar no icone da extensao na barra do navegador
2. Escolher a editoria (Politica, Economia, etc.)
3. Clicar em "Escanear"
4. Marcar as materias desejadas
5. Clicar em "Preparar selecionadas"
6. Revisar a mensagem (e possivel editar o texto diretamente)
7. Clicar em "Copiar"
8. Colar no WhatsApp (Ctrl+V)

A extensao avanca automaticamente para a proxima materia apos a copia.

## Editorias disponiveis

| Editoria | Feed RSS |
|---|---|
| Politica | `feeds.folha.uol.com.br/poder/rss091.xml` |
| Economia | `feeds.folha.uol.com.br/mercado/rss091.xml` |
| Mundo | `feeds.folha.uol.com.br/mundo/rss091.xml` |
| Cotidiano | `feeds.folha.uol.com.br/cotidiano/rss091.xml` |
| Esporte | `feeds.folha.uol.com.br/esporte/rss091.xml` |

---

## Arquitetura tecnica

### Componentes

| Arquivo | Funcao |
|---|---|
| `manifest.json` | Declaracao da extensao (Manifest V3), permissoes e pontos de entrada |
| `background.js` | Service worker. Busca o feed RSS, coordena a extracao de cada pagina, encurta URLs |
| `content-extractor.js` | Script injetado nas paginas da Folha para extrair titulo e subtitulos via DOM |
| `popup.html` | Interface do operador |
| `popup.js` | Logica da interface: listagem, selecao, previa e copia |
| `styles.css` | Estilos da interface |

### Fluxo de execucao detalhado

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
background.js parseia o XML com regex e retorna lista de {titulo, link}
        |
        v
popup.js exibe a lista. Operador seleciona materias e clica "Preparar"
        |
        v
Para cada materia selecionada, sequencialmente:
   1. background.js abre aba em segundo plano (chrome.tabs.create, active: false)
   2. Aguarda carregamento completo da pagina (timeout de 15 segundos)
   3. Injeta content-extractor.js via chrome.scripting.executeScript
   4. content-extractor.js consulta o DOM da pagina e retorna os subtitulos
   5. background.js fecha a aba imediatamente
   6. background.js limpa a URL e adiciona parametros UTM de rastreamento
   7. background.js encurta a URL via API do is.gd
   8. background.js monta a mensagem formatada
        |
        v
popup.js exibe a previa editavel. Operador revisa e clica "Copiar"
        |
        v
Mensagem copiada para a area de transferencia via navigator.clipboard.writeText
```

### Permissoes declaradas no manifest

| Permissao | Justificativa |
|---|---|
| `activeTab` | Acesso a aba ativa para operacoes de clipboard |
| `clipboardWrite` | Copiar mensagem formatada para a area de transferencia |
| `scripting` | Injetar o content-extractor.js nas paginas da Folha para leitura do DOM |
| `tabs` | Criar e fechar abas em segundo plano durante a extracao |
| `host: *.folha.uol.com.br` | Acessar feeds RSS e paginas de materias da Folha |
| `host: is.gd` | Chamar a API de encurtamento de URLs |

A extensao **nao solicita** permissoes amplas como `<all_urls>`, `webRequest`, `history`, `bookmarks` ou `cookies`. O acesso e restrito aos dois dominios listados.

### Extracao de subtitulos (content-extractor.js)

O script injetado na pagina tenta os seguintes seletores CSS em cascata, parando no primeiro que retornar ao menos 2 itens:

1. `.c-news__subheadline li` — padrao atual da Folha
2. `.summary li`
3. `.bullets li`
4. `[class*="bullet"] li`
5. `[class*="linha-fina"] li`
6. `article header ul li`
7. `article .summary ul li`
8. `main .summary li`
9. `article ul li`
10. `main ul li`

Se nenhum seletor retornar resultado, o fallback e a meta tag `og:description` da pagina.

### Parametros UTM

Todas as URLs recebem os seguintes parametros antes do encurtamento:

```
utm_source=whatsapp
utm_medium=social
utm_campaign=wppcfolhapol
```

Isso permite rastrear no analytics da Folha o trafego originado por esses disparos.

### Servicos externos utilizados

| Servico | Uso | Dados enviados |
|---|---|---|
| feeds.folha.uol.com.br | Leitura do feed RSS (publico, sem autenticacao) | Nenhum dado do operador |
| www1.folha.uol.com.br | Carregamento das paginas de materias para extracao | Cookies do navegador do operador (sessao da Folha) |
| is.gd | Encurtamento de URL | Apenas a URL da materia |

---

## Riscos conhecidos e mitigacoes

### 1. Dependencia da estrutura HTML da Folha

**Risco:** A extracao dos subtitulos depende de seletores CSS especificos da Folha (`.c-news__subheadline li`, entre outros). Se a Folha alterar a estrutura HTML das paginas de materia, os subtitulos podem deixar de ser extraidos.

**Probabilidade:** Media. Redesigns acontecem, mas a Folha mantem a estrutura atual ha bastante tempo.

**Impacto:** Parcial. As mensagens serao geradas sem subtitulos (apenas titulo + link). A operacao nao e interrompida.

**Mitigacao:** 10 seletores em cascata e fallback para `og:description`. Em caso de falha total, basta atualizar os seletores em `content-extractor.js`.

### 2. Dependencia do servico is.gd

**Risco:** O encurtamento de URL depende do servico gratuito is.gd. Se o servico ficar indisponivel, instavel ou for descontinuado, os links nao serao encurtados.

**Probabilidade:** Baixa a media. O is.gd opera desde 2009, mas e gratuito e sem SLA.

**Impacto:** Minimo. Em caso de falha, a extensao usa automaticamente a URL original (longa). A operacao nao e interrompida.

**Alternativa futura:** Substituir por bit.ly (com API key), t.ly, ou dominio proprio com redirecionamento.

### 3. Dependencia do feed RSS da Folha

**Risco:** Os feeds RSS da Folha sao publicos e sem autenticacao, mas podem ser alterados, ter a URL modificada, ou ser descontinuados.

**Probabilidade:** Baixa. Feeds RSS sao um padrao consolidado e a Folha os mantem publicos.

**Impacto:** Total. Sem o feed, a extensao nao lista materias.

**Mitigacao:** Nao ha fallback automatico. Seria necessario adaptar a extensao para outra fonte de dados (scraping da pagina de listagem, API, etc.).

### 4. Abertura de abas em segundo plano

**Risco:** Para cada materia processada, uma aba do navegador e criada, carregada e fechada. O operador vera abas aparecendo brevemente. Em maquinas com pouca memoria ou conexao lenta, processar muitas materias pode causar lentidao.

**Probabilidade:** Baixa em condicoes normais de uso.

**Impacto:** Desconforto visual e possivel lentidao temporaria.

**Mitigacao:** As materias sao processadas sequencialmente (uma aba por vez). Cada aba e fechada imediatamente apos a extracao. Ha um timeout de 15 segundos por pagina. O escaneamento e limitado a 15 materias por vez.

### 5. Privacidade e dados

- A extensao **nao coleta, armazena ou transmite dados do operador**
- Nao ha backend, banco de dados ou servidor proprio
- As unicas requisicoes externas sao para `folha.uol.com.br` (feed e paginas) e `is.gd` (encurtamento)
- As mensagens existem apenas na memoria local do navegador enquanto o popup esta aberto. Ao fechar, sao descartadas
- A extensao nao tem acesso a nenhum outro site alem dos dois declarados no manifest
- Nenhum dado de navegacao, historico ou credencial e acessado

### 6. Distribuicao e confianca

A extensao nao esta publicada na Chrome Web Store. E instalada manualmente via modo desenvolvedor ("Carregar sem compactacao"). Isso significa:

- **Nao passa por revisao automatizada do Google.** O codigo-fonte, no entanto, e aberto e auditavel neste repositorio.
- **O Chrome pode exibir avisos** sobre extensoes em modo desenvolvedor a cada inicializacao. Isso e normal e esperado.
- **Atualizacoes nao sao automaticas.** Para atualizar, e necessario baixar a nova versao e recarregar na pagina de extensoes.

Para distribuicao em escala, seria necessario publicar na Chrome Web Store (requer conta de desenvolvedor Google, taxa unica de US$ 5 e submissao para revisao).

---

## Limitacoes

- Opera exclusivamente com materias da Folha de S.Paulo
- A mensagem e copiada para a area de transferencia; o envio no WhatsApp e manual (colar e enviar)
- O feed RSS retorna as materias mais recentes, sem controle de data ou busca por palavra-chave
- Materias com paywall: os subtitulos sao extraidos do header da pagina, que e publico mesmo em materias restritas a assinantes, mas isso depende de a Folha manter essa estrutura
- Limite de 15 materias por escaneamento

## Estrutura de arquivos

```
disparos/
├── extension/
│   ├── manifest.json           # Configuracao da extensao
│   ├── background.js           # Service worker (feed, tabs, URLs)
│   ├── content-extractor.js    # Extracao de subtitulos via DOM
│   ├── popup.html              # Interface do operador
│   ├── popup.js                # Logica da interface
│   ├── styles.css              # Estilos visuais
│   ├── icons/                  # Icones da extensao
│   │   ├── icon.svg
│   │   └── generate-icons.html # Gerador de PNGs a partir do SVG
│   └── INSTALACAO.md           # Instrucoes de instalacao passo a passo
└── README.md
```
