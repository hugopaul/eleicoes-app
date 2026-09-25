import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { filaCheia, naFila } from './tse-sync';

const ausentes = new Set<string>();

export async function obterFotoLocal(url: string, destino: string, jaExiste: boolean): Promise<boolean> {
  if (jaExiste) return true;
  if (ausentes.has(url) || filaCheia()) return false;
  const status = await naFila(async () => {
    const resposta = await fetch(url, {
      headers: { Accept: 'image/jpeg', 'User-Agent': 'eleicoes-api/0.1' },
      signal: AbortSignal.timeout(20000),
    });
    if (resposta.status === 404) {
      ausentes.add(url);
      return 404;
    }
    if (!resposta.ok) return resposta.status;
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from(await resposta.arrayBuffer()));
    return 200;
  });
  return status === 200;
}
