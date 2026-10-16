# Spec — Motor de Cálculo de Reembolso

**Versão:** 1.4 · **Status:** ativo · **Última alteração:** 2026-10-16

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
| `periodo.competencia` | string `AAAA-MM` | Metadado informativo da competência | Sim |
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
> "R$ 250 por diária". O campo `num_diarias` não existe na entrada. Para uma
> hospedagem ser elegível, a `descricao` deve conter exatamente um número inteiro
> positivo em algarismos imediatamente antes de `diária`, `diárias`, `noite` ou
> `noites`, sem distinção de maiúsculas/minúsculas. Número depois da expressão,
> número por extenso ou mais de um número candidato tornam a descrição inválida.
> Se não for possível determinar as diárias, a despesa é recusada com motivo
> "Não foi possível determinar o número de diárias a partir da descrição".
> (ver AMB-003)

> **Sugestão para versão futura:** adicionar campo `num_diarias` explícito na
> entrada e campo booleano `em_viagem` para habilitar a ampliação de 50% nos
> limites prevista na política do RH (ver AMB-005).

### 4.2 Saída

| Campo | Tipo | Significado |
|---|---|---|
| `colaborador` | object | Cópia do objeto `colaborador` da entrada |
| `periodo` | object | Cópia do objeto `periodo` da entrada |
| `processado_em` | string ISO 8601 UTC | Data e hora UTC em que o cálculo foi executado. Critério de aceite: formato válido com sufixo `Z` (ex: `2026-07-01T10:00:00Z`); o valor exato não é verificado por testes funcionais. |
| `resumo.total_solicitado` | number | Soma dos `valor_original` exatos (sem arredondamento prévio) de todos os itens com status `aprovado`, `aprovado_parcial` ou `recusado` (exclui `ignorado`); o total é arredondado para duas casas decimais (half-up) |
| `resumo.total_reembolsavel` | number | Soma dos `valor_reembolsavel` de itens `aprovado` ou `aprovado_parcial` |
| `resumo.total_recusado` | number | `total_solicitado` − `total_reembolsavel` |
| `itens[].id` | string | Mesmo `id` da entrada |
| `itens[].data` | string | Data da despesa |
| `itens[].categoria` | string | Categoria normalizada (minúsculas) |
| `itens[].valor_original` | number | Valor conforme a entrada |
| `itens[].valor_reembolsavel` | number | Valor aprovado (0 se recusado ou ignorado) |
| `itens[].status` | string | `"aprovado"`, `"aprovado_parcial"`, `"recusado"` ou `"ignorado"` |
| `itens[].motivo` | string | Justificativa legível da decisão |
| `itens[].num_diarias` | integer positivo | Quantidade de diárias determinada para hospedagem | Condicional |
| `itens[].limite_unitario_diaria` | number BRL | Limite de uma diária, com duas casas decimais | Condicional |
| `itens[].limite_item` | number BRL | Limite individual do item, com duas casas decimais | Condicional |
| `itens[].limite_grupo` | number BRL | Limite agregado da data e categoria, com duas casas decimais | Condicional |

**Status possíveis:**
- `aprovado` — o valor reembolsável interno corresponde integralmente ao valor efetivo elegível do item, após as compensações aplicáveis e antes do arredondamento final de apresentação.
- `aprovado_parcial` — a aplicação de limite diário ou outra regra que reduza o valor reembolsável interno abaixo do valor efetivo elegível determina este status.
- `recusado` — valor reembolsável é zero; motivo obrigatório. O `valor_original` entra no `total_solicitado` e no `total_recusado`.
- `ignorado` — despesa não entra no cálculo. Aparece na lista para auditoria, mas não afeta nenhum total do resumo. Subcasos (distinguíveis pelo `motivo`): estorno processado, estorno sem correspondente, fora do período de competência e duplicata secundária.

O status é determinado antes do arredondamento final do output, usando os valores efetivos e limites com a precisão interna disponível. O arredondamento de apresentação não transforma uma aprovação integral em aprovação parcial e uma diferença causada somente por arredondamento não representa recusa por política de reembolso.

