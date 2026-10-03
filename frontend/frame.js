let fase = new URLSearchParams(location.search).get('fase') === 'simulado' ? 'simulado' : 'oficial';
let origemUrl = true;

const faseEl = document.querySelector('#fase');
const eleicaoEl = document.querySelector('#eleicao');
const cargoEl = document.querySelector('#cargo');
const ufCampo = document.querySelector('#uf-campo');
const ufEl = document.querySelector('#uf');
const municipioCampo = document.querySelector('#municipio-campo');
const municipioEl = document.querySelector('#municipio');
const candidatosEl = document.querySelector('#candidatos');
const resultadoResumo = document.querySelector('#resultado-resumo');
const resultadoTitulo = document.querySelector('#resultado-titulo');
const resumoEl = document.querySelector('#resumo-votos');
const avisoEl = document.querySelector('#aviso');
const mapaBloco = document.querySelector('#mapa-bloco');
const mapaSvg = document.querySelector('#mapa-brasil');
const mapaDica = document.querySelector('#mapa-dica');
const mapaNota = document.querySelector('#mapa-nota');
const mapaLegenda = document.querySelector('#mapa-legenda');
const mapaDetalhe = document.querySelector('#mapa-detalhe');
const mapaTitulo = document.querySelector('#mapa-titulo');

const TIPOS_ORDINARIOS = new Set([1, 3, 8]);
const UFS_PADRAO = ['ac', 'al', 'am', 'ap', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mg', 'ms', 'mt', 'pa', 'pb', 'pe', 'pi', 'pr', 'rj', 'rn', 'ro', 'rr', 'rs', 'sc', 'se', 'sp', 'to', 'zz'];
const UFS_MAPA = UFS_PADRAO.filter((sigla) => sigla !== 'zz');
const IBGE_UF = {
  '11': 'ro', '12': 'ac', '13': 'am', '14': 'rr', '15': 'pa', '16': 'ap', '17': 'to',
  '21': 'ma', '22': 'pi', '23': 'ce', '24': 'rn', '25': 'pb', '26': 'pe', '27': 'al', '28': 'se', '29': 'ba',
  '31': 'mg', '32': 'es', '33': 'rj', '35': 'sp', '41': 'pr', '42': 'sc', '43': 'rs',
  '50': 'ms', '51': 'mt', '52': 'go', '53': 'df',
};
const NOMES_UF = {
  ac: 'Acre', al: 'Alagoas', am: 'Amazonas', ap: 'Amapá', ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal',
  es: 'Espírito Santo', go: 'Goiás', ma: 'Maranhão', mg: 'Minas Gerais', ms: 'Mato Grosso do Sul',
  mt: 'Mato Grosso', pa: 'Pará', pb: 'Paraíba', pe: 'Pernambuco', pi: 'Piauí', pr: 'Paraná',
  rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte', ro: 'Rondônia', rr: 'Roraima', rs: 'Rio Grande do Sul',
  sc: 'Santa Catarina', se: 'Sergipe', sp: 'São Paulo', to: 'Tocantins',
};
const PALETA = ['#1b4f72', '#b03a2e', '#1e8449', '#b7950b', '#6c3483', '#d35400', '#148f77', '#1a5276', '#a93226', '#7d3c98', '#117a65', '#b9770e', '#2e4053'];
const SEM_DADO = '#d5dde6';

let eleicoes = [];
let eleicaoAtual = null;
let malhaBrasil = null;
let resultadosUf = new Map();
let coresCandidato = new Map();
let filtroPedido = 0;
let mapaPedido = 0;
let municipiosPedido = 0;
let ajustandoFiltro = false;

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
    const erro = new Error(corpo.erro?.mensagem || 'Não foi possível carregar os dados.');
    throw erro;
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

function eleicaoMunicipal() {
  const tipo = Number(eleicaoAtual?.tipo?.codigo);
  return tipo === 3 || tipo === 4;
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
    fase: atuais.get('fase') === 'simulado' ? 'simulado' : 'oficial',
    eleicao: atuais.get('eleicao') || '',
    cargo: cargo ? cargo.padStart(4, '0') : '',
    uf: (atuais.get('uf') || '').toLowerCase(),
    municipio: atuais.get('municipio') || '',
  };
}

function sincronizarUrl() {
  const busca = new URLSearchParams();
  busca.set('fase', fase);
  if (eleicaoEl.value) busca.set('eleicao', eleicaoEl.value);
  if (cargoEl.value) busca.set('cargo', cargoEl.value);
  if (!ufCampo.hidden && ufEl.value) busca.set('uf', ufEl.value);
  if (!municipioCampo.hidden && municipioEl.value) busca.set('municipio', municipioEl.value);
  const destino = `/frame?${busca}`;
  if (`${location.pathname}${location.search}` !== destino) history.replaceState(null, '', destino);
  informarAltura();
}

