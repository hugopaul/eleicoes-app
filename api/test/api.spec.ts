import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ElectionStore } from '../src/store/election-store';
import { parseCatalogo } from '../src/store/parse';

describe('API de eleições', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista as três eleições do simulado com cargos e segundo turno', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/eleicoes').expect(200);
    const porCodigo = Object.fromEntries(res.body.itens.map((item: { codigo: string }) => [item.codigo, item]));
    expect(porCodigo['21270'].codigoSegundoTurno).toBe('21271');
    expect(porCodigo['21270'].cargos.map((cargo: { codigo: string }) => cargo.codigo)).toEqual(['0001']);
    expect(porCodigo['21272'].cargos.map((cargo: { codigo: string }) => cargo.codigo)).toEqual(['0003', '0005', '0006', '0007', '0008']);
    expect(porCodigo['21274'].cargos[0].nome).toBe('Conselheiro Distrital');
    expect(res.body.total).toBe(3);
  });

  it('lê o catálogo oficial de 2024 com ciclo na raiz e sem idg', () => {
    const raw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'samples', 'tse', 'ele-c.json'), 'utf8'));
    const catalogo = parseCatalogo(raw);
    expect(catalogo.geracao.id).toBeNull();
    expect(catalogo.pleitos[0].ciclo).toBe('ele2024');
    expect(catalogo.eleicoes[0].nome).toContain('1º Turno');
    expect(catalogo.eleicoes[0].nome).not.toContain('&#');
  });

  it('devolve Acrelândia e a capital Rio Branco', async () => {
    const acre = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/municipios/01120').expect(200);
    expect(acre.body.nome).toBe('ACRELÂNDIA');
    expect(acre.body.codigoIbge).toBe('1200013');
    expect(acre.body.zonas).toEqual(['0008']);
    const capital = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/ufs/ac/municipios?capital=true').expect(200);
    expect(capital.body.itens[0].codigo).toBe('01392');
    expect(capital.body.itens[0].capital).toBe(true);
  });

  it('monta o painel nacional sem depender do arquivo do Acre', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/painel').expect(200);
    expect(res.body.acompanhamento.secoes.total).toBe(528951);
    expect(res.body.acompanhamento.eleitorado.comparecimento).toBe(138863131);
    expect(res.body.cargos[0].codigo).toBe('0001');
  });

  it('ordena o resultado de Presidente e soma os votos computados', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/resultados/0001').expect(200);
    expect(res.body.candidatos[0]).toMatchObject({
      numero: '57',
      votos: 10503573,
      eleito: true,
      situacao: '2º turno',
      destinacao: 'Anulado sub judice',
    });
    expect(res.body.votos.validosComputados).toBe(120704576);
    expect(res.body.votos.validos + res.body.votos.anulados + res.body.votos.anuladosSubJudice).toBe(120704576);
  });

  it('exige UF no governador e devolve vice e nome feminino', async () => {
    await request(app.getHttpServer()).get('/api/v1/eleicoes/21272/resultados/0003').expect(400);
    const res = await request(app.getHttpServer()).get('/api/v1/eleicoes/21272/resultados/0003?uf=ac').expect(200);
    expect(res.body.cargo.nomeFeminino).toBe('Governadora');
    expect(res.body.candidatos.some((candidato: { vices?: unknown[] }) => (candidato.vices?.length ?? 0) > 0)).toBe(true);
  });

  it('não regrava resultado quando o idg é o mesmo', () => {
    const store = app.get(ElectionStore);
    const antes = store.regravacoes;
    const raw = JSON.parse(readFileSync(join(__dirname, '..', '..', 'samples', 'tse', 'simulado2026', 'br-c0001-e021270-u.json'), 'utf8'));
    expect(store.ingerirResultado(raw, 'br-c0001-e021270-u.json')).toBe(false);
    expect(store.regravacoes).toBe(antes);
  });

  it('responde eleitos ainda não publicados', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/eleitos').expect(404);
    expect(res.body.erro.codigo).toBe('NAO_PUBLICADO');
  });

  it('responde 304 quando o ETag não muda', async () => {
    const primeiro = await request(app.getHttpServer()).get('/api/v1/eleicoes/21270/resultados/0001').expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/eleicoes/21270/resultados/0001')
      .set('If-None-Match', primeiro.headers.etag)
      .expect(304);
  });

  it('recusa listagem de seções sem município e sem zona', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/pleitos/17801/ufs/ac/secoes').expect(400);
    expect(res.body.erro.codigo).toBe('PARAMETRO_INVALIDO');
  });
});