**Por que itens `recusado` entram no `total_solicitado`:**
O colaborador solicitou o reembolso; o sistema negou. O `total_recusado` é a diferença entre o que foi pedido e o que será pago — inclui **tanto** o excedente de itens `aprovado_parcial` **quanto** o valor inteiro de itens `recusado`. Isso é intencional: `total_recusado` não representa apenas itens integralmente negados, mas todo o valor solicitado que não será pago. A invariante `total_solicitado = total_reembolsavel + total_recusado` deve ser satisfeita em qualquer saída válida.

**Sobre o status `ignorado`:**
Itens `ignorado` não entram em nenhum total do resumo. Esse status cobre três casos distintos, distinguíveis pelo campo `motivo`: (a) estorno (valor negativo processado), (b) fora do período de competência e (c) duplicata secundária. Um quarto subcaso — estorno sem despesa correspondente para compensar — também usa `ignorado`; o `motivo` identifica esse subcaso explicitamente.

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
é de R$ 60,00. Apenas despesas elegíveis na etapa de limites são somadas no total
diário. Se a soma ultrapassar R$ 60,00, o reembolso de cada item é calculado
proporcionalmente. Os valores são arredondados por maiores restos fracionários:
após arredondar para baixo, os centavos restantes são atribuídos aos maiores
restos; empates são resolvidos pela posição no array de entrada. A soma final é
exatamente R$ 60,00.

**Origem:** política do RH, item 1.

**Aceite:** d-001 (R$ 72,50) + d-002 (R$ 38,00) no dia 2026-07-03 → total = R$ 110,50 > R$ 60,00.
d-001 reembolsável = 72,50 / 110,50 × 60,00 = R$ 39,37.
d-002 reembolsável = 38,00 / 110,50 × 60,00 = R$ 20,63.
Soma dos reembolsáveis = R$ 60,00 exatamente; eventual resíduo de centavos é distribuído conforme RN-010.

---

### RN-002 — Limite diário de transporte urbano

**Regra:** O total reembolsável de despesas de `transporte_urbano` por dia de
calendário é de R$ 80,00. Apenas despesas elegíveis na etapa de limites entram
no total diário. Aplica-se a mesma distribuição proporcional e determinística
de RN-001, com soma final exatamente igual ao limite quando o grupo for limitado.

**Origem:** política do RH, item 2.

**Aceite (unitário, sem interferência de estorno):** considerando apenas d-003 isolada e sem d-009 no período, d-003 (R$ 100,00) está sozinha no dia 2026-07-06 (d-004 é recusada por falta de nota fiscal antes desta etapa). Total diário = R$ 100,00 > R$ 80,00 → reembolsável = R$ 80,00 (aprovado_parcial).

**Aceite (com arquivo de exemplo completo):** d-009 é um estorno de −R$ 45,00 do mesmo grupo (`transporte_urbano` + `TaxiApp`). Estornos são aplicados na etapa 4 da pipeline, antes dos limites diários (etapa 8). O valor efetivo de d-003 após o estorno é R$ 100,00 − R$ 45,00 = R$ 55,00. R$ 55,00 < R$ 80,00 → d-003 reembolsável = R$ 55,00, status `aprovado` (não há excedente).

---

### RN-003 — Limite diário de hospedagem

**Regra:** O total reembolsável de despesas de `hospedagem` por dia de calendário
é calculado com base no número de diárias determinado para cada item (ver AMB-003).
O limite individual do item é `num_diarias × R$ 250,00`. O limite do grupo na
mesma data é a soma dos limites individuais dos itens elegíveis. Múltiplas
despesas de hospedagem no mesmo dia compartilham esse limite agregado, com
distribuição proporcional e determinística igual à de RN-001. A soma final é
exatamente igual ao limite do grupo quando ele for excedido. Cada item elegível
emite `num_diarias`, `limite_unitario_diaria`, `limite_item` e `limite_grupo`;
esses campos são omitidos para outras categorias ou quando a inferência falhar.

**Origem:** política do RH, item 3.

**Aceite:** despesa de R$ 480,00 com 2 diárias inferidas → limite = R$ 500,00 → R$ 480,00 < R$ 500,00 → reembolsável = R$ 480,00 (aprovado). Corresponde a d-010 em `despesas-exemplo.json`.
Despesa de R$ 900,00 com 3 diárias inferidas → limite = R$ 750,00 → reembolsável = R$ 750,00 (aprovado_parcial). **Nota:** este segundo caso não existe em `despesas-exemplo.json` (d-013 seria o candidato mas é recusada por falta de nota fiscal antes desta etapa). Deve ser coberto por teste automatizado com dado sintético.