async function carregarCatalogo() {
  const dados = await obter('/api/v1/eleicoes?tamanho=200');
  eleicoes = (dados.itens ?? []).filter((eleicao) => TIPOS_ORDINARIOS.has(eleicao.tipo?.codigo));
  if (!eleicoes.length) eleicoes = dados.itens ?? [];
  eleicaoEl.replaceChildren();
  for (const eleicao of eleicoes) {
    const opcao = document.createElement('option');
    opcao.value = eleicao.codigo;
    opcao.textContent = eleicao.nome;
    eleicaoEl.append(opcao);
  }
  const pedida = origemUrl ? lerFiltros().eleicao : '';
  const federal = eleicoes.find((eleicao) => eleicao.cargos?.some((cargo) => cargo.codigo === '0001'));
  if (pedida && eleicoes.some((eleicao) => String(eleicao.codigo) === pedida)) eleicaoEl.value = pedida;
  else if (pedida) {
    avisar('Esta eleição não está disponível. Ela pode estar inativa ou não existir nesta fase.');
    candidatosEl.replaceChildren();
    resumoEl.replaceChildren();
    resultadoResumo.hidden = true;
    mapaBloco.hidden = true;
    informarAltura();
    return;
  } else if (federal) eleicaoEl.value = federal.codigo;
  await selecionarEleicao();
}

async function selecionarEleicao() {
  eleicaoAtual = eleicoes.find((eleicao) => String(eleicao.codigo) === eleicaoEl.value) ?? null;
  cargoEl.replaceChildren();
  if (!eleicaoAtual) {
    avisar('Nenhuma eleição disponível nesta fase.');
    return;
  }
  for (const cargo of eleicaoAtual.cargos) {
    const opcao = document.createElement('option');
    opcao.value = String(cargo.codigo).padStart(4, '0');
    opcao.textContent = cargo.nome;
    cargoEl.append(opcao);
  }
  const cargoPedido = origemUrl ? lerFiltros().cargo : '';
  if (cargoPedido && [...cargoEl.options].some((opcao) => opcao.value === cargoPedido.padStart(4, '0'))) {
    cargoEl.value = cargoPedido.padStart(4, '0');
  }
  await prepararUf();
  await carregarResultado();
}

async function prepararUf() {
  const nacional = cargoEl.value === '0001';
  ufCampo.hidden = nacional;
  municipioCampo.hidden = !eleicaoMunicipal();
  if (nacional) return;
  ufEl.replaceChildren();
  let ufs = UFS_PADRAO.map((sigla) => ({ sigla, nome: sigla.toUpperCase() }));
  try {
    const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/ufs`);
    if (dados.itens?.length) ufs = dados.itens;
  } catch {
    // A eleição estadual do simulado não tem arquivo de municípios próprio.
  }
  for (const uf of ufs) {
    const opcao = document.createElement('option');
    opcao.value = uf.sigla;
    opcao.textContent = uf.nome;
    ufEl.append(opcao);
  }
  const ufPedida = origemUrl ? lerFiltros().uf : '';
  if (ufPedida && [...ufEl.options].some((opcao) => opcao.value === ufPedida)) ufEl.value = ufPedida;
  if (eleicaoMunicipal()) await prepararMunicipios();
}

async function prepararMunicipios(manterUrl = origemUrl) {
  const sigla = String(ufEl.value || '').toLowerCase();
  const pedido = ++municipiosPedido;
  municipioEl.replaceChildren();
  const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/ufs/${sigla}/municipios?tamanho=1000`);
  if (pedido !== municipiosPedido || String(ufEl.value || '').toLowerCase() !== sigla) return false;
  const ordenados = [...(dados.itens ?? [])].sort((a, b) => Number(b.capital) - Number(a.capital) || a.nome.localeCompare(b.nome, 'pt-BR'));
  let capital = '';
  for (const municipio of ordenados) {
    const opcao = document.createElement('option');
    opcao.value = municipio.codigo;
    opcao.textContent = municipio.capital ? `${municipio.nome} (capital)` : municipio.nome;
    if (municipio.capital) capital = municipio.codigo;
    municipioEl.append(opcao);
  }
  const municipioPedido = manterUrl ? lerFiltros().municipio : '';
  if (municipioPedido && [...municipioEl.options].some((opcao) => opcao.value === municipioPedido)) {
    municipioEl.value = municipioPedido;
  } else if (capital) {
    municipioEl.value = capital;
  } else if (municipioEl.options.length) {
    municipioEl.selectedIndex = 0;
  }
  return true;
}

