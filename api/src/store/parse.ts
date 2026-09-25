import { andamento, decodeHtml, faseNome, num, pad, tipoAbrangencia } from '../common/util';
import { Acompanhamento, Candidato, Contagem, Eleicao, Geracao, Municipio, Pleito, Resultado } from './model';

const TIPO_ELEICAO: Record<number, string> = {
  1: 'Estadual ordinária',
  2: 'Estadual suplementar',
  3: 'Municipal ordinária',
  4: 'Municipal suplementar',
  5: 'Consulta popular nacional',
  6: 'Consulta popular estadual',
  7: 'Consulta popular municipal',
  8: 'Federal ordinária',
  9: 'Federal suplementar',
};

const TIPO_CARGO: Record<string, 'majoritario' | 'proporcional' | 'consulta'> = {
  '1': 'majoritario',
  '2': 'proporcional',
  '3': 'consulta',
};

export function geracaoDe(raw: { dg?: string; hg?: string; idg?: string; f?: string }): Geracao {
  return {
    data: raw.dg,
    hora: raw.hg,
    id: raw.idg ?? null,
    fase: faseNome(raw.f),
  };
}

export function parseCatalogo(raw: any): { geracao: Geracao; pleitos: Pleito[]; eleicoes: Eleicao[] } {
  const cicloRaiz = raw.c as string | undefined;
  const pleitos: Pleito[] = [];
  const eleicoes: Eleicao[] = [];

  for (const pl of raw.pl ?? []) {
    const ciclo = pl.c ?? cicloRaiz;
    const resumo = [];
    for (const e of pl.e ?? []) {
      const cargos = cargosDaEleicao(e);
      const tipoCodigo = Number(e.tp);
      const eleicao: Eleicao = {
        codigo: String(e.cd),
        nome: decodeHtml(String(e.nm ?? '')),
        turno: Number(e.t),
        tipo: { codigo: tipoCodigo, descricao: TIPO_ELEICAO[tipoCodigo] ?? String(e.tp) },
        pleito: {
          codigo: String(pl.cd),
          data: pl.dt,
          dataLimiteDivulgacao: pl.dtlim,
          ciclo,
        },
        cargos,
        abrangencias: (e.abr ?? []).map((abr: any) => ({
          codigo: String(abr.cd),
          municipios: abr.mu?.map((mu: any) => ({
            codigo: String(mu.cd),
            codigoIbge: mu.cdi ? String(mu.cdi) : undefined,
          })),
        })),
      };
      if (e.cdt2) eleicao.codigoSegundoTurno = String(e.cdt2);
      if (e.sqele) eleicao.sequencial = String(e.sqele);
      eleicoes.push(eleicao);
      resumo.push({ codigo: eleicao.codigo, nome: eleicao.nome, turno: eleicao.turno, tipo: eleicao.tipo });
    }
    pleitos.push({
      codigo: String(pl.cd),
      processoEleitoral: pl.cdpr ? String(pl.cdpr) : undefined,
      ciclo,
      data: pl.dt,
      dataLimiteDivulgacao: pl.dtlim,
      eleicoes: resumo,
    });
  }

  return { geracao: geracaoDe(raw), pleitos, eleicoes };
}

function cargosDaEleicao(eleicao: any) {
  const vistos = new Map<string, { codigo: string; nome: string; tipo: 'majoritario' | 'proporcional' | 'consulta' }>();
  for (const abr of eleicao.abr ?? []) {
    for (const cp of abr.cp ?? []) {
      const codigo = pad(cp.cd, 4);
      if (!vistos.has(codigo)) {
        vistos.set(codigo, {
          codigo,
          nome: decodeHtml(String(cp.ds ?? '')),
          tipo: TIPO_CARGO[String(cp.tp)] ?? 'majoritario',
        });
      }
    }
  }
  return [...vistos.values()];
}

export function parseMunicipios(raw: any): { geracao: Geracao; ufs: Array<{ sigla: string; nome: string }>; municipios: Municipio[] } {
  const ufs: Array<{ sigla: string; nome: string }> = [];
  const municipios: Municipio[] = [];
  for (const abr of raw.abr ?? []) {
    const uf = { sigla: String(abr.cd), nome: String(abr.ds ?? '') };
    ufs.push(uf);
    for (const mu of abr.mu ?? []) {
      municipios.push({
        codigo: String(mu.cd),
        codigoIbge: mu.cdi ? String(mu.cdi) : undefined,
        nome: String(mu.nm ?? ''),
        capital: mu.c === 's',
        zonas: (mu.z ?? []).map(String),
        uf,
      });
    }
  }
  return { geracao: geracaoDe(raw), ufs, municipios };
}

