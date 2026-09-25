# Spec: API de divulgação das Eleições 2026

**Status:** pronta para implementação  
**Consumidor:** frontend de acompanhamento. A API entrega recursos nomeados, numéricos e paginados. O frontend não fala com o TSE e não interpreta sigla de arquivo.  
**Fontes:** `extracted/`, página técnica do TSE e os JSON em `samples/tse/`.

## 1. O que a API entrega

Uma eleição, vista pelo frontend, tem quatro blocos:

1. **Catálogo** — pleitos, eleições, cargos e municípios para montar navegação.
2. **Apuração** — percentual de seções, comparecimento e abstenção, do Brasil até o município.
3. **Resultado** — votos por cargo, agrupamento, partido e candidato, com situação (eleito, 2º turno, não eleito, anulado).
4. **Eleitos** — lista fechada depois da totalização final, quando o arquivo EA10 existir.

Cada resposta de domínio traz `geracao`, para o frontend saber se o dado mudou e quando foi produzido.

## 2. Ambientes confirmados

`https://cdn.tse.jus.br` respondeu 403 neste ambiente e não é a URL publicada pelo TSE. Não usar.

| Ambiente | Base | Pasta `ambiente` | Catálogo | Situação em 24/09/2026 |
| --- | --- | --- | --- | --- |
| Simulado 2026 | `https://resultados-sim.tse.jus.br/simulado` | `simulado2026` | `.../simulado2026/comum/config/ele-c.json` | Baixado. Fase `s`, ciclo `ele2026`, pleito `17801` |
| Oficial | `https://resultados.tse.jus.br` | `oficial` | `.../oficial/comum/config/ele-c.json` | Baixado. Ainda é o ciclo `ele2024` (gerado em 12/05/2026). Os códigos de 2026 ainda não estão nesse arquivo |

Códigos de produção anunciados pelo TSE, ainda ausentes do `ele-c.json` oficial: pleito `3220` em 04/10/2026; eleições `6257` (federal), `6259` (estaduais) e `6261` (conselho distrital). A aplicação não grava esses códigos à mão. Quando o catálogo oficial passar a listá-los, o mesmo fluxo os carrega.

Amostra usada para fechar o contrato:

| Arquivo local | Papel |
| --- | --- |
| `samples/tse/ele-c.json` | Catálogo oficial vigente (ciclo 2024, sem `idg` na raiz) |
| `samples/tse/simulado2026/ele-c.json` | Catálogo do simulado (`idg` presente, ciclo dentro do pleito) |
| `samples/tse/simulado2026/mun-e021270-cm.json` | Municípios |
| `samples/tse/simulado2026/br-e021270-ab.json` | Acompanhamento Brasil |
| `samples/tse/simulado2026/ac-e021270-ab.json` | Acompanhamento do Acre, com municípios |
| `samples/tse/simulado2026/br-c0001-e021270-u.json` | Resultado de Presidente |
| `samples/tse/simulado2026/ac-c0003-e021272-u.json` | Resultado de Governador no Acre |

O PDF do EA20 não está em `extracted`. O contrato de resultado desta spec sai desses dois `*-u.json`. Se o TSE publicar o dicionário e algum campo divergir, o nome na API permanece e o mapeamento é ajustado.

## 3. Fora do contrato do frontend

- Tela. Esta spec é só o backend.
- Boletim de urna, RDV, log e assinatura. O EA18, quando for buscado, devolve só situação, hash e nome do arquivo.
- Validação do certificado `cert-e<ELEICA>-a.cer`.
- Arquivo de tipo `t` listado em `arq` no simulado. Não há dicionário em `extracted` nem amostra. Não baixar.
- Proxy da foto. A API pode devolver a URL pública `{diretório ft}/{sqcand}.jpeg`. O binário não passa pelo backend.
- Autenticação de eleitor. Leitura pública dos dados já divulgados.
- Gravar código de eleição que ainda não veio no `ele-c.json`.

## 4. Como o frontend usa

O frontend consulta só esta API. Intervalo sugerido na tela de resultado, durante a janela do pleito: 15 segundos, usando `geracao.id`. Se o id não mudou, a tela não redesenha a lista.

Três entradas cobrem a navegação:

```text
GET /api/v1/eleicoes
GET /api/v1/eleicoes/{codigo}/painel
GET /api/v1/eleicoes/{codigo}/resultados/{cargo}?uf=ac
```

