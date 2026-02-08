// Content script que extrai bullets da página da Folha
// É injetado na página quando o usuário seleciona uma matéria

(function() {
  function clean(t) {
    return (t || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function q(s) {
    return document.querySelector(s);
  }

  function qa(s) {
    return Array.prototype.slice.call(document.querySelectorAll(s));
  }

  // Extrai título
  const title = clean(
    (q('meta[property="og:title"]') || {}).content ||
    (q('h1') || {}).innerText ||
    document.title ||
    ''
  );

  // Extrai descrição
  const ogDescription = clean(
    (q('meta[property="og:description"]') || {}).content ||
    (q('meta[name="description"]') || {}).content ||
    ''
  );

  // Seletores para bullets (mesmo do bookmarklet original)
  const sels = [
    '.c-news__subheadline li',
    '.summary li',
    '.bullets li',
    '[class*="bullet"] li',
    '[class*="linha-fina"] li',
    'article header ul li',
    'article .summary ul li',
    'main .summary li',
    'article ul li',
    'main ul li'
  ];

  let bullets = [];

  for (let i = 0; i < sels.length; i++) {
    bullets = qa(sels[i])
      .map(e => clean(e.textContent))
      .filter(x => x && x.length > 3 && x.length < 220);

    if (bullets.length >= 2) break;
  }

  // Fallback: tenta extrair da descrição
  if (bullets.length < 2 && ogDescription) {
    const parts = ogDescription
      .split(/(?:•|·|;|—|–|:|\.)(?:\s+|$)/)
      .map(clean)
      .filter(Boolean);

    if (parts.length >= 2) {
      bullets = [parts[0], parts[1]];
    } else if (parts.length === 1) {
      bullets = [parts[0]];
    }
  }

  // Limita a 2 bullets
  bullets = bullets.slice(0, 2);

  // Retorna os dados extraídos
  return {
    title: title,
    bullets: bullets,
    description: ogDescription
  };
})();