---

### RN-004 — Reembolso parcial de despesas acima do limite

**Regra:** Despesas cujo total diário excede o limite são reembolsadas até o
valor do limite (status `aprovado_parcial`). O item não é recusado integralmente
— apenas o excedente não é pago.

**Origem:** política do RH, item 4.

**Aceite:** limite diário de alimentação = R$ 60,00; total do dia = R$ 70,00 → reembolsável = R$ 60,00, status = `aprovado_parcial`.

---

### RN-005 — Nota fiscal obrigatória para valores acima de R$ 100,00

**Regra:** Despesas com `valor_original` estritamente maior que R$ 100,00 **e**
`tem_nota_fiscal = false` são recusadas integralmente com motivo
"Nota fiscal obrigatória para valores acima de R$ 100,00". A comparação sempre
usa o valor original da entrada, antes de qualquer compensação de estorno.
Despesas com `valor` exatamente igual a R$ 100,00 e `tem_nota_fiscal = false`
**não** são recusadas por esta regra.

**Origem:** política do RH, item 5.

**Aceite:** d-003 (R$ 100,00, sem nota) → não recusada por esta regra; avaliada normalmente.
d-004 (R$ 100,01, sem nota) → recusada: nota fiscal obrigatória.
d-013 (R$ 690,00, sem nota) → recusada: nota fiscal obrigatória.

---

### RN-006 — Categorias permitidas

**Regra:** Somente as categorias canônicas `alimentacao`, `transporte_urbano` e
`hospedagem` são reembolsáveis. A comparação é insensível a maiúsculas/minúsculas.
`alimentacao` e `alimentação` são aliases da categoria canônica `alimentacao`;
o valor emitido em `itens[].categoria` é sempre o nome canônico.
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

**Regra:** Despesas com `valor` estritamente negativo são estornos. Na etapa 5,
o sistema associa cada estorno a um grupo candidato pela mesma `categoria`
(normalizada), `fornecedor` (insensível a maiúsculas) e período de competência,
após normalização, filtro de período e deduplicação. Essa associação não altera
valores e não exclui a despesa das etapas posteriores.

Após categoria, nota fiscal e inferência de diárias, somente despesas elegíveis
formam o grupo compensável. A nota fiscal é sempre avaliada sobre `valor_original`,
sem considerar qualquer estorno. Na etapa de aplicação efetiva, os estornos do
grupo são processados pela posição no array de entrada; cada estorno é aplicado
sequencialmente às despesas elegíveis também pela posição no array, reduzindo
primeiro a primeira despesa até zerar seu saldo e prosseguindo para a seguinte.
Nenhuma despesa pode ter valor efetivo negativo e excedentes não são transportados
para outros grupos.

O estorno em si é marcado `ignorado` com motivo "Estorno: compensou despesas de
`<categoria>` do fornecedor `<fornecedor>` no período". Se não existir nenhuma
despesa elegível para compensar, o estorno é marcado `ignorado` com motivo
"Estorno sem despesa elegível para compensar". Se o valor efetivo de uma despesa
for reduzido a zero, ela não recebe reembolso.

**Origem:** política do RH, item 8.

**Aceite:** d-009 (−R$ 45,00, `transporte_urbano`, `TaxiApp`) é associado na etapa 5 ao grupo candidato com d-003 e d-004, sem alterar seus valores. Na etapa 7, d-004 é recusada por falta de nota fiscal com base em seu `valor_original` de R$ 100,01. Na etapa 9, d-009 é aplicado sequencialmente somente a d-003, reduzindo seu valor efetivo de R$ 100,00 para R$ 55,00. R$ 55,00 < R$ 80,00 → d-003 `aprovado`, reembolsável = R$ 55,00.

---

### RN-009 — Duplicatas

