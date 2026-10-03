import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { paginar, semAcento } from '../common/util';
import { Eleicao } from '../store/model';
import { ElectionStore } from '../store/election-store';
import { ChaveEleicao, SelecaoEleicoes } from '../store/selecao-eleicoes';
import { AgendadorTse } from '../sync/agendador';
import { ordenarCandidatos } from '../store/parse';
import { enviar, erro } from './resposta';

@Controller('eleicoes')
export class EleicoesController {
  constructor(
    private readonly store: ElectionStore,
    @Inject('STORE_OFICIAL') private readonly oficial: ElectionStore,
    private readonly agendador: AgendadorTse,
    private readonly selecao: SelecaoEleicoes,
  ) {}

  private loja(fase?: string) {
    return fase === 'oficial' ? this.oficial : this.store;
  }

  @Get('gestao')
  gestao() {
    return { itens: this.catalogoCompleto() };
  }

  @Post('gestao')
  @HttpCode(200)
  salvarGestao(@Body() corpo: { ativas?: Array<{ fase?: string; codigo?: string }> }) {
    if (!Array.isArray(corpo?.ativas)) erro('PARAMETRO_INVALIDO', 'Informe a lista de eleições ativas.', 400);
    const ativas: ChaveEleicao[] = [];
    for (const item of corpo.ativas) {
      if (item?.fase !== 'simulado' && item?.fase !== 'oficial') erro('PARAMETRO_INVALIDO', 'Cada eleição precisa da fase simulado ou oficial.', 400);
      if (!/^\d+$/.test(String(item.codigo ?? ''))) erro('PARAMETRO_INVALIDO', 'Cada eleição precisa de um código numérico.', 400);
      ativas.push({ fase: item.fase, codigo: String(item.codigo) });
    }
    this.selecao.aplicar(this.catalogoCompleto(), ativas);
    return { itens: this.catalogoCompleto() };
  }

  @Get()
  listar(@Query('turno') turno?: string, @Query('tipo') tipo?: string, @Query('pleito') pleito?: string, @Query('pagina') pagina?: string, @Query('tamanho') tamanho?: string, @Query('fase') fase?: string) {
    const loja = this.loja(fase);
    let itens = loja.eleicoes.filter((item) => this.selecao.ativa(loja.geracaoCatalogo.fase, item.codigo)).map(resumo);
    if (turno) itens = itens.filter((item) => item.turno === Number(turno));
    if (tipo) itens = itens.filter((item) => item.tipo.codigo === Number(tipo));
    if (pleito) itens = itens.filter((item) => item.pleito.codigo === pleito);
    return { ...paginar(itens, pagina, tamanho), geracao: loja.geracaoCatalogo };
  }

  @Get(':codigo/painel')
  painel(@Param('codigo') codigo: string, @Query('uf') uf: string | undefined, @Query('fase') fase: string | undefined, @Res() res: Response) {
    const loja = this.loja(fase);
    const eleicao = this.exigirEleicao(codigo, fase);
    const item = uf
      ? loja.acompanhamentoDe(codigo, 'uf', uf.toLowerCase())
      : loja.acompanhamentoDe(codigo, 'br');
    if (!item) erro('NAO_PUBLICADO', `Acompanhamento da eleição ${codigo} ainda não foi publicado.`, 404);
    enviar(res, {
      geracao: item!.geracao,
      eleicao: { codigo: eleicao.codigo, nome: eleicao.nome, turno: eleicao.turno },
      cargos: eleicao.cargos,
      acompanhamento: resumirPainel(item!),
    }, item!.geracao.id);
  }

  @Get(':codigo/acompanhamento/ufs/:uf/municipios')
  municipiosAcompanhamento(
    @Param('codigo') codigo: string,
    @Param('uf') uf: string,
    @Query('andamento') filtro?: string,
    @Query('pagina') pagina?: string,
    @Query('tamanho') tamanho?: string,
  ) {
    this.exigirEleicao(codigo);
    let itens = this.store.acompanhamentos(codigo, 'mun').filter((item) => this.municipioNaUf(codigo, item.codigo, uf));
    if (filtro) itens = itens.filter((item) => item.andamento === filtro);
    return paginar(itens, pagina, tamanho);
  }

