import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ElectionStore } from './election-store';

export function carregarAmostras(store: ElectionStore, diretorio: string): void {
  const ler = (nome: string) => JSON.parse(readFileSync(join(diretorio, nome), 'utf8'));
  store.ingerirCatalogo(ler('ele-c.json'));
  for (const nome of readdirSync(diretorio)) {
    if (nome.startsWith('mun-') && nome.endsWith('-cm.json')) {
      const raw = ler(nome);
      const codigo = nome.match(/mun-e0*(\d+)-cm\.json/)?.[1];
      if (codigo) store.ingerirMunicipios(codigo, raw, nome);
    } else if (nome.endsWith('-ab.json')) {
      store.ingerirAcompanhamento(ler(nome), nome);
    } else if (nome.endsWith('-u.json')) {
      store.ingerirResultado(ler(nome), nome);
    }
  }
  store.ultimoCiclo = new Date().toISOString();
  store.origemOk = true;
}
