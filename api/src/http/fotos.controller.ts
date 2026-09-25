import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { ElectionStore } from '../store/election-store';
import { obterFotoLocal } from '../sync/fotos';

const PASTA = process.env.FOTOS_DIR ?? join(__dirname, '..', '..', 'data', 'fotos');

@Controller('fotos')
export class FotosController {
  constructor(
    private readonly store: ElectionStore,
    @Inject('STORE_OFICIAL') private readonly oficial: ElectionStore,
  ) {}

  @Get(':fase/:eleicao/:uf/:arquivo')
  async foto(
    @Param('fase') fase: string,
    @Param('eleicao') eleicao: string,
    @Param('uf') uf: string,
    @Param('arquivo') arquivo: string,
    @Res() res: Response,
  ) {
    if (!/^(simulado|oficial)$/.test(fase) || !/^\d{1,6}$/.test(eleicao) || !/^[a-z]{2}$/.test(uf) || !/^\d+\.jpeg$/.test(arquivo)) {
      res.status(404).end();
      return;
    }
    const destino = join(PASTA, fase, eleicao, uf, arquivo);
    if (existsSync(destino)) {
      res.type('image/jpeg').sendFile(destino);
      return;
    }
    const loja = fase === 'oficial' ? this.oficial : this.store;
    const url = loja.urlFoto(eleicao, uf, arquivo.replace(/\.jpeg$/, ''));
    const baixou = url ? await obterFotoLocal(url, destino, false) : false;
    if (!baixou || !existsSync(destino)) {
      res.status(404).end();
      return;
    }
    res.type('image/jpeg').sendFile(destino);
  }
}