**Regra:** Duas despesas são duplicatas quando têm exatamente os mesmos valores
de `data`, `categoria` (normalizada), `fornecedor` (insensível a maiúsculas/minúsculas)
e `valor`. A primeira ocorrência na **posição do array de entrada** (`despesas[]`)
é processada normalmente; as demais recebem `status = "ignorado"` e
motivo "Duplicata da despesa `<id da principal>`".
Estornos (valores negativos) também são sujeitos à deduplicação: se dois estornos
têm o mesmo grupo data+categoria+fornecedor+valor, apenas o que aparece primeiro
no array é aplicado; o segundo é descartado como duplicata.

**Origem:** política do RH, item 8.

**Aceite:** d-006 e d-007: mesma data (2026-07-09), categoria (`alimentacao`), fornecedor (`Bistro Central`), valor (R$ 54,90). d-006 (id menor) é processada; d-007 → ignorada, motivo "Duplicata da despesa d-006".

---

### RN-010 — Arredondamento monetário

**Regra:** Todos os valores reembolsáveis no output são arredondados para duas
casas decimais usando half-up (0,005 arredonda para 0,01). O status é decidido
antes desse arredondamento, usando os valores efetivos e limites com a precisão
interna disponível. Portanto, o arredondamento de apresentação não transforma
uma aprovação integral em aprovação parcial, e uma diferença causada somente
por arredondamento não representa recusa por política de reembolso. Cálculos
internos (proporções, limites) usam precisão máxima disponível. Quando um grupo
excede seu limite, os valores exatos são arredondados inicialmente para baixo e
os centavos restantes são atribuídos aos itens com maiores restos fracionários;
empates são resolvidos pela posição no array de entrada. A soma final dos itens
é exatamente o limite do grupo. Para `total_solicitado`: os `valor_original`
são somados em sua precisão exata e o resultado final é arredondado para duas
casas decimais. Não se arredonda cada `valor_original` individualmente antes de
somar.

**Origem:** identificado na análise do arquivo de exemplo (d-011, valor R$ 33,333).

**Aceite:** d-011 (R$ 33,333, `alimentacao`, abaixo do limite) → `status = aprovado` e `valor_reembolsavel` = R$ 33,33. A diferença entre o valor original e o valor exibido decorre somente do arredondamento de output e não representa recusa por política.

---

### RN-011 — Valor zero inválido

**Regra:** Despesas com `valor` igual a zero são inválidas. O sistema as recusa
com motivo "Valor zero não é uma despesa válida". Não se aplica arredondamento
nem limite diário. A despesa participa dos conjuntos de itens considerados em
`total_solicitado` e `total_recusado`, com contribuição numérica de R$ 0,00.

**Origem:** identificado na análise do schema de entrada (ausência de restrição explícita para zero).

**Aceite:** despesa com `valor = 0` → `status = "recusado"`, `valor_reembolsavel = 0`,
motivo "Valor zero não é uma despesa válida". Entra em `total_solicitado` e `total_recusado`
com valor 0 (sem impacto numérico nos totais).

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

**Decisão:** o sistema determina o número de diárias a partir da `descricao`.
A descrição válida contém exatamente um número inteiro positivo em algarismos
imediatamente antes de `diária`, `diárias`, `noite` ou `noites`, sem distinção de
maiúsculas/minúsculas. Número depois da expressão, número por extenso ou mais de
um número candidato tornam a descrição inválida. Nesses casos, a despesa é
recusada com motivo "Não foi possível determinar o número de diárias a partir da
descrição".

**Justificativa:** exigir um campo adicional na entrada quebraria o schema definido
no desafio. O contrato — número inteiro positivo identificável na descrição — é
auditável: o motivo de recusa indica exatamente por que falhou, e o colaborador
pode corrigir a descrição.

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
`periodo.competencia` é metadado informativo: deve respeitar o formato `AAAA-MM`,
mas não é comparado com `periodo.inicio` ou `periodo.fim` e não decide a inclusão.
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

**Decisão para duplicatas:** manter a **primeira ocorrência na posição do array
de entrada** (`despesas[]`) e marcar as demais como `ignorado`. Critério de duplicidade:
mesma `data` + mesma `categoria` (normalizada) + mesmo `fornecedor`
(insensível a maiúsculas) + mesmo `valor` (incluindo sinal — um estorno de
−R$ 45,00 só é duplicata de outro estorno de −R$ 45,00 do mesmo grupo).