`painel` evita que a home faça dezenas de chamadas: devolve a eleição, os cargos e o acompanhamento Brasil (ou da UF, se `uf` vier). O detalhe de município, candidato e eleitos fica nos endpoints próprios.

CORS: `Access-Control-Allow-Origin` sai de `FRONTEND_ORIGIN`. Métodos `GET` e `OPTIONS`. `POST /api/v1/sincronizacao` não entra no CORS do frontend; é operação interna.

Cabeçalhos de cache: `ETag` igual a `geracao.id` do recurso. `GET` com `If-None-Match` devolve 304 sem corpo. O frontend pode usar isso no polling.

## 5. Convenções da resposta

- JSON, UTF-8, sem HTML. `1&#186; Turno` no catálogo oficial vira `1º Turno`.
- Códigos de município, zona e seção são string com zeros à esquerda, como no arquivo (`01120`, `0008`).
- Código de eleição e de pleito saem como no catálogo (`21270`, `17801`), sem completar zeros na URL da API. Os zeros entram só no nome do arquivo TSE (`e021270`, `p017801`).
- Código de cargo na API tem 4 dígitos (`0001`). No catálogo do simulado o TSE manda `"1"`; no nome do arquivo manda `c0001`.
- Inteiros e percentuais são número JSON. O TSE manda string. Percentual vem do campo `*n` (ponto decimal, até 9 casas), não do texto com vírgula.
- Data e hora permanecem `dd/mm/aaaa` e `hh:mm:ss`, no fuso em que o TSE gravou. Não converter para ISO.
- Campo ausente no JSON do TSE é omitido na resposta. Campo presente e vazio (`mnae: []`, `nfed: ""`) vem vazio. Não inventar zero no lugar de ausência.
- Lista: `pagina` (padrão 1), `tamanho` (padrão 50, máximo 200). Corpo: `pagina`, `tamanho`, `total`, `itens`.
- Ordenação padrão de candidato no resultado: votos decrescentes, depois `ordem` (`seq`) crescente. A query `ordem=sequencia` devolve a ordem da urna.

Envelope de geração, em todo recurso originado de arquivo:

```json
{
  "geracao": {
    "data": "24/09/2026",
    "hora": "16:12:52",
    "id": "172098798",
    "fase": "simulado"
  }
}
```

`id` é string. No simulado `idg` já vem string; no catálogo oficial de 2024 a raiz não traz `idg`. Sem `idg`, `geracao.id` é `null` e a detecção de mudança cai em `dg` + `hg`.

`fase`: `s` → `simulado`, `o` → `oficial`.

Erro:

```json
{
  "erro": {
    "codigo": "NAO_PUBLICADO",
    "mensagem": "Resultado do cargo 0001 na eleição 21270 ainda não foi publicado."
  }
}
```

| HTTP | Código | Quando |
| --- | --- | --- |
| 400 | `PARAMETRO_INVALIDO` | UF, cargo, página ou código fora do formato |
| 404 | `NAO_ENCONTRADO` | Eleição, UF ou município que não está no catálogo |
| 404 | `NAO_PUBLICADO` | Arquivo que esta eleição pode ter, mas o TSE ainda não gerou |
| 304 | — | `If-None-Match` igual ao `geracao.id` |
| 409 | `SINCRONIZACAO_EM_ANDAMENTO` | Disparo manual com ciclo já rodando |
| 503 | `ORIGEM_INDISPONIVEL` | Nenhum snapshot e o TSE não respondeu |

## 6. Carga

Um agendador só. Fila serial por host, concorrência padrão 2, pausa mínima 200 ms, no máximo 100 requisições por segundo por IP. 404 repetido pode bloquear o IP no TSE; URL é montada a partir do catálogo, sem varredura.

Bootstrap, único caminho fixo:

```text
{TSE_BASE_URL}/{TSE_AMBIENTE}/comum/config/ele-c.json
```

Os outros caminhos saem de `arq[].dir`, com os tokens:

| Token | Valor |
| --- | --- |
| `<base>` | `TSE_BASE_URL` |
| `<ambiente>` | `TSE_AMBIENTE` |
| `<ciclo>` | `pl.c`; se o pleito não tiver `c`, o `c` da raiz. O oficial 2024 só tem `c` na raiz (`ele2024`). O simulado só tem `c` no pleito (`ele2026`) |
| `<cd_eleicao>` | `e.cd` |
| `<cd_pleito>` | `pl.cd` |
| `<uf>` | sigla minúscula, `br` ou `zz` |
| `<municipio>` | 5 dígitos |
| `<zona>` | 4 dígitos |
| `<secao>` | 4 dígitos |

