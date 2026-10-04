const eleicoesEl = document.querySelector('#eleicoes');
const filtroEleicaoEl = document.querySelector('#filtro-eleicao');
const geracaoEl = document.querySelector('#geracao');
const painelSecao = document.querySelector('#painel-secao');
const painelEl = document.querySelector('#painel');
const resultadoSecao = document.querySelector('#resultado-secao');
const cargoEl = document.querySelector('#cargo');
const ufCampo = document.querySelector('#uf-campo');
const ufEl = document.querySelector('#uf');
const municipioCampo = document.querySelector('#municipio-campo');
const municipioEl = document.querySelector('#municipio');
const candidatosEl = document.querySelector('#candidatos');
const subtituloEleicaoEl = document.querySelector('#subtitulo-eleicao');
const resultadoResumo = document.querySelector('#resultado-resumo');
const resultadoTitulo = document.querySelector('#resultado-titulo');
const resumoEl = document.querySelector('#resumo-votos');
const avisoEl = document.querySelector('#aviso');
const eleicoesSecao = document.querySelector('#eleicoes-secao');
const statusSecao = document.querySelector('#status-secao');
const gestaoSecao = document.querySelector('#gestao-secao');
const gestaoLista = document.querySelector('#gestao-lista');
const gestaoAviso = document.querySelector('#gestao-aviso');
const salvarGestaoBtn = document.querySelector('#salvar-gestao');
const statusResumo = document.querySelector('#status-resumo');
const statusArquivos = document.querySelector('#status-arquivos');
const sincronizarBtn = document.querySelector('#sincronizar');
const mapaBloco = document.querySelector('#mapa-bloco');
const mapaSvg = document.querySelector('#mapa-brasil');
const mapaDica = document.querySelector('#mapa-dica');
const mapaNota = document.querySelector('#mapa-nota');
const mapaLegenda = document.querySelector('#mapa-legenda');
const mapaDetalhe = document.querySelector('#mapa-detalhe');
const mapaTitulo = document.querySelector('#mapa-titulo');
const urnasEl = document.querySelector('#urnas-apuradas');
const confirmaFiltroEl = document.querySelector('#confirma-filtro');

let eleicaoAtual = null;
let eleicoesCarregadas = [];
const TIPOS_ORDINARIOS = new Set([1, 3, 8]);
const TIPOS_SUPLEMENTARES = new Set([2, 4, 9]);
const TIPOS_CONSULTA = new Set([5, 6, 7]);
let fase = 'simulado';
let atualizacaoTimer = null;

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

let malhaBrasil = null;
let resultadosUf = new Map();
let coresCandidato = new Map();
let ufSelecionada = null;
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
    erro.codigo = corpo.erro?.codigo;
    throw erro;
  }
  return corpo;
}

function textoGeracao(geracao) {
  if (!geracao) return '';
  const id = geracao.id ? ` · geração ${geracao.id}` : '';
  return `${geracao.fase} · ${geracao.data ?? ''} ${geracao.hora ?? ''}${id}`;
}

