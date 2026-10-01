# Spec — Motor de Cálculo de Reembolso

**Versão:** 1.1 · **Status:** ativo · **Última alteração:** 2026-07-01

> **Regra de ouro deste arquivo:** ele descreve o QUÊ e o PORQUÊ. Nenhuma linha
> aqui pode citar linguagem, biblioteca, classe, função ou estrutura de pasta.
> Se apareceu solução, o lugar dela é o `plan.md`.
>
> **Teste de aceitação da própria spec:** uma pessoa que nunca viu o projeto
> consegue, lendo só este arquivo, verificar se o sistema está correto?

---

## 1. Problema

O processo de reembolso de despesas corporativas é feito manualmente: alguém do
financeiro abre uma planilha, confere cada item contra a política e devolve uma
lista de aprovações e recusas. Esse processo é lento, inconsistente e sujeito a
erro humano — a mesma despesa pode ter resultados diferentes dependendo de quem
analisa.

## 2. Objetivo

Dado um conjunto de despesas de um colaborador num período, o sistema determina
automaticamente o valor reembolsável de cada item e registra a justificativa da
decisão, tornando o resultado auditável, repetível e consistente.

## 3. Fora de escopo

- Não gerencia usuários, autenticação ou permissões.
- Não consulta bancos de dados externos nem APIs de terceiros.
- Não valida a autenticidade de notas fiscais (apenas verifica o campo `tem_nota_fiscal`).
- Não emite notificações, e-mails ou relatórios em formatos além de JSON.
- Não aprova nem recusa pagamentos — apenas calcula e justifica os valores reembolsáveis.
- Não converte moedas; todos os valores são BRL.
- Não aplica a ampliação de 50% para viagens nesta versão: o campo `em_viagem` não existe na entrada (ver AMB-005).
- Não consolida resultados de múltiplos períodos ou colaboradores numa única execução.

---

## 4. Entrada e saída

### 4.1 Entrada

Conforme `exemplos/despesas-exemplo.json`.

| Campo | Tipo | Significado | Obrigatório |
|---|---|---|---|
| `colaborador.id` | string | Identificador único do colaborador | Sim |
| `colaborador.nome` | string | Nome do colaborador | Sim |
| `colaborador.centro_custo` | string | Centro de custo | Sim |
| `periodo.competencia` | string `AAAA-MM` | Mês de competência | Sim |
| `periodo.inicio` | string `AAAA-MM-DD` | Primeiro dia do período | Sim |
| `periodo.fim` | string `AAAA-MM-DD` | Último dia do período | Sim |
| `despesas[].id` | string | Identificador único da despesa | Sim |
| `despesas[].data` | string `AAAA-MM-DD` | Data em que a despesa foi incorrida | Sim |
| `despesas[].categoria` | string | Tipo de despesa (ver RN-006) | Sim |
| `despesas[].descricao` | string | Descrição textual livre | Sim |
| `despesas[].fornecedor` | string | Nome do fornecedor | Sim |
| `despesas[].valor` | number | Valor em BRL (pode ser negativo — ver RN-008) | Sim |
| `despesas[].tem_nota_fiscal` | boolean | Se há nota fiscal vinculada | Sim |

> **Nota sobre hospedagem e número de diárias:** a política define o limite em
> "R$ 250 por diária". O campo `num_diarias` não existe na entrada. Para despesas
> de `hospedagem`, o sistema tenta inferir o número de diárias a partir do campo
> `descricao` buscando um número inteiro positivo seguido da palavra "diaria(s)"
> ou "noite(s)" (insensível a maiúsculas, com ou sem acento). Se não encontrar,
> a despesa é recusada com motivo "Não foi possível determinar o número de diárias".
> (ver AMB-003)

> **Sugestão para versão futura:** adicionar campo `num_diarias` explícito na
> entrada e campo booleano `em_viagem` para habilitar a ampliação de 50% nos
> limites prevista na política do RH (ver AMB-005).

### 4.2 Saída