function mapPares(origem: any, pares: Array<[string, string, string?]>): Contagem | undefined {
  if (!origem) return undefined;
  const saida: Contagem = {};
  for (const [campo, nome, percentual] of pares) {
    if (origem[campo] !== undefined) saida[nome] = num(origem[campo]);
    if (percentual && origem[percentual] !== undefined) saida[`${nome}Percentual`] = num(origem[percentual]);
  }
  return saida;
}

const SECOES: Array<[string, string, string?]> = [
  ['ts', 'total'],
  ['st', 'totalizadas', 'pstn'],
  ['snt', 'naoTotalizadas', 'psntn'],
  ['si', 'instaladas', 'psin'],
  ['sni', 'naoInstaladas', 'psnin'],
  ['sa', 'apuradas', 'psan'],
  ['sna', 'naoApuradas', 'psnan'],
];

const ELEITORADO: Array<[string, string, string?]> = [
  ['te', 'total'],
  ['est', 'emSecoesTotalizadas', 'pestn'],
  ['esnt', 'emSecoesNaoTotalizadas', 'pesntn'],
  ['esi', 'emSecoesInstaladas', 'pesin'],
  ['esni', 'emSecoesNaoInstaladas', 'pesnin'],
  ['esa', 'emSecoesApuradas', 'pesan'],
  ['esna', 'emSecoesNaoApuradas', 'pesnan'],
  ['c', 'comparecimento', 'pcn'],
  ['a', 'abstencao', 'pan'],
];

export function parseAcompanhamento(raw: any): Acompanhamento[] {
  const geracao = geracaoDe(raw);
  return (raw.abr ?? []).map((abr: any) => {
    const tipo = tipoAbrangencia(abr.tpabr);
    const item: Acompanhamento = {
      geracao,
      andamento: andamento(abr.and),
      tipo,
      codigo: abr.cdabr ? String(abr.cdabr) : undefined,
      atualizadoEm: abr.dt || abr.ht ? { data: abr.dt, hora: abr.ht } : undefined,
      secoes: mapPares(abr.s, SECOES),
      eleitorado: mapPares(abr.e, ELEITORADO),
    };
    if (abr.tpabr === 'br') {
      item.ufs = mapPares(abr, [
        ['ufsnr', 'naoIniciadas', 'pufsnrn'],
        ['ufspt', 'emAndamento', 'pufsptn'],
        ['ufsf', 'finalizadas', 'pufsfn'],
      ]);
    }
    if (abr.tpabr === 'uf') {
      item.municipios = mapPares(abr, [
        ['munnr', 'naoIniciados', 'pmunnrn'],
        ['munpt', 'emAndamento', 'pmunptn'],
        ['munf', 'finalizados', 'pmunfn'],
      ]);
    }
    return item;
  });
}

const VICE: Record<string, string> = { v: 'vice', s1: 'primeiro_suplente', s2: 'segundo_suplente' };
const AGR: Record<string, string> = { i: 'partido', f: 'federacao', c: 'coligacao' };

const VOTOS: Array<[string, string, string?]> = [
  ['tv', 'total'],
  ['vvc', 'validosComputados', 'pvvcn'],
  ['vv', 'validos', 'pvvn'],
  ['vnom', 'nominais', 'pvnomn'],
  ['van', 'anulados', 'pvann'],
  ['vansj', 'anuladosSubJudice', 'pvansjn'],
  ['vb', 'brancos', 'pvbn'],
  ['vn', 'nulos', 'pvnn'],
  ['vnt', 'nulosTecnicos', 'pvntn'],
  ['vsan', 'vsan'],
  ['vscv', 'vscv'],
];

