import { ConflictException, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { Response } from 'express';
import { paginar } from '../common/util';
import { ElectionStore } from '../store/election-store';
import { AgendadorTse } from '../sync/agendador';
import { erro } from './resposta';

@Controller()
export class OutrosController {
  constructor(
    private readonly store: ElectionStore,
    @Inject('STORE_OFICIAL') private readonly oficial: ElectionStore,
    private readonly agendador: AgendadorTse,
  ) {}

  private loja(fase?: string) {
    return fase === 'oficial' ? this.oficial : this.store;
  }

  @Get('saude')
  saude() {
    return {
      status: 'ok',
      fase: this.store.geracaoCatalogo.fase,
      ultimoCiclo: this.store.ultimoCiclo,
      origemOk: this.store.origemOk,
    };
  }

  @Get('sincronizacao')
  sincronizacao(@Query('fase') fase?: string) {
    const loja = this.loja(fase);
    return {
      executando: loja.executando,
      ultimoCiclo: loja.ultimoCiclo,
      fase: loja.geracaoCatalogo.fase,
      regravacoes: loja.regravacoes,
      ausentes: [...loja.arquivosAusentes],
      arquivos: [...loja.arquivos.values()],
    };
  }

  @Post('sincronizacao')
  @HttpCode(202)
  disparar() {
    if (!this.agendador.manual()) {
      throw new ConflictException({ erro: { codigo: 'SINCRONIZACAO_EM_ANDAMENTO', mensagem: 'Já existe um ciclo em execução.' } });
    }
    return { estado: 'executando' };
  }

  @Get('pleitos/:codigo')
  pleito(@Param('codigo') codigo: string) {
    const pleito = this.store.pleito(codigo);
    if (!pleito) erro('NAO_ENCONTRADO', `Pleito ${codigo} não está no catálogo.`, 404);
    return { ...pleito, geracao: this.store.geracaoCatalogo };
  }

  @Get('pleitos')
  pleitos(@Query('data') data?: string, @Query('pagina') pagina?: string, @Query('tamanho') tamanho?: string) {
    let itens = this.store.pleitos;
    if (data) itens = itens.filter((item) => item.data === data);
    return { ...paginar(itens, pagina, tamanho), geracao: this.store.geracaoCatalogo };
  }

  @Get('pleitos/:codigoPleito/ufs/:uf/municipios/:codigoMunicipio/zonas/:zona/secoes/:secao')
  secao() {
    return { auxiliar: null };
  }

  @Get('pleitos/:codigoPleito/ufs/:uf/secoes')
  secoes(@Query('municipio') municipio?: string, @Query('zona') zona?: string) {
    if (!municipio && !zona) erro('PARAMETRO_INVALIDO', 'Informe municipio ou zona para listar seções.', 400);
    return { pagina: 1, tamanho: 50, total: 0, itens: [] };
  }
}
