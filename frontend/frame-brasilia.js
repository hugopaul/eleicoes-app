const UF = 'df';
const CAMINHO = '/frame/brasilia';
const CARGOS_DF = new Set(['0003', '0005', '0006', '0008']);

let fase = new URLSearchParams(location.search).get('fase') === 'oficial' ? 'oficial' : 'simulado';
let origemUrl = true;
let pedido = 0;

const faseEl = document.querySelector('#fase');
const eleicaoCampo = document.querySelector('#eleicao-campo');
const eleicaoEl = document.querySelector('#eleicao');
const eleicaoNome = document.querySelector('#eleicao-nome');
const cargoEl = document.querySelector('#cargo');
const candidatosEl = document.querySelector('#candidatos');
const resultadoResumo = document.querySelector('#resultado-resumo');
const resultadoTitulo = document.querySelector('#resultado-titulo');
const resumoEl = document.querySelector('#resumo-votos');
const avisoEl = document.querySelector('#aviso');
const mapaBloco = document.querySelector('#mapa-bloco');
const mapaSvg = document.querySelector('#mapa-df');

const IBGE_UF = {
  '17': 'to', '29': 'ba', '31': 'mg', '35': 'sp', '50': 'ms', '51': 'mt', '52': 'go', '53': 'df',
};
const TOM_VIZINHO = { go: '#d7e0e8', mg: '#b9c8d6', ba: '#e7eef4', mt: '#dce4ed', to: '#cfd8e3', ms: '#e7eef4' };
const ROTULOS = [
  ['GO', -49.6, -14.15],
  ['MG', -45.9, -16.95],
  ['BA', -45.6, -13.6],
];
const SVG = 'http://www.w3.org/2000/svg';
const ALCANCE = 2.45;
const ESCALA_DF = 2.75;

let eleicoes = [];
let eleicaoAtual = null;

const numero = new Intl.NumberFormat('pt-BR');
const percentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function comFase(caminho) {
  const separador = caminho.includes('?') ? '&' : '?';
  return `${caminho}${separador}fase=${fase}`;
}

async function obter(caminho) {
  const resposta = await fetch(comFase(caminho));
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.erro?.mensagem || 'Não foi possível carregar os dados.');
  }
  return corpo;
}

function chip(texto, destaque) {
  const item = document.createElement('span');
  item.className = 'chip';
  if (destaque) {
    const forte = document.createElement('b');
    forte.textContent = destaque;
    item.append(texto, ' ', forte);
  } else {
    item.textContent = texto;
  }
  return item;
}

function classeSituacao(candidato) {
  const texto = (candidato.situacao ?? '').toLowerCase();
  if (texto.includes('turno')) return 'segundo';
  if (texto.startsWith('não') || texto.startsWith('nao')) return '';
  if (candidato.eleito || texto.includes('eleito')) return 'eleito';
  return '';
}

function avisar(mensagem) {
  avisoEl.hidden = !mensagem;
  avisoEl.textContent = mensagem || '';
}

function informarAltura() {
  const altura = document.documentElement.scrollHeight;
  parent.postMessage({ tipo: 'eleicoes-frame', altura, url: `${location.pathname}${location.search}` }, '*');
}

function lerFiltros() {
  const atuais = new URLSearchParams(location.search);
  const cargo = atuais.get('cargo') || '';
  return {
    fase: atuais.get('fase') === 'oficial' ? 'oficial' : 'simulado',
    eleicao: atuais.get('eleicao') || '',
    cargo: cargo ? cargo.padStart(4, '0') : '',
  };
}

function sincronizarUrl() {
  const busca = new URLSearchParams();
  busca.set('fase', fase);
  if (eleicaoEl.value) busca.set('eleicao', eleicaoEl.value);
  if (cargoEl.value) busca.set('cargo', cargoEl.value);
  const destino = `${CAMINHO}?${busca}`;
  if (`${location.pathname}${location.search}` !== destino) history.replaceState(null, '', destino);
  informarAltura();
}