function metrica(rotulo, valor, progresso) {
  const bloco = document.createElement('article');
  bloco.className = 'metrica';
  const rotuloEl = document.createElement('span');
  rotuloEl.className = 'suave';
  rotuloEl.textContent = rotulo;
  const valorEl = document.createElement('b');
  valorEl.textContent = valor;
  bloco.append(rotuloEl, valorEl);
  if (progresso != null && Number.isFinite(progresso)) {
    const trilho = document.createElement('span');
    trilho.className = 'trilho';
    const enchimento = document.createElement('span');
    enchimento.className = 'enchimento';
    enchimento.style.width = `${Math.max(0, Math.min(100, progresso))}%`;
    trilho.append(enchimento);
    bloco.append(trilho);
  }
  return bloco;
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

function aceitaFiltroEleicao(eleicao) {
  const codigo = eleicao.tipo?.codigo;
  if (filtroEleicaoEl.value === 'ordinaria') return TIPOS_ORDINARIOS.has(codigo);
  if (filtroEleicaoEl.value === 'suplementar') return TIPOS_SUPLEMENTARES.has(codigo);
  if (filtroEleicaoEl.value === 'consulta') return TIPOS_CONSULTA.has(codigo);
  return true;
}

function pintarEleicoes() {
  const itens = eleicoesCarregadas.filter(aceitaFiltroEleicao);
  if (filtroEleicaoEl.value === 'todas') {
    itens.sort((a, b) => Number(TIPOS_ORDINARIOS.has(b.tipo?.codigo)) - Number(TIPOS_ORDINARIOS.has(a.tipo?.codigo)));
  }
  eleicoesEl.replaceChildren();
  if (!itens.length) {
    const vazio = document.createElement('p');
    vazio.className = 'resumo';
    vazio.textContent = 'Nenhuma eleição deste tipo nesta fase. A aba Eleições define quais ficam visíveis.';
    eleicoesEl.append(vazio);
    return;
  }
  for (const eleicao of itens) {
    const botao = document.createElement('button');
    botao.className = 'cartao';
    botao.type = 'button';
    if (eleicaoAtual?.codigo === eleicao.codigo) botao.classList.add('ativo');
    botao.innerHTML = `<strong></strong><span class="data"></span><span></span>`;
    botao.querySelector('strong').textContent = eleicao.nome;
    botao.querySelector('.data').textContent = eleicao.pleito?.data || 'Data não informada';
    botao.querySelector('span:last-child').textContent = `${eleicao.turno}º turno · ${eleicao.tipo.descricao}`;
    botao.addEventListener('click', () => selecionarEleicao(eleicao, botao));
    eleicoesEl.append(botao);
  }
}

async function carregarEleicoes() {
  const dados = await obter('/api/v1/eleicoes?tamanho=200');
  geracaoEl.textContent = textoGeracao(dados.geracao);
  eleicoesCarregadas = dados.itens ?? [];
  pintarEleicoes();
}

async function selecionarEleicao(eleicao, botao) {
  eleicaoAtual = eleicao;
  for (const cartao of eleicoesEl.querySelectorAll('.cartao')) cartao.classList.remove('ativo');
  botao.classList.add('ativo');
  painelSecao.hidden = false;
  resultadoSecao.hidden = false;
  avisoEl.hidden = true;

  painelEl.replaceChildren();
  try {
    const painel = await obter(`/api/v1/eleicoes/${eleicao.codigo}/painel`);
    const apuracao = painel.acompanhamento;
    const secoesPct = apuracao.secoes.total
      ? (apuracao.secoes.totalizadas / apuracao.secoes.total) * 100
      : null;
    painelEl.replaceChildren(
      metrica('Andamento', apuracao.andamento?.replaceAll('_', ' ') ?? '—'),
      metrica('Seções totalizadas', formatarPar(apuracao.secoes.totalizadas, apuracao.secoes.total), secoesPct),
      metrica('Comparecimento', percentual.format(apuracao.eleitorado.comparecimentoPercentual ?? 0) + '%', apuracao.eleitorado.comparecimentoPercentual),
      metrica('Abstenção', percentual.format(apuracao.eleitorado.abstencaoPercentual ?? 0) + '%', apuracao.eleitorado.abstencaoPercentual),
    );
  } catch (erro) {
    painelEl.append(metrica('Apuração', erro.message));
  }

  cargoEl.replaceChildren();
  for (const cargo of eleicao.cargos) {
    const opcao = document.createElement('option');
    opcao.value = cargo.codigo;
    opcao.textContent = cargo.nome;
    cargoEl.append(opcao);
  }
  await prepararUf();
  await carregarResultado();
}

function eleicaoMunicipal() {
  const tipo = Number(eleicaoAtual?.tipo?.codigo);
  return tipo === 3 || tipo === 4;
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
  if (eleicaoMunicipal()) await prepararMunicipios();
}

async function prepararMunicipios() {
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
  if (capital) municipioEl.value = capital;
  else if (municipioEl.options.length) municipioEl.selectedIndex = 0;
  return true;
}

async function carregarResultado(atualizarMapa = true) {
  confirmarFiltro();
  avisoEl.hidden = true;
  candidatosEl.replaceChildren();
  resumoEl.replaceChildren();
  resultadoResumo.hidden = true;
  mostrarSubtituloEleicao();
  const cargo = cargoEl.value;
  if (eleicaoMunicipal() && !municipioEl.value) {
    avisoEl.hidden = false;
    avisoEl.textContent = 'Selecione um município. A lista aparece quando o arquivo de municípios desta eleição tiver sido baixado.';
    limparUrnas();
    if (atualizarMapa) await carregarMapa();
    return;
  }
  const uf = cargo === '0001' ? '' : `?uf=${ufEl.value}${eleicaoMunicipal() ? `&municipio=${municipioEl.value}` : ''}`;
  try {
    const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}${uf}`);
    pintarUrnas(dados.apuracao?.secoes, rotuloUrnas());
    const votos = dados.votos ?? {};
    const abrangencia = dados.abrangencia.codigo?.toUpperCase() === 'BR' ? 'Brasil' : dados.abrangencia.codigo?.toUpperCase();
    resultadoTitulo.textContent = dados.totalizacaoFinal ? 'Resultado definido' : 'Resultado preliminar';
    resultadoResumo.hidden = false;
    resumoEl.replaceChildren(
      chip(dados.cargo.nome),
      chip(abrangencia || '—'),
      chip((dados.andamento ?? '—').replaceAll('_', ' ')),
      chip('votos', numero.format(votos.total ?? 0)),
      chip('válidos', numero.format(votos.validos ?? 0)),
      chip('brancos', numero.format(votos.brancos ?? 0)),
      chip('nulos', numero.format(votos.nulos ?? 0)),
    );
    coresCandidato = new Map();
    const maior = Math.max(...dados.candidatos.map((candidato) => candidato.votos ?? 0), 0);
    dados.candidatos.forEach((candidato, indice) => {
      const cartao = document.createElement('article');
      const cor = corDo(candidato, indice);
      const situacao = classeSituacao(candidato);
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
      selo.className = `selo ${situacao}`.trim();
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
    limparUrnas();
    avisoEl.hidden = false;
    avisoEl.textContent = erro.message;
  }
  if (atualizarMapa) await carregarMapa();
}

function mostrarSubtituloEleicao() {
  if (!eleicaoAtual) {
    subtituloEleicaoEl.hidden = true;
    subtituloEleicaoEl.replaceChildren();
    return;
  }
  const nome = document.createElement('strong');
  nome.textContent = eleicaoAtual.nome;
  const linha = document.createElement('span');
  const data = eleicaoAtual.pleito?.data || 'Data não informada';
  linha.textContent = `${data} · ${eleicaoAtual.turno}º turno · ${eleicaoAtual.tipo.descricao}`;
  subtituloEleicaoEl.replaceChildren(nome, linha);
  subtituloEleicaoEl.hidden = false;
}

function limparUrnas() {
  urnasEl.hidden = true;
}

function ocultarConfirmacao() {
  confirmaFiltroEl.hidden = true;
}

function confirmarFiltro() {
  if (!eleicaoAtual || !cargoEl.value) {
    ocultarConfirmacao();
    return;
  }
  const cargo = cargoEl.selectedOptions[0]?.textContent || 'Cargo';
  const partes = [`Cargo: ${cargo}`];
  let dica = 'Veja se o cargo é o que você quer consultar. Neste cargo o recorte é o Brasil.';
  if (cargoEl.value === '0001') {
    partes.push('Estado: Brasil');
  } else {
    const sigla = String(ufEl.value || '').toLowerCase();
    const estado = NOMES_UF[sigla] || ufEl.selectedOptions[0]?.textContent || sigla.toUpperCase() || 'não escolhido';
    partes.push(`Estado: ${estado}`);
    if (eleicaoMunicipal()) {
      const municipio = municipioEl.selectedOptions[0]?.textContent;
      if (municipio) partes.push(`Município: ${municipio}`);
      dica = 'Veja se o cargo, o estado e o município são os que você quer consultar.';
    } else {
      dica = 'Veja se o cargo e o estado são os que você quer consultar.';
    }
  }
  const texto = partes.join(' · ');
  const resumo = confirmaFiltroEl.querySelector('[data-resumo]');
  const mudou = resumo.textContent !== texto;
  resumo.textContent = texto;
  confirmaFiltroEl.querySelector('[data-dica]').textContent = dica;
  confirmaFiltroEl.hidden = false;
  if (mudou) {
    confirmaFiltroEl.classList.remove('atualizado');
    void confirmaFiltroEl.offsetWidth;
    confirmaFiltroEl.classList.add('atualizado');
  }
}

function rotuloUrnas() {
  if (cargoEl.value === '0001') return 'Brasil';
  if (eleicaoMunicipal() && municipioEl.selectedOptions[0]) return municipioEl.selectedOptions[0].textContent;
  const sigla = String(ufEl.value || '').toLowerCase();
  return NOMES_UF[sigla] || sigla.toUpperCase();
}

function pintarUrnas(secoes, lugar) {
  const apuradas = secoes?.apuradas;
  const total = secoes?.total;
  if (apuradas == null || total == null) {
    limparUrnas();
    return;
  }
  const progresso = total > 0 ? Math.max(0, Math.min(100, (apuradas / total) * 100)) : 0;
  urnasEl.hidden = false;
  urnasEl.querySelector('[data-lugar]').textContent = lugar || '';
  urnasEl.querySelector('[data-qtd]').textContent = numero.format(apuradas);
  urnasEl.querySelector('[data-total]').textContent = `de ${numero.format(total)}`;
  urnasEl.querySelector('[data-pct]').textContent = `${percentual.format(progresso)}%`;
  urnasEl.querySelector('[data-barra]').style.width = `${progresso}%`;
  const trilho = urnasEl.querySelector('[role="progressbar"]');
  trilho.setAttribute('aria-valuenow', String(Math.round(progresso)));
  trilho.setAttribute('aria-valuetext', `${numero.format(apuradas)} de ${numero.format(total)} urnas apuradas`);
}

function formatarPar(parte, total) {
  if (parte == null || total == null) return '—';
  return `${numero.format(parte)} / ${numero.format(total)}`;
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
  const largura = 1000;
  const altura = 980;
  const margem = 12;
  const projetar = (lon, lat) => {
    const x = margem + ((lon - minLon) / (maxLon - minLon)) * (largura - margem * 2);
    const y = margem + ((maxLat - lat) / (maxLat - minLat)) * (altura - margem * 2);
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
    forma.dataset.fill = SEM_DADO;
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
  const resultado = resultadosUf.get(sigla);
  const lider = liderDe(resultado);
  const linha = lider
    ? `${lider.nomeUrna || lider.nome} · ${percentual.format(lider.votosPercentual ?? 0)}%`
    : 'Resultado ainda não publicado';
  mapaDica.textContent = `${NOMES_UF[sigla]} · ${linha}`;
  mapaDica.hidden = false;
  posicionarDica(evento);
}

function posicionarDica(evento) {
  const palco = mapaSvg.parentElement.getBoundingClientRect();
  const x = Math.min(evento.clientX - palco.left + 12, palco.width - 180);
  const y = Math.max(evento.clientY - palco.top - 36, 8);
  mapaDica.style.left = `${x}px`;
  mapaDica.style.top = `${y}px`;
}

function marcarUfSelecionada(sigla) {
  const alvo = String(sigla || '').toLowerCase();
  ufSelecionada = alvo || null;
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
  const pedido = ++filtroPedido;
  marcarUfSelecionada(sigla);
  pintarDetalhe(sigla);
  if (cargoEl.value === '0001') return;
  try {
    definirUf(sigla);
    if (eleicaoMunicipal()) {
      const ok = await prepararMunicipios();
      if (!ok || pedido !== filtroPedido) return;
    } else if (pedido !== filtroPedido) return;
    await carregarResultado(false);
  } catch (erro) {
    if (pedido !== filtroPedido) return;
    avisoEl.hidden = false;
    avisoEl.textContent = erro.message;
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
    const nomeCargo = cargoEl.selectedOptions[0]?.textContent || 'cargo';
    aviso.textContent = eleicaoMunicipal()
      ? `A capital não teve disputa de ${nomeCargo.toLowerCase()} neste turno.`
      : `O TSE ainda não publicou o resultado de ${nomeCargo.toLowerCase()} nesta unidade.`;
    mapaDetalhe.append(aviso);
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
}

function pintarMapa() {
  for (const forma of mapaSvg.querySelectorAll('.uf')) {
    const lider = liderDe(resultadosUf.get(forma.dataset.uf));
    const cor = lider ? corDo(lider, 0) : SEM_DADO;
    forma.dataset.fill = cor;
    forma.setAttribute('fill', cor);
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
  if (vistos.size === 0) return;
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
  const publicados = resultadosUf.size;
  mapaNota.textContent = publicados
    ? municipal
      ? `${publicados} capitais com resultado de ${nomeCargo.toLowerCase()}. A cor é de quem está à frente na capital.`
      : `${publicados} unidades com resultado de ${nomeCargo.toLowerCase()}. A cor é de quem está à frente em cada estado.`
    : municipal
      ? `O 2º turno municipal não tem total por estado. O mapa usa a capital quando ela teve disputa de ${nomeCargo.toLowerCase()}.`
      : `O mapa segue o cargo ${nomeCargo}. Cada estado ganha cor quando o TSE publicar o resultado dessa UF.`;
}

async function resultadoParaMapa(cargo, sigla, municipal) {
  if (!municipal) {
    return obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}?uf=${sigla}`);
  }
  const municipios = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/ufs/${sigla}/municipios?capital=true&tamanho=1`);
  const capital = municipios.itens?.[0];
  if (!capital) throw new Error('sem capital');
  const dados = await obter(`/api/v1/eleicoes/${eleicaoAtual.codigo}/resultados/${cargo}?uf=${sigla}&municipio=${capital.codigo}`);
  dados.municipioMapa = capital.nome;
  return dados;
}

filtroEleicaoEl.addEventListener('change', pintarEleicoes);

cargoEl.addEventListener('change', async () => {
  filtroPedido += 1;
  await prepararUf();
  await carregarResultado();
});
ufEl.addEventListener('change', async () => {
  if (ajustandoFiltro) return;
  const pedido = ++filtroPedido;
  marcarUfSelecionada(ufEl.value);
  pintarDetalhe((ufEl.value || '').toLowerCase());
  try {
    if (eleicaoMunicipal()) {
      const ok = await prepararMunicipios();
      if (!ok || pedido !== filtroPedido) return;
    } else if (pedido !== filtroPedido) return;
    carregarResultado(false);
  } catch (erro) {
    if (pedido !== filtroPedido) return;
    avisoEl.hidden = false;
    avisoEl.textContent = erro.message;
  }
});
municipioEl.addEventListener('change', () => carregarResultado(false));

sincronizarBtn.addEventListener('click', async () => {
  sincronizarBtn.disabled = true;
  const resposta = await fetch('/api/v1/sincronizacao', { method: 'POST' });
  const corpo = await resposta.json().catch(() => ({}));
  await carregarStatus();
  if (!resposta.ok) statusResumo.textContent = corpo.erro?.mensagem || 'Não foi possível sincronizar.';
});

function horaLocal(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(iso));
}

function mostrarVisao(visao) {
  const catalogo = visao === 'catalogo';
  eleicoesSecao.hidden = !catalogo;
  statusSecao.hidden = visao !== 'atualizacao';
  gestaoSecao.hidden = visao !== 'gestao';
  if (!catalogo) {
    painelSecao.hidden = true;
    resultadoSecao.hidden = true;
    mapaBloco.hidden = true;
  }
}

function anoDaEleicao(eleicao) {
  return eleicao.ano || eleicao.pleito?.ciclo?.match(/20\d{2}/)?.[0] || eleicao.pleito?.data?.match(/20\d{2}/)?.[0] || 'Sem ano';
}

function textoCargos(eleicao) {
  const nomes = (eleicao.cargos ?? []).map((cargo) => cargo.nome).filter(Boolean);
  return nomes.length ? nomes.join(', ') : 'Cargo não informado';
}

function atualizarGrupo(grupo) {
  const itens = [...grupo.querySelectorAll('.item-eleicao')];
  const marcadas = itens.filter((item) => item.querySelector('input').checked).length;
  const cabecalho = grupo.querySelector('.ano-check');
  cabecalho.checked = marcadas === itens.length && itens.length > 0;
  cabecalho.indeterminate = marcadas > 0 && marcadas < itens.length;
  const seloAno = grupo.querySelector('header .selo-status');
  if (marcadas === itens.length) definirSelo(seloAno, true);
  else if (marcadas === 0) definirSelo(seloAno, false);
  else {
    seloAno.textContent = 'PARCIAL';
    seloAno.className = 'selo selo-status';
  }
  for (const item of itens) definirSelo(item.querySelector('.selo-status'), item.querySelector('input').checked);
}

function definirSelo(selo, ativa) {
  selo.textContent = ativa ? 'ATIVA' : 'INATIVA';
  selo.className = `selo selo-status ${ativa ? 'ativa' : 'inativa'}`;
}

function pintarGestao(itens) {
  gestaoLista.replaceChildren();
  if (!itens.length) {
    const vazio = document.createElement('p');
    vazio.className = 'resumo';
    vazio.textContent = 'Nenhuma eleição encontrada nos catálogos carregados.';
    gestaoLista.append(vazio);
    return;
  }
  const grupos = new Map();
  for (const eleicao of itens) {
    const ano = anoDaEleicao(eleicao);
    if (!grupos.has(ano)) grupos.set(ano, []);
    grupos.get(ano).push(eleicao);
  }
  const anos = [...grupos.keys()].sort((a, b) => String(b).localeCompare(String(a), 'pt-BR'));
  for (const ano of anos) {
    const grupo = document.createElement('section');
    grupo.className = 'grupo-ano';
    const cabecalho = document.createElement('header');
    const anoCheck = document.createElement('input');
    anoCheck.type = 'checkbox';
    anoCheck.className = 'ano-check';
    anoCheck.setAttribute('aria-label', `Eleições ${ano}`);
    const titulo = document.createElement('div');
    const nome = document.createElement('strong');
    nome.textContent = `Eleições ${ano}`;
    const detalhe = document.createElement('span');
    detalhe.className = 'meta-eleicao';
    detalhe.textContent = 'Marca ou desmarca todas as eleições deste ano.';
    titulo.append(nome, detalhe);
    const seloAno = document.createElement('span');
    seloAno.className = 'selo selo-status selo-ano';
    cabecalho.append(anoCheck, titulo, seloAno);
    grupo.append(cabecalho);
    const eleicoesAno = grupos.get(ano).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || String(a.codigo).localeCompare(String(b.codigo)));
    for (const eleicao of eleicoesAno) {
      const linha = document.createElement('label');
      linha.className = 'item-eleicao';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = Boolean(eleicao.ativa);
      check.dataset.fase = eleicao.fase;
      check.dataset.codigo = eleicao.codigo;
      check.addEventListener('change', () => atualizarGrupo(grupo));
      const texto = document.createElement('div');
      const forte = document.createElement('strong');
      forte.textContent = eleicao.nome;
      const meta = document.createElement('span');
      meta.className = 'meta-eleicao';
      const identificador = eleicao.sequencial ? `${eleicao.codigo} · seq. ${eleicao.sequencial}` : eleicao.codigo;
      meta.textContent = `${eleicao.ano || ano} · ${eleicao.turno}º turno · ${eleicao.tipo?.descricao ?? 'Tipo não informado'} · ${textoCargos(eleicao)} · ${identificador} · ${eleicao.origem || eleicao.fase}`;
      texto.append(forte, meta);
      const selo = document.createElement('span');
      selo.className = 'selo selo-status';
      linha.append(check, texto, selo);
      grupo.append(linha);
    }
    anoCheck.addEventListener('change', () => {
      for (const item of grupo.querySelectorAll('.item-eleicao input')) item.checked = anoCheck.checked;
      atualizarGrupo(grupo);
    });
    atualizarGrupo(grupo);
    gestaoLista.append(grupo);
  }
}

async function carregarGestao() {
  mostrarVisao('gestao');
  gestaoAviso.hidden = true;
  const resposta = await fetch('/api/v1/eleicoes/gestao');
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro?.mensagem || 'Não foi possível listar as eleições.');
  pintarGestao(corpo.itens ?? []);
}

async function salvarGestao() {
  const ativas = [...gestaoLista.querySelectorAll('.item-eleicao input:checked')].map((input) => ({
    fase: input.dataset.fase,
    codigo: input.dataset.codigo,
  }));
  salvarGestaoBtn.disabled = true;
  gestaoAviso.hidden = true;
  try {
    const resposta = await fetch('/api/v1/eleicoes/gestao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativas }),
    });
    const corpo = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(corpo.erro?.mensagem || 'Não foi possível salvar.');
    pintarGestao(corpo.itens ?? []);
    gestaoAviso.hidden = false;
    gestaoAviso.textContent = 'Alterações salvas. As outras páginas passam a usar somente as eleições ativas.';
  } catch (erro) {
    gestaoAviso.hidden = false;
    gestaoAviso.textContent = erro.message;
  } finally {
    salvarGestaoBtn.disabled = false;
  }
}

async function carregarStatus() {
  mostrarVisao('atualizacao');
  const dados = await obter('/api/v1/sincronizacao');
  const emAndamento = dados.executando ? ' · baixando agora' : '';
  sincronizarBtn.disabled = dados.executando;
  statusResumo.textContent = `Fase ${dados.fase} · consulta ao TSE ao iniciar e a cada 5 minutos · última carga ${horaLocal(dados.ultimoCiclo)} · ${dados.arquivos.length} arquivo(s)${emAndamento}`;
  statusArquivos.replaceChildren();
  for (const arquivo of dados.arquivos) {
    const linha = document.createElement('tr');
    linha.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td>';
    const celulas = linha.children;
    celulas[0].textContent = arquivo.nome;
    celulas[1].textContent = arquivo.tipo;
    celulas[2].textContent = `${arquivo.geracao?.data ?? ''} ${arquivo.geracao?.hora ?? ''}`.trim() || '—';
    celulas[3].textContent = arquivo.geracao?.id ?? '—';
    celulas[4].textContent = horaLocal(arquivo.verificadoEm);
    celulas[5].textContent = arquivo.estado;
    statusArquivos.append(linha);
  }
}

salvarGestaoBtn.addEventListener('click', () => {
  salvarGestao().catch((erro) => {
    gestaoAviso.hidden = false;
    gestaoAviso.textContent = erro.message;
  });
});

for (const aba of document.querySelectorAll('.aba')) {
  aba.addEventListener('click', () => {
    for (const item of document.querySelectorAll('.aba')) item.classList.remove('ativa');
    aba.classList.add('ativa');
    if (atualizacaoTimer) clearInterval(atualizacaoTimer);
    atualizacaoTimer = null;
    if (aba.dataset.visao === 'atualizacao') {
      carregarStatus().catch((erro) => {
        statusResumo.textContent = erro.message;
      });
      atualizacaoTimer = setInterval(() => {
        carregarStatus().catch((erro) => {
          statusResumo.textContent = erro.message;
        });
      }, 60000);
      return;
    }
    if (aba.dataset.visao === 'gestao') {
      carregarGestao().catch((erro) => {
        gestaoAviso.hidden = false;
        gestaoAviso.textContent = erro.message;
      });
      return;
    }
    fase = aba.dataset.fase;
    eleicaoAtual = null;
    limparUrnas();
    ocultarConfirmacao();
    mostrarVisao('catalogo');
    painelSecao.hidden = true;
    resultadoSecao.hidden = true;
    carregarEleicoes().catch((erro) => {
      geracaoEl.textContent = erro.message;
    });
  });
}

carregarEleicoes().catch((erro) => {
  geracaoEl.textContent = erro.message;
});
