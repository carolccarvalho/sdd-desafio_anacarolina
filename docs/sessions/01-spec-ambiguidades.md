# Sessão 01 — Spec e resolução de ambiguidades

**Data:** 2026-07-01  
**Objetivo:** Revisar a spec.md gerada na sessão anterior, identificar ambiguidades e resolvê-las com o usuário.

---

## Contexto inicial

O usuário retomou o projeto após uma sessão anterior em que a spec havia sido redigida. Como as sessões são stateless, o agente releu todos os arquivos relevantes:

- `DESAFIO.md`
- `RUBRICA.md`
- `exemplos/despesas-exemplo.json`
- `CLAUDE.md`
- `specs/001-motor-reembolso/spec.md`

---

## Etapa (a) — Lista de ambiguidades identificadas na spec existente

O agente identificou 8 pontos ambíguos ou problemáticos na spec anterior:

**P-001 — AMB-003: `num_diarias` exigido na entrada**
A spec dizia que `num_diarias` deve vir na entrada para hospedagem, mas o arquivo `despesas-exemplo.json` não tem esse campo. d-010 ("Hotel Rio - 2 diárias") seria recusada mesmo a descrição dizendo "2 diárias".

**P-002 — RN-008: qual despesa o estorno compensa?**
A spec dizia "a despesa mais recente". d-009 é estorno de `transporte_urbano` + `TaxiApp`. As candidatas são d-003 e d-004 (mesmo dia). Não estava claro se compensa a mais recente individualmente ou o total agregado do grupo.

**P-003 — RN-008 + RN-009: qual vem antes — estorno ou duplicata?**
Se um estorno for duplicata de outro estorno, ele seria ignorado como duplicata antes de compensar algo. A ordem importa.

**P-004 — RN-001/002: despesas recusadas entram no total diário?**
d-004 é recusada por falta de nota fiscal antes da etapa de limites. A spec não dizia explicitamente se despesas recusadas são excluídas do total diário antes do cálculo proporcional.

**P-005 — `resumo.total_solicitado`: o que entra?**
A spec dizia "exclui ignorado", mas não deixava claro se itens `recusado` entram. O `total_recusado` é definido como `total_solicitado − total_reembolsavel`.

**P-006 — Estorno compensa `valor_original` ou `valor_reembolsavel`?**
A spec dizia "reduz o `valor_reembolsavel`", mas isso cria dependência de ordem: o limite precisa ser calculado antes do estorno, mas o estorno vem antes do limite na ordem de regras.

**P-007 — Hospedagem: limite por item ou por dia?**
Alimentação e transporte têm limite por dia (agregando múltiplos itens). Hospedagem não estava explícita nesse ponto.

**P-008 — Valor do estorno maior que o `valor_reembolsavel` da despesa alvo**
A spec dizia "sem ficar negativo", mas não definia o que acontece com o excedente.

---

## Etapa (b) — Decisões tomadas pelo usuário

### P-001 — Hospedagem sem `num_diarias`

**Pergunta:** Se a descrição não contiver um número de diárias legível, o que o sistema faz?

**Opções apresentadas:**
- Recusa a despesa (campo obrigatório)
- Exige o campo na entrada
- **Infere da descrição, recusa se não conseguir** ← escolhida

**Decisão:** O sistema infere o número de diárias a partir do campo `descricao` buscando um número inteiro positivo antes/depois de "diaria(s)" ou "noite(s)". Se não encontrar, recusa com motivo "Não foi possível determinar o número de diárias a partir da descrição".

---

### P-002 — Como o estorno compensa

**Pergunta:** O estorno reduz o agregado do período inteiro ou apenas do mesmo dia?

**Primeira decisão:** Reduz o total agregado da categoria+fornecedor no período inteiro.

**Segunda confirmação:** O estorno reduz o agregado do **período inteiro** (não apenas do dia do estorno).

**Decisão final:** d-009 (−R$ 45,00, `transporte_urbano`, `TaxiApp`) reduz o `valor_original` agregado de todas as despesas `transporte_urbano` + `TaxiApp` no período em R$ 45,00. O motor recalcula os limites com os valores resultantes.

