// RNCWEB
// Interface em HTML: ordem de serviço (navegação) e pedido de orçamento.
const WHATSAPP = '5551996538103';

export function initUI() {
  const steps = [...document.querySelectorAll('.os li')];
  const html = document.documentElement;
  let last = -1;

  const form = document.getElementById('orcamento-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const modelo = (data.get('modelo') || '').toString().trim();
      const nome = (data.get('nome') || '').toString().trim();
      const defeito = data.get('defeito');
      const err = form.querySelector('.form-error');
      if (!modelo) {
        err.textContent = 'Informe o modelo do aparelho para a gente calcular o orçamento.';
        form.querySelector('[name=modelo]').focus();
        return;
      }
      err.textContent = '';
      const msg = `Olá! ${nome ? `Meu nome é ${nome}. ` : ''}Quero um orçamento para um ${modelo}. Problema: ${defeito}.`;
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    });
  }

  return {
    setChapter(f) {
      const i = Math.round(f);
      if (i === last) return;
      last = i;
      html.dataset.chapter = i;
      steps.forEach((li, k) => {
        li.classList.toggle('done', k < i);
        li.classList.toggle('now', k === i);
        const a = li.querySelector('a');
        if (k === i) a.setAttribute('aria-current', 'step');
        else a.removeAttribute('aria-current');
      });
    },
  };
}

async function carregarVitrine() {
  const vitrine = document.getElementById('lista-produtos');
  if (!vitrine) return;
  try {
    const res = await fetch('/api/produtos');
    if (!res.ok) return;
    const data = await res.json();
    if (!Array.isArray(data.produtos) || !data.produtos.length) return;
    const itens = data.produtos.map(p => {
      const card = document.createElement('article');
      const titulo = document.createElement('h3');
      titulo.textContent = p.nome;
      const preco = document.createElement('p');
      preco.textContent = ((p.preco_promocional_centavos ?? p.preco_centavos) / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
      const link = document.createElement('a');
      link.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Tenho interesse em ' + p.nome + '.');
      link.textContent = 'Consultar pelo WhatsApp';
      if (typeof p.imagem_url === 'string' && p.imagem_url.trim()) {
        try {
          const url = new URL(p.imagem_url, window.location.origin);
          const interna = url.origin === window.location.origin && /^\/api\/fotos\/[a-f0-9-]{36}$/.test(url.pathname);
          if ((interna || url.protocol === 'https:') && !url.username && !url.password) {
            const foto = document.createElement('img');
            foto.className = 'produto-foto';
            foto.alt = p.nome;
            foto.loading = 'lazy';
            foto.decoding = 'async';
            foto.referrerPolicy = 'no-referrer';
            foto.addEventListener('error', () => foto.remove(), { once: true });
            foto.src = url.href;
            card.append(foto);
          }
        } catch {}
      }
      card.append(titulo, preco, link);
      return card;
    });
    vitrine.replaceChildren(...itens);
  } catch {}
}
carregarVitrine();
