# Tasks — Motor de Cálculo de Reembolso

> Cada task é pequena o bastante para virar **um commit**. Se você não consegue
> descrever o critério de aceite como "o teste X passa", a task está grande demais.
>
> Marque `[x]` conforme conclui — ao longo do caminho, não tudo no fim. O histórico
> de quando cada task foi marcada é lido na correção.

**Formato do commit:** `feat(T-003): <descrição>` · `test(T-003): <descrição>`

---

## Fase 1 — Fundação

- [ ] **T-001** — Estrutura do projeto e configuração do ambiente
  - **O que faz:** cria `package.json` com `"type": "module"`, script `start` (`node src/cli.js`) e script `test` (`node --test tests/**/*.test.js`). Cria as pastas `src/`, `src/rules/`, `tests/`, `tests/rules/`, `tests/integracao/`. Cria `src/politica.js` com os limites e categorias permitidas como constantes exportadas.
  - **Atende:** DT-001 (aritmética em centavos), DT-003 (test runner nativo)
  - **Aceite:** `npm test` roda sem erro (zero testes ainda, mas o runner não falha). `node -e "import('./src/politica.js').then(m => console.log(m.LIMITES))"` imprime os limites corretamente.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-002** — Loader: leitura e validação do JSON de entrada
  - **O que faz:** implementa `src/loader.js` que lê o arquivo passado como caminho, faz parse do JSON e valida presença dos campos obrigatórios (`colaborador.id`, `colaborador.nome`, `colaborador.centro_custo`, `periodo.competencia`, `periodo.inicio`, `periodo.fim`, `despesas[]` com `id`, `data`, `categoria`, `descricao`, `fornecedor`, `valor`, `tem_nota_fiscal`). Lança erro com mensagem clara se inválido.
  - **Atende:** spec seção 4.1
  - **Aceite:** teste `tests/rules/loader.test.js` — JSON válido retorna objeto estruturado; JSON sem campo obrigatório lança erro com mensagem que identifica o campo faltante.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-003** — Arredondamento half-up (RN-010)
  - **O que faz:** implementa `src/arredondamento.js` com função `arredondarHalfUp(centavos)` que converte centavos inteiros para reais com duas casas decimais usando half-up. Implementa também `paracentavos(valor)` que converte reais para centavos inteiros (`Math.round(valor * 100)`).
  - **Atende:** RN-010, AMB-009
  - **Aceite:** teste `tests/rules/RN-010-arredondamento.test.js` — `3333` centavos → `33.33`; `3334` → `33.34`; `3335` → `33.35` (half-up); `paracentavos(33.333)` → `3333`.
  - **Commit:** _(preenchido após execução)_

---

## Fase 2 — Regras de negócio (pipeline de fases)

- [ ] **T-004** — Fase 1: normalização de categoria (AMB-007)
  - **O que faz:** implementa `src/rules/normalize.js` — função que recebe array de despesas e retorna novo array com `categoria` convertida para minúsculas em todos os itens.
  - **Atende:** RN-006, RN-009, AMB-007
  - **Aceite:** teste `tests/rules/RN-006-categoria.test.js` — `"ALIMENTACAO"` → `"alimentacao"`; `"Transporte_Urbano"` → `"transporte_urbano"`.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-005** — Fase 2: filtro de período de competência (RN-007)
  - **O que faz:** implementa `src/rules/periodo.js` — função que marca como `ignorado` despesas cuja `data` está fora de `[periodo.inicio, periodo.fim]`.
  - **Atende:** RN-007, AMB-006
  - **Aceite:** teste `tests/rules/RN-007-periodo.test.js` — d-008 (2026-04-15, período 2026-07) → `status: 'ignorado'`; despesa no primeiro dia do período → não ignorada; despesa no último dia → não ignorada.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-006** — Fase 3: detecção de duplicatas (RN-009)
  - **O que faz:** implementa `src/rules/duplicatas.js` — função que identifica despesas com mesma data + categoria (normalizada) + fornecedor (case-insensitive) + valor, mantém a de menor `id` lexicográfico e marca as demais como `ignorado`. Aplica também a estornos duplicados.
  - **Atende:** RN-009, AMB-008
  - **Aceite:** teste `tests/rules/RN-009-duplicatas.test.js` — d-006 processada normalmente; d-007 → `status: 'ignorado'`, `motivo` referencia d-006. Dois estornos idênticos: apenas o primeiro é aplicado.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-007** — Fase 4: compensação de estornos (RN-008)
  - **O que faz:** implementa `src/rules/estornos.js` — função que identifica despesas com `valor < 0`, subtrai o valor absoluto do campo `valorCentavos` agregado de despesas da mesma categoria+fornecedor (não ignoradas, não estornos) no período. Se nenhuma despesa compatível, marca o estorno como `ignorado` com motivo adequado. Se o agregado ficar ≤ 0, todas as despesas do grupo ficam com `valorCentavos = 0` (AMB-011). O estorno é sempre marcado `ignorado`.
  - **Atende:** RN-008, AMB-008, AMB-011
  - **Aceite:** teste `tests/rules/RN-008-estornos.test.js` — d-009 (−R$45) reduz total de `transporte_urbano`+`TaxiApp` em R$45; estorno sem grupo compatível → `ignorado`; estorno maior que o grupo → grupo com `valorCentavos = 0`.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-008** — Fase 5: validação de categoria permitida (RN-006)
  - **O que faz:** implementa `src/rules/categoria.js` — função que marca como `recusado` despesas com categoria não presente em `CATEGORIAS_PERMITIDAS` (já normalizada).
  - **Atende:** RN-006
  - **Aceite:** teste `tests/rules/RN-006-categoria.test.js` (ampliado) — `coworking` → `recusado`; `alimentacao` → não recusada por esta regra.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-009** — Fase 6: exigência de nota fiscal (RN-005)
  - **O que faz:** implementa `src/rules/nota-fiscal.js` — função que marca como `recusado` despesas com `valorCentavos > 10000` e `tem_nota_fiscal = false`.
  - **Atende:** RN-005, AMB-004
  - **Aceite:** teste `tests/rules/RN-005-nota-fiscal.test.js` — d-003 (R$100,00 sem nota) → não recusada; d-004 (R$100,01 sem nota) → `recusado`; d-013 (R$690,00 sem nota) → `recusado`.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-010** — Fase 7: inferência de diárias para hospedagem (AMB-003)
  - **O que faz:** implementa `src/rules/diarias.js` — função que, para despesas de `hospedagem` com `status` ainda não definido, aplica regex `/(\d+)\s*(?:di[aá]rias?|noites?)/i` na `descricao`. Se encontrar, preenche `num_diarias`; se não encontrar, marca como `recusado`.
  - **Atende:** RN-003, AMB-003
  - **Aceite:** teste `tests/rules/RN-003-hospedagem.test.js` — `"Hotel Rio - 2 diárias"` → `num_diarias = 2`; `"Airbnb 3 noites"` → `num_diarias = 3`; `"Hospedagem executiva"` → `recusado` com motivo adequado.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-011** — Fase 8: aplicação de limites diários (RN-001, RN-002, RN-003)
  - **O que faz:** implementa `src/rules/limites.js` — função que agrupa despesas elegíveis (não recusadas, não ignoradas) por `data` + `categoria`, calcula o total do dia em centavos, compara com o limite da categoria (para hospedagem: `num_diarias × 25000`). Se total ≤ limite: `aprovado`. Se total > limite: distribuição proporcional → `aprovado_parcial`. Despesas recusadas/ignoradas são excluídas do agrupamento (AMB-010).
  - **Atende:** RN-001, RN-002, RN-003, RN-004, AMB-001, AMB-010
  - **Aceite:** teste `tests/rules/RN-001-alimentacao.test.js` — d-001+d-002 → soma R$60,00 proporcional. Teste `tests/rules/RN-002-transporte.test.js` — d-003 sozinho (d-004 já recusada) → R$80,00. Teste `tests/rules/RN-003-hospedagem.test.js` — d-010 R$480,00 / 2 diárias → `aprovado`; R$900,00 / 3 diárias → `aprovado_parcial` R$750,00.
  - **Commit:** _(preenchido após execução)_

---

## Fase 3 — Orquestração e resumo

- [ ] **T-012** — Engine: orquestração do pipeline completo
  - **O que faz:** implementa `src/engine.js` — função `calcular(entrada)` que recebe o objeto da entrada, enriquece as despesas com `valorCentavos` e campos iniciais (`status: 'pendente'`, `valorReembolsavelCentavos`, `num_diarias: null`, `motivo: ''`), encadeia as 8 fases em ordem e retorna o array de despesas processadas.
  - **Atende:** spec seção 8 (ordem de aplicação)
  - **Aceite:** teste `tests/integracao/despesas-exemplo.test.js` parcial — engine processa a entrada sem lançar erro e retorna array com 14 itens, todos com `status` diferente de `'pendente'`.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-013** — Resumo: cálculo dos totais (spec seção 4.2)
  - **O que faz:** implementa `src/resumo.js` — função que recebe o array de despesas processadas e calcula `total_solicitado` (soma de `valor_original` de itens `aprovado`, `aprovado_parcial`, `recusado`), `total_reembolsavel` (soma de `valor_reembolsavel` de `aprovado` e `aprovado_parcial`) e `total_recusado` (`total_solicitado − total_reembolsavel`). Aplica arredondamento nos totais.
  - **Atende:** spec seção 4.2, AMB-010 (itens ignorados excluídos dos totais)
  - **Aceite:** teste `tests/rules/resumo.test.js` — totais corretos para array com mix de status; `total_solicitado = total_reembolsavel + total_recusado` sempre.
  - **Commit:** _(preenchido após execução)_

---

## Fase 4 — CLI e integração ponta-a-ponta

- [ ] **T-014** — CLI: ponto de entrada com `--input` e `--output`
  - **O que faz:** implementa `src/cli.js` — lê `--input` e `--output` de `process.argv`, chama `loader.js`, chama `engine.js`, monta o objeto de saída (com `colaborador`, `periodo`, `processado_em`, `resumo`, `itens`), serializa para JSON com 2 espaços de indentação e escreve no arquivo de saída. Erros de leitura/validação são impressos em `stderr` e encerram com código 1.
  - **Atende:** spec seção 4.2, DESAFIO.md (interface CLI)
  - **Aceite:** `node src/cli.js --input exemplos/despesas-exemplo.json --output /tmp/resultado.json` roda sem erro e produz JSON válido com todos os campos da spec.
  - **Commit:** _(preenchido após execução)_

- [ ] **T-015** — Teste de integração ponta-a-ponta com `despesas-exemplo.json`
  - **O que faz:** implementa `tests/integracao/despesas-exemplo.test.js` completo — processa o arquivo de exemplo e verifica cada item individualmente contra os critérios de aceite da spec seção 9.
  - **Atende:** todos os critérios de aceite da spec seção 9
  - **Aceite:** todos os asserts passam:
    - d-001 + d-002: soma `valor_reembolsavel` = R$60,00 (±R$0,01)
    - d-003: não recusada por nota fiscal; `valor_reembolsavel` = R$80,00
    - d-004: `status = 'recusado'`, motivo contém "nota fiscal"
    - d-005: `status = 'recusado'`, motivo contém "categoria"
    - d-006: processada; d-007: `status = 'ignorado'`
    - d-008: `status = 'ignorado'`
    - d-009: `status = 'ignorado'`
    - d-010: `status = 'aprovado'`, `valor_reembolsavel = 480.00`
    - d-011: `valor_reembolsavel = 33.33`
    - d-013: `status = 'recusado'`
    - d-014: tratada como `alimentacao`
    - `total_solicitado = total_reembolsavel + total_recusado`
  - **Commit:** _(preenchido após execução)_

- [ ] **T-016** — README com instruções de execução e teste
  - **O que faz:** escreve `README.md` com: pré-requisitos (Node.js ≥ 20), como instalar (nenhum `npm install` necessário — zero dependências), como rodar (`node src/cli.js --input ... --output ...`), como testar (`npm test`), exemplo de saída.
  - **Atende:** rubrica (penalidade se README não permite rodar o projeto)
  - **Aceite:** alguém que nunca viu o projeto consegue rodar e testar seguindo apenas o README.
  - **Commit:** _(preenchido após execução)_

---

## Fase 5 — Envelope (criar no Dia 2)

_Tasks a partir da mudança de requisito do dia 2. Numeração continua de T-017 em diante — não reiniciar e não renumerar as antigas._

---

## Cobertura

| Regra da spec | Task | Teste |
|---|---|---|
| RN-001 | T-011 | `tests/rules/RN-001-alimentacao.test.js` |
| RN-002 | T-011 | `tests/rules/RN-002-transporte.test.js` |
| RN-003 | T-010, T-011 | `tests/rules/RN-003-hospedagem.test.js` |
| RN-004 | T-011 | `tests/rules/RN-001-alimentacao.test.js`, `RN-002-transporte.test.js` |
| RN-005 | T-009 | `tests/rules/RN-005-nota-fiscal.test.js` |
| RN-006 | T-004, T-008 | `tests/rules/RN-006-categoria.test.js` |
| RN-007 | T-005 | `tests/rules/RN-007-periodo.test.js` |
| RN-008 | T-007 | `tests/rules/RN-008-estornos.test.js` |
| RN-009 | T-006 | `tests/rules/RN-009-duplicatas.test.js` |
| RN-010 | T-003 | `tests/rules/RN-010-arredondamento.test.js` |
| AMB-001 | T-011 | `tests/rules/RN-001-alimentacao.test.js` |
| AMB-003 | T-010 | `tests/rules/RN-003-hospedagem.test.js` |
| AMB-004 | T-009 | `tests/rules/RN-005-nota-fiscal.test.js` |
| AMB-007 | T-004 | `tests/rules/RN-006-categoria.test.js` |
| AMB-008 | T-006, T-007 | `tests/rules/RN-009-duplicatas.test.js`, `RN-008-estornos.test.js` |
| AMB-009 | T-003 | `tests/rules/RN-010-arredondamento.test.js` |
| AMB-010 | T-011 | `tests/rules/RN-002-transporte.test.js` |
| AMB-011 | T-007 | `tests/rules/RN-008-estornos.test.js` |