async function carregarResultado(atualizarMapa = true) {
  avisar('');
  candidatosEl.replaceChildren();
  resumoEl.replaceChildren();
  resultadoResumo.hidden = true;
  const cargo = cargoEl.value;
  if (eleicaoMunicipal() && !municipioEl.value) {
    avisar('Selecione um município.');
    if (atualizarMapa) await carregarMapa();
    sincronizarUrl();
    return;
  }
  const uf = cargo === '0001' ? '' : `?uf=${ufEl.value}${eleicaoMunicipal() ? `&municipio=${municipioEl.value}` : ''}`;
  try {
    const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}${uf}`);
    const votos = dados.votos ?? {};
    const abrangencia = dados.abrangencia.codigo?.toUpperCase() === 'BR' ? 'Brasil' : dados.abrangencia.codigo?.toUpperCase();
    resultadoTitulo.textContent = dados.totalizacaoFinal ? 'Resultado definido' : 'Resultado preliminar';
    resultadoResumo.hidden = false;
    resumoEl.replaceChildren(
      chip(abrangencia || '—'),
      chip((dados.andamento ?? '—').replaceAll('_', ' ')),
      chip('votos', numero.format(votos.total ?? 0)),
      chip('válidos', numero.format(votos.validos ?? 0)),
    );
    coresCandidato = new Map();
    const maior = Math.max(...dados.candidatos.map((candidato) => candidato.votos ?? 0), 0);
    dados.candidatos.forEach((candidato, indice) => {
      const cartao = document.createElement('article');
      const cor = corDo(candidato, indice);
      cartao.className = `resultado${indice === 0 ? ' lider' : ''}`;
      cartao.style.setProperty('--cor', cor);

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
      topo.append(identidade, numeros, selo);

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
    avisar(erro.message);
  }
  if (atualizarMapa) await carregarMapa();
  sincronizarUrl();
}

function liderDe(resultado) {
  const lista = [...(resultado?.candidatos ?? [])].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0));
  return lista[0] ?? null;
}

function corDo(candidato, indice) {
  const chave = candidato?.sequencial || candidato?.numero || String(indice);
  if (!coresCandidato.has(chave)) coresCandidato.set(chave, PALETA[coresCandidato.size % PALETA.length]);
  return coresCandidato.get(chave);
}

function aneisDe(geometria) {
  if (geometria.type === 'Polygon') return geometria.coordinates;
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.flat();
  return [];
}

function caminhoUf(aneis, projetar) {
  return aneis.map((anel) => anel.map(([lon, lat], indice) => {
    const [x, y] = projetar(lon, lat);
    return `${indice === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');
}

async function garantirMalha() {
  if (malhaBrasil) return malhaBrasil;
  const resposta = await fetch('/brasil-ufs.geojson');
  if (!resposta.ok) throw new Error('Não foi possível carregar o mapa.');
  malhaBrasil = await resposta.json();
  desenharMalha(malhaBrasil);
  return malhaBrasil;
}

function desenharMalha(colecao) {
  const pontos = colecao.features.flatMap((item) => aneisDe(item.geometry).flat());
  const lons = pontos.map(([lon]) => lon);
  const lats = pontos.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const projetar = (lon, lat) => {
    const x = 12 + ((lon - minLon) / (maxLon - minLon)) * 976;
    const y = 12 + ((maxLat - lat) / (maxLat - minLat)) * 956;
    return [x, y];
  };

  mapaSvg.replaceChildren();
  for (const item of colecao.features) {
    const sigla = IBGE_UF[String(item.properties.codarea)];
    if (!sigla) continue;
    const forma = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    forma.setAttribute('d', caminhoUf(aneisDe(item.geometry), projetar));
    forma.setAttribute('class', 'uf');
    forma.setAttribute('data-uf', sigla);
    forma.setAttribute('tabindex', '0');
    forma.setAttribute('role', 'button');
    forma.setAttribute('aria-label', NOMES_UF[sigla]);
    forma.setAttribute('fill', SEM_DADO);
    forma.addEventListener('mouseenter', (evento) => mostrarDica(sigla, evento));
    forma.addEventListener('mousemove', (evento) => posicionarDica(evento));
    forma.addEventListener('mouseleave', () => { mapaDica.hidden = true; });
    forma.addEventListener('click', () => selecionarUf(sigla));
    forma.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        selecionarUf(sigla);
      }
    });
    mapaSvg.append(forma);
  }
}