| Campo | Tipo | Significado |
|---|---|---|
| `colaborador` | object | Cópia do objeto `colaborador` da entrada |
| `periodo` | object | Cópia do objeto `periodo` da entrada |
| `processado_em` | string ISO 8601 | Data e hora UTC em que o cálculo foi executado |
| `resumo.total_solicitado` | number | Soma dos `valor_original` de todos os itens com status `aprovado`, `aprovado_parcial` ou `recusado` (exclui `ignorado`) |
| `resumo.total_reembolsavel` | number | Soma dos `valor_reembolsavel` de itens `aprovado` ou `aprovado_parcial` |
| `resumo.total_recusado` | number | `total_solicitado` − `total_reembolsavel` |
| `itens[].id` | string | Mesmo `id` da entrada |
| `itens[].data` | string | Data da despesa |
| `itens[].categoria` | string | Categoria normalizada (minúsculas) |
| `itens[].valor_original` | number | Valor conforme a entrada |
| `itens[].valor_reembolsavel` | number | Valor aprovado (0 se recusado ou ignorado) |
| `itens[].status` | string | `"aprovado"`, `"aprovado_parcial"`, `"recusado"` ou `"ignorado"` |
| `itens[].motivo` | string | Justificativa legível da decisão |

**Status possíveis:**
- `aprovado` — reembolso integral do valor solicitado.
- `aprovado_parcial` — reembolso até o limite máximo; o excedente não é pago.
- `recusado` — valor reembolsável é zero; motivo obrigatório. O `valor_original` entra no `total_solicitado` e no `total_recusado`.
- `ignorado` — despesa não entra no cálculo (estorno, fora de período, duplicata secundária). Aparece na lista para auditoria, mas não afeta nenhum total do resumo.

**Por que itens `recusado` entram no `total_solicitado`:**
O colaborador solicitou o reembolso; o sistema negou. O `total_recusado` é a diferença entre o que foi pedido e o que será pago — inclui tanto o excedente de itens aprovados parcialmente quanto o valor inteiro de itens recusados. Isso torna o resumo auditável: `total_solicitado = total_reembolsavel + total_recusado`.

**Exemplo de saída (simplificado, dois itens):**

```json
{
  "colaborador": { "id": "c-0417", "nome": "Marina Volpi", "centro_custo": "CC-ENG-PLATAFORMA" },
  "periodo": { "competencia": "2026-07", "inicio": "2026-07-01", "fim": "2026-07-31" },
  "processado_em": "2026-07-01T10:00:00Z",
  "resumo": {
    "total_solicitado": 110.50,
    "total_reembolsavel": 60.00,
    "total_recusado": 50.50
  },
  "itens": [
    {
      "id": "d-001",
      "data": "2026-07-03",
      "categoria": "alimentacao",
      "valor_original": 72.50,
      "valor_reembolsavel": 39.37,
      "status": "aprovado_parcial",
      "motivo": "Limite diário de alimentação (R$ 60,00) atingido. Reembolso proporcional: 72,50 / 110,50 × 60,00."
    },
    {
      "id": "d-002",
      "data": "2026-07-03",
      "categoria": "alimentacao",
      "valor_original": 38.00,
      "valor_reembolsavel": 20.63,
      "status": "aprovado_parcial",
      "motivo": "Limite diário de alimentação (R$ 60,00) atingido. Reembolso proporcional: 38,00 / 110,50 × 60,00."
    }
  ]
}
```

---

## 5. Regras de negócio

### RN-001 — Limite diário de alimentação

**Regra:** O total reembolsável de despesas de `alimentacao` por dia de calendário
é de R$ 60,00. Apenas despesas que chegaram à etapa de limites (não recusadas,
não ignoradas) são somadas no total diário. Se a soma ultrapassar R$ 60,00, o
reembolso de cada item é calculado proporcionalmente: `valor_item / total_dia × limite_dia`.
O resultado de cada item é arredondado para duas casas decimais (half-up).

**Origem:** política do RH, item 1.

**Aceite:** d-001 (R$ 72,50) + d-002 (R$ 38,00) no dia 2026-07-03 → total = R$ 110,50 > R$ 60,00.
d-001 reembolsável = 72,50 / 110,50 × 60,00 = R$ 39,37.
d-002 reembolsável = 38,00 / 110,50 × 60,00 = R$ 20,63.
Soma dos reembolsáveis = R$ 60,00 (pode variar em ±R$ 0,01 por arredondamento).

