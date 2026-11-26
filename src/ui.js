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

// RNCWEB
const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const moeda = centavos => (centavos / 100).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const valorProduto = p => p.preco_promocional_centavos ?? p.preco_centavos;

function vitrineDoProduto(p) {
  const c = normalizar(p.categoria);
  if (/^(celulares?|smartphones?|aparelhos?|telefones?)\s+nov[oa]s?$/.test(c) || /^(novo|novos|celular novo|celulares novos)$/.test(c)) return 'celulares';
  if (/servic|assistencia|reparo|conserto|mao de obra/.test(c)) return 'servicos';
  if (/acessor|capinha|\bcapa[s]?\b|pelicul|carregador|cabo|\bfones?\b|adaptador|suporte|power\s*bank/.test(c)) return 'acessorios';
  return 'outros';
}

function criarCard(p) {
  const card = document.createElement('article');
  if (typeof p.imagem_url === 'string' && p.imagem_url.trim()) {
    try {
      const url = new URL(p.imagem_url, location.origin);
      const interna = url.origin === location.origin && /^\/api\/fotos\/[a-f0-9-]{36}$/.test(url.pathname);
      if ((interna || url.protocol === 'https:') && !url.username && !url.password) {
        const foto = document.createElement('img');
        foto.className = 'produto-foto'; foto.alt = p.nome; foto.loading = 'lazy'; foto.decoding = 'async'; foto.referrerPolicy = 'no-referrer';
        foto.addEventListener('error', () => foto.remove(), {once:true}); foto.src = url.href; card.append(foto);
      }
    } catch {}
  }
  const categoria = document.createElement('span'); categoria.className = 'mt-item-category';
  categoria.textContent = (p.categoria || 'Produto') + (p.destaque ? ' · Destaque' : '');
  const titulo = document.createElement('h3'); titulo.textContent = p.nome;
  card.append(categoria, titulo);
  if (p.descricao) { const desc = document.createElement('p'); desc.className = 'mt-item-description'; desc.textContent = p.descricao; card.append(desc); }
  const preco = document.createElement('p'); preco.className = 'mt-item-price';
  if (p.preco_promocional_centavos != null) { const antigo = document.createElement('del'); antigo.textContent = moeda(p.preco_centavos); preco.append(antigo); }
  preco.append(document.createTextNode(moeda(valorProduto(p)))); card.append(preco);
  if (vitrineDoProduto(p) !== 'servicos') { const estoque = document.createElement('span'); estoque.className = 'mt-item-stock'; estoque.textContent = p.estoque > 0 ? 'Disponível em estoque' : 'Consulte disponibilidade'; card.append(estoque); }
  const link = document.createElement('a'); link.className = 'mt-item-cta'; link.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Tenho interesse em ' + p.nome + '.');
  link.textContent = 'Consultar pelo WhatsApp ↗'; card.append(link); return card;
}

async function carregarVitrine() {
  const grupos = {acessorios:document.getElementById('lista-produtos'),celulares:document.getElementById('lista-celulares'),outros:document.getElementById('lista-outros'),servicos:document.getElementById('lista-servicos')};
  if (Object.values(grupos).some(el => !el)) return;
  const busca = document.getElementById('mt-search'), ordem = document.getElementById('mt-sort'), status = document.getElementById('mt-catalog-status'), outros = document.getElementById('outros-produtos');
  try {
    const res = await fetch('/api/produtos'); if (!res.ok) throw Error('Catálogo indisponível');
    const data = await res.json(); if (!Array.isArray(data.produtos)) throw Error('Catálogo inválido');
    const todos = data.produtos;
    const catalogo = todos.filter(p => vitrineDoProduto(p) !== 'servicos');
    function preencher(el, itens, mensagem) {
      if (itens.length) { el.replaceChildren(...itens.map(criarCard)); return; }
      const vazio = document.createElement('p'); vazio.className = 'mt-empty'; vazio.textContent = mensagem; el.replaceChildren(vazio);
    }
    const servicos = todos.filter(p => vitrineDoProduto(p) === 'servicos');
    grupos.servicos.hidden = !servicos.length;
    if (servicos.length) preencher(grupos.servicos, servicos, '');
    function render() {
      const q = normalizar(busca.value);
      const filtrados = catalogo.filter(p => !q || q.split(/\s+/).every(t => normalizar([p.nome,p.categoria,p.descricao].join(' ')).includes(t)));
      if (ordem.value === 'asc') filtrados.sort((a,b) => valorProduto(a)-valorProduto(b));
      if (ordem.value === 'desc') filtrados.sort((a,b) => valorProduto(b)-valorProduto(a));
      if (ordem.value === 'name') filtrados.sort((a,b) => String(a.nome).localeCompare(String(b.nome),'pt-BR'));
      const a = filtrados.filter(p => vitrineDoProduto(p) === 'acessorios'), c = filtrados.filter(p => vitrineDoProduto(p) === 'celulares'), o = filtrados.filter(p => vitrineDoProduto(p) === 'outros');
      preencher(grupos.acessorios,a,q?'Nenhum acessório encontrado.':'Consulte os acessórios disponíveis pelo WhatsApp.');
      preencher(grupos.celulares,c,q?'Nenhum celular novo encontrado.':'Consulte os celulares novos disponíveis pelo WhatsApp.');
      outros.hidden = !o.length; preencher(grupos.outros,o,'Nenhum outro produto encontrado.');
      status.textContent = catalogo.length ? filtrados.length + ' de ' + catalogo.length + ' produtos' : 'Novos produtos serão exibidos aqui quando cadastrados.';
    }
    busca.addEventListener('input',render); ordem.addEventListener('change',render); render();
  } catch { status.textContent = 'Não foi possível carregar o catálogo agora. Consulte a equipe pelo WhatsApp.'; }
}
carregarVitrine();