Preenchimento do nome:

| Peça | Largura | Exemplo real |
| --- | --- | --- |
| Eleição | 6 | `21270` → `e021270`; `619` → `e000619` |
| Pleito | 6 | `17801` → `p017801` |
| Cargo | 4 | `1` → `c0001`; `3` → `c0003` |
| Município no resultado | 5, colado na UF | `ac01120-c0005-e021272-u.json` |

Tipos em `arq` vistos no simulado: `cm`, `e`, `cs`, `ab`, `u`, `aux`, `ft`, `t`. O oficial 2024 também lista `a` (certificado). Baixar `cm`, `ab`, `u` e, na janela, `e`. `cs` entra no intervalo estrutural. `aux` só sob demanda. `ft` só para montar URL. `a` e `t` não são baixados.

Ordem:

```text
ele-c.json
  ├─ municípios mun-e{ELEICA}-cm.json
  ├─ acompanhamento br-e{ELEICA}-ab.json e {uf}-e{ELEICA}-ab.json
  ├─ resultado {abr}-c{CARGO}-e{ELEICA}-u.json para cada cargo da eleição
  └─ eleitos {abr}-c{CARGO}-e{ELEICA}-e.json quando o tipo de eleição publica EA10
```

Resultado por cargo, a partir do que o catálogo e o guia TSE descrevem:

| Eleição | Arquivos `u` |
| --- | --- |
| Federal (`tp` 8), cargo `0001` | `br-c0001-e{ELEICA}-u.json` |
| Estadual (`tp` 1), cargos `0003`, `0005`, `0006`, `0007` | `{uf}-c{CARGO}-e{ELEICA}-u.json` para cada UF. Deputado distrital `0008` só na UF `df` |
| Municipal (`tp` 3) | `{uf}-c0011-...` e `{uf}-c0013-...`, e o recorte municipal `{uf}{MUNIC}-c{CARGO}-e{ELEICA}-u.json` quando o frontend pedir o município |

Não pré-baixar o resultado de cada município do país. O arquivo de UF (ou `br`) alimenta a tela de estado. O arquivo municipal é baixado na primeira consulta daquele município e revalidado quando `dt`/`ht` do município no EA15 mudar.

Eleitos (EA10), só estes casos:

- Geral ordinária, 1º turno: `br` para Governador `0003`, Senador `0005` e Deputado Federal `0006`.
- 2º turno: `br` de Governador se houver disputa.
- Municipal ordinária: Prefeito `0011` por UF.
- Presidente não tem EA10. O frontend lê eleição em `e` e situação `st` no resultado unificado.
- Deputado estadual, distrital e vereador também ficam no unificado.

404 de arquivo ainda não gerado marca `ausente` e não entra em retentativa rápida. O EA10 só passa a existir depois da primeira totalização final de uma UF. Falha de rede conserva o snapshot anterior daquele arquivo.

Janela rápida: da data `pl.dt` até `pl.dtlim`, fuso `America/Sao_Paulo`. Dentro dela, acompanhamento, resultado e eleitos a cada `SYNC_INTERVALO_RAPIDO_SEG`. Fora, só o catálogo no intervalo longo. Comparar `ETag` / `Last-Modified` e, no corpo, `idg`. `idg` igual não regrava. 304 também conta no limite do TSE; o intervalo mínimo segura o volume.

Fase da configuração (`TSE_FASE` = `o` ou `s`) tem de bater com `f` do arquivo. Simulado e oficial não se misturam.

Configuração:

| Variável | Padrão sugerido para desenvolver com a amostra |
| --- | --- |
| `TSE_BASE_URL` | `https://resultados-sim.tse.jus.br/simulado` |
| `TSE_AMBIENTE` | `simulado2026` |
| `TSE_FASE` | `s` |
| `FRONTEND_ORIGIN` | origem do frontend |
| `SYNC_INTERVALO_CATALOGO_SEG` | `300` |
| `SYNC_INTERVALO_RAPIDO_SEG` | `60` |
| `SYNC_INTERVALO_ESTRUTURAL_SEG` | `900` |
| `SYNC_CONCORRENCIA` | `2` |
| `SYNC_INTERVALO_MINIMO_MS` | `200` |
| `DATABASE_URL` | Postgres |