function cargosDoDf(eleicao) {
  return (eleicao?.cargos ?? []).filter((cargo) => CARGOS_DF.has(String(cargo.codigo).padStart(4, '0')));
}

function limparResultado() {
  candidatosEl.replaceChildren();
  resumoEl.replaceChildren();
  resultadoResumo.hidden = true;
}

async function carregarCatalogo() {
  const atual = ++pedido;
  const dados = await obter('/api/v1/eleicoes?tamanho=200');
  if (atual !== pedido) return;
  eleicoes = (dados.itens ?? []).filter((eleicao) => Number(eleicao.tipo?.codigo) === 1 && cargosDoDf(eleicao).length);
  eleicaoEl.replaceChildren();
  cargoEl.replaceChildren();
  eleicaoNome.textContent = '';
  if (!eleicoes.length) {
    eleicaoAtual = null;
    eleicaoCampo.hidden = true;
    limparResultado();
    avisar('Não há eleição do Distrito Federal nesta fase.');
    sincronizarUrl();
    return;
  }
  for (const eleicao of eleicoes) {
    const opcao = document.createElement('option');
    opcao.value = eleicao.codigo;
    opcao.textContent = eleicao.nome;
    eleicaoEl.append(opcao);
  }
  eleicaoCampo.hidden = eleicoes.length < 2;
  const pedida = origemUrl ? lerFiltros().eleicao : '';
  const comGovernador = eleicoes.find((eleicao) => cargosDoDf(eleicao).some((cargo) => cargo.codigo === '0003'));
  if (pedida && eleicoes.some((eleicao) => String(eleicao.codigo) === pedida)) eleicaoEl.value = pedida;
  else if (comGovernador) eleicaoEl.value = comGovernador.codigo;
  await selecionarEleicao();
}

async function selecionarEleicao() {
  const atual = ++pedido;
  eleicaoAtual = eleicoes.find((eleicao) => String(eleicao.codigo) === eleicaoEl.value) ?? null;
  cargoEl.replaceChildren();
  if (!eleicaoAtual) {
    avisar('Nenhuma eleição do Distrito Federal disponível nesta fase.');
    return;
  }
  eleicaoNome.textContent = `${eleicaoAtual.turno}º turno`;
  for (const cargo of cargosDoDf(eleicaoAtual)) {
    const opcao = document.createElement('option');
    opcao.value = String(cargo.codigo).padStart(4, '0');
    opcao.textContent = cargo.nome;
    cargoEl.append(opcao);
  }
  const cargoPedido = origemUrl ? lerFiltros().cargo : '';
  if (cargoPedido && [...cargoEl.options].some((opcao) => opcao.value === cargoPedido)) {
    cargoEl.value = cargoPedido;
  } else if ([...cargoEl.options].some((opcao) => opcao.value === '0003')) {
    cargoEl.value = '0003';
  }
  if (atual !== pedido) return;
  await carregarResultado();
}