export function parseResultado(raw: any, fotoBase?: string): Resultado {
  const carg = raw.carg?.[0] ?? {};
  const candidatos: Candidato[] = [];
  const agrupamentos = (carg.agr ?? []).map((agr: any) => {
    const agrupamento = {
      numero: agr.n ? String(agr.n) : undefined,
      nome: agr.nm,
      tipo: AGR[agr.tp] ?? agr.tp,
      composicao: agr.com,
      votosNominais: num(agr.tvtn),
      votosAtribuidos: num(agr.tvan),
      vagas: agr.vag !== undefined ? num(agr.vag) : undefined,
      partidos: [] as Array<Record<string, unknown>>,
    };
    agrupamento.partidos = (agr.par ?? []).map((par: any) => {
      const partido = {
        numero: par.n ? String(par.n) : undefined,
        sigla: par.sg,
        nome: par.nm,
        federacao: par.nfed ? String(par.nfed) : undefined,
        votosNominais: num(par.tvtn),
        votosAtribuidos: num(par.tvan),
      };
      for (const cand of par.cand ?? []) {
        candidatos.push(mapCandidato(cand, partido, agrupamento, fotoBase));
      }
      return partido;
    });
    return agrupamento;
  });

  const votos = mapPares(raw.v, VOTOS) ?? {};
  if (raw.v?.tvn !== undefined && num(raw.v.tvn) !== votos.nulos) {
    votos.nulosTotal = num(raw.v.tvn);
  }

  return {
    geracao: geracaoDe(raw),
    eleicao: String(raw.ele),
    turno: raw.t !== undefined ? Number(raw.t) : undefined,
    abrangencia: { tipo: tipoAbrangencia(raw.tpabr), codigo: raw.cdabr ? String(raw.cdabr) : undefined },
    cargo: {
      codigo: pad(carg.cd, 4),
      nome: carg.nmn,
      nomeMasculino: carg.nmm,
      nomeFeminino: carg.nmf,
      vagas: num(carg.nv),
    },
    atualizadoEm: raw.dt || raw.ht ? { data: raw.dt, hora: raw.ht } : undefined,
    andamento: andamento(raw.and),
    totalizacaoFinal: raw.tf === undefined ? undefined : raw.tf === 's',
    votosDivulgados: raw.dv === undefined ? undefined : raw.dv === 's',
    suplementar: raw.sup === undefined ? undefined : raw.sup === 's',
    semAtribuicaoDeEleito: raw.esae === undefined ? undefined : raw.esae === 's',
    motivosSemAtribuicao: raw.mnae,
    apuracao: { secoes: mapPares(raw.s, SECOES), eleitorado: mapPares(raw.e, ELEITORADO) },
    votos,
    federacoes: (carg.fed ?? []).map((fed: any) => ({
      numero: fed.n ? String(fed.n) : undefined,
      sigla: fed.sg,
      nome: fed.nm,
      composicao: fed.com,
      partidos: (fed.npar ?? []).map(String),
    })),
    agrupamentos,
    candidatos,
  };
}

function mapCandidato(cand: any, partido: { numero?: string; sigla?: string; nome?: string }, agrupamento: { numero?: string; nome?: string; tipo?: string }, fotoBase?: string): Candidato {
  const sequencial = cand.sqcand ? String(cand.sqcand) : undefined;
  return {
    numero: cand.n ? String(cand.n) : undefined,
    sequencial,
    nome: cand.nm,
    nomeUrna: cand.nmu,
    nascimento: cand.dt,
    destinacao: cand.dvt,
    ordem: num(cand.seq),
    eleito: cand.e === 's',
    situacao: cand.st,
    votos: num(cand.vap),
    votosPercentual: num(cand.pvapn),
    partido: { numero: partido.numero, sigla: partido.sigla, nome: partido.nome },
    agrupamento: { numero: agrupamento.numero, nome: agrupamento.nome, tipo: agrupamento.tipo },
    vices: (cand.vs ?? []).map((vs: any) => ({
      tipo: VICE[vs.tp] ?? vs.tp,
      sequencial: vs.sqcand ? String(vs.sqcand) : undefined,
      nome: vs.nm,
      nomeUrna: vs.nmu,
      partido: vs.sgp,
    })),
    fotoUrl: fotoBase && sequencial ? `${fotoBase}/${sequencial}.jpeg` : undefined,
  };
}

export function ordenarCandidatos(lista: Candidato[], ordem: string | undefined): Candidato[] {
  const copia = [...lista];
  if (ordem === 'sequencia') {
    copia.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    return copia;
  }
  copia.sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0) || (a.ordem ?? 0) - (b.ordem ?? 0));
  return copia;
}
