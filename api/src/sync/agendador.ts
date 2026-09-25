import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ElectionStore } from '../store/election-store';
import { baixarResultadoMunicipal, sincronizarOrigem } from './tse-sync';

@Injectable()
export class AgendadorTse implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private ciclo = 0;
  private rodando = false;
  private readonly etags = new Map<string, string>();

  constructor(
    private readonly simulado: ElectionStore,
    @Inject('STORE_OFICIAL') private readonly oficial: ElectionStore,
  ) {}

  onModuleInit() {
    if (process.env.JEST_WORKER_ID || process.env.SYNC_HABILITADO === 'false') return;
    const intervalo = Number(process.env.SYNC_INTERVALO_SEG ?? 300) * 1000;
    this.disparar();
    this.timer = setInterval(() => this.disparar(), intervalo);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  manual(): boolean {
    return this.iniciar(true);
  }

  garantirMunicipal(fase: string | undefined, eleicao: string, cargo: string, uf: string, municipio: string): Promise<number> {
    const oficial = fase === 'oficial';
    return baixarResultadoMunicipal(oficial ? this.oficial : this.simulado, oficial ? this.origemOficial() : this.origemSimulado(), this.etags, true, eleicao, cargo, uf, municipio);
  }

  private origemSimulado() {
    return {
      base: process.env.TSE_SIMULADO_BASE ?? 'https://resultados-sim.tse.jus.br/simulado',
      ambiente: process.env.TSE_SIMULADO_AMBIENTE ?? 'simulado2026',
    };
  }

  private origemOficial() {
    return {
      base: process.env.TSE_OFICIAL_BASE ?? 'https://resultados.tse.jus.br',
      ambiente: process.env.TSE_OFICIAL_AMBIENTE ?? 'oficial',
    };
  }

  private disparar() {
    this.ciclo += 1;
    this.iniciar(this.ciclo % 10 === 0);
  }

  private iniciar(tentarAusentes: boolean): boolean {
    if (this.rodando) return false;
    this.rodando = true;
    this.executar(tentarAusentes)
      .catch((erro) => {
        this.simulado.origemOk = false;
        console.error('Falha na sincronização com o TSE', erro);
      })
      .finally(() => {
        this.rodando = false;
      });
    return true;
  }

  private async executar(tentarAusentes: boolean) {
    await sincronizarOrigem(this.simulado, this.origemSimulado(), this.etags, tentarAusentes);
    await sincronizarOrigem(this.oficial, this.origemOficial(), this.etags, tentarAusentes);
  }
}