---

### RN-002 — Limite diário de transporte urbano

**Regra:** O total reembolsável de despesas de `transporte_urbano` por dia de
calendário é de R$ 80,00. Apenas despesas não recusadas e não ignoradas entram
no total diário. Mesma lógica de agregação e distribuição proporcional de RN-001.

**Origem:** política do RH, item 2.

**Aceite:** d-003 (R$ 100,00) está sozinha no dia 2026-07-06 para fins de limite
(d-004 é recusada por falta de nota fiscal antes desta etapa). Total = R$ 100,00 > R$ 80,00 → d-003 reembolsável = R$ 80,00 (aprovado_parcial).

---

### RN-003 — Limite diário de hospedagem

**Regra:** O total reembolsável de despesas de `hospedagem` por dia de calendário
é calculado com base no número de diárias inferido da `descricao` (ver AMB-003).
O limite máximo do dia é `num_diarias × R$ 250,00`.
Múltiplas despesas de hospedagem no mesmo dia somam para esse limite diário,
com distribuição proporcional igual à de RN-001.
Apenas despesas não recusadas e não ignoradas entram no total diário.

**Origem:** política do RH, item 3.

**Aceite:** despesa de R$ 480,00 com 2 diárias inferidas → limite = R$ 500,00 → R$ 480,00 < R$ 500,00 → reembolsável = R$ 480,00 (aprovado).
Despesa de R$ 900,00 com 3 diárias inferidas → limite = R$ 750,00 → reembolsável = R$ 750,00 (aprovado_parcial).

---

### RN-004 — Reembolso parcial de despesas acima do limite

**Regra:** Despesas cujo total diário excede o limite são reembolsadas até o
valor do limite (status `aprovado_parcial`). O item não é recusado integralmente
— apenas o excedente não é pago.

**Origem:** política do RH, item 4.

**Aceite:** limite diário de alimentação = R$ 60,00; total do dia = R$ 70,00 → reembolsável = R$ 60,00, status = `aprovado_parcial`.

---

### RN-005 — Nota fiscal obrigatória para valores acima de R$ 100,00

**Regra:** Despesas com `valor` estritamente maior que R$ 100,00 **e**
`tem_nota_fiscal = false` são recusadas integralmente com motivo
"Nota fiscal obrigatória para valores acima de R$ 100,00".
Despesas com `valor` exatamente igual a R$ 100,00 e `tem_nota_fiscal = false`
**não** são recusadas por esta regra.

**Origem:** política do RH, item 5.

**Aceite:** d-003 (R$ 100,00, sem nota) → não recusada por esta regra; avaliada normalmente.
d-004 (R$ 100,01, sem nota) → recusada: nota fiscal obrigatória.
d-013 (R$ 690,00, sem nota) → recusada: nota fiscal obrigatória.

---

### RN-006 — Categorias permitidas

**Regra:** Somente as categorias `alimentacao`, `transporte_urbano` e `hospedagem`
são reembolsáveis. A comparação é insensível a maiúsculas/minúsculas (ver AMB-007).
Qualquer outra categoria recebe `status = "recusado"` e motivo
"Categoria não coberta pela política de reembolso".

**Origem:** política do RH, item 9.

**Aceite:** d-005 (categoria `coworking`) → recusada. d-014 (`ALIMENTACAO`) → tratada como `alimentacao`.

---

### RN-007 — Período de competência

**Regra:** Somente despesas cuja `data` esteja dentro do intervalo
`[periodo.inicio, periodo.fim]` (ambos inclusive) são processadas.
Despesas com `data` fora desse intervalo recebem `status = "ignorado"` e motivo
"Data fora do período de competência (`<data>` não está em `<inicio>` a `<fim>`)".

**Origem:** política do RH, item 7.

**Aceite:** d-008 (data 2026-04-15, período 2026-07-01 a 2026-07-31) → ignorada.

---

### RN-008 — Estornos (valores negativos)

