import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErroFilter } from './http/exception.filter';
import { EleicoesController } from './http/eleicoes.controller';
import { FotosController } from './http/fotos.controller';
import { OutrosController } from './http/outros.controller';
import { ElectionStore } from './store/election-store';
import { carregarAmostras } from './store/load-samples';
import { AgendadorTse } from './sync/agendador';
import { join } from 'path';

const raizAmostras = join(__dirname, '..', '..', 'samples', 'tse');
const store = new ElectionStore();
const storeOficial = new ElectionStore();
carregarAmostras(store, process.env.SAMPLES_DIR ?? join(raizAmostras, 'simulado2026'));
carregarAmostras(storeOficial, process.env.SAMPLES_OFICIAL_DIR ?? raizAmostras);

@Module({
  controllers: [EleicoesController, OutrosController, FotosController],
  providers: [
    ErroFilter,
    { provide: ElectionStore, useValue: store },
    { provide: 'STORE_OFICIAL', useValue: storeOficial },
    AgendadorTse,
    { provide: APP_FILTER, useClass: ErroFilter },
  ],
})
export class AppModule {}