Produção, quando o `ele-c.json` oficial listar 2026: `TSE_BASE_URL=https://resultados.tse.jus.br`, `TSE_AMBIENTE=oficial`, `TSE_FASE=o`.

## 7. Catálogo

### `GET /api/v1/eleicoes`

Filtros: `turno` (`1` ou `2`), `tipo` (1–9), `pleito`.

```json
{
  "pagina": 1,
  "tamanho": 50,
  "total": 3,
  "itens": [
    {
      "codigo": "21270",
      "codigoSegundoTurno": "21271",
      "nome": "Eleição Ordinária Federal - 2026 - 17801 1º Turno",
      "turno": 1,
      "tipo": { "codigo": 8, "descricao": "Federal ordinária" },
      "pleito": {
        "codigo": "17801",
        "data": "26/04/2026",
        "dataLimiteDivulgacao": "18/10/2026",
        "ciclo": "ele2026"
      },
      "cargos": [
        { "codigo": "0001", "nome": "Presidente", "tipo": "majoritario" }
      ]
    }
  ]
}
```

`codigoSegundoTurno` e `sequencial` (`sqele`) só aparecem quando o TSE envia. Consulta popular do catálogo 2024 não tem `sqele`.

Tipos de eleição: `1` estadual ordinária, `2` estadual suplementar, `3` municipal ordinária, `4` municipal suplementar, `5` consulta nacional, `6` consulta estadual, `7` consulta municipal, `8` federal ordinária, `9` federal suplementar.

Tipo de cargo: `1` `majoritario`, `2` `proporcional`, `3` `consulta`.

### `GET /api/v1/eleicoes/{codigo}`

A eleição acima mais `abrangencias`. No simulado a abrangência federal e a estadual vêm com `codigo: "br"` e a lista de cargos. `municipios` dentro da abrangência só é preenchido quando o EA11 manda `mu` (suplementar municipal, consulta municipal ou 2º turno municipal). Nos demais, os municípios vêm do endpoint de municípios.

### `GET /api/v1/pleitos` e `GET /api/v1/pleitos/{codigo}`

`codigo`, `processoEleitoral` (`cdpr`), `ciclo`, `data`, `dataLimiteDivulgacao` e o resumo das eleições.

### `GET /api/v1/eleicoes/{codigo}/ufs`

Do arquivo de municípios: `sigla`, `nome`. Inclui `zz` se o arquivo tiver exterior. Nome como publicado (`ACRE`).

### `GET /api/v1/eleicoes/{codigo}/ufs/{uf}/municipios`

Filtros: `capital` (`true`/`false`), `nome` (contém, sem acento e sem caixa).

Item: `codigo`, `codigoIbge`, `nome`, `capital`, `zonas`. Exemplo real: Acrelândia `01120`, IBGE `1200013`, capital `false`, zona `0008`. Rio Branco `01392` é capital.

### `GET /api/v1/eleicoes/{codigo}/municipios/{codigoMunicipio}`

O mesmo item mais `uf` (`sigla`, `nome`).

## 8. Painel e acompanhamento

### `GET /api/v1/eleicoes/{codigo}/painel`

Query opcional `uf`. Sem `uf`, a abrangência é Brasil (EA14, `tpabr = br`). Com `uf`, a abrangência é a UF (EA15, `tpabr = uf`).

```json
{
  "eleicao": { "codigo": "21270", "nome": "Eleição Ordinária Federal - 2026 - 17801 1º Turno", "turno": 1 },
  "cargos": [{ "codigo": "0001", "nome": "Presidente", "tipo": "majoritario" }],
  "acompanhamento": {
    "andamento": "finalizado",
    "tipo": "br",
    "codigo": "br",
    "atualizadoEm": { "data": "24/09/2026", "hora": "16:12:34" },
    "secoes": {
      "total": 528951,
      "totalizadas": 528951,
      "totalizadasPercentual": 100,
      "naoTotalizadas": 0,
      "instaladas": 528950,
      "naoInstaladas": 1,
      "apuradas": 528950,
      "naoApuradas": 0
    },
    "eleitorado": {
      "total": 163079139,
      "comparecimento": 138863131,
      "comparecimentoPercentual": 85.150902319,
      "abstencao": 24215741,
      "abstencaoPercentual": 14.849097681
    }
  }
}
```

