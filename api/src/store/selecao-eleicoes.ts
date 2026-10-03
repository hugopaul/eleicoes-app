export interface ChaveEleicao {
  fase: 'simulado' | 'oficial';
  codigo: string;
}

export class SelecaoEleicoes {
  private inativas = new Set<string>();

  static chave(fase: string, codigo: string) {
    return `${fase}:${codigo}`;
  }

  ativa(fase: string, codigo: string) {
    return !this.inativas.has(SelecaoEleicoes.chave(fase, codigo));
  }

  aplicar(conhecidas: ChaveEleicao[], ativas: ChaveEleicao[]) {
    const permitidas = new Set(ativas.map((item) => SelecaoEleicoes.chave(item.fase, item.codigo)));
    this.inativas = new Set(
      conhecidas
        .filter((item) => !permitidas.has(SelecaoEleicoes.chave(item.fase, item.codigo)))
        .map((item) => SelecaoEleicoes.chave(item.fase, item.codigo)),
    );
  }
}
