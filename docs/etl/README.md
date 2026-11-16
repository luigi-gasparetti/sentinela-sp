# ETL de arboviroses

## 1. Visão geral

O ETL de arboviroses obtém notificações epidemiológicas disponibilizadas pelo Departamento de Monitoramento, Avaliação e Disseminação de Informações Estratégicas em Saúde (DEMAS), normaliza os registros, avalia sua qualidade e disponibiliza os resultados em arquivos JSON.

Atualmente, a execução de exportação contempla chikungunya e Zika. A ingestão de dengue ainda não está incluída no executor.

O processamento é dividido nas seguintes etapas:

1. Extração dos registros da API do DEMAS.
2. Normalização dos campos para uma estrutura padronizada.
3. Validação dos registros e identificação de problemas de qualidade.
4. Geração de um relatório consolidado de qualidade.
5. Exportação das notificações normalizadas e dos metadados em JSON.

## 2. Fonte de dados

A fonte utilizada é a API de Dados Abertos do Ministério da Saúde.

Endpoints:

- Dengue: https://apidadosabertos.saude.gov.br/arboviroses/dengue
- Chikungunya: https://apidadosabertos.saude.gov.br/arboviroses/chikungunya
- Zika: https://apidadosabertos.saude.gov.br/arboviroses/zikavirus

### 2.1. Consulta e paginação

As consultas utilizam os seguintes parâmetros:

| Parâmetro | Descrição |
|---|---|
| `id_municip` | Código do município de notificação |
| `limit` | Quantidade máxima de registros por página |
| `offset` | Número da página, começando em zero |

O limite padrão é de 1.000 registros por página, sendo esse também o limite máximo aceito pelo cliente.

A paginação é feita incrementando `offset` em uma unidade a cada requisição. A extração termina quando uma página retorna menos registros do que o limite solicitado.

O cliente verifica a estrutura da resposta e interrompe a execução com erro caso a resposta HTTP não seja bem-sucedida ou não contenha uma lista válida de registros.

### 2.2. Filtro municipal

A ingestão é restrita ao município de São Paulo, utilizando o código `355030` no campo `id_municip`, correspondente ao município de notificação.

Esse filtro não deve ser interpretado automaticamente como local de infecção ou município de residência do paciente.

O município de residência é preservado separadamente, quando informado pela fonte.

## 3. Arquivos exportados

Os arquivos gerados ficam em:

```text
data/
└── processed/
    └── demas/
        ├── chikungunya.json
        └── zika.json
```

Cada arquivo contém três propriedades principais:

| Propriedade | Descrição |
|---|---|
| `metadados` | Informações sobre a origem e o escopo da exportação |
| `notificacoes` | Lista de notificações normalizadas |
| `qualidade` | Relatório consolidado de qualidade dos registros processados |

### 3.1. Metadados

Exemplo:

```json
{
  "doenca": "chikungunya",
  "municipioNotificacao": "355030",
  "fonte": "DEMAS",
  "dataReferencia": "2026-11-16"
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `doenca` | string | Doença correspondente à exportação |
| `municipioNotificacao` | string | Código do município de notificação |
| `fonte` | string | Fonte dos dados (`DEMAS`) |
| `dataReferencia` | string | Data de referência da execução, no formato `YYYY-MM-DD` |

A data de referência é calculada considerando o fuso horário de São Paulo.

### 3.2. Notificações

Cada elemento de `notificacoes` representa um registro individual após a normalização.

Exemplo estrutural:

```json
{
  "doenca": "chikungunya",
  "anoNotificacao": 2026,
  "anoNascimento": 1990,
  "dataNotificacao": "2026-05-10",
  "dataInicioSintomas": "2026-05-03",
  "dataObito": null,
  "dataEncerramento": null,
  "dataDigitacao": "2026-05-11",
  "semanaNotificacao": {
    "ano": 2026,
    "semana": 19
  },
  "semanaInicioSintomas": {
    "ano": 2026,
    "semana": 18
  },
  "idade": {
    "unidade": "anos",
    "quantidade": 23
  },
  "sexo": "F",
  "municipioNotificacao": "355030",
  "municipioResidencia": "355030",
  "cnes": "1234567",
  "classificacaoFinal": "13",
  "criterioConfirmacao": "1",
  "evolucao": "1",
  "hospitalizacao": null,
  "sintomas": {
    "febre": "1",
    "mialgia": "1"
  }
}
```

O exemplo é ilustrativo e não representa necessariamente uma notificação real. Os campos opcionais podem estar ausentes, conforme explicado a seguir.

#### Dicionário de campos

| Campo | Tipo | Campo de origem | Descrição |
|---|---|---|---|
| `doenca` | string | Definido pelo ETL | Doença associada à notificação |
| `anoNotificacao` | number ou null | `nu_ano` | Ano da notificação |
| `anoNascimento` | number ou null | `ano_nasc` | Ano de nascimento |
| `dataNotificacao` | string ou null | `dt_notific` | Data da notificação |
| `dataInicioSintomas` | string ou null | `dt_sin_pri` | Data de início dos sintomas |
| `dataObito` | string ou null | `dt_obito` | Data do óbito |
| `dataEncerramento` | string ou null | `dt_encerra` | Data de encerramento da investigação |
| `dataDigitacao` | string ou null | `dt_digita` | Data de digitação |
| `semanaNotificacao` | objeto ou null | `sem_not` | Ano e semana epidemiológica da notificação |
| `semanaInicioSintomas` | objeto ou null | `sem_pri` | Ano e semana epidemiológica do início dos sintomas |
| `idade` | objeto ou null | `nu_idade_n` | Idade normalizada |
| `sexo` | string ou null | `cs_sexo` | Sexo informado na fonte |
| `municipioNotificacao` | string ou null | `id_municip` | Código do município de notificação |
| `municipioResidencia` | string ou null | `id_mn_resi` | Código do município de residência |
| `cnes` | string ou null | `id_unidade` | Código CNES do estabelecimento associado à notificação |
| `classificacaoFinal` | string ou null | `classi_fin` | Código original da classificação final |
| `criterioConfirmacao` | string ou null | `criterio` | Código original do critério de confirmação |
| `evolucao` | string ou null | `evolucao` | Código original da evolução do caso |
| `hospitalizacao` | string, null ou ausente | `hospitaliz` | Informação de hospitalização, quando disponível |
| `sintomas` | objeto ou ausente | Campos específicos da doença | Informações sobre sintomas |

#### Normalização dos valores

- **Datas:** são aceitas no formato `YYYY-MM-DD`. Datas ausentes ou inválidas são normalizadas para `null`.
- **Números:** os anos são convertidos para números inteiros seguros. Valores ausentes ou inválidos são normalizados para `null`.
- **Identificadores:** são preservados como strings, inclusive zeros à esquerda.
- **Valores ausentes:** `null`, `undefined`, strings vazias e `"nan"` são normalizados para `null`.
- **Idade:** o formato codificado utilizado pelo SINAN é interpretado conforme o primeiro dígito:
  - `1`: horas;
  - `2`: dias;
  - `3`: meses;
  - `4`: anos.

  Os três dígitos seguintes representam a quantidade. Por exemplo, `4023` resulta em `{ "unidade": "anos", "quantidade": 23 }`.

- **Semanas epidemiológicas:** são representadas por objetos com os campos `ano` e `semana`. O código valida o ano e a quantidade de semanas existente nele, considerando a regra de que a semana que contém 4 de janeiro é a primeira semana epidemiológica do ano.

#### Campos opcionais e sintomas

O campo `hospitalizacao` só é incluído quando a propriedade `hospitaliz` existe no registro original. Se existir, seu valor pode ser `null`.

O campo `sintomas` é construído a partir dos campos específicos de cada doença:

- Dengue: febre, mialgia, cefaleia, exantema, vômito, náusea, náuseas, dor nas costas, conjuntivite, artrite, artralgia, dor retro-orbitária, diarreia, dor, prostração e outros.
- Chikungunya: febre, mialgia, cefaleia, exantema, vômito, náusea, dor nas costas, conjuntivite, artrite e artralgia.
- Zika: não há campos de sintomas configurados atualmente.

O objeto `sintomas` só é incluído quando pelo menos um dos campos previstos para a doença está presente no registro original. Campos ausentes não são adicionados ao objeto.

Os nomes dos campos seguem os identificadores utilizados pela API, inclusive quando possuem grafia abreviada ou particularidades da fonte.

O campo `cnes` identifica o estabelecimento de saúde associado à notificação. Não representa necessariamente o local de infecção nem o município de residência.

Os códigos de classificação, critério de confirmação e evolução são preservados como strings. Sua interpretação depende da doença e deve utilizar as regras correspondentes.

### 3.3. Relatório de qualidade

A propriedade `qualidade` resume os problemas identificados durante o processamento.

Exemplo estrutural:

```json
{
  "total": 100,
  "semProblemas": 90,
  "comAvisos": 8,
  "comErros": 2,
  "problemas": [
    {
      "campo": "dt_sin_pri",
      "codigo": "campo_invalido",
      "severidade": "erro",
      "quantidade": 5
    }
  ]
}
```

| Campo | Descrição |
|---|---|
| `total` | Total de registros processados |
| `semProblemas` | Registros sem problemas de validação |
| `comAvisos` | Registros com pelo menos um aviso |
| `comErros` | Registros com pelo menos um erro |
| `problemas` | Contagem consolidada dos problemas identificados |

Cada elemento de `problemas` contém:

- `campo`: campo relacionado ao problema;
- `codigo`: código identificador do problema;
- `severidade`: nível de severidade (`aviso` ou `erro`);
- `quantidade`: quantidade de ocorrências daquele problema.

A mensagem descritiva de cada problema é utilizada internamente na validação, mas não é incluída no relatório consolidado exportado.

Um mesmo registro pode apresentar avisos e erros simultaneamente. Portanto, `comAvisos` e `comErros` não são categorias necessariamente exclusivas.

#### Regras de validação

| Condição | Código | Severidade |
|---|---|---|
| Data preenchida com formato ou valor inválido | `campo_invalido` | erro |
| Semana epidemiológica preenchida com valor inválido | `campo_invalido` | erro |
| Idade preenchida com codificação inválida | `campo_invalido` | aviso |
| Data posterior à data de referência da ingestão | `data_futura` | aviso |
| Início dos sintomas posterior à notificação | `inconsistencia_temporal` | aviso |
| Óbito anterior ao início dos sintomas | `inconsistencia_temporal` | aviso |
| Encerramento anterior à notificação | `inconsistencia_temporal` | aviso |

A validação não implica descarte automático dos registros. Mesmo registros com erros ou avisos continuam no processamento e podem aparecer na exportação.

O relatório consolida a quantidade de ocorrências por campo, código e severidade.

## 4. Classificação epidemiológica

O campo `classificacaoFinal` preserva o código recebido da fonte. O módulo `classification.ts` interpreta esse código de acordo com a doença.

As situações epidemiológicas utilizadas internamente são:

| Situação | Significado |
|---|---|
| `confirmado` | Registro classificado como confirmado |
| `descartado` | Registro explicitamente descartado |
| `nao_descartado` | Registro não descartado, incluindo classificações inconclusivas previstas nas regras |
| `indeterminado` | Não há informação suficiente para determinar a situação |

As regras atualmente implementadas incluem:

| Doença | Código | Categoria | Situação |
|---|---|---|---|
| Dengue | `5` | `descartado` | descartado |
| Dengue | `8` | `inconclusivo` | nao_descartado |
| Dengue | `10` | `dengue` | confirmado |
| Dengue | `11` | `dengue_com_sinais_de_alarme` | confirmado |
| Dengue | `12` | `dengue_grave` | confirmado |
| Chikungunya | `5` | `descartado` | descartado |
| Chikungunya | `13` | `chikungunya` | confirmado |
| Zika | `1` | `zika` | confirmado |
| Zika | `2` | `descartado` | descartado |

Códigos ausentes ou não mapeados resultam em situação `indeterminado`, com categorias `nao_informado` ou `desconhecido`, respectivamente.

A interpretação também produz o campo `elegivelParaContagemDeProvaveis`, que indica se o registro pode ser considerado em contagens de casos prováveis segundo as regras atuais.

Os códigos são específicos por doença. Não se deve aplicar uma tabela genérica aos códigos de classificação.

## 5. Agregações disponíveis

O módulo `aggregates.ts` disponibiliza funções para gerar duas agregações:

- Casos por semana epidemiológica.
- Casos por semana epidemiológica e estabelecimento de saúde (CNES).

As agregações utilizam a semana epidemiológica de início dos sintomas (`semanaInicioSintomas`), e não a semana de notificação.

### Regras de elegibilidade

Para participar das agregações, uma notificação precisa:

1. Pertencer ao município de notificação `355030`.
2. Possuir semana epidemiológica válida de início dos sintomas.
3. Não possuir classificação explicitamente interpretada como descartada.

Registros sem classificação, com classificação desconhecida ou em situação indeterminada não são descartados automaticamente pelas regras atuais.

Na agregação por CNES, registros sem código de estabelecimento são mantidos em um grupo próprio, representado por `cnes: null`.

### Estrutura das agregações

Casos por semana:

```json
{
  "doenca": "chikungunya",
  "ano": 2026,
  "semana": 18,
  "total": 25
}
```

Casos por semana e unidade:

```json
{
  "doenca": "chikungunya",
  "ano": 2026,
  "semana": 18,
  "cnes": "1234567",
  "total": 10
}
```

**Importante:** essas agregações estão disponíveis como funções no código, mas não fazem parte dos arquivos JSON atualmente produzidos pelo `export-runner.ts`. A exportação atual contém as notificações individuais e o relatório de qualidade.

## 6. Execução e testes

A execução da exportação é realizada pelo script:

```text
apps/api/src/etl/demas/export-runner.ts
```

A partir da raiz do repositório, execute:

```bash
node apps/api/src/etl/demas/export-runner.ts
```

O script:

1. Cria o diretório de saída, caso ainda não exista.
2. Exporta chikungunya e Zika.
3. Salva os resultados em `data/processed/demas/`.
4. Exibe o total de notificações processadas e o caminho dos arquivos gerados.

A execução utiliza a data local de São Paulo como data de referência.

### Testes

Para executar os testes da API:

```bash
npm run test -w @sentinela/api
```

Para verificar os tipos TypeScript:

```bash
npm run typecheck -w @sentinela/api
```

## 7. Situação atual e limitações

- A ingestão e exportação de chikungunya estão implementadas.
- A ingestão e exportação de Zika estão implementadas.
- A ingestão e exportação de dengue ainda não estão incluídas no executor atual.
- As agregações por semana e por CNES estão implementadas, mas ainda não são incluídas nos arquivos exportados.
- A integração com o banco de dados não faz parte desta etapa do ETL.

A estrutura descrita neste documento representa o contrato atual dos arquivos exportados e pode ser utilizada como referência para a integração com as demais partes do sistema.