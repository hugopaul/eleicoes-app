import { pad } from '../common/util';
import { ElectionStore } from '../store/election-store';

export interface OrigemTse {
  base: string;
  ambiente: string;
}

const PAUSA_MS = Number(process.env.SYNC_INTERVALO_MINIMO_MS ?? 200);
const LIMITE_FILA = Number(process.env.SYNC_FILA_MAX ?? 40);
let cadeia: Promise<void> = Promise.resolve();
let aguardando = 0;

export function filaCheia(): boolean {
  return aguardando >= LIMITE_FILA;
}

export function naFila<T>(trabalho: () => Promise<T>): Promise<T> {
  aguardando += 1;
  const execucao = cadeia.then(async () => {
    try {
      await esperar(PAUSA_MS);
      return await trabalho();
    } finally {
      aguardando -= 1;
    }
  });
  cadeia = execucao.then(() => undefined, () => undefined);
  return execucao;
}

export async function sincronizarOrigem(store: ElectionStore, origem: OrigemTse, etags: Map<string, string>, tentarAusentes: boolean): Promise<void> {
  store.executando = true;
  try {
    const catalogoUrl = `${origem.base}/${origem.ambiente}/comum/config/ele-c.json`;
    const catalogo = await baixar(catalogoUrl, etags);
    if (catalogo.status === 200 && catalogo.json) store.ingerirCatalogo(catalogo.json);
    else if (catalogo.status === 304) store.marcarVerificado('ele-c.json');
    else if (catalogo.status !== 200) {
      store.origemOk = false;
      return;
    }
    const raw = store.catalogoRaw;
    if (!raw) return;

    const distritais: Array<{ contexto: { ciclo?: string; eleicao: string; pleito: string }; codigoArquivo: string }> = [];
    for (const eleicao of store.eleicoes) {
      const contexto = localizar(raw, eleicao.codigo);
      if (!contexto) continue;
      const codigoArquivo = pad(eleicao.codigo, 6);
      const nomeMunicipios = `mun-e${codigoArquivo}-cm.json`;
      await obterJson(store, etags, tentarAusentes, 'Municípios', urlArquivo(origem, raw, 'cm', contexto, '', nomeMunicipios), nomeMunicipios, (json) => store.ingerirMunicipios(eleicao.codigo, json, nomeMunicipios));

      const ufs = store.listarUfs(eleicao.codigo).map((uf) => uf.sigla);
      const abrangencias = ufs.length > 0 ? ufs : [];
      const nomeBrasil = `br-e${codigoArquivo}-ab.json`;
      await obterJson(store, etags, tentarAusentes, 'Acompanhamento', urlArquivo(origem, raw, 'ab', contexto, 'br', nomeBrasil), nomeBrasil, (json) => store.ingerirAcompanhamento(json, nomeBrasil));
      for (const uf of abrangencias) {
        const nome = `${uf}-e${codigoArquivo}-ab.json`;
        await obterJson(store, etags, tentarAusentes, 'Acompanhamento', urlArquivo(origem, raw, 'ab', contexto, uf, nome), nome, (json) => store.ingerirAcompanhamento(json, nome));
      }

      const municipal = eleicao.tipo.codigo === 3 || eleicao.tipo.codigo === 4;
      for (const cargo of eleicao.cargos) {
        if (cargo.codigo === '0008') {
          distritais.push({ contexto, codigoArquivo });
          continue;
        }
        if (municipal) {
          for (const uf of abrangencias) {
            const capital = store.listarMunicipios(eleicao.codigo, uf).map(([, item]) => item).find((item) => item?.capital);
            if (!capital) continue;
            await baixarResultadoMunicipal(store, origem, etags, tentarAusentes, eleicao.codigo, cargo.codigo, uf, capital.codigo);
          }
          continue;
        }
        const grupo = `resultado:${eleicao.codigo}:${cargo.codigo}`;
        if (tentarAusentes) store.arquivosAusentes.delete(grupo);
        if (store.arquivosAusentes.has(grupo)) continue;
        const ufsDoCargo = abrangencias.filter((uf) => uf !== 'br' && uf !== 'zz');
        const alvo = cargo.codigo === '0001' ? ['br', ...ufsDoCargo] : abrangencias;
        for (const uf of alvo) {
          const nome = `${uf}-c${cargo.codigo}-e${codigoArquivo}-u.json`;
          const status = await obterJson(store, etags, tentarAusentes, 'Resultado', urlArquivo(origem, raw, 'u', contexto, uf, nome), nome, (json) => store.ingerirResultado(json, nome));
          if (status === 404 && (cargo.codigo !== '0001' || uf === 'br')) {
            store.marcarAusente(grupo, 'Resultado');
            break;
          }
        }
      }
    }
    for (const item of distritais) {
      store.arquivosAusentes.delete(`resultado:${item.contexto.eleicao}:0008`);
      const nome = `df-c0008-e${item.codigoArquivo}-u.json`;
      await obterJson(store, etags, tentarAusentes, 'Resultado', urlArquivo(origem, raw, 'u', item.contexto, 'df', nome), nome, (json) => store.ingerirResultado(json, nome));
    }
    store.origemOk = true;
    store.ultimoCiclo = new Date().toISOString();
  } finally {
    store.executando = false;
  }
}