**Regra:** Despesas com `valor` estritamente negativo são estornos.
O valor absoluto do estorno é subtraído do `valor_original` **agregado** de todas
as despesas da mesma `categoria` (normalizada) e mesmo `fornecedor`
(insensível a maiúsculas) no mesmo período de competência que já passaram pela
verificação de período e não são elas mesmas estornos ou ignoradas.
Se o resultado do agregado ficar negativo ou zero, nenhuma despesa desse grupo
terá reembolso.
O estorno em si é marcado `ignorado` com motivo "Estorno: compensou despesas de
`<categoria>` do fornecedor `<fornecedor>` no período".
Se não existir nenhuma despesa compatível no período, o estorno é marcado
`ignorado` com motivo "Estorno sem despesa correspondente para compensar".

**Origem:** política do RH, item 8.

**Aceite:** d-009 (−R$ 45,00, `transporte_urbano`, `TaxiApp`) → reduz o total de
`transporte_urbano` + `TaxiApp` no período em R$ 45,00. d-003 (R$ 100,00) e d-004
(R$ 100,01) somam R$ 200,01 agregados; após estorno: R$ 155,01. O motor aplica
os limites diários sobre os valores resultantes.

---

### RN-009 — Duplicatas

**Regra:** Duas despesas são duplicatas quando têm exatamente os mesmos valores
de `data`, `categoria` (normalizada), `fornecedor` (insensível a maiúsculas/minúsculas)
e `valor`. A primeira ocorrência (menor `id` em ordem lexicográfica entre as
duplicatas) é processada normalmente; as demais recebem `status = "ignorado"` e
motivo "Duplicata da despesa `<id da principal>`".
Estornos (valores negativos) também são sujeitos à deduplicação: se dois estornos
têm o mesmo grupo data+categoria+fornecedor+valor, apenas o primeiro (menor `id`)
é aplicado; o segundo é descartado como duplicata.

**Origem:** política do RH, item 8.

**Aceite:** d-006 e d-007: mesma data (2026-07-09), categoria (`alimentacao`), fornecedor (`Bistro Central`), valor (R$ 54,90). d-006 (id menor) é processada; d-007 → ignorada, motivo "Duplicata da despesa d-006".

---

### RN-010 — Arredondamento monetário

**Regra:** Todos os valores reembolsáveis no output são arredondados para duas
casas decimais usando half-up (0,005 arredonda para 0,01). Cálculos internos
(proporções, limites) usam precisão máxima disponível; o arredondamento é
aplicado apenas ao `valor_reembolsavel` final de cada item e aos totais do resumo.

**Origem:** identificado na análise do arquivo de exemplo (d-011, valor R$ 33,333).

**Aceite:** d-011 (R$ 33,333, `alimentacao`, abaixo do limite) → `valor_reembolsavel` = R$ 33,33.

---

## 6. Ambiguidades identificadas e decisões

### AMB-001 — "R$ 60 por dia": por despesa individual ou por total diário?

**Texto original do RH:** "Alimentação tem limite de R$ 60 por dia."

**O que não estava claro:** o limite se aplica a cada despesa individualmente
(cada item pode ser até R$ 60) ou ao total de todas as despesas de alimentação
no mesmo dia (a soma do dia não pode passar de R$ 60)?

**Decisão:** o limite de R$ 60,00 aplica-se ao **total diário**. Se a soma
ultrapassar o limite, o reembolso de cada item é calculado proporcionalmente.

**Justificativa:** o arquivo de exemplo tem d-001 (R$ 72,50) e d-002 (R$ 38,00)
no mesmo dia; esse par só faz sentido como teste se a regra for sobre o total
diário — caso contrário d-001 seria simplesmente cortada e d-002 aprovada sem
lógica interessante.

**Regra afetada:** RN-001, RN-002.

---

### AMB-002 — "Reembolsadas parcialmente": paga o limite ou recusa o item?

**Texto original do RH:** "Despesas acima do limite são reembolsadas parcialmente."

**O que não estava claro:** (a) paga até o limite e corta o excedente, ou
(b) recusa o item inteiro por estar acima do limite.

