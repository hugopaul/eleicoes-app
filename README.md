# Eleições 2026

Aplicação que lê a divulgação de resultados do TSE, guarda o que mudou e apresenta isso numa página. A especificação de contrato está em `specs/001-backend-eleicoes-2026/spec.md`. Os dicionários oficiais dos arquivos estão em `extracted/`.

## Como usar

Com Docker, a imagem guarda a API, a página e a carga inicial. As fotos baixadas ficam no volume `fotos`, sem gravar `node_modules`, `dist` ou `data/` no disco do projeto.

```powershell
docker compose up --build
```

Abra `http://localhost:3000`.

Fora do Docker, é preciso Node.js 22.

```powershell
cd api
npm install
npm run build
npm start
```

A página tem quatro abas:

| Aba | O que mostra |
| --- | --- |
| Simulado | Eleições da carga de teste de 2026, com data do pleito, apuração e candidatos |
| Oficial | Catálogo que o TSE publica em `ele-c.json`. Hoje esse arquivo ainda é o ciclo de 2024 |
| Atualização | Cada arquivo carregado, a geração do TSE, o identificador e o horário em que a API o leu |

Na aba Atualização, **Sincronizar agora** dispara um ciclo imediato. Se já houver um ciclo em andamento, a API responde 409 e a página mostra o aviso. A própria aba relê o status a cada 1 minuto.

No cartão da eleição, a data em destaque é a data do pleito (`pl.dt`). Ao escolher uma eleição:

- a apuração mostra andamento, seções totalizadas, comparecimento e abstenção, quando o arquivo de acompanhamento existe;
- o seletor de cargo lista os cargos daquela eleição;
- Presidente não pede UF;
- os demais cargos pedem UF. Se o TSE ainda não publicou o resultado, a mensagem aparece na própria página.

Os testes da API não acessam a rede:

```powershell
cd api
npm test
```

## O que a aplicação guarda

Tudo fica em memória, em dois conjuntos separados: simulado e oficial. Ao subir, a API preenche esses conjuntos com os JSON locais e depois passa a atualizá-los pelo TSE.

| Pasta | Conteúdo |
| --- | --- |
| `samples/tse/simulado2026/` | Catálogo, municípios, acompanhamento e resultados do simulado de 2026 |
| `samples/tse/ele-c.json` | Catálogo oficial baixado. O ciclo gravado nele ainda é `ele2024` |
| `extracted/` | Especificações EA10, EA11, EA12, EA14, EA15, EA16, EA18 e o guia de download |

Informações expostas:

- **Catálogo.** Pleito, data, ciclo, eleição, turno, tipo, cargos e abrangências.
- **Municípios.** Código TSE com zeros à esquerda, código IBGE, nome, capital e zonas.
- **Apuração.** Andamento, seções, eleitorado, comparecimento e abstenção, do Brasil até o município quando o arquivo existe.
- **Resultado.** Votos do cargo, partidos, candidatos, vice, situação e percentual. Presidente vem do arquivo nacional. Os outros cargos vêm do arquivo da UF.
- **Eleitos.** O endpoint existe, mas responde que o arquivo ainda não foi publicado. A tela usa a situação que já vem no resultado.
- **Seções.** A listagem exige município ou zona. Não há carga automática de boletim de urna.

Códigos de cargo usados nos nomes de arquivo: `0001` Presidente, `0003` Governador, `0005` Senador, `0006` Deputado Federal, `0007` Deputado Estadual, `0008` Deputado Distrital, `0011` Prefeito, `0013` Vereador. No simulado também aparece `0025` Conselheiro Distrital.

## De onde vêm os arquivos

O host `https://cdn.tse.jus.br` responde 403 neste ambiente. As bases usadas são as publicadas pelo TSE:

| Fase | Base | Ambiente | Catálogo |
| --- | --- | --- | --- |
| Simulado | `https://resultados-sim.tse.jus.br/simulado` | `simulado2026` | `.../simulado2026/comum/config/ele-c.json` |
| Oficial | `https://resultados.tse.jus.br` | `oficial` | `.../oficial/comum/config/ele-c.json` |

O catálogo traz a lista `arq`, com o diretório de cada tipo. A aplicação troca os tokens `<base>`, `<ambiente>`, `<ciclo>`, `<cd_eleicao>`, `<cd_pleito>` e `<uf>` e monta o nome do arquivo. O ciclo sai do pleito; no catálogo oficial de 2024 ele está na raiz.

Em cada eleição o ciclo baixa:

- `mun-e{eleição}-cm.json`, municípios;
- `br-e{eleição}-ab.json` e `{uf}-e{eleição}-ab.json`, acompanhamento;
- `{uf}-c{cargo}-e{eleição}-u.json`, resultado. Presidente usa a abrangência `br`.

Não baixa boletim de urna, RDV, log, fotos nem o arquivo auxiliar de seção.

## Mecanismo de atualização

O agendador sobe junto com a API, faz um ciclo na hora e repete no intervalo configurado. O padrão é 5 minutos (`SYNC_INTERVALO_SEG=300`). Simulado e oficial rodam no mesmo ciclo, um depois do outro. Se o ciclo anterior ainda não terminou, o próximo é ignorado.

Para cada arquivo:

1. A requisição envia `If-None-Match` quando já existe `ETag`. Resposta 304 só atualiza o horário de verificação.
2. Resposta 200 compara o `idg`. Se for o mesmo, os dados não são regravados. Se mudou, o recorte daquele arquivo é substituído.
3. Resposta 404 marca o arquivo como ausente. No ciclo automático ele não é pedido de novo, para não acumular 404 no TSE. A cada 10 ciclos, e também no botão **Sincronizar agora**, os ausentes voltam a ser tentados.
4. Se o `idg` do catálogo mudar, a lista de ausentes é limpa.
5. Há uma pausa de 200 ms entre requisições (`SYNC_INTERVALO_MINIMO_MS`).
6. Se o primeiro arquivo de resultado de um cargo não existe, os outros estados daquele cargo não são pedidos naquele ciclo.

O botão chama `POST /api/v1/sincronizacao`. A resposta 202 significa que o ciclo começou. A resposta 409 significa que já existe um ciclo rodando.

Durante os testes o agendador não liga, porque o Jest define `JEST_WORKER_ID`. Para desligar também fora dos testes, use `SYNC_HABILITADO=false`.

## API

Base: `http://localhost:3000/api/v1`. A fase entra na query `fase=simulado` ou `fase=oficial`. Sem esse parâmetro, vale o simulado.

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/eleicoes` | Lista eleições. Filtros: `turno`, `tipo`, `pleito`, `pagina`, `tamanho` |
| GET | `/eleicoes/{codigo}` | Eleição com abrangências e cargos |
| GET | `/eleicoes/{codigo}/painel` | Apuração resumida. Query opcional `uf` |
| GET | `/eleicoes/{codigo}/acompanhamento` | Acompanhamento Brasil |
| GET | `/eleicoes/{codigo}/acompanhamento/ufs` | UFs |
| GET | `/eleicoes/{codigo}/acompanhamento/ufs/{uf}` | Uma UF |
| GET | `/eleicoes/{codigo}/acompanhamento/ufs/{uf}/municipios` | Municípios da UF. Filtro `andamento` |
| GET | `/eleicoes/{codigo}/acompanhamento/municipios/{codigo}` | Um município |
| GET | `/eleicoes/{codigo}/resultados/{cargo}` | Candidatos. Query `uf` e `ordem=votos` ou `ordem=sequencia` |
| GET | `/eleicoes/{codigo}/resultados/{cargo}/candidatos/{sequencial}` | Um candidato |
| GET | `/eleicoes/{codigo}/eleitos` | Eleitos, quando o arquivo existir |
| GET | `/eleicoes/{codigo}/ufs` | UFs do arquivo de municípios |
| GET | `/eleicoes/{codigo}/ufs/{uf}/municipios` | Municípios. Filtros `capital` e `nome` |
| GET | `/eleicoes/{codigo}/municipios/{codigo}` | Um município |
| GET | `/pleitos` | Pleitos. Filtro `data` |
| GET | `/pleitos/{codigo}` | Um pleito |
| GET | `/saude` | Processo no ar e fase |
| GET | `/sincronizacao` | Último ciclo, arquivos, ausentes e se está baixando |
| POST | `/sincronizacao` | Dispara um ciclo |

Lista paginada devolve `pagina`, `tamanho`, `total` e `itens`. O padrão é 50 itens, no máximo 200. Recurso de domínio inclui `geracao` com data, hora, `id` e fase. `If-None-Match` igual ao `id` responde 304.

Erros seguem este corpo:

```json
{ "erro": { "codigo": "NAO_PUBLICADO", "mensagem": "..." } }
```

Códigos: `PARAMETRO_INVALIDO` (400), `NAO_ENCONTRADO` e `NAO_PUBLICADO` (404), `SINCRONIZACAO_EM_ANDAMENTO` (409).

## Configuração

| Variável | Padrão | Função |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP |
| `FRONTEND_ORIGIN` | qualquer origem | CORS. Métodos `GET`, `POST` e `OPTIONS` |
| `SYNC_INTERVALO_SEG` | `300` | Intervalo entre ciclos |
| `SYNC_INTERVALO_MINIMO_MS` | `200` | Pausa entre arquivos |
| `SYNC_HABILITADO` | ligado | `false` desliga o agendador |
| `TSE_SIMULADO_BASE` | `https://resultados-sim.tse.jus.br/simulado` | Host do simulado |
| `TSE_SIMULADO_AMBIENTE` | `simulado2026` | Pasta do simulado |
| `TSE_OFICIAL_BASE` | `https://resultados.tse.jus.br` | Host oficial |
| `TSE_OFICIAL_AMBIENTE` | `oficial` | Pasta oficial |
| `SAMPLES_DIR` | `samples/tse/simulado2026` | Carga inicial do simulado |
| `SAMPLES_OFICIAL_DIR` | `samples/tse` | Carga inicial do oficial |

## Estrutura

```text
frontend/          página estática (HTML, CSS e JavaScript)
api/src/http/      rotas
api/src/store/     leitura dos JSON e memória das duas fases
api/src/sync/      agendador e download
samples/           primeira carga local
extracted/         especificações do TSE
specs/             contrato da API
Dockerfile         imagem com API, página e amostras
docker-compose.yml sobe o processo na porta 3000 e o volume das fotos
```

A página é servida pelo mesmo processo da API, a partir de `frontend/`. Não há banco. Ao reiniciar o processo, a memória volta à carga local e o primeiro ciclo do TSE preenche de novo o que estiver publicado.