  @Get(':codigo/acompanhamento/ufs/:uf')
  acompanhamentoUf(@Param('codigo') codigo: string, @Param('uf') uf: string, @Res() res: Response) {
    this.exigirEleicao(codigo);
    const item = this.store.acompanhamentoDe(codigo, 'uf', uf.toLowerCase());
    if (!item) erro('NAO_PUBLICADO', `Acompanhamento da UF ${uf} ainda não foi publicado.`, 404);
    enviar(res, item, item!.geracao.id);
  }

  @Get(':codigo/acompanhamento/ufs')
  acompanhamentoUfs(@Param('codigo') codigo: string, @Query('pagina') pagina?: string, @Query('tamanho') tamanho?: string) {
    this.exigirEleicao(codigo);
    const itens = this.store.acompanhamentos(codigo, 'uf').map((item) => ({
      andamento: item.andamento,
      tipo: item.tipo,
      codigo: item.codigo,
      atualizadoEm: item.atualizadoEm,
      secoes: item.secoes,
      eleitorado: item.eleitorado,
      geracao: item.geracao,
    }));
    return paginar(itens, pagina, tamanho);
  }

  @Get(':codigo/acompanhamento/municipios/:codigoMunicipio')
  acompanhamentoMunicipio(@Param('codigo') codigo: string, @Param('codigoMunicipio') codigoMunicipio: string, @Res() res: Response) {
    this.exigirEleicao(codigo);
    const item = this.store.acompanhamentoDe(codigo, 'mun', codigoMunicipio);
    if (!item) erro('NAO_ENCONTRADO', `Município ${codigoMunicipio} não está no acompanhamento da eleição ${codigo}.`, 404);
    enviar(res, item, item!.geracao.id);
  }

  @Get(':codigo/acompanhamento')
  acompanhamento(@Param('codigo') codigo: string, @Res() res: Response) {
    this.exigirEleicao(codigo);
    const item = this.store.acompanhamentoDe(codigo, 'br');
    if (!item) erro('NAO_PUBLICADO', `Acompanhamento da eleição ${codigo} ainda não foi publicado.`, 404);
    enviar(res, item, item!.geracao.id);
  }

  @Get(':codigo/resultados/:cargo/candidatos/:sequencial')
  async candidato(
    @Param('codigo') codigo: string,
    @Param('cargo') cargo: string,
    @Param('sequencial') sequencial: string,
    @Query('uf') uf: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.buscarResultado(codigo, cargo, uf);
    const candidato = resultado.candidatos.find((item) => item.sequencial === sequencial);
    if (!candidato) erro('NAO_ENCONTRADO', `Candidato ${sequencial} não está nesse resultado.`, 404);
    enviar(res, { geracao: resultado.geracao, candidato, votos: resultado.votos, cargo: resultado.cargo }, resultado.geracao.id);
  }

  @Get(':codigo/resultados/:cargo')
  async resultado(
    @Param('codigo') codigo: string,
    @Param('cargo') cargo: string,
    @Query('uf') uf: string | undefined,
    @Query('municipio') municipio: string | undefined,
    @Query('ordem') ordem: string | undefined,
    @Query('fase') fase: string | undefined,
    @Res() res: Response,
  ) {
    const resultado = await this.buscarResultado(codigo, cargo, uf, fase, municipio);
    const corpo = { ...resultado, candidatos: ordenarCandidatos(resultado.candidatos, ordem) };
    enviar(res, corpo, resultado.geracao.id);
  }

  @Get(':codigo/eleitos')
  eleitos(@Param('codigo') codigo: string) {
    this.exigirEleicao(codigo);
    erro('NAO_PUBLICADO', `Arquivo de eleitos da eleição ${codigo} ainda não foi publicado.`, 404);
  }