**Decisão para estornos duplicados:** se dois estornos têm o mesmo grupo
data+categoria+fornecedor+valor, apenas o que aparece primeiro no array é aplicado;
o segundo é descartado como `ignorado` com motivo de duplicata.

**Decisão para estornos:** valores negativos compensam o total agregado de
`valor_original` de despesas da mesma categoria+fornecedor no período (ver RN-008).

**Justificativa para duplicatas:** "tratar" mais naturalmente significa não
reembolsar duas vezes. Usar posição no array é inequívoco e independe do formato
do `id`, tornando o comportamento previsível para qualquer conjunto de entrada.

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

**Decisão:** despesas recusadas ou ignoradas antes da aplicação efetiva de
estornos **não entram** no total diário nem no grupo compensável. Estornos são
associados antes das exclusões, mas só são aplicados às despesas que permanecem
elegíveis após categoria, nota fiscal e inferência de diárias.

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
| Valor com três casas decimais | d-011 (R$ 33,333) | `status = aprovado`; `valor_reembolsavel` = R$ 33,33 por arredondamento de output, pois o valor efetivo está abaixo do limite | RN-010, AMB-009 |
| Hospedagem sem nota fiscal acima de R$ 100 | d-013 (R$ 690,00, sem nota) | Recusada: nota fiscal obrigatória | RN-005 |
| Categoria em maiúsculas | d-014 (`ALIMENTACAO`) | Normalizada e tratada como `alimentacao` | RN-006, AMB-007 |
| Lista de despesas vazia | `"despesas": []` | Saída válida com totais zero e lista de itens vazia | — |
| Hospedagem dentro do limite por diária | R$ 480,00 com 2 diárias inferidas | Aprovada integralmente (R$ 480 < 2 × R$ 250) | RN-003 |
| Hospedagem acima do limite por diária | R$ 900,00 com 3 diárias inferidas | Aprovada parcialmente: reembolsável = R$ 750,00 | RN-003, RN-004 |
| Estorno maior que total do grupo | estorno de −R$ 300,00, grupo tem R$ 200,00 | Todas as despesas do grupo: valor_reembolsavel = 0 | RN-008, AMB-011 |
| Valor zero | despesa com `valor = 0` | Recusada: valor zero não é válido | RN-011 |

---

## 8. Ordem de aplicação das regras

Quando múltiplas regras incidem sobre uma despesa, a ordem é:

1. **Normalização de categoria** (AMB-007) — aplica caixa e aliases canônicos.
2. **Período de competência** (RN-007) — fora do intervalo inclusivo → `ignorado`; nenhuma outra regra é avaliada.
3. **Valor zero** (RN-011) — `valor = 0` → `recusado`; não entra nos limites.
4. **Duplicatas** (RN-009) — duplicata secundária → `ignorado`.
5. **Associação de estornos** (RN-008) — identifica grupos candidatos, sem alterar valores.
6. **Categoria permitida** (RN-006) — categoria desconhecida → `recusado`.
7. **Nota fiscal** (RN-005) — compara `valor_original`; valor acima de R$ 100,00 sem nota → `recusado`.
8. **Inferência de diárias** (RN-003 / AMB-003) — descrição inválida → `recusado`.
9. **Aplicação efetiva de estornos** (RN-008) — somente contra despesas elegíveis, sequencialmente.
10. **Limites diários** (RN-001, RN-002, RN-003) — aplica limites e distribuição proporcional.
11. **Arredondamento e fechamento** (RN-010) — maiores restos e empate pela posição no array.

**Motivação:** o filtro de período ocorre antes da validação de valor zero para
ignorar imediatamente despesas fora da competência. A associação de estornos é
separada da aplicação efetiva para que nota fiscal e diárias sejam avaliadas sobre
as despesas originais e somente despesas elegíveis sejam compensadas. Regras de
exclusão total não participam dos limites diários.

---

## 9. Critérios de aceite

O sistema está pronto quando:

- [ ] Processar `exemplos/despesas-exemplo.json` sem erros e produzir JSON válido.
- [ ] d-001 + d-002 (alimentação, 2026-07-03) terem soma de `valor_reembolsavel` exatamente R$ 60,00, com eventual resíduo distribuído por maiores restos e empate pela posição no array.
- [ ] d-003 (R$ 100,00 sem nota) **não** ser recusada por falta de nota fiscal; ter `valor_reembolsavel` = R$ 55,00 (após redução pelo estorno d-009 de −R$ 45,00; valor efetivo R$ 55,00 < limite de R$ 80,00 → `aprovado`).
- [ ] d-004 (R$ 100,01 sem nota) ser `recusado` com motivo de nota fiscal; **não** entrar no total diário de transporte.
- [ ] d-005 (`coworking`) ser `recusado` com motivo de categoria.
- [ ] d-006 ser processada normalmente; d-007 ser `ignorado` (duplicata de d-006).
- [ ] d-008 ser `ignorado` (fora do período de competência).
- [ ] d-009 (estorno −R$ 45,00) ser associado ao grupo candidato, ser `ignorado` e reduzir sequencialmente apenas a despesa elegível d-003 em R$ 45,00; d-004 deve ser excluída antes da aplicação por nota fiscal baseada no valor original.
- [ ] d-010 ("Hotel Rio - 2 diárias") ter `num_diarias` = 2, `limite_unitario_diaria` = R$ 250,00, `limite_item` = R$ 500,00, `limite_grupo` = R$ 500,00 e `valor_reembolsavel` = R$ 480,00.
- [ ] d-011 ter `valor_original` = R$ 33,333, `valor_reembolsavel` = R$ 33,33 e `status = aprovado`; a diferença decorre somente do arredondamento de output e não representa recusa por política.
- [ ] d-013 ser `recusado` por falta de nota fiscal.
- [ ] d-014 (`ALIMENTACAO`) ser tratada como `alimentacao`; a forma acentuada `alimentação` também deve produzir o canônico `alimentacao`.
- [ ] `resumo.total_reembolsavel` = soma dos `valor_reembolsavel` de itens `aprovado` ou `aprovado_parcial`.
- [ ] `resumo.total_solicitado` = soma dos `valor_original` de itens `aprovado`, `aprovado_parcial` e `recusado` (exclui `ignorado`).
- [ ] `resumo.total_recusado` = `total_solicitado` − `total_reembolsavel`.
- [ ] CLI aceitar `--input` e `--output` e escrever o arquivo de saída corretamente.
- [ ] Todos os testes automatizados passarem.
- [ ] Despesas fora do período serem ignoradas antes da validação de valor zero.
- [ ] Hospedagens elegíveis da mesma data emitirem o mesmo `limite_grupo`; os quatro campos de auditoria serem omitidos para outras categorias e inferências malsucedidas.
- [ ] `periodo.competencia` aceitar somente o formato `AAAA-MM` e não decidir a inclusão da despesa.
- [ ] **Critério de integração confirmado:** para `exemplos/despesas-exemplo.json`, `resumo.total_solicitado` = R$ 1.765,94, `resumo.total_reembolsavel` = R$ 790,43 e `resumo.total_recusado` = R$ 975,51; d-007 deve ser `ignorado` com motivo "Duplicata da despesa d-006", d-008 deve ser `ignorado` com o motivo de RN-007 para data fora do período de competência e d-009 deve ser `ignorado` com o motivo de RN-008 "Estorno: compensou despesas de transporte_urbano do fornecedor TaxiApp no período"; a invariante `total_solicitado = total_reembolsavel + total_recusado` também deve ser verificada.

---

## 10. O que fica em aberto

- **Ampliação de 50% para viagem (AMB-005):** campo `em_viagem` não existe na entrada desta versão. Decisão: não implementar. Quando o campo for adicionado, a lógica é: se `em_viagem = true`, multiplicar os limites de RN-001, RN-002 e RN-003 por 1,5 antes de aplicar.
- **Fusos horários:** datas são tratadas como datas de calendário sem conversão de fuso.
- **Nota fiscal cobre o valor:** o sistema confia no campo `tem_nota_fiscal`; não há como verificar se a nota cobre o valor declarado.
- **Inferência de diárias frágil:** o padrão de texto da `descricao` pode variar; uma versão futura deveria exigir `num_diarias` como campo explícito na entrada.