**Decisão:** paga o **valor do limite** (status `aprovado_parcial`). O excedente
não é pago, mas o item não é recusado.

**Justificativa:** "reembolsadas parcialmente" é contraditório com recusa total
(que seria reembolso zero, não parcial). A leitura (a) é a única coerente com
o enunciado literal.

**Regra afetada:** RN-004.

---

### AMB-003 — "R$ 250 por diária": como saber quantas diárias houve?

**Texto original do RH:** "Hospedagem tem limite de R$ 250 por diária."

**O que não estava claro:** o arquivo de entrada não inclui campo `num_diarias`.
Sem esse dado, não é possível calcular o limite correto.

**Decisão:** o sistema infere o número de diárias a partir do campo `descricao`
buscando um número inteiro positivo imediatamente antes ou depois das palavras
"diaria(s)" ou "noite(s)" (insensível a maiúsculas, com ou sem acento). Exemplos
válidos: "2 diárias", "Hotel - 3 noites", "diárias: 1". Se a inferência falhar
(padrão não encontrado ou número ≤ 0), a despesa é recusada com motivo
"Não foi possível determinar o número de diárias a partir da descrição".

**Justificativa:** exigir um campo adicional na entrada quebraria o schema definido
no desafio. Inferir da descrição é frágil mas auditável: o motivo de recusa indica
exatamente por que falhou, e o colaborador pode corrigir a descrição.

**Regra afetada:** RN-003.

---

### AMB-004 — "Acima de R$ 100": R$ 100,00 exato exige nota fiscal?

**Texto original do RH:** "Nota fiscal é obrigatória acima de R$ 100."

**O que não estava claro:** "acima de" é estritamente maior (> 100) ou maior ou
igual (≥ 100)?

**Decisão:** "acima de" é interpretado como **estritamente maior** (> 100,00).
Uma despesa de exatamente R$ 100,00 não exige nota fiscal.

**Justificativa:** "acima de" em português é normalmente estritamente maior.
O arquivo de exemplo inclui d-003 (R$ 100,00) e d-004 (R$ 100,01) sem nota
fiscal, sugerindo que essa fronteira é um caso de teste deliberado.

**Regra afetada:** RN-005.

---

### AMB-005 — "Em viagem": como identificar viagem?

**Texto original do RH:** "Colaborador em viagem tem limites ampliados em 50%."

**O que não estava claro:** o JSON de entrada não possui campo `em_viagem` ou
similar. Não há como determinar, com os dados disponíveis, se uma despesa
ocorreu durante uma viagem.

**Decisão:** a regra de ampliação de 50% **não é implementada nesta versão**.
A ausência do campo torna qualquer inferência não-auditável. Os limites aplicados
são sempre os valores-base da política. Recomenda-se adicionar campo booleano
`em_viagem` no objeto `colaborador` da entrada em versão futura.

**Justificativa:** implementar uma regra com base em informação ausente produziria
resultados incorretos e não-auditáveis.

**Regra afetada:** RN-001, RN-002, RN-003 (limites permanecem sem ampliação).

---

### AMB-006 — "Período de competência": qual data usar?

**Texto original do RH:** "Despesas devem ser lançadas dentro do período de
competência."

**O que não estava claro:** (a) "lançadas" refere-se à data da despesa ou à data
de lançamento no sistema? (b) como interpretar "período de competência"?

**Decisão:** o critério é a **`data` da despesa** (data em que foi incorrida)
estar dentro do intervalo `[periodo.inicio, periodo.fim]`, ambos inclusive.
Não há campo de "data de lançamento" na entrada.

**Justificativa:** d-008 (data 2026-04-15, período 2026-07) é o caso de teste
para essa regra. A única data disponível e verificável é a data da despesa.

**Regra afetada:** RN-007.

---

### AMB-007 — Case sensitivity nas categorias

**Texto original do RH:** (a política não menciona maiúsculas/minúsculas)

**O que não estava claro:** d-014 usa categoria `ALIMENTACAO`. O sistema deve
rejeitar como categoria desconhecida ou normalizar?