  @Get(':codigo/ufs/:uf/municipios')
  municipios(
    @Param('codigo') codigo: string,
    @Param('uf') uf: string,
    @Query('capital') capital?: string,
    @Query('nome') nome?: string,
    @Query('pagina') pagina?: string,
    @Query('tamanho') tamanho?: string,
    @Query('fase') fase?: string,
  ) {
    const loja = this.loja(fase);
    this.exigirEleicao(codigo, fase);
    let itens = loja.listarMunicipios(codigo, uf.toLowerCase()).map(([, mun]) => mun!).filter(Boolean);
    if (capital === 'true') itens = itens.filter((mun) => mun.capital);
    if (capital === 'false') itens = itens.filter((mun) => !mun.capital);
    if (nome) {
      const alvo = semAcento(nome);
      itens = itens.filter((mun) => semAcento(mun.nome).includes(alvo));
    }
    return paginar(itens.map(({ geracao, ...mun }) => mun), pagina, tamanho);
  }

  @Get(':codigo/ufs')
  ufs(@Param('codigo') codigo: string, @Query('fase') fase?: string) {
    const loja = this.loja(fase);
    this.exigirEleicao(codigo, fase);
    const ufs = loja.listarUfs(codigo);
    if (ufs.length === 0) erro('NAO_PUBLICADO', `Municípios da eleição ${codigo} ainda não foram publicados.`, 404);
    return { itens: ufs.map(({ sigla, nome }) => ({ sigla, nome })), geracao: ufs[0].geracao };
  }

  @Get(':codigo/municipios/:codigoMunicipio')
  municipio(@Param('codigo') codigo: string, @Param('codigoMunicipio') codigoMunicipio: string) {
    this.exigirEleicao(codigo);
    const mun = this.store.municipio(codigo, codigoMunicipio);
    if (!mun) erro('NAO_ENCONTRADO', `Município ${codigoMunicipio} não está na eleição ${codigo}.`, 404);
    const { geracao, ...resto } = mun!;
    return { ...resto, geracao };
  }

  @Get(':codigo')
  detalhe(@Param('codigo') codigo: string) {
    const eleicao = this.exigirEleicao(codigo);
    return { ...eleicao, geracao: this.store.geracaoCatalogo };
  }

  private catalogoCompleto() {
    return [
      ...this.store.eleicoes.map((item) => itemGestao(item, 'simulado', this.selecao)),
      ...this.oficial.eleicoes.map((item) => itemGestao(item, 'oficial', this.selecao)),
    ];
  }

  private exigirEleicao(codigo: string, fase?: string) {
    const loja = this.loja(fase);
    const eleicao = loja.eleicao(codigo);
    if (!eleicao) erro('NAO_ENCONTRADO', `Eleição ${codigo} não está no catálogo da fase ${loja.geracaoCatalogo.fase}.`, 404);
    if (!this.selecao.ativa(loja.geracaoCatalogo.fase, codigo)) erro('NAO_ENCONTRADO', `Eleição ${codigo} não está ativa.`, 404);
    return eleicao!;
  }

