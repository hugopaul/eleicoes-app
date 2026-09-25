export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function pad(value: unknown, width: number): string {
  return String(value ?? '').padStart(width, '0');
}

export function faseNome(flag: string | undefined): 'simulado' | 'oficial' {
  return flag === 'o' ? 'oficial' : 'simulado';
}

export function semAcento(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function paginar<T>(itens: T[], paginaRaw?: string, tamanhoRaw?: string): { pagina: number; tamanho: number; total: number; itens: T[] } {
  const pagina = Math.max(1, Number(paginaRaw) || 1);
  const tamanho = Math.min(1000, Math.max(1, Number(tamanhoRaw) || 50));
  const inicio = (pagina - 1) * tamanho;
  return { pagina, tamanho, total: itens.length, itens: itens.slice(inicio, inicio + tamanho) };
}

const ANDAMENTO: Record<string, string> = { n: 'nao_iniciado', p: 'em_andamento', f: 'finalizado' };

export function andamento(flag: string | undefined): string | undefined {
  if (!flag) return undefined;
  return ANDAMENTO[flag] ?? flag;
}

export function tipoAbrangencia(flag: string | undefined): string | undefined {
  if (flag === 'mun') return 'municipio';
  return flag;
}