function mostrarDica(sigla, evento) {
  const lider = liderDe(resultadosUf.get(sigla));
  const linha = lider
    ? `${lider.nomeUrna || lider.nome} · ${percentual.format(lider.votosPercentual ?? 0)}%`
    : 'Resultado ainda não publicado';
  mapaDica.textContent = `${NOMES_UF[sigla]} · ${linha}`;
  mapaDica.hidden = false;
  posicionarDica(evento);
}

function posicionarDica(evento) {
  const palco = mapaSvg.parentElement.getBoundingClientRect();
  mapaDica.style.left = `${Math.min(evento.clientX - palco.left + 12, palco.width - 180)}px`;
  mapaDica.style.top = `${Math.max(evento.clientY - palco.top - 36, 8)}px`;
}

function marcarUfSelecionada(sigla) {
  const alvo = String(sigla || '').toLowerCase();
  for (const forma of mapaSvg.querySelectorAll('.uf')) {
    forma.classList.toggle('selecionada', Boolean(alvo) && forma.dataset.uf === alvo);
  }
}

function definirUf(sigla) {
  const alvo = String(sigla || '').toLowerCase();
  let opcao = [...ufEl.options].find((item) => item.value.toLowerCase() === alvo);
  if (!opcao) {
    opcao = document.createElement('option');
    opcao.value = alvo;
    opcao.textContent = NOMES_UF[alvo] ?? alvo.toUpperCase();
    ufEl.append(opcao);
  }
  if (ufEl.value === opcao.value) return;
  ajustandoFiltro = true;
  ufEl.value = opcao.value;
  ajustandoFiltro = false;
}

async function selecionarUf(sigla) {
  origemUrl = false;
  const pedido = ++filtroPedido;
  marcarUfSelecionada(sigla);
  pintarDetalhe(sigla);
  if (cargoEl.value === '0001') return;
  try {
    definirUf(sigla);
    if (eleicaoMunicipal()) {
      const ok = await prepararMunicipios(false);
      if (!ok || pedido !== filtroPedido) return;
    } else if (pedido !== filtroPedido) return;
    await carregarResultado(false);
  } catch (erro) {
    if (pedido === filtroPedido) avisar(erro.message);
  }
}

function pintarDetalhe(sigla) {
  mapaDetalhe.replaceChildren();
  const resultado = resultadosUf.get(sigla);
  const titulo = document.createElement('strong');
  titulo.textContent = resultado?.municipioMapa
    ? `${NOMES_UF[sigla] ?? sigla.toUpperCase()} · ${resultado.municipioMapa}`
    : (NOMES_UF[sigla] ?? sigla.toUpperCase());
  mapaDetalhe.append(titulo);
  if (!resultado) {
    const aviso = document.createElement('p');
    aviso.className = 'resumo';
    aviso.textContent = 'Resultado ainda não publicado nesta unidade.';
    mapaDetalhe.append(aviso);
    revelarDetalhe();
    return;
  }
  const lista = [...resultado.candidatos].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0)).slice(0, 5);
  const maior = Math.max(...lista.map((candidato) => candidato.votos ?? 0), 0);
  for (const candidato of lista) {
    const linha = document.createElement('div');
    linha.className = 'mapa-linha';
    const nome = document.createElement('span');
    nome.textContent = `${candidato.numero} · ${candidato.nomeUrna || candidato.nome}`;
    const pct = document.createElement('b');
    pct.textContent = `${percentual.format(candidato.votosPercentual ?? 0)}%`;
    pct.style.color = corDo(candidato, 0);
    const trilho = document.createElement('span');
    trilho.className = 'trilho';
    const enchimento = document.createElement('span');
    enchimento.className = 'enchimento';
    enchimento.style.width = maior > 0 ? `${((candidato.votos ?? 0) / maior) * 100}%` : '0%';
    enchimento.style.background = corDo(candidato, 0);
    trilho.append(enchimento);
    linha.append(nome, pct, trilho);
    mapaDetalhe.append(linha);
  }
  revelarDetalhe();
}

function revelarDetalhe() {
  const bloco = mapaDetalhe.closest('.mapa-bloco');
  if (!bloco || !mapaDetalhe.childElementCount) return;
  const topo = mapaDetalhe.getBoundingClientRect().top - bloco.getBoundingClientRect().top + bloco.scrollTop;
  bloco.scrollTo({ top: Math.max(0, topo - 8) });
}

function pintarMapa() {
  for (const forma of mapaSvg.querySelectorAll('.uf')) {
    const lider = liderDe(resultadosUf.get(forma.dataset.uf));
    forma.setAttribute('fill', lider ? corDo(lider, 0) : SEM_DADO);
  }
}

