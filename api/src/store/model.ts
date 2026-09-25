export interface Geracao {
  data?: string;
  hora?: string;
  id: string | null;
  fase: 'simulado' | 'oficial';
}

export interface Cargo {
  codigo: string;
  nome: string;
  tipo: 'majoritario' | 'proporcional' | 'consulta';
}

export interface Eleicao {
  codigo: string;
  codigoSegundoTurno?: string;
  sequencial?: string;
  nome: string;
  turno: number;
  tipo: { codigo: number; descricao: string };
  pleito: { codigo: string; data?: string; dataLimiteDivulgacao?: string; ciclo?: string };
  cargos: Cargo[];
  abrangencias: Array<{ codigo: string; municipios?: Array<{ codigo: string; codigoIbge?: string }> }>;
}

export interface Pleito {
  codigo: string;
  processoEleitoral?: string;
  ciclo?: string;
  data?: string;
  dataLimiteDivulgacao?: string;
  eleicoes: Array<{ codigo: string; nome: string; turno: number; tipo: { codigo: number; descricao: string } }>;
}

export interface Municipio {
  codigo: string;
  codigoIbge?: string;
  nome: string;
  capital: boolean;
  zonas: string[];
  uf: { sigla: string; nome: string };
}

export interface Contagem {
  [chave: string]: number | undefined;
}

export interface Acompanhamento {
  geracao: Geracao;
  andamento?: string;
  tipo?: string;
  codigo?: string;
  atualizadoEm?: { data?: string; hora?: string };
  ufs?: Contagem;
  municipios?: Contagem;
  secoes?: Contagem;
  eleitorado?: Contagem;
}

export interface Candidato {
  numero?: string;
  sequencial?: string;
  nome?: string;
  nomeUrna?: string;
  nascimento?: string;
  destinacao?: string;
  ordem?: number;
  eleito: boolean;
  situacao?: string;
  votos?: number;
  votosPercentual?: number;
  partido?: { numero?: string; sigla?: string; nome?: string };
  agrupamento?: { numero?: string; nome?: string; tipo?: string };
  vices?: Array<{ tipo: string; sequencial?: string; nome?: string; nomeUrna?: string; partido?: string }>;
  fotoUrl?: string;
}

export interface Resultado {
  geracao: Geracao;
  eleicao: string;
  turno?: number;
  abrangencia: { tipo?: string; codigo?: string };
  ufFoto?: string;
  cargo: { codigo: string; nome?: string; nomeMasculino?: string; nomeFeminino?: string; vagas?: number };
  atualizadoEm?: { data?: string; hora?: string };
  andamento?: string;
  totalizacaoFinal?: boolean;
  votosDivulgados?: boolean;
  suplementar?: boolean;
  semAtribuicaoDeEleito?: boolean;
  motivosSemAtribuicao?: string[];
  apuracao: { secoes?: Contagem; eleitorado?: Contagem };
  votos: Contagem;
  federacoes: unknown[];
  agrupamentos: unknown[];
  candidatos: Candidato[];
}