async function obterJson(store: ElectionStore, etags: Map<string, string>, tentarAusentes: boolean, tipo: string, url: string | null, nome: string, ingerir: (json: any) => void): Promise<number> {
  if (!url) return 0;
  if (store.arquivosAusentes.has(nome) && !tentarAusentes) return 404;
  const resposta = await baixar(url, etags);
  if (resposta.status === 304) {
    store.marcarVerificado(nome);
    return 304;
  }
  if (resposta.status === 404) {
    store.marcarAusente(nome, tipo);
    return 404;
  }
  if (resposta.status === 200 && resposta.json) {
    ingerir(resposta.json);
    return 200;
  }
  return resposta.status;
}

async function baixar(url: string, etags: Map<string, string>): Promise<{ status: number; json?: any }> {
  return naFila(() => buscar(url, etags));
}

async function buscar(url: string, etags: Map<string, string>): Promise<{ status: number; json?: any }> {
  const etag = etags.get(url);
  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'eleicoes-api/0.1' };
  if (etag) headers['If-None-Match'] = etag;
  const resposta = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const novo = resposta.headers.get('etag');
  if (novo) etags.set(url, novo);
  if (resposta.status === 304 || resposta.status === 404) return { status: resposta.status };
  if (!resposta.ok) return { status: resposta.status };
  return { status: 200, json: await resposta.json() };
}

function localizar(raw: any, codigo: string) {
  for (const pleito of raw.pl ?? []) {
    for (const eleicao of pleito.e ?? []) {
      if (String(eleicao.cd) === codigo) return { ciclo: pleito.c ?? raw.c, eleicao: String(eleicao.cd), pleito: String(pleito.cd) };
    }
  }
  return null;
}

export async function baixarResultadoUf(store: ElectionStore, origem: OrigemTse, etags: Map<string, string>, tentarAusentes: boolean, eleicao: string, cargo: string, uf: string): Promise<number> {
  const raw = store.catalogoRaw;
  const contexto = raw ? localizar(raw, eleicao) : null;
  if (!contexto) return 0;
  const sigla = uf.toLowerCase();
  const nome = `${sigla}-c${cargo}-e${pad(eleicao, 6)}-u.json`;
  if (store.resultado(eleicao, cargo, sigla)) return 200;
  return obterJson(store, etags, tentarAusentes, 'Resultado', urlArquivo(origem, raw, 'u', contexto, sigla, nome), nome, (json) => store.ingerirResultado(json, nome));
}

export async function baixarResultadoMunicipal(store: ElectionStore, origem: OrigemTse, etags: Map<string, string>, tentarAusentes: boolean, eleicao: string, cargo: string, uf: string, municipio: string): Promise<number> {
  const raw = store.catalogoRaw;
  const contexto = raw ? localizar(raw, eleicao) : null;
  if (!contexto) return 0;
  const nome = `${uf.toLowerCase()}${municipio}-c${cargo}-e${pad(eleicao, 6)}-u.json`;
  if (store.resultado(eleicao, cargo, municipio)) return 200;
  return obterJson(store, etags, tentarAusentes, 'Resultado', urlArquivo(origem, raw, 'u', contexto, uf.toLowerCase(), nome), nome, (json) => store.ingerirResultado(json, nome));
}

export function urlArquivo(origem: OrigemTse, raw: any, tipo: string, contexto: { ciclo?: string; eleicao: string; pleito: string }, uf: string, arquivo: string): string | null {
  const item = (raw.arq ?? []).find((entrada: { tp?: string }) => entrada.tp === tipo);
  if (!item?.dir || !contexto.ciclo) return null;
  const diretorio = String(item.dir)
    .replaceAll('<base>', origem.base)
    .replaceAll('<ambiente>', origem.ambiente)
    .replaceAll('<ciclo>', contexto.ciclo)
    .replaceAll('<cd_eleicao>', contexto.eleicao)
    .replaceAll('<cd_pleito>', contexto.pleito)
    .replaceAll('<uf>', uf);
  if (diretorio.includes('<')) return null;
  return `${diretorio}/${arquivo}`;
}

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}