**Decisão:** a comparação de categoria é **insensível a maiúsculas/minúsculas**.
A categoria é normalizada para minúsculas antes de qualquer avaliação.

**Justificativa:** rejeitar por diferença de caixa puniria o colaborador por
um problema de formatação da entrada, não por uma despesa ilegítima.

**Regra afetada:** RN-006, RN-009.

---

### AMB-008 — "Duplicatas devem ser tratadas": como? E estornos duplicados?

**Texto original do RH:** "Duplicatas devem ser tratadas."

**O que não estava claro:** (a) "tratadas" pode significar recusar, consolidar,
manter a primeira ou alertar. (b) A política não menciona estornos (valores
negativos) explicitamente. (c) Um estorno pode ser duplicata de outro estorno?

**Decisão para duplicatas:** manter a **primeira ocorrência** (menor `id`
lexicográfico) e marcar as demais como `ignorado`. Critério de duplicidade:
mesma `data` + mesma `categoria` (normalizada) + mesmo `fornecedor`
(insensível a maiúsculas) + mesmo `valor` (incluindo sinal — um estorno de
−R$ 45,00 só é duplicata de outro estorno de −R$ 45,00 do mesmo grupo).

**Decisão para estornos duplicados:** se dois estornos têm o mesmo grupo
data+categoria+fornecedor+valor, apenas o primeiro (menor `id`) é aplicado;
o segundo é descartado como `ignorado` com motivo de duplicata.

**Decisão para estornos:** valores negativos compensam o total agregado de
`valor_original` de despesas da mesma categoria+fornecedor no período (ver RN-008).

**Justificativa para duplicatas:** "tratar" mais naturalmente significa não
reembolsar duas vezes. Manter a primeira e ignorar as demais é auditável.

**Justificativa para estornos:** um estorno se refere a uma transação anterior;
compensar o agregado é mais justo do que impactar apenas um item específico.
Deduplica-se estornos pelo mesmo motivo que despesas: não processar o mesmo
cancelamento duas vezes.

**Regra afetada:** RN-008, RN-009.

---

### AMB-009 — Valores com mais de duas casas decimais

**Texto original do RH:** (a política não menciona precisão decimal)

**O que não estava claro:** d-011 tem valor R$ 33,333. Como tratar na aritmética
e no output?

**Decisão:** calcular internamente com precisão máxima; arredondar para duas
casas decimais (half-up) apenas no `valor_reembolsavel` final e nos totais.

**Justificativa:** o output é um documento financeiro; apresentar R$ 33,333
seria não-convencional e potencialmente problemático em sistemas downstream.

**Regra afetada:** RN-010.

---

### AMB-010 — Despesas recusadas ou ignoradas entram no total diário para cálculo proporcional?

**Texto original do RH:** (implícito nas regras de limite)

**O que não estava claro:** ao calcular o total diário de uma categoria para fins
de proporção (RN-001, RN-002, RN-003), despesas que já foram recusadas (ex: falta
de nota fiscal) ou ignoradas (ex: fora do período, duplicata) devem entrar na soma?

**Decisão:** despesas recusadas ou ignoradas em etapas anteriores **não entram**
no total diário para cálculo proporcional. Somente despesas que chegaram à etapa
de limites são contabilizadas.

**Justificativa:** incluir despesas recusadas no total diário distorceria o
cálculo — o colaborador seria penalizado por uma despesa que ele mesmo não vai
receber. Por exemplo: se d-004 (R$ 100,01, recusada por falta de nota) entrasse
no total diário de transporte junto com d-003 (R$ 100,00), o limite de R$ 80,00
seria distribuído proporcionalmente entre as duas, reduzindo o reembolso de d-003
indevidamente.

**Regra afetada:** RN-001, RN-002, RN-003.

---

### AMB-011 — Estorno com valor absoluto maior que o total das despesas do grupo

**Texto original do RH:** "Duplicatas devem ser tratadas." / implícito em estornos

**O que não estava claro:** se o estorno (−R$ 45,00) fosse maior que o total de
`valor_original` das despesas compatíveis no período, o saldo ficaria negativo.
O que acontece?

