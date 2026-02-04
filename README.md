# Disparos Folha

Scanner automatizado de matérias da Folha de S.Paulo com disparo para WhatsApp.

## Duas formas de usar

| Versão | Descrição | Instalação |
|--------|-----------|------------|
| **Extensão de navegador** | Interface visual, não precisa de terminal | Só carregar no Chrome/Firefox |
| **CLI (linha de comando)** | Para quem prefere terminal | Precisa de Node.js |

---

## Opção 1: Extensão de Navegador (Recomendada)

A forma mais fácil de usar. Funciona no Chrome, Edge e Firefox.

### Como instalar

Veja o arquivo [extension/INSTALACAO.md](extension/INSTALACAO.md) para instruções detalhadas.

**Resumo rápido (Chrome):**
1. Abra `chrome://extensions`
2. Ative "Modo do desenvolvedor"
3. Clique em "Carregar sem compactação"
4. Selecione a pasta `extension/`

### Como usar

1. Clique no ícone 📰 na barra do navegador
2. Escolha o feed (Política, Economia, etc.)
3. Clique em "Escanear"
4. Marque as matérias ☑
5. Clique em "Preparar selecionadas"
6. Revise e clique em "Copiar"
7. Cole no WhatsApp (Ctrl+V)

---

## Opção 2: CLI (Linha de Comando)

Para quem prefere usar o terminal.

### Funcionalidades

- Escaneia feeds RSS ou páginas da Folha (Política, Economia, Mundo, etc.)
- Extrai título e bullets de cada matéria
- Encurta links automaticamente via is.gd
- Monta mensagem formatada para WhatsApp
- Interface interativa: Sim / Não / Editar / Ver URL
- Copia direto para o clipboard

### Instalação

```bash
git clone <repo-url>
cd disparos
npm install
```

## Uso

```bash
# Escaneia Política (padrão)
npm start

# Escaneia Economia
npm start --feed=mercado

# Limita a 5 matérias
npm start --limit=5

# Atalhos
npm run politica
npm run economia
```

## Feeds disponíveis

| Feed | Comando |
|------|---------|
| Política | `--feed=poder` |
| Economia | `--feed=mercado` |
| Mundo | `--feed=mundo` |
| Cotidiano | `--feed=cotidiano` |
| Esporte | `--feed=esporte` |

## Fluxo de uso

1. Execute `npm start`
2. O scanner busca as matérias mais recentes
3. Para cada matéria:
   - Mostra prévia da mensagem formatada
   - Você escolhe: **[S]im** / **[N]ão** / **[E]ditar** / **[V]er URL** / **[Q]uit**
4. Se **Sim**: copia para clipboard, pronto para colar no WhatsApp

## Estrutura do projeto

```
disparos/
├── extension/              # Extensão de navegador
│   ├── manifest.json       # Configuração da extensão
│   ├── popup.html          # Interface do popup
│   ├── popup.js            # Lógica do popup
│   ├── background.js       # Service worker
│   ├── styles.css          # Estilos
│   ├── icons/              # Ícones
│   └── INSTALACAO.md       # Instruções detalhadas
├── src/                    # CLI (linha de comando)
│   ├── index.js            # Ponto de entrada principal
│   ├── scanner.js          # Escaneia feed RSS / página
│   ├── extractor.js        # Extrai conteúdo das matérias
│   ├── shortener.js        # Encurta links (is.gd)
│   └── cli.js              # Interface de linha de comando
├── package.json
└── README.md
```

## Dependências (apenas CLI)

- **axios**: Requisições HTTP
- **cheerio**: Parsing de HTML
- **xml2js**: Parsing de RSS/XML
- **clipboardy**: Acesso ao clipboard

## Exemplo de mensagem gerada

```
*Lula sanciona lei que aumenta pena para crimes de corrupção*
• Presidente assinou projeto aprovado pelo Congresso na semana passada
• Nova lei prevê penas de até 20 anos de prisão
https://is.gd/abc123
```
