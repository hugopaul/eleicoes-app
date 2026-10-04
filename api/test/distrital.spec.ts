import { ElectionStore } from '../src/store/election-store';
import { sincronizarOrigem } from '../src/sync/tse-sync';

const catalogo = {
  dg: '01/01/2026',
  hg: '00:00:00',
  f: 'o',
  idg: '1',
  arq: [
    { tp: 'cm', dir: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/config' },
    { tp: 'ab', dir: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>' },
    { tp: 'u', dir: '<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>' },
  ],
  pl: [{
    cd: '3220',
    c: 'ele2026',
    dt: '04/10/2026',
      e: [{
      cd: '6259',
      nm: 'Eleição Estadual',
      t: '1',
      tp: '1',
      abr: [{
        cd: 'br',
        cp: [
          { cd: '3', ds: 'Governador', tp: '1' },
          { cd: '8', ds: 'Deputado Distrital', tp: '2' },
        ],
      }],
    }, {
      cd: '7000',
      nm: 'Outra estadual',
      t: '1',
      tp: '1',
      abr: [{
        cd: 'br',
        cp: [{ cd: '3', ds: 'Governador', tp: '1' }],
      }],
    }],
  }],
};

function resultado(cargo: string, uf: string, nome: string) {
  return {
    ele: '6259',
    t: '1',
    f: 'o',
    tpabr: 'uf',
    cdabr: uf.toUpperCase(),
    dg: '01/01/2026',
    hg: '00:00:00',
    idg: `${cargo}-${uf}`,
    carg: [{
      cd: cargo,
      nmn: nome,
      agr: [{ par: [{ sg: 'PP', cand: [{ n: '12345', nmu: nome, vap: '10', e: 'n', st: 'Suplente' }] }] }],
    }],
  };
}

describe('deputado distrital', () => {
  const original = global.fetch;

  afterEach(() => {
    global.fetch = original;
  });

  it('cadastra o deputado distrital do DF só depois dos resultados dos demais estados', async () => {
    const pedidos: string[] = [];
    global.fetch = (async (url: string | URL) => {
      const alvo = String(url);
      pedidos.push(alvo);
      const corpo = alvo.endsWith('/ele-c.json')
        ? catalogo
        : alvo.includes('-cm.json')
          ? {
            dg: '01/01/2026', hg: '00:00:00', f: 'o', idg: alvo.includes('006259') ? '2' : '3',
            abr: [
              { cd: 'ac', ds: 'Acre', mu: [] },
              { cd: 'df', ds: 'Distrito Federal', mu: [] },
            ],
          }
          : alvo.includes('ac-c0003-')
            ? resultado('3', 'ac', 'Governador')
            : alvo.includes('df-c0003-')
              ? resultado('3', 'df', 'Governador')
              : alvo.includes('df-c0008-')
                ? resultado('8', 'df', 'Deputado Distrital')
                : null;
      return {
        status: corpo ? 200 : 404,
        ok: Boolean(corpo),
        headers: { get: () => null },
        json: async () => corpo,
      };
    }) as unknown as typeof fetch;

    const store = new ElectionStore();
    store.arquivosAusentes.add('resultado:6259:0008');
    store.arquivosAusentes.add('ac-c0008-e006259-u.json');
    await sincronizarOrigem(store, { base: 'https://origem.test', ambiente: 'oficial' }, new Map(), false);

    const resultados = pedidos.filter((url) => /-c\d{4}-/.test(url));
    const distrital = resultados.findIndex((url) => url.includes('df-c0008-e006259-u.json'));
    expect(pedidos.some((url) => url.includes('ac-c0008-'))).toBe(false);
    expect(distrital).toBe(resultados.length - 1);
    expect(resultados.some((url) => url.includes('ac-c0003-e006259-'))).toBe(true);
    expect(resultados.some((url) => url.includes('ac-c0003-e007000-'))).toBe(true);
    expect(store.arquivosAusentes.has('resultado:6259:0008')).toBe(false);
    expect(store.resultado('6259', '0008', 'df')?.candidatos[0]).toMatchObject({
      nomeUrna: 'Deputado Distrital',
      numero: '12345',
    });
  });
});