O bloco completo de seções e eleitorado, quando a tela precisar dos percentuais intermediários, está em:

- `GET /api/v1/eleicoes/{codigo}/acompanhamento`
- `GET /api/v1/eleicoes/{codigo}/acompanhamento/ufs`
- `GET /api/v1/eleicoes/{codigo}/acompanhamento/ufs/{uf}`
- `GET /api/v1/eleicoes/{codigo}/acompanhamento/ufs/{uf}/municipios?andamento=finalizado`
- `GET /api/v1/eleicoes/{codigo}/acompanhamento/municipios/{codigoMunicipio}`

`andamento`: `n` `nao_iniciado`, `p` `em_andamento`, `f` `finalizado`. A API não recalcula. Para Presidente (eleição federal), `finalizado` no Brasil exige totalização final; na UF e no município, `snt = 0`. Para cargos estaduais, a UF só fica `finalizado` com totalização final.

Mapeamento de seções: `ts` `total`, `st` `totalizadas`, `snt` `naoTotalizadas`, `si` `instaladas`, `sni` `naoInstaladas`, `sa` `apuradas`, `sna` `naoApuradas`. Eleitorado: `te` `total`, `est` `emSecoesTotalizadas`, `esnt` `emSecoesNaoTotalizadas`, `esi` `emSecoesInstaladas`, `esni` `emSecoesNaoInstaladas`, `esa` `emSecoesApuradas`, `esna` `emSecoesNaoApuradas`, `c` `comparecimento`, `a` `abstencao`. Cada inteiro pode ter `*Percentual` vindo do campo `*n`.

Contadores que só existem em parte das abrangências:

- `ufs` (`naoIniciadas`, `emAndamento`, `finalizadas` e percentuais) somente no acompanhamento Brasil.
- `municipios` (os mesmos três grupos) somente no acompanhamento de UF.
- No EA15 de município esses contadores não vêm. O exemplo do Acre confirma: o item municipal tem `and`, `s` e `e`, sem `munnr`.

`tipo` na API: `br`, `uf`, `municipio` (`mun` da origem vira `municipio`).

## 9. Resultado

Fonte: arquivo unificado. Um arquivo tem um cargo na amostra (`carg` com um elemento). A resposta segue isso.

### `GET /api/v1/eleicoes/{codigo}/resultados/{cargo}`

`cargo` com 4 dígitos. Query:

- `uf` — obrigatória para cargo estadual. Para Presidente, omitir (abrangência `br`).
- `municipio` — troca para o arquivo municipal. Sem ele, vale o arquivo da UF ou do Brasil.
- `ordem` — `votos` (padrão) ou `sequencia`.

```json
{
  "eleicao": "21270",
  "turno": 1,
  "abrangencia": { "tipo": "br", "codigo": "br" },
  "cargo": {
    "codigo": "0001",
    "nome": "Presidente",
    "nomeMasculino": "Presidente",
    "nomeFeminino": "Presidente",
    "vagas": 1
  },
  "atualizadoEm": { "data": "24/09/2026", "hora": "16:12:34" },
  "andamento": "finalizado",
  "totalizacaoFinal": true,
  "votosDivulgados": true,
  "suplementar": false,
  "semAtribuicaoDeEleito": false,
  "motivosSemAtribuicao": [],
  "apuracao": { "secoes": {}, "eleitorado": {} },
  "votos": {
    "total": 138863131,
    "validosComputados": 120704576,
    "validos": 100982116,
    "nominais": 100982116,
    "anulados": 9218887,
    "anuladosSubJudice": 10503573,
    "brancos": 9118018,
    "nulos": 9040537,
    "nulosTecnicos": 0,
    "vsan": 143627,
    "vscv": 0
  },
  "federacoes": [],
  "agrupamentos": [],
  "candidatos": []
}
```