async function carregarResultado() {
  const atual = ++pedido;
  avisar('');
  limparResultado();
  if (!eleicaoAtual || !cargoEl.value) {
    sincronizarUrl();
    return;
  }
  try {
    const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargoEl.value}?uf=${UF}`);
    if (atual !== pedido) return;
    const votos = dados.votos ?? {};
    resultadoTitulo.textContent = dados.totalizacaoFinal ? 'Resultado definido' : 'Resultado preliminar';
    resultadoResumo.hidden = false;
    resumoEl.replaceChildren(
      chip('Distrito Federal'),
      chip((dados.andamento ?? '—').replaceAll('_', ' ')),
      chip('votos', numero.format(votos.total ?? 0)),
      chip('válidos', numero.format(votos.validos ?? 0)),
    );
    const maior = Math.max(...dados.candidatos.map((candidato) => candidato.votos ?? 0), 0);
    dados.candidatos.forEach((candidato, indice) => {
      const cartao = document.createElement('article');
      cartao.className = `resultado${indice === 0 ? ' lider' : ''}`;
      cartao.style.setProperty('--cor', '#0b3a6a');

      const topo = document.createElement('div');
      topo.className = 'resultado-topo';
      if (candidato.fotoUrl) {
        const foto = document.createElement('img');
        foto.className = 'foto';
        foto.alt = '';
        foto.src = candidato.fotoUrl;
        foto.addEventListener('error', () => foto.remove());
        topo.append(foto);
      }
      const posicao = document.createElement('span');
      posicao.className = 'posicao';
      posicao.textContent = String(indice + 1);
      const identidade = document.createElement('div');
      const nome = document.createElement('strong');
      nome.textContent = `${candidato.numero ?? '—'} · ${candidato.nomeUrna || candidato.nome || 'Candidato'}`;
      const detalhe = document.createElement('span');
      detalhe.className = 'suave';
      const vice = candidato.vices?.[0]?.nome ? ` · Vice ${candidato.vices[0].nome}` : '';
      detalhe.textContent = `${candidato.partido?.sigla ?? 'Sem partido'}${vice}`;
      identidade.append(nome, detalhe);
      const numeros = document.createElement('div');
      numeros.className = 'resultado-numeros';
      const pct = document.createElement('b');
      pct.textContent = `${percentual.format(candidato.votosPercentual ?? 0)}%`;
      const qtd = document.createElement('span');
      qtd.textContent = `${numero.format(candidato.votos ?? 0)} votos`;
      numeros.append(pct, qtd);
      const selo = document.createElement('span');
      selo.className = `selo ${classeSituacao(candidato)}`.trim();
      selo.textContent = candidato.situacao ?? '—';
      topo.append(posicao, identidade, numeros, selo);

      const trilho = document.createElement('span');
      trilho.className = 'trilho';
      const enchimento = document.createElement('span');
      enchimento.className = 'enchimento';
      enchimento.style.width = maior > 0 ? `${((candidato.votos ?? 0) / maior) * 100}%` : '0%';
      trilho.append(enchimento);
      cartao.append(topo, trilho);
      candidatosEl.append(cartao);
    });
  } catch (erro) {
    if (atual === pedido) avisar(erro.message);
  }
  if (atual === pedido) sincronizarUrl();
}

function aneisDe(geometria) {
  if (geometria.type === 'Polygon') return geometria.coordinates;
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.flat();
  return [];
}

function caixaDe(aneis) {
  const caixa = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const anel of aneis) {
    for (const [lon, lat] of anel) {
      caixa.minLon = Math.min(caixa.minLon, lon);
      caixa.maxLon = Math.max(caixa.maxLon, lon);
      caixa.minLat = Math.min(caixa.minLat, lat);
      caixa.maxLat = Math.max(caixa.maxLat, lat);
    }
  }
  return caixa;
}

function cruza(a, b) {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

function caminhoDe(aneis, projetar) {
  return aneis.map((anel) => anel.map(([lon, lat], indice) => {
    const [x, y] = projetar(lon, lat);
    return `${indice === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');
}

function criarPath(d, classe) {
  const forma = document.createElementNS(SVG, 'path');
  forma.setAttribute('d', d);
  forma.setAttribute('class', classe);
  return forma;
}

function criarTexto(x, y, classe, texto) {
  const el = document.createElementNS(SVG, 'text');
  el.setAttribute('x', x.toFixed(1));
  el.setAttribute('y', y.toFixed(1));
  el.setAttribute('class', classe);
  el.textContent = texto;
  return el;
}

async function desenharMapa() {
  try {
    const resposta = await fetch('/brasil-ufs.geojson');
    if (!resposta.ok) throw new Error('mapa');
    const colecao = await resposta.json();
    const df = colecao.features.find((item) => IBGE_UF[String(item.properties.codarea)] === 'df');
    if (!df) throw new Error('mapa');
    const aneisDf = aneisDe(df.geometry);
    const caixaDf = caixaDe(aneisDf);
    const centroLon = (caixaDf.minLon + caixaDf.maxLon) / 2;
    const centroLat = (caixaDf.minLat + caixaDf.maxLat) / 2;
    const cos = Math.cos(centroLat * Math.PI / 180);
    const janela = {
      minLon: centroLon - ALCANCE / cos,
      maxLon: centroLon + ALCANCE / cos,
      minLat: centroLat - ALCANCE,
      maxLat: centroLat + ALCANCE,
    };
    const margem = 16;
    const projetar = (lon, lat) => {
      const x = margem + ((lon - janela.minLon) / (janela.maxLon - janela.minLon)) * (640 - margem * 2);
      const y = margem + ((janela.maxLat - lat) / (janela.maxLat - janela.minLat)) * (640 - margem * 2);
      return [x, y];
    };
    const [origemX, origemY] = projetar(centroLon, centroLat);
    const projetarDf = (lon, lat) => {
      const [x, y] = projetar(lon, lat);
      return [origemX + (x - origemX) * ESCALA_DF, origemY + (y - origemY) * ESCALA_DF];
    };
    const desenhoDf = caminhoDe(aneisDf, projetarDf);
    const xs = [];
    const ys = [];
    for (const anel of aneisDf) {
      for (const [lon, lat] of anel) {
        const [x, y] = projetarDf(lon, lat);
        xs.push(x);
        ys.push(y);
      }
    }
    const ocupado = {
      minX: Math.min(...xs) - 28,
      maxX: Math.max(...xs) + 28,
      minY: Math.min(...ys) - 28,
      maxY: Math.max(...ys) + 28,
    };

    mapaSvg.replaceChildren();
    for (const item of colecao.features) {
      const sigla = IBGE_UF[String(item.properties.codarea)];
      if (!sigla || sigla === 'df') continue;
      const aneis = aneisDe(item.geometry);
      if (!cruza(caixaDe(aneis), janela)) continue;
      const forma = criarPath(caminhoDe(aneis, projetar), 'recorte');
      if (TOM_VIZINHO[sigla]) forma.setAttribute('fill', TOM_VIZINHO[sigla]);
      mapaSvg.append(forma);
    }
    mapaSvg.append(criarPath(desenhoDf, 'recorte-placa'));
    mapaSvg.append(criarPath(desenhoDf, 'recorte-df'));
    for (const [nome, lon, lat] of ROTULOS) {
      const [x, y] = projetar(lon, lat);
      if (x < 28 || y < 28 || x > 612 || y > 612) continue;
      if (x >= ocupado.minX && x <= ocupado.maxX && y >= ocupado.minY && y <= ocupado.maxY) continue;
      mapaSvg.append(criarTexto(x, y, 'recorte-sigla', nome));
    }
    mapaSvg.append(criarTexto(origemX, origemY, 'recorte-df-nome', 'DF'));
  } catch {
    mapaBloco.hidden = true;
  }
  informarAltura();
}

faseEl.value = fase;
faseEl.addEventListener('change', () => {
  fase = faseEl.value;
  origemUrl = false;
  carregarCatalogo().catch((erro) => avisar(erro.message));
});

eleicaoEl.addEventListener('change', () => {
  origemUrl = false;
  selecionarEleicao().catch((erro) => avisar(erro.message));
});

cargoEl.addEventListener('change', () => {
  origemUrl = false;
  carregarResultado().catch((erro) => avisar(erro.message));
});

window.addEventListener('resize', informarAltura);
window.addEventListener('popstate', () => {
  const filtros = lerFiltros();
  fase = filtros.fase;
  faseEl.value = fase;
  origemUrl = true;
  carregarCatalogo()
    .catch((erro) => avisar(erro.message))
    .finally(() => { origemUrl = false; });
});

desenharMapa();
carregarCatalogo()
  .catch((erro) => avisar(erro.message))
  .finally(() => { origemUrl = false; });
