import { Acompanhamento, Eleicao, Geracao, Municipio, Pleito, Resultado } from './model';
import { geracaoDe, parseAcompanhamento, parseCatalogo, parseMunicipios, parseResultado } from './parse';

function baseFotos(origem: { base: string; ambiente: string }, raw: any, eleicao: string, uf: string): string | null {
  let contexto: { ciclo?: string; eleicao: string; pleito: string } | null = null;
  for (const pleito of raw.pl ?? []) {
    for (const item of pleito.e ?? []) {
      if (String(item.cd) === eleicao) contexto = { ciclo: pleito.c ?? raw.c, eleicao: String(item.cd), pleito: String(pleito.cd) };
    }
  }
  if (!contexto?.ciclo) return null;
  const tipo = (raw.arq ?? []).some((entrada: { tp?: string }) => entrada.tp === 'ft') ? 'ft' : 'u';
  const item = (raw.arq ?? []).find((entrada: { tp?: string }) => entrada.tp === tipo);
  if (!item?.dir) return null;
  let diretorio = String(item.dir)
    .replaceAll('<base>', origem.base)
    .replaceAll('<ambiente>', origem.ambiente)
    .replaceAll('<ciclo>', contexto.ciclo)
    .replaceAll('<cd_eleicao>', contexto.eleicao)
    .replaceAll('<cd_pleito>', contexto.pleito)
    .replaceAll('<uf>', uf);
  if (tipo === 'u') diretorio = diretorio.replace('/dados/', '/fotos/');
  if (diretorio.includes('<') || diretorio.includes('/dados/')) return null;
  return diretorio;
}

function ufDoArquivo(nome: string, codigo?: string): string | undefined {
  const municipal = nome.match(/^([a-z]{2})\d{5}-/i);
  if (municipal) return municipal[1].toLowerCase();
  if (codigo && codigo.length <= 2) return codigo;
  const uf = nome.match(/^([a-z]{2})-/i);
  return uf?.[1].toLowerCase();
}

function origemSimulado() {
  return {
    base: process.env.TSE_SIMULADO_BASE ?? 'https://resultados-sim.tse.jus.br/simulado',
    ambiente: process.env.TSE_SIMULADO_AMBIENTE ?? 'simulado2026',
  };
}

function origemOficial() {
  return {
    base: process.env.TSE_OFICIAL_BASE ?? 'https://resultados.tse.jus.br',
    ambiente: process.env.TSE_OFICIAL_AMBIENTE ?? 'oficial',
  };
}

function geracaoDeArquivo(raw: { dg?: string; hg?: string; idg?: string; f?: string }): Geracao {
  return geracaoDe(raw);
}

export class ElectionStore {
  geracaoCatalogo: Geracao = { id: null, fase: 'simulado' };
  pleitos: Pleito[] = [];
  eleicoes: Eleicao[] = [];
  ufs = new Map<string, Array<{ sigla: string; nome: string; geracao: Geracao }>>();
  municipios = new Map<string, Municipio & { geracao: Geracao }>();
  acompanhamento = new Map<string, Acompanhamento>();
  resultados = new Map<string, Resultado>();
  snapshots = new Map<string, string | null>();
  arquivos = new Map<string, { nome: string; tipo: string; estado: string; geracao: Geracao; verificadoEm: string }>();
  regravacoes = 0;
  arquivosAusentes = new Set<string>();
  ultimoCiclo: string | null = null;
  catalogoRaw: any = null;
  origemOk = true;
  executando = false;

  ingerirCatalogo(raw: any, chave = 'ele-c.json'): boolean {
    const idAnterior = this.geracaoCatalogo.id;
    this.catalogoRaw = raw;
    const mudou = this.mudou(chave, raw.idg ?? null);
    if (mudou && idAnterior && idAnterior !== (raw.idg ?? null)) this.arquivosAusentes.clear();
    if (mudou) {
      const parsed = parseCatalogo(raw);
      this.geracaoCatalogo = parsed.geracao;
      this.pleitos = parsed.pleitos;
      this.eleicoes = parsed.eleicoes;
      this.regravacoes += 1;
    }
    this.registrar(chave, 'Catálogo', this.geracaoCatalogo);
    return mudou;
  }

  ingerirMunicipios(eleicao: string, raw: any, nome = `mun-e${eleicao}-cm.json`): boolean {
    const chave = `cm:${eleicao}`;
    if (!this.mudou(chave, raw.idg ?? null)) {
      const geracao = this.ufs.get(eleicao)?.[0]?.geracao ?? geracaoDeArquivo(raw);
      this.registrar(nome, 'Municípios', geracao);
      return false;
    }
    const parsed = parseMunicipios(raw);
    this.ufs.set(eleicao, parsed.ufs.map((uf) => ({ ...uf, geracao: parsed.geracao })));
    for (const [codigo, mun] of this.listarMunicipios(eleicao)) {
      if (mun) this.municipios.delete(`${eleicao}:${codigo}`);
    }
    for (const mun of parsed.municipios) {
      this.municipios.set(`${eleicao}:${mun.codigo}`, { ...mun, geracao: parsed.geracao });
    }
    this.regravacoes += 1;
    this.registrar(nome, 'Municípios', parsed.geracao);
    return true;
  }

