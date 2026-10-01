# Sessão 02 — Plan, Tasks e decisões de stack

**Data:** 2026-07-01  
**Objetivo:** Escrever `plan.md` e `tasks.md` com base na spec v1.1 aprovada na sessão anterior.

---

## Contexto

Continuação da sessão 01. A spec.md v1.1 estava aprovada com 11 ambiguidades resolvidas. O usuário escolheu JavaScript como stack.

---

## Etapa (d) — plan.md

### Stack definida pelo usuário

**Linguagem:** JavaScript (Node.js 20 ESM)

### Decisões registradas no plan.md

| Decisão | Escolha | Alternativa descartada |
|---|---|---|
| DT-001 — Aritmética monetária | Inteiros de centavos (`valor × 100`) | `decimal.js` — dependência externa desnecessária |
| DT-002 — Arquitetura | Pipeline de fases sequencial, um arquivo por regra | Classe `Motor` com métodos encadeados |
| DT-003 — Test runner | `node:test` nativo do Node 20 | Jest — overhead sem ganho real para este escopo |
| DT-004 — Inferência de diárias | Regex `/(\d+)\s*(?:di[aá]rias?|noites?)/i` na `descricao` | Campo `num_diarias` explícito na entrada (quebraria schema do desafio) |

### Arquitetura definida

```
src/
├── cli.js
├── loader.js
├── engine.js
├── politica.js
├── arredondamento.js
├── resumo.js
└── rules/
    ├── normalize.js
    ├── periodo.js
    ├── duplicatas.js
    ├── estornos.js
    ├── categoria.js
    ├── nota-fiscal.js
    ├── diarias.js
    └── limites.js

tests/
├── rules/          ← um arquivo por RN-NNN
└── integracao/     ← teste ponta-a-ponta com despesas-exemplo.json
```

---

## Etapa (e) — tasks.md

### 16 tasks criadas (T-001 a T-016)

#### Fase 1 — Fundação

| Task | O que faz | Atende |
|---|---|---|
| T-001 | Estrutura do projeto, `package.json`, `politica.js` | DT-001, DT-003 |
| T-002 | `loader.js` — leitura e validação do JSON de entrada | spec seção 4.1 |
| T-003 | `arredondamento.js` — half-up e conversão centavos↔reais | RN-010, AMB-009 |

#### Fase 2 — Regras de negócio (pipeline)

| Task | O que faz | Atende |
|---|---|---|
| T-004 | `normalize.js` — normalização de categoria para minúsculas | RN-006, AMB-007 |
| T-005 | `periodo.js` — filtro de período de competência | RN-007, AMB-006 |
| T-006 | `duplicatas.js` — detecção e marcação de duplicatas (incl. estornos) | RN-009, AMB-008 |
| T-007 | `estornos.js` — compensação de estornos no agregado do grupo | RN-008, AMB-008, AMB-011 |
| T-008 | `categoria.js` — validação de categoria permitida | RN-006 |
| T-009 | `nota-fiscal.js` — exigência de nota fiscal acima de R$100 | RN-005, AMB-004 |
| T-010 | `diarias.js` — inferência de num_diarias da descrição | RN-003, AMB-003 |
| T-011 | `limites.js` — aplicação de limites diários com proporção | RN-001..004, AMB-001, AMB-010 |

#### Fase 3 — Orquestração e resumo

| Task | O que faz | Atende |
|---|---|---|
| T-012 | `engine.js` — encadeamento das 8 fases em ordem | spec seção 8 |
| T-013 | `resumo.js` — cálculo de total_solicitado, total_reembolsavel, total_recusado | spec seção 4.2 |

#### Fase 4 — CLI e integração ponta-a-ponta

| Task | O que faz | Atende |
|---|---|---|
| T-014 | `cli.js` — ponto de entrada com `--input` e `--output` | spec seção 4.2, DESAFIO.md |
| T-015 | Teste de integração completo com `despesas-exemplo.json` | spec seção 9 (todos os critérios) |
| T-016 | `README.md` com instruções de execução e teste | rubrica (penalidade se ausente) |

#### Fase 5 — Envelope (Dia 2)

_Numeração continua de T-017. Tasks criadas após receber a mudança de requisito._

### Matriz de cobertura (resumo)

Todas as regras da spec (RN-001 a RN-010, AMB-001 a AMB-011) mapeadas para task e arquivo de teste na seção "Cobertura" do `tasks.md`.

---

## Arquivos modificados nesta sessão

| Arquivo | Ação |
|---|---|
| `specs/001-motor-reembolso/plan.md` | Escrito (versão 1.1) |
| `specs/001-motor-reembolso/tasks.md` | Escrito (T-001 a T-016) |
| `docs/sessions/02-plan-tasks.md` | Criado (este arquivo) |

---

## Próximos passos

- **Etapa (f):** implementação task por task, começando pela T-001
- Aguardando aprovação das tasks pelo usuário antes de iniciar