function montarLegenda() {
  mapaLegenda.replaceChildren();
  const vistos = new Map();
  for (const resultado of resultadosUf.values()) {
    const lider = liderDe(resultado);
    if (!lider) continue;
    const chave = lider.sequencial || lider.numero;
    if (vistos.has(chave)) continue;
    vistos.set(chave, lider);
  }
  for (const lider of vistos.values()) {
    const item = document.createElement('li');
    const amostra = document.createElement('span');
    amostra.className = 'amostra';
    amostra.style.background = corDo(lider, 0);
    const texto = document.createElement('span');
    texto.textContent = `${lider.numero} · ${lider.nomeUrna || lider.nome}`;
    item.append(amostra, texto);
    mapaLegenda.append(item);
  }
}

async function carregarMapa() {
  const cargo = cargoEl.value;
  const nomeCargo = cargoEl.selectedOptions[0]?.textContent || 'Cargo';
  mapaBloco.hidden = !(eleicaoAtual && cargo);
  if (!eleicaoAtual || !cargo) return;
  const pedido = ++mapaPedido;
  mapaTitulo.textContent = `${nomeCargo} por estado`;
  mapaNota.textContent = 'Carregando resultados das unidades da federação…';
  mapaDetalhe.replaceChildren();
  mapaLegenda.replaceChildren();
  resultadosUf = new Map();
  try {
    await garantirMalha();
  } catch (erro) {
    if (pedido === mapaPedido) mapaNota.textContent = erro.message;
    return;
  }
  if (pedido !== mapaPedido) return;
  const municipal = eleicaoMunicipal();
  await Promise.all(UFS_MAPA.map(async (sigla) => {
    try {
      const dados = await resultadoParaMapa(cargo, sigla, municipal);
      if (pedido === mapaPedido) resultadosUf.set(sigla, dados);
    } catch {
      if (pedido === mapaPedido) resultadosUf.delete(sigla);
    }
  }));
  if (pedido !== mapaPedido) return;
  pintarMapa();
  montarLegenda();
  marcarUfSelecionada(ufCampo.hidden ? '' : ufEl.value);
  mapaNota.textContent = resultadosUf.size
    ? `${resultadosUf.size} unidades com resultado. Clique em um estado para ver o detalhe.`
    : 'O mapa ganha cor quando o resultado de cada estado for publicado.';
}

async function resultadoParaMapa(cargo, sigla, municipal) {
  if (!municipal) return obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}?uf=${sigla}`);
  const municipios = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/ufs/${sigla}/municipios?capital=true&tamanho=1`);
  const capital = municipios.itens?.[0];
  if (!capital) throw new Error('sem capital');
  const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}?uf=${sigla}&municipio=${capital.codigo}`);
  dados.municipioMapa = capital.nome;
  return dados;
}

faseEl.value = fase;
faseEl.addEventListener('change', () => {
  fase = faseEl.value;
  origemUrl = false;
  filtroPedido += 1;
  mapaPedido += 1;
  carregarCatalogo().catch((erro) => avisar(erro.message));
});

eleicaoEl.addEventListener('change', () => {
  filtroPedido += 1;
  origemUrl = false;
  selecionarEleicao().catch((erro) => avisar(erro.message));
});

cargoEl.addEventListener('change', async () => {
  filtroPedido += 1;
  origemUrl = false;
  await prepararUf();
  await carregarResultado();
});

ufEl.addEventListener('change', async () => {
  if (ajustandoFiltro) return;
  const pedido = ++filtroPedido;
  origemUrl = false;
  marcarUfSelecionada(ufEl.value);
  pintarDetalhe((ufEl.value || '').toLowerCase());
  try {
    if (eleicaoMunicipal()) {
      const ok = await prepararMunicipios(false);
      if (!ok || pedido !== filtroPedido) return;
    } else if (pedido !== filtroPedido) return;
    carregarResultado(false);
  } catch (erro) {
    if (pedido === filtroPedido) avisar(erro.message);
  }
});

municipioEl.addEventListener('change', () => {
  origemUrl = false;
  carregarResultado(false);
});
window.addEventListener('resize', informarAltura);
window.addEventListener('popstate', () => {
  const filtros = lerFiltros();
  fase = filtros.fase;
  faseEl.value = fase;
  origemUrl = true;
  filtroPedido += 1;
  mapaPedido += 1;
  carregarCatalogo()
    .catch((erro) => avisar(erro.message))
    .finally(() => { origemUrl = false; });
});

carregarCatalogo()
  .catch((erro) => avisar(erro.message))
  .finally(() => { origemUrl = false; });
