# Disparos Folha

Scanner automatizado de matérias da Folha de S.Paulo com disparo para WhatsApp.

## Funcionalidades

- Escaneia feeds RSS ou páginas da Folha (Política, Economia, Mundo, etc.)
- Extrai título e bullets de cada matéria
- Encurta links automaticamente via is.gd
- Monta mensagem formatada para WhatsApp
- Interface interativa: Sim / Não / Editar / Ver URL
- Copia direto para o clipboard

## Instalação

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

## Exemplo de mensagem gerada

```
*Lula sanciona lei que aumenta pena para crimes de corrupção*
• Presidente assinou projeto aprovado pelo Congresso na semana passada
• Nova lei prevê penas de até 20 anos de prisão
https://is.gd/abc123
```

## Estrutura do projeto

```
disparos/
├── src/
│   ├── index.js      # Ponto de entrada principal
│   ├── scanner.js    # Escaneia feed RSS / página
│   ├── extractor.js  # Extrai conteúdo das matérias
│   ├── shortener.js  # Encurta links (is.gd)
│   └── cli.js        # Interface de linha de comando
├── package.json
└── README.md
```

## Dependências

- **axios**: Requisições HTTP
- **cheerio**: Parsing de HTML
- **xml2js**: Parsing de RSS/XML
- **clipboardy**: Acesso ao clipboard