**Decisão:** o `valor_reembolsavel` de nenhum item pode ser negativo. Se o estorno
reduz o total agregado a zero ou abaixo, todas as despesas do grupo ficam com
`valor_reembolsavel = 0` e status `recusado` (motivo: "Valor integral compensado
por estorno"). O excedente do estorno não é transportado para outros grupos.

**Justificativa:** reembolso negativo não tem significado financeiro neste contexto.
O excedente é descartado para manter o sistema simples e auditável.

**Regra afetada:** RN-008.

---

## 7. Casos de borda

| Caso | Entrada | Comportamento esperado | Regra |
|---|---|---|---|
| Múltiplas despesas de alimentação mesmo dia, soma acima do limite | d-001 + d-002 (dia 2026-07-03, total R$ 110,50) | Reembolso total = R$ 60,00, proporcional | RN-001, AMB-001 |
| Despesa com exatamente R$ 100,00 sem nota fiscal | d-003 (R$ 100,00, `tem_nota_fiscal: false`) | Processada normalmente (nota não obrigatória ≤ R$ 100,00) | RN-005, AMB-004 |
| Despesa com R$ 100,01 sem nota fiscal | d-004 (R$ 100,01, `tem_nota_fiscal: false`) | Recusada: nota fiscal obrigatória | RN-005, AMB-004 |
| Despesa recusada excluída do total diário | d-004 recusada; d-003 sozinha no dia | d-003 calculada com total diário = R$ 100,00 (sem d-004) | AMB-010 |
| Categoria não coberta | d-005 (`coworking`) | Recusada: categoria fora da política | RN-006 |
| Duplicata exata | d-006 e d-007 (mesma data/categoria/fornecedor/valor) | d-006 aprovada; d-007 ignorada (duplicata) | RN-009, AMB-008 |
| Data fora do período de competência | d-008 (data 2026-04-15, período 2026-07) | Ignorada: fora do período | RN-007, AMB-006 |
| Estorno compensa total agregado do grupo | d-009 (−R$ 45,00, `transporte_urbano`, `TaxiApp`) | Ignora o estorno; reduz valor_original agregado do grupo em R$ 45,00 | RN-008, AMB-008 |
| Hospedagem: num_diarias inferido da descrição | d-010 "Hotel Rio - 2 diárias" | num_diarias = 2; limite = R$ 500,00 | RN-003, AMB-003 |
| Hospedagem: descrição sem número de diárias | despesa de hospedagem sem padrão na descrição | Recusada: não foi possível determinar o número de diárias | RN-003, AMB-003 |
| Valor com três casas decimais | d-011 (R$ 33,333) | `valor_reembolsavel` = R$ 33,33 (arredondamento) | RN-010, AMB-009 |
| Hospedagem sem nota fiscal acima de R$ 100 | d-013 (R$ 690,00, sem nota) | Recusada: nota fiscal obrigatória | RN-005 |
| Categoria em maiúsculas | d-014 (`ALIMENTACAO`) | Normalizada e tratada como `alimentacao` | RN-006, AMB-007 |
| Lista de despesas vazia | `"despesas": []` | Saída válida com totais zero e lista de itens vazia | — |
| Hospedagem dentro do limite por diária | R$ 480,00 com 2 diárias inferidas | Aprovada integralmente (R$ 480 < 2 × R$ 250) | RN-003 |
| Hospedagem acima do limite por diária | R$ 900,00 com 3 diárias inferidas | Aprovada parcialmente: reembolsável = R$ 750,00 | RN-003, RN-004 |
| Estorno maior que total do grupo | estorno de −R$ 300,00, grupo tem R$ 200,00 | Todas as despesas do grupo: valor_reembolsavel = 0 | RN-008, AMB-011 |

---

## 8. Ordem de aplicação das regras

Quando múltiplas regras incidem sobre uma despesa, a ordem é:

1. **Normalização de categoria** (AMB-007) — converte para minúsculas; sem essa etapa as demais comparações são incorretas.
2. **Período de competência** (RN-007) — fora do período → `ignorado`; nenhuma outra regra avaliada.
3. **Duplicatas** (RN-009) — duplicata secundária (incluindo estornos duplicados) → `ignorado`; nenhuma outra regra avaliada.
4. **Estornos** (RN-008) — valor negativo → reduz total agregado do grupo ou é `ignorado` se sem grupo compatível; nenhuma outra regra avaliada para o estorno.
5. **Categoria permitida** (RN-006) — categoria desconhecida → `recusado`; nenhuma regra de limite avaliada.
6. **Nota fiscal** (RN-005) — valor > R$ 100,00 sem nota → `recusado`; excluída do total diário.
7. **Inferência de diárias** (RN-003 / AMB-003) — hospedagem sem padrão na descrição → `recusado`; excluída do total diário.
8. **Limites diários** (RN-001, RN-002, RN-003) — aplicados sobre as despesas restantes; excedente → `aprovado_parcial`.
9. **Arredondamento** (RN-010) — aplicado ao `valor_reembolsavel` final de cada item e aos totais.

**Motivação:** regras de exclusão total têm prioridade sobre regras de limite
parcial, evitando que despesas recusadas sejam contabilizadas no total diário
e distorçam o cálculo dos demais itens. Duplicatas vêm antes de estornos para
que um estorno duplicado não seja aplicado duas vezes antes de ser descartado.

---

## 9. Critérios de aceite

O sistema está pronto quando:

- [ ] Processar `exemplos/despesas-exemplo.json` sem erros e produzir JSON válido.
- [ ] d-001 + d-002 (alimentação, 2026-07-03) terem soma de `valor_reembolsavel` exatamente R$ 60,00 (±R$ 0,01 por arredondamento distribuído).
- [ ] d-003 (R$ 100,00 sem nota) **não** ser recusada por falta de nota fiscal; ter `valor_reembolsavel` = R$ 80,00 (único do dia, acima do limite de transporte).
- [ ] d-004 (R$ 100,01 sem nota) ser `recusado` com motivo de nota fiscal; **não** entrar no total diário de transporte.
- [ ] d-005 (`coworking`) ser `recusado` com motivo de categoria.
- [ ] d-006 ser processada normalmente; d-007 ser `ignorado` (duplicata de d-006).
- [ ] d-008 ser `ignorado` (fora do período de competência).
- [ ] d-009 (estorno −R$ 45,00) ser `ignorado` e reduzir o total agregado de `transporte_urbano` + `TaxiApp` em R$ 45,00.
- [ ] d-010 ("Hotel Rio - 2 diárias") ter `num_diarias` inferido como 2; limite = R$ 500,00; `valor_reembolsavel` = R$ 480,00.
- [ ] d-011 ter `valor_reembolsavel` de R$ 33,33.
- [ ] d-013 ser `recusado` por falta de nota fiscal.
- [ ] d-014 (`ALIMENTACAO`) ser tratada como `alimentacao`.
- [ ] `resumo.total_reembolsavel` = soma dos `valor_reembolsavel` de itens `aprovado` ou `aprovado_parcial`.
- [ ] `resumo.total_solicitado` = soma dos `valor_original` de itens `aprovado`, `aprovado_parcial` e `recusado` (exclui `ignorado`).
- [ ] `resumo.total_recusado` = `total_solicitado` − `total_reembolsavel`.
- [ ] CLI aceitar `--input` e `--output` e escrever o arquivo de saída corretamente.
- [ ] Todos os testes automatizados passarem.

---

## 10. O que fica em aberto

- **Ampliação de 50% para viagem (AMB-005):** campo `em_viagem` não existe na entrada desta versão. Decisão: não implementar. Quando o campo for adicionado, a lógica é: se `em_viagem = true`, multiplicar os limites de RN-001, RN-002 e RN-003 por 1,5 antes de aplicar.
- **Fusos horários:** datas são tratadas como datas de calendário sem conversão de fuso.
- **Nota fiscal cobre o valor:** o sistema confia no campo `tem_nota_fiscal`; não há como verificar se a nota cobre o valor declarado.
- **Inferência de diárias frágil:** o padrão de texto da `descricao` pode variar; uma versão futura deveria exigir `num_diarias` como campo explícito na entrada.