  private async buscarResultado(codigo: string, cargo: string, uf?: string, fase?: string, municipio?: string) {
    const loja = this.loja(fase);
    const eleicao = this.exigirEleicao(codigo, fase);
    if (!/^\d{4}$/.test(cargo)) erro('PARAMETRO_INVALIDO', 'Cargo deve ter 4 dígitos.', 400);
    const municipal = eleicao.tipo.codigo === 3 || eleicao.tipo.codigo === 4;
    if (municipal) {
      if (!uf) erro('PARAMETRO_INVALIDO', 'Informe a UF para esta eleição.', 400);
      const informado = municipio?.trim();
      const capital = informado
        ? undefined
        : loja.listarMunicipios(codigo, uf.toLowerCase()).map(([, item]) => item).find((item) => item?.capital);
      if (!informado && !capital) erro('NAO_PUBLICADO', `Capital de ${uf.toUpperCase()} ainda não está disponível para esta eleição.`, 404);
      const codigoMunicipio = (informado || capital!.codigo).padStart(5, '0');
      if (!loja.resultado(codigo, cargo, codigoMunicipio)) {
        await this.agendador.garantirMunicipal(fase, codigo, cargo, uf, codigoMunicipio);
      }
      const resultado = loja.resultado(codigo, cargo, codigoMunicipio);
      if (!resultado) erro('NAO_PUBLICADO', `Resultado do cargo ${cargo} em ${uf.toUpperCase()} ${codigoMunicipio} ainda não foi publicado.`, 404);
      return loja.aplicarFotos(resultado!);
    }
    const abrangencia = uf ? uf.toLowerCase() : 'br';
    if (!uf && !loja.resultado(codigo, cargo, 'br')) {
      erro('PARAMETRO_INVALIDO', `Informe a UF para o cargo ${cargo}.`, 400);
    }
    const resultado = loja.resultado(codigo, cargo, abrangencia);
    if (!resultado) erro('NAO_PUBLICADO', `Resultado do cargo ${cargo} na eleição ${codigo} ainda não foi publicado.`, 404);
    return loja.aplicarFotos(resultado!);
  }

  private municipioNaUf(eleicao: string, codigo: string | undefined, uf: string) {
    if (!codigo) return false;
    const mun = this.store.municipio(eleicao, codigo);
    return mun?.uf.sigla === uf.toLowerCase();
  }
}

function anoDaEleicao(eleicao: { nome: string; pleito: { data?: string; ciclo?: string } }) {
  return eleicao.pleito.ciclo?.match(/20\d{2}/)?.[0]
    ?? eleicao.pleito.data?.match(/20\d{2}/)?.[0]
    ?? eleicao.nome.match(/20\d{2}/)?.[0]
    ?? '';
}

function itemGestao(eleicao: Eleicao, fase: 'simulado' | 'oficial', selecao: SelecaoEleicoes) {
  return {
    ...resumo(eleicao),
    fase,
    ano: anoDaEleicao(eleicao),
    origem: fase === 'oficial' ? 'oficial/ele-c.json' : 'simulado/ele-c.json',
    ativa: selecao.ativa(fase, eleicao.codigo),
  };
}

function resumo(eleicao: { codigo: string; codigoSegundoTurno?: string; sequencial?: string; nome: string; turno: number; tipo: { codigo: number; descricao: string }; pleito: { codigo: string; data?: string; dataLimiteDivulgacao?: string; ciclo?: string }; cargos: unknown[] }) {
  return {
    codigo: eleicao.codigo,
    codigoSegundoTurno: eleicao.codigoSegundoTurno,
    sequencial: eleicao.sequencial,
    nome: eleicao.nome,
    turno: eleicao.turno,
    tipo: eleicao.tipo,
    pleito: eleicao.pleito,
    cargos: eleicao.cargos,
  };
}

function resumirPainel(item: { andamento?: string; tipo?: string; codigo?: string; atualizadoEm?: { data?: string; hora?: string }; secoes?: Record<string, number | undefined>; eleitorado?: Record<string, number | undefined> }) {
  const secoes = item.secoes ?? {};
  const eleitorado = item.eleitorado ?? {};
  return {
    andamento: item.andamento,
    tipo: item.tipo,
    codigo: item.codigo,
    atualizadoEm: item.atualizadoEm,
    secoes: {
      total: secoes.total,
      totalizadas: secoes.totalizadas,
      totalizadasPercentual: secoes.totalizadasPercentual,
      naoTotalizadas: secoes.naoTotalizadas,
      instaladas: secoes.instaladas,
      naoInstaladas: secoes.naoInstaladas,
      apuradas: secoes.apuradas,
      naoApuradas: secoes.naoApuradas,
    },
    eleitorado: {
      total: eleitorado.total,
      comparecimento: eleitorado.comparecimento,
      comparecimentoPercentual: eleitorado.comparecimentoPercentual,
      abstencao: eleitorado.abstencao,
      abstencaoPercentual: eleitorado.abstencaoPercentual,
    },
  };
}
