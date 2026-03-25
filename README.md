# Disparos Folha

Extensao para Google Chrome que prepara mensagens de WhatsApp a partir de materias da Folha de S.Paulo, com link encurtado via mLabs (mla.bs).

## O que faz

1. Le o feed RSS publico da Folha para listar as materias mais recentes de uma editoria
2. O operador seleciona quais materias deseja disparar
3. Para cada materia, a extensao abre a pagina em segundo plano, extrai titulo e subtitulos (linhas finas), encurta o link via mLabs e formata a mensagem
4. O operador revisa, edita se necessario, e copia para colar no WhatsApp

Resultado:

```
*Titulo da materia*
- _Primeiro subtitulo extraido da pagina_
- _Segundo subtitulo extraido da pagina_
https://mla.bs/abc123
```

## Pre-requisitos

- **Google Chrome** com modo desenvolvedor ativado
- **Conta no mLabs** (publish.mlabs.io) — a extensao usa o cookie de sessao do mLabs para encurtar links. Basta estar logado no mLabs em outra aba.

## Instalacao

1. Baixe o ZIP deste repositorio (Code > Download ZIP)
2. Extraia o ZIP
3. Abra `chrome://extensions` no Chrome
4. Ative o **Modo do desenvolvedor** (canto superior direito)
5. Clique em **Carregar sem compactacao**
6. Selecione a pasta `extension/` (dentro de `disparos-main/disparos-main/`)

Para atualizar: baixe o ZIP novo, substitua a pasta, e clique no botao de recarregar na pagina de extensoes.

## Como usar

1. Faca login no **mLabs** (publish.mlabs.io) em uma aba do Chrome
2. Clique no icone da extensao na barra do navegador
3. Escolha a editoria (Politica, Economia, Mundo, Cotidiano, Esporte)
4. Clique em **Escanear**
5. Marque as materias desejadas
6. Clique em **Preparar selecionadas** (demora alguns segundos por materia)
7. Revise a mensagem (pode editar o texto)
8. Clique em **Copiar** e cole no WhatsApp

A extensao avanca automaticamente para a proxima materia apos copiar.

## Editorias disponiveis

| Editoria | Feed RSS |
|---|---|
| Politica | feeds.folha.uol.com.br/poder/rss091.xml |
| Economia | feeds.folha.uol.com.br/mercado/rss091.xml |
| Mundo | feeds.folha.uol.com.br/mundo/rss091.xml |
| Cotidiano | feeds.folha.uol.com.br/cotidiano/rss091.xml |
| Esporte | feeds.folha.uol.com.br/esporte/rss091.xml |

## Estrutura de arquivos

```
extension/           <- pasta que deve ser carregada no Chrome
  manifest.json      # Configuracao da extensao (Manifest V3)
  background.js      # Service worker: feed RSS, extracao de paginas, encurtamento
  content-extractor.js  # Script injetado nas paginas da Folha para extrair subtitulos
  popup.html         # Interface do operador
  popup.js           # Logica da interface
  styles.css         # Estilos visuais
  icons/             # Icones da extensao
```

## Como funciona (tecnico)

1. **Feed RSS**: o background.js faz fetch do XML, parseia com regex (service workers nao tem DOMParser) e retorna ate 15 materias
2. **Extracao**: para cada materia, abre uma aba invisivel, injeta o content-extractor.js que le o DOM da pagina (seletores CSS em cascata) e retorna titulo + subtitulos + metadados OG
3. **URL**: extrai a URL real da Folha (o feed usa redirects via redir.folha.com.br), limpa parametros UTM existentes e adiciona UTM proprio (whatsapp/social/wppcfolhapol)
4. **Encurtamento**: envia a URL limpa para a API interna do mLabs (core-api.mlabs.io), que gera um link mla.bs. Apos criar, acessa o link para forcar o cache dos metadados OG
5. **Mensagem**: monta o texto no formato WhatsApp (titulo em negrito, subtitulos em italico, link)

### Permissoes

| Permissao | Motivo |
|---|---|
| activeTab | Acesso a aba ativa para clipboard |
| clipboardWrite | Copiar mensagem |
| scripting | Injetar content-extractor.js nas paginas |
| tabs | Criar/fechar abas em segundo plano |
| cookies | Ler cookie de sessao do mLabs |
| host: *.folha.uol.com.br | Feed RSS e paginas |
| host: *.mlabs.io | API de encurtamento |
| host: mla.bs | Aquecimento do link curto |

## Limitacoes

- Opera exclusivamente com materias da Folha de S.Paulo
- A mensagem e copiada; o envio no WhatsApp e manual
- Limite de 15 materias por escaneamento
- Requer sessao ativa no mLabs (login em outra aba)
- Se a sessao expirar, a extensao mostra erro e pede novo login

## Privacidade

- Nao coleta, armazena ou transmite dados do operador
- Nao tem backend ou banco de dados
- Os dados acessados (feed RSS, paginas, metadados OG) sao publicos
- As mensagens existem apenas na memoria do navegador enquanto o popup esta aberto