| Campo API | Origem | Leitura confirmada na amostra |
| --- | --- | --- |
| `suplementar` | `sup` | `n`/`s` |
| `votosDivulgados` | `dv` | `s` nos dois arquivos com voto preenchido |
| `totalizacaoFinal` | `tf` | `s` junto de `and = f` |
| `vagas` | `nv` | `1` em Presidente e Governador |
| `nome` / `nomeMasculino` / `nomeFeminino` | `nmn` / `nmm` / `nmf` | Governador traz `Governadora` em `nmf` |
| `votos.total` | `v.tv` | Igual ao comparecimento `e.c` nos dois arquivos |
| `votos.validosComputados` | `v.vvc` | `validos` + `anulados` + `anuladosSubJudice` |
| `votos.validos` | `v.vv` | |
| `votos.nominais` | `v.vnom` | Igual a `validos` nestes cargos majoritários |
| `votos.anulados` | `v.van` | |
| `votos.anuladosSubJudice` | `v.vansj` | |
| `votos.brancos` | `v.vb` | |
| `votos.nulos` | `v.tvn` e `v.vn` | Iguais na amostra. `nulos` usa `vn`. `tvn` vai em `nulosTotal` se divergir de `vn` |
| `votos.nulosTecnicos` | `v.vnt` | |
| `votos.vsan` / `votos.vscv` | `v.vsan` / `v.vscv` | Sem dicionário nesta pasta. A API repete a chave do TSE |

Percentuais de voto (`pvvcn`, `pvvn`, `pvbn`, `ptvnn`, e os demais `*n`) acompanham o inteiro com sufixo `Percentual`.

`apuracao.secoes` e `apuracao.eleitorado` usam o mesmo formato da seção 8. No resultado eles descrevem a abrangência daquele cargo, não o painel geral.

Federação (`fed`): `numero` (`n`), `sigla` (`sg`), `nome` (`nm`), `composicao` (`com`), `partidos` (`npar`, lista de números).

Agrupamento (`agr`):

| Campo API | Origem |
| --- | --- |
| `numero` | `n` |
| `nome` | `nm` |
| `tipo` | `tp`: `i` `partido`, `f` `federacao`, `c` `coligacao` |
| `composicao` | `com` |
| `votosNominais` | `tvtn` |
| `votosAtribuidos` | `tvan` |
| `vagas` | `vag`, só quando vier |

Na amostra, candidato com destinação `Anulado` deixa `tvtn` em 0 e `tvan` igual aos votos dele. Candidato `Válido` repete o mesmo valor nos dois. A API não recalcula.

Partido (`par`): `numero`, `sigla`, `nome`, `federacao` (`nfed`, omitido se string vazia), `votosNominais`, `votosAtribuidos`.

Candidato, também achatado em `candidatos` para a tabela do frontend não percorrer árvore:

| Campo API | Origem |
| --- | --- |
| `numero` | `n` |
| `sequencial` | `sqcand` |
| `nome` | `nm` |
| `nomeUrna` | `nmu` |
| `nascimento` | `dt` |
| `destinacao` | `dvt`, texto do TSE: `Válido`, `Anulado`, `Anulado sub judice` |
| `ordem` | `seq` |
| `eleito` | `e` = `s` |
| `situacao` | `st`, texto do TSE: `Não eleito`, `2º turno`, e o que mais vier |
| `votos` | `vap` |
| `votosPercentual` | `pvapn` |
| `partido` | sigla e número do `par` pai |
| `agrupamento` | número, nome e tipo do `agr` pai |
| `vices` | `vs` |
| `fotoUrl` | URL `ft` + `/{sqcand}.jpeg`, só se o catálogo tiver diretório `ft` |

Vice: `tipo` (`v` → `vice`, `s1` → `primeiro_suplente`, `s2` → `segundo_suplente`), `sequencial`, `nome`, `nomeUrna`, `partido`.

`candidatos` é a lista usada pela tabela. `agrupamentos` permanece aninhado para a tela de legenda e coligação. Os dois descrevem as mesmas pessoas.

### `GET /api/v1/eleicoes/{codigo}/resultados/{cargo}/candidatos/{sequencial}`

Um candidato com vice, partido, agrupamento e os totais do cargo na mesma abrangência. Query `uf` e `municipio` iguais à listagem.

## 10. Eleitos

### `GET /api/v1/eleicoes/{codigo}/eleitos`

Filtros: `cargo`, `uf`, `municipio`, `partido`.

Quando o EA10 ainda não existe, `404` `NAO_PUBLICADO`. O frontend usa `situacao` e `eleito` do resultado até lá.