  ingerirAcompanhamento(raw: any, nome: string): boolean {
    if (!this.mudou(nome, raw.idg ?? null)) {
      this.registrar(nome, 'Acompanhamento', geracaoDeArquivo(raw));
      return false;
    }
    const eleicao = String(raw.ele);
    for (const item of parseAcompanhamento(raw)) {
      const codigo = item.codigo ?? '';
      const chave = item.tipo === 'municipio' ? `${eleicao}:mun:${codigo}` : item.tipo === 'uf' ? `${eleicao}:uf:${codigo}` : `${eleicao}:br`;
      this.acompanhamento.set(chave, item);
    }
    this.regravacoes += 1;
    this.registrar(nome, 'Acompanhamento', geracaoDeArquivo(raw));
    return true;
  }

  ingerirResultado(raw: any, nome: string): boolean {
    if (!this.mudou(nome, raw.idg ?? null)) {
      this.registrar(nome, 'Resultado', geracaoDeArquivo(raw));
      return false;
    }
    const resultado = parseResultado(raw);
    if (resultado.abrangencia.codigo) resultado.abrangencia.codigo = resultado.abrangencia.codigo.toLowerCase();
    resultado.ufFoto = ufDoArquivo(nome, resultado.abrangencia.codigo);
    this.resultados.set(`${resultado.eleicao}:${resultado.cargo.codigo}:${resultado.abrangencia.codigo}`, resultado);
    this.regravacoes += 1;
    this.registrar(nome, 'Resultado', resultado.geracao);
    return true;
  }

  eleicao(codigo: string): Eleicao | undefined {
    return this.eleicoes.find((item) => item.codigo === codigo);
  }

  pleito(codigo: string): Pleito | undefined {
    return this.pleitos.find((item) => item.codigo === codigo);
  }

  listarUfs(eleicao: string) {
    return this.ufs.get(eleicao) ?? [];
  }

  listarMunicipios(eleicao: string, uf?: string): Array<[string, (Municipio & { geracao: Geracao }) | undefined]> {
    const saida: Array<[string, Municipio & { geracao: Geracao }]> = [];
    for (const [chave, mun] of this.municipios) {
      if (!chave.startsWith(`${eleicao}:`)) continue;
      if (uf && mun.uf.sigla !== uf) continue;
      saida.push([mun.codigo, mun]);
    }
    return saida;
  }

  municipio(eleicao: string, codigo: string) {
    return this.municipios.get(`${eleicao}:${codigo}`);
  }

  acompanhamentoDe(eleicao: string, tipo: 'br' | 'uf' | 'mun', codigo = '') {
    const sufixo = tipo === 'br' ? 'br' : `${tipo}:${codigo}`;
    return this.acompanhamento.get(`${eleicao}:${sufixo}`);
  }

  acompanhamentos(eleicao: string, tipo: 'uf' | 'mun') {
    const prefixo = `${eleicao}:${tipo}:`;
    return [...this.acompanhamento.entries()].filter(([chave]) => chave.startsWith(prefixo)).map(([, item]) => item);
  }

  resultado(eleicao: string, cargo: string, abrangencia: string) {
    return this.resultados.get(`${eleicao}:${cargo}:${abrangencia}`);
  }

  urlFoto(eleicao: string, uf: string, sequencial: string): string | null {
    if (!this.catalogoRaw || !/^\d+$/.test(sequencial)) return null;
    const oficial = this.geracaoCatalogo.fase === 'oficial';
    const base = baseFotos(oficial ? origemOficial() : origemSimulado(), this.catalogoRaw, eleicao, uf);
    return base ? `${base}/${sequencial}.jpeg` : null;
  }

  aplicarFotos(resultado: Resultado): Resultado {
    const { ufFoto, ...resto } = resultado;
    const raw = this.catalogoRaw;
    const codigo = resto.abrangencia.codigo;
    const uf = ufFoto
      || (!codigo || codigo === 'br' || codigo === 'zz' || codigo.length === 2 ? codigo || 'br' : this.municipio(resto.eleicao, codigo)?.uf.sigla);
    if (!raw || !uf) return resto;
    const oficial = this.geracaoCatalogo.fase === 'oficial';
    const base = baseFotos(oficial ? origemOficial() : origemSimulado(), raw, resto.eleicao, uf);
    if (!base) return resto;
    return {
      ...resto,
      candidatos: resto.candidatos.map((candidato) => ({
        ...candidato,
        fotoUrl: candidato.sequencial ? `/api/v1/fotos/${this.geracaoCatalogo.fase}/${resto.eleicao}/${uf}/${candidato.sequencial}.jpeg` : candidato.fotoUrl,
      })),
    };
  }

  marcarAusente(nome: string, tipo: string) {
    this.arquivosAusentes.add(nome);
    this.arquivos.set(nome, {
      nome,
      tipo,
      estado: 'ausente',
      geracao: { id: null, fase: this.geracaoCatalogo.fase },
      verificadoEm: new Date().toISOString(),
    });
  }

  marcarVerificado(nome: string) {
    const atual = this.arquivos.get(nome);
    if (atual) atual.verificadoEm = new Date().toISOString();
  }

  private registrar(nome: string, tipo: string, geracao: Geracao) {
    this.arquivosAusentes.delete(nome);
    this.arquivos.set(nome, {
      nome,
      tipo,
      estado: 'atualizado',
      geracao,
      verificadoEm: new Date().toISOString(),
    });
  }

  private mudou(chave: string, idg: string | null): boolean {
    if (this.snapshots.has(chave) && this.snapshots.get(chave) === idg) return false;
    this.snapshots.set(chave, idg);
    return true;
  }
}
