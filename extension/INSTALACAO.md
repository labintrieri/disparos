# Como Instalar a Extensão Disparos Folha

## Passo 1: Gerar os ícones

1. Abra o arquivo `icons/generate-icons.html` no navegador
2. Clique no botão **"Baixar todos os ícones"**
3. Três arquivos serão baixados: `icon16.png`, `icon48.png`, `icon128.png`
4. Mova esses arquivos para a pasta `icons/`

```
extension/
├── icons/
│   ├── icon16.png   ← mova para cá
│   ├── icon48.png   ← mova para cá
│   └── icon128.png  ← mova para cá
```

---

## Passo 2: Instalar no Chrome

### 2.1 Abrir página de extensões

1. Abra o Chrome
2. Digite na barra de endereço: `chrome://extensions`
3. Aperte Enter

### 2.2 Ativar modo desenvolvedor

No canto superior direito, ative o botão **"Modo do desenvolvedor"**

```
┌─────────────────────────────────────────────────────────┐
│ Extensões                          [Modo desenvolvedor] │
│                                           🔘 → 🔵       │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Carregar a extensão

1. Clique no botão **"Carregar sem compactação"**
2. Navegue até a pasta `extension/`
3. Clique em **"Selecionar pasta"**

### 2.4 Pronto!

A extensão aparecerá na lista e um ícone 📰 surgirá na barra do navegador.

---

## Passo 3: Fixar a extensão (opcional)

Para o ícone ficar sempre visível:

1. Clique no ícone de quebra-cabeça 🧩 na barra do Chrome
2. Encontre "Disparos Folha"
3. Clique no alfinete 📌 para fixar

---

## Como Usar

```
┌────────────────────────────────────────┐
│ 1. Clique no ícone 📰                  │
│                                        │
│ 2. Escolha o feed (Política, etc.)     │
│                                        │
│ 3. Clique em "Escanear"                │
│                                        │
│ 4. Marque as matérias desejadas ☑      │
│                                        │
│ 5. Clique em "Preparar selecionadas"   │
│                                        │
│ 6. Revise a mensagem                   │
│                                        │
│ 7. Clique em "Copiar"                  │
│                                        │
│ 8. Cole no WhatsApp! (Ctrl+V)          │
└────────────────────────────────────────┘
```

---

## Instalação no Firefox

1. Digite na barra de endereço: `about:debugging`
2. Clique em **"Este Firefox"** no menu lateral
3. Clique em **"Carregar extensão temporária..."**
4. Selecione o arquivo `manifest.json` dentro da pasta `extension/`

⚠️ **Nota:** No Firefox, a extensão temporária é removida ao fechar o navegador.

---

## Instalação no Edge

O processo é idêntico ao Chrome:

1. Digite: `edge://extensions`
2. Ative **"Modo do desenvolvedor"**
3. Clique em **"Carregar descompactada"**
4. Selecione a pasta `extension/`

---

## Solução de Problemas

### A extensão não aparece
- Verifique se o modo desenvolvedor está ativado
- Tente recarregar a extensão (botão de atualizar na página de extensões)

### Erro ao escanear feed
- Verifique sua conexão com a internet
- O site da Folha pode estar temporariamente fora do ar

### Erro ao encurtar link
- O serviço is.gd pode estar temporariamente indisponível
- A extensão usará o link original como fallback

### Não consigo copiar
- Certifique-se de que a página está em foco
- Tente clicar dentro da área de texto antes de copiar