Candidato eleito: `numero`, `sequencial`, `nome`, `nomeUrna`, `partido`, `coligacao`, `votos`, `ordem`, `vices`, mais a abrangência em que se elegeu (`tipo` `uf` ou `municipio`, `codigo`, `nome`) e o cargo do arquivo.

`semCandidatos` (`scv = s`) devolve lista vazia. `semAtribuicaoDeEleito` (`esae = s`) traz `motivosSemAtribuicao` (`mnae`). Partido inapto continua com `**` como o TSE publicou.

Governador e Prefeito trazem vice. Senador traz suplentes. Deputado Federal não traz `vs`.

## 11. Seções

Fora da primeira tela. Contrato já fechado para a implementação não inventar outro formato.

`GET /api/v1/pleitos/{codigoPleito}/ufs/{uf}/secoes` exige `municipio` ou `zona`. Sem os dois, 400.

Seção: `numero`, `zona`, `municipio`, `secaoPrincipal` (`nsp`, só agregada), `secoesAgregadas` (`nsa`), `auxiliarEm` (`da` + `ha`).

`GET .../zonas/{zona}/secoes/{secao}` devolve a seção e, se o auxiliar existir, `auxiliar`. Se não existir, `auxiliar` é `null` e o HTTP continua 200.

Auxiliar: `situacao` (`recebida`, `nao_instalada`, `nao_apurada`, `anulada`, `totalizada`) e `recebimentos` (`hash`, `recebidoEm`, `situacao` `recebido`/`rejeitado`/`excluido`/`totalizado`, `arquivos` com `nome` e `tipo`). Sem conteúdo de urna.

## 12. Operação

`GET /api/v1/saude` — processo no ar, fase, último ciclo, se o catálogo respondeu.

`GET /api/v1/sincronizacao` — por tipo de arquivo, quantos estão `atualizado`, `ausente` e `erro`, com `geracao.id` e horário da última verificação.

`POST /api/v1/sincronizacao` — dispara um ciclo. 202 ou 409. Sem URL no corpo.

## 13. Persistência e stack

Postgres. Snapshot do JSON original por arquivo, mais as linhas que os endpoints leem. Troca de geração é atômica por arquivo.

Chave do snapshot: fase + tipo + nome do arquivo. Códigos com zero à esquerda continuam `text`.

Stack da implementação: Node.js 22, TypeScript, NestJS, agendador único no processo, cliente HTTP com timeout, ETag e backoff. Testes usam os JSON de `samples/tse/simulado2026` e `samples/tse/ele-c.json`, sem rede.

## 14. Critérios de aceite

1. Com `samples/tse/simulado2026/ele-c.json`, `GET /eleicoes` devolve três eleições: `21270` Presidente, `21272` com os cinco cargos estaduais em código de 4 dígitos, `21274` Conselheiro Distrital. `codigoSegundoTurno` de `21270` é `21271`.
2. O mesmo parser lê `samples/tse/ele-c.json`: ciclo `ele2024` vem da raiz, nome com `&#186;` sai como `1º Turno`, e `geracao.id` fica `null`.
3. Município `01120` da eleição `21270` responde com nome `ACRELÂNDIA`, IBGE `1200013` e zona `0008`. Rio Branco `01392` vem com `capital: true`.
4. `GET /eleicoes/21270/painel` usa `br-e021270-ab.json` e não exige o arquivo do Acre.
5. `GET /eleicoes/21270/resultados/0001` monta candidatos a partir de `br-c0001-e021270-u.json`, ordenados por votos. O primeiro da amostra, nessa ordem, é o número `57` com `10503573` votos, `eleito: false`, `situacao: "2º turno"`, `destinacao: "Anulado sub judice"`.
6. `votos.validosComputados` desse arquivo é `120704576`, soma de válidos, anulados e anulados sub judice.
7. `GET /eleicoes/21272/resultados/0003?uf=ac` lê `ac-c0003-e021272-u.json`. Sem `uf`, responde 400.
8. Candidato de Governador inclui vice. `nomeFeminino` do cargo é `Governadora`.
9. Segundo load do mesmo `idg` não regrava resultado nem acompanhamento.
10. Arquivo de eleitos ausente responde `NAO_PUBLICADO` e não apaga o resultado unificado.
11. `If-None-Match` com o `geracao.id` corrente responde 304.
12. A API não emite pedido de EA18 nem de arquivo `*-u.json` municipal durante a carga inicial do simulado.
