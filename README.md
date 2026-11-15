# Sentinela SP

Painel cidadão sobre arboviroses (dengue, chikungunya e zika) no município de São Paulo, que relaciona a **situação epidemiológica** com a **rede de atendimento** e com a **orientação oficial** sobre qual serviço procurar.

Projeto da disciplina **MAC0332 / MAC5783 – Engenharia de Software**

> ⚠️ **O Sentinela SP não realiza diagnóstico e não substitui a avaliação de um profissional de saúde.** Também não exibe dados individuais. Em caso de emergência, ligue 192 (SAMU).

## Problema

Quando aparecem os primeiros sintomas, o morador de São Paulo precisa de duas informações que hoje estão em lugares separados:

1. **Qual é a situação epidemiológica onde moro?** Os boletins oficiais são técnicos e voltados a gestores.
2. **Onde devo procurar atendimento?** As ferramentas de busca de unidades não ligam isso ao cenário epidemiológico nem indicam qual porta de entrada é adequada.

O Sentinela SP reúne essas informações em uma fonte única, em linguagem acessível.

## Funcionalidades

| Épico | User stories |
|---|---|
| **E1 – Panorama de arboviroses** | US01 curva epidêmica semanal · US02 distribuição por faixa etária · US03 comparação com o ano anterior |
| **E2 – Onde buscar atendimento** | US04 catálogo de UBS e hospitais · US05 busca e filtro por tipo · US06 endereço e contato |
| **E3 – Relato de sintomas e rota de cuidado** | US07 lista de sintomas e sinais de alarme (SINAN) · US08 encaminhamento por protocolo do MS · US09 frequência do conjunto de sintomas entre casos confirmados · US10 aviso não descartável |
| **E4 – Gravidade e retaguarda** | US11 proporção de internação por faixa etária · US12 capacidade de leitos |
| **E5 – Capacidades offline** | US13 cache de estabelecimentos · US14 instalação como PWA |
| **E6 – Acessibilidade** | US15 alto contraste e escala de fonte · US16 navegação por teclado · US17 linguagem simples |

[Protótipo no Figma](https://www.figma.com/proto/ZeUHuFk32qVMJ1oax3kFW0/Sentinela-SP?node-id=1-2&p=f&t=SchZelGCWii63nvS-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1)

## Fonte de dados

[API de Dados Abertos do Ministério da Saúde (DEMAS)](https://apidadosabertos.saude.gov.br/v1/)

| Endpoint | Uso |
|---|---|
| `/arboviroses/dengue`, `/arboviroses/chikungunya`, `/arboviroses/zikavirus` | Notificações (SINAN) |
| `/assistencia-a-saude/unidade-basicas-de-saude` | UBS |
| `/assistencia-a-saude/hospitais-e-leitos` | Hospitais e leitos |

O campo `id_unidade` das notificações é o **código CNES** da unidade notificadora. Ele permite ligar cada notificação ao estabelecimento que a registrou.

## Arquitetura

- **Cliente-servidor:** o PWA consome só o backend (API REST), nunca a API do Ministério diretamente.
- **Camadas:** rotas → serviços → repositórios → integração externa.
- **ETL em background:** ingere, normaliza e agrega os dados sem bloquear as requisições.
- **Monólito modular.**

```
┌──────────────┐  HTTPS/JSON  ┌──────────────────────────────────────────┐
│ PWA (React)  │ ───────────▶ │ Backend (Express)                        │
└──────────────┘              │  routes → services → repositories        │
                              │                 ▼                        │
                              │           PostgreSQL ◀── ETL             │
                              └────────────────────────────▲─────────────┘
                                                           │
                                                 API DEMAS (MS)
```

## Tecnologias

TypeScript · React · Vite · Express · Vitest · Supertest · ESLint · Prettier · PostgreSQL

## Como rodar

Requer Node 24 (`nvm use`) e Docker Compose. O Makefile é opcional e requer
GNU Make instalado.

```bash
npm install
cp .env.example .env
make db-setup
npm run dev:api   # http://localhost:3000
npm run dev:web   # http://localhost:5173
```

O PostgreSQL local fica disponível em `localhost:5432`. Para importar os
arquivos JSON de exemplo, coloque-os em `data/` (ignorado pelo Git) ou defina
`SEED_DATA_DIR` no `.env` com o caminho da pasta. `make db-setup` inicia o
PostgreSQL, sincroniza o schema e importa os dados. Ele não sobrescreve tabelas
que já tenham dados; para executar as etapas separadamente, use:

```bash
npm run db:up
npm run db:push -w @sentinela/api
npm run db:seed -w @sentinela/api
```

Por padrão, o importador não sobrescreve dados existentes. Para limpar e
recarregar as tabelas de unidades, capacidade e notificações, execute
`npm run db:seed -w @sentinela/api -- --reset`. Use essa opção apenas no banco
local de desenvolvimento.

Outros comandos úteis: `make db-status` mostra o estado dos serviços e
`make db-down` para o PostgreSQL sem remover o volume de dados. Sem GNU Make,
os comandos `npm run` acima continuam disponíveis.

| Comando | O que faz |
|---|---|
| `npm test` | Testes de todos os pacotes |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm run format` | Formata o código com Prettier |
| `npm run build` | Build de produção do frontend |
| `npm run db:up` | Inicia o PostgreSQL local |
| `npm run db:down` | Para o PostgreSQL local |
| `npm run db:push -w @sentinela/api` | Sincroniza o schema com o banco local |
| `npm run db:seed -w @sentinela/api` | Importa os JSONs de exemplo |

## Estrutura

```
apps/api         backend (Express)
apps/web         frontend (React + Vite)
packages/shared  tipos compartilhados entre api e web
```

## Padrão de commits

```
<tipo>(<escopo>): <descrição curta>
```

| Tipo | Quando usar |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug (muda o comportamento) |
| `refactor` | Melhoria de código sem mudar o comportamento |
| `docs` | Documentação |
| `chore` | Configuração, dependências e infraestrutura |

- O escopo é opcional: `api`, `web` ou `etl`.
- As mensagens ficam em português.
- Os testes vão no mesmo commit do `feat` ou `fix` correspondente.

```
feat(etl): ingere notificações de chikungunya
fix(api): corrige supressão de contagens pequenas
refactor(web): extrai componente de gráfico
```

## Equipe

Cauê Fornielles da Costa · Felipe Kelemen Bernardino · Felipe Sousa dos Santos · Luigi Gasparetti · Pedro Miguelez · Raul Mello Silva