---

### P-003 — Duplicata de estorno

**Decisão do usuário:** "A duplicação de estorno deveria levar em consideração apenas 1. Se já contabilizou 1 estorno, caso tenha outro exatamente igual, deverá ser descartado."

**Resultado:** Estornos duplicados (mesmo data+categoria+fornecedor+valor negativo) são tratados como duplicatas normais — apenas o primeiro (menor `id`) é aplicado; os demais são `ignorado`.

---

### P-004 — Despesas recusadas no total diário

**Decisão do usuário:** "Sim, despesas recusadas precisam ser excluídas antes do total e explicar o porquê."

**Resultado:** Despesas recusadas ou ignoradas em etapas anteriores não entram no total diário para cálculo proporcional. Documentado como AMB-010 com justificativa explícita.

---

### P-005 — `total_solicitado` inclui recusados?

**Decisão do usuário:** "Se total_recusado é a diferença entre o que foi solicitado e o que é válido, então ele precisa conter os valores recusados."

**Resultado:** `total_solicitado` = soma dos `valor_original` de itens `aprovado`, `aprovado_parcial` e `recusado` (exclui apenas `ignorado`). `total_recusado` = `total_solicitado` − `total_reembolsavel`.

---

### P-006 — Estorno compensa `valor_original`

**Decisão do usuário:** "O estorno vai compensar o valor original, vai reduzi-lo e calcular o limite."

**Resultado:** O estorno reduz o `valor_original` agregado do grupo. O motor então recalcula os limites sobre os valores originais já reduzidos.

---

### P-007 — Hospedagem: limite por dia

**Decisão do usuário:** "A diária tem um limite por dia, então, se tiver 2 despesas no mesmo dia, deve somar para um limite."

**Resultado:** Hospedagem segue a mesma lógica de RN-001/RN-002: múltiplas despesas de hospedagem no mesmo dia somam para o limite diário (calculado como `num_diarias × R$ 250,00`), com distribuição proporcional.

---

### P-008 — Estorno deixa valor negativo

**Decisão do usuário:** "Se estorno deixar negativo o valor da despesa, então não vai existir reembolso para ela."

**Resultado:** Se o estorno reduz o total agregado a zero ou abaixo, todas as despesas do grupo ficam com `valor_reembolsavel = 0` e status `recusado` (motivo: "Valor integral compensado por estorno"). O excedente do estorno não é transportado para outros grupos. Documentado como AMB-011.

---

## Etapa (c) — spec.md reescrita

A `spec.md` foi completamente reescrita incorporando todas as decisões acima. Principais mudanças em relação à versão anterior:

### Mudanças estruturais

1. **RN-003 reescrita** — limite de hospedagem é agora diário (igual a RN-001/RN-002), com inferência de `num_diarias` da `descricao`
2. **RN-008 reescrita** — estorno reduz o `valor_original` **agregado** do grupo categoria+fornecedor no período inteiro
3. **RN-009 atualizada** — estornos duplicados também são descartados como duplicatas
4. **Ordem de regras ajustada** — duplicatas (passo 3) antes de estornos (passo 4)
5. **`total_solicitado` clarificado** — inclui `recusado`, exclui `ignorado`

### Novas ambiguidades documentadas

- **AMB-010** — Despesas recusadas excluídas do total diário (com justificativa)
- **AMB-011** — Estorno com valor absoluto maior que o total do grupo

### Contagem final de ambiguidades: 11 (AMB-001 a AMB-011)

---

## Arquivos modificados nesta sessão

| Arquivo | Ação |
|---|---|
| `specs/001-motor-reembolso/spec.md` | Reescrito (versão 1.1) |
| `docs/sessions/01-spec-ambiguidades.md` | Criado (este arquivo) |

---

## Próximos passos

- **Etapa (d):** `plan.md` — aguardando definição de stack pelo usuário
- **Etapa (e):** `tasks.md`
- **Etapa (f):** implementação task por task
