# Log de Decisões e Mudanças de Spec

> Uma entrada **toda vez** que a spec mudar. Este arquivo é a prova de que a spec
> foi tratada como artefato vivo e não como cerimônia de abertura.
>
> Spec que não muda em dois dias é spec que ninguém consultou. Mudança não é
> demérito — mudança não registrada é.

Ordem cronológica inversa: a mais recente primeiro.

---

## D-002 — Revisão de ambiguidades e lacunas (15 achados) · 2026-10-02

**Gatilho:** revisão sistemática da spec v1.1 cruzada com `DESAFIO.md`, `RUBRICA.md`
e `exemplos/despesas-exemplo.json`, identificando ambiguidades, contradições e
lacunas antes do início da implementação.

**O que mudou na spec (v1.1 → v1.2):**

| ID | Trecho afetado | De | Para |
|---|---|---|---|
| A1 | RN-008, pipeline | Estorno aplicado sobre `valor_original` agregado sem posição clara na pipeline | Estorno aplicado na **etapa 5**, antes de categoria/nota-fiscal/limites; compensa apenas despesas que passaram pelas etapas 1–4 |
| A2 | RN-002 aceite | d-003 → R$ 80,00 `aprovado_parcial` | d-003 → R$ 55,00 `aprovado` (estorno d-009 reduz valor efetivo antes dos limites) |
| A3 | 4.2 `processado_em` | Sem critério de aceite | Critério: formato ISO 8601 UTC com sufixo `Z`; valor exato fora do escopo de testes funcionais |
| A4 | 4.1 nota hospedagem, AMB-003 | Algoritmo de inferência (regex) escrito na spec | Contrato comportamental apenas na spec; mecanismo movido para `plan.md` |
| A5 | Seção 8 (pipeline) | Ordem implícita, mencionada apenas de passagem | Seção 8 declarada explicitamente com 10 etapas numeradas (inclui nova RN-011 na etapa 2) |
| A6 | 4.2 `total_recusado` | Sem nota sobre composição | Nota explícita: agrega excedentes de `aprovado_parcial` + inteiros de `recusado`; invariante `total_solicitado = total_reembolsavel + total_recusado` declarada |
| A7 | 4.2 status `ignorado` | 3 subcasos listados | 4 subcasos com nota: distinguíveis pelo `motivo`; inclui "estorno sem correspondente" |
| A8 | RN-009, AMB-008 | Duplicata principal = menor `id` lexicográfico | Duplicata principal = **primeira posição no array de entrada** |
| A9 | (ausente) | Valor zero sem cobertura | Nova **RN-011**: `valor = 0` → `recusado`; inserida como etapa 2 da pipeline |
| A10 | Seção 9 critérios de aceite | Sem critério de integração para o arquivo completo | Critério de integração adicionado: `total_solicitado` = R$ 1.765,94; `total_reembolsavel` = R$ 791,43; `total_recusado` = R$ 974,51 |
| A11 | RN-010 | `total_solicitado` sem clareza sobre arredondamento | Explicitado: soma exata dos `valor_original`, arredondamento apenas no total final |
| A12 | AMB-003 | Mecanismo de extração de diárias descrito na spec | Mecanismo movido para `plan.md`; spec mantém apenas o contrato (consequência de A4) |
| A13 | RN-008 | Grupo compensável implícito | Grupo compensável restrito a despesas não recusadas e não ignoradas após etapas 1–4 |
| A14 | Seção 7, última linha | Célula truncada: "lista de itens v" | Completada: "Saída válida com totais zero e `itens = []`" |
| A15 | RN-003 aceite | Exemplo hipotético sem nota de cobertura | Nota adicionada: caminho de aprovação parcial de hospedagem não existe no arquivo de exemplo; requer teste sintético |

**Por quê:** os 15 achados foram identificados antes da implementação para evitar
que ambiguidades críticas (especialmente a ordem de aplicação dos estornos e o
critério de duplicata) produzissem implementações incompatíveis com a spec ou
entre si. A maioria é resultado da leitura cruzada entre as regras — nenhuma
regra contradiz outra individualmente, mas a combinação criava resultados
indeterminados.

**O que isso invalidou:**

- **Critério de aceite de RN-002:** o valor de R$ 80,00 para d-003 estava errado;
  corrigido para R$ 55,00. Testes que verificarem R$ 80,00 falharão.
- **Lógica de T-006 (duplicatas):** o critério de "menor `id` lexicográfico" deve
  ser substituído por posição no array. Impacto direto na implementação de
  `src/rules/duplicatas.js`.
- **Ordem das fases em `engine.js`:** a nova RN-011 (valor zero) entra como
  etapa 2, deslocando as demais. Arquivos `rules/` permanecem inalterados na
  lógica interna, mas `engine.js` precisa encadear 10 fases em vez de 9.
- **`src/rules/diarias.js`:** o mecanismo de regex continua válido (agora
  documentado em `plan.md` como DT-004), mas a spec não o prescreve mais.

**Tasks afetadas:**

| Task | Impacto |
|---|---|
| T-006 | Critério de aceite atualizado: duplicata principal = primeira posição no array (não menor `id`) |
| T-007 | Critério de aceite atualizado: grupo compensável restrito a despesas que chegam à etapa de limites |
| T-010 | Mecanismo de regex agora vive em `plan.md` (DT-004); implementação não muda, apenas a referência |
| T-011 | Critério de aceite de d-003 corrigido: R$ 55,00 `aprovado` (não R$ 80,00 `aprovado_parcial`) |
| T-012 | Engine passa a encadear 10 fases (nova fase de valor zero como etapa 2) |
| T-015 | Critérios de aceite de integração atualizados: d-003 = R$ 55,00; totais do resumo fixados |
| **T-017** (nova) | Implementar RN-011 — validação de valor zero como etapa 2 da pipeline |

**Custo:** 1 arquivo modificado (`spec.md`, v1.1 → v1.2); 3 arquivos a atualizar
(`DECISIONS.md`, `plan.md`, `tasks.md`); nenhuma linha de código escrita ainda.
Impacto zero em implementação existente (implementação ainda não iniciada).

---

## D-001 — Versão inicial da spec · 2026-07-01

**Gatilho:** início do desafio; leitura da política do RH e do arquivo de exemplo.

**O que mudou na spec:** criação da spec v1.0 a partir da política do RH,
resolvendo AMB-001 a AMB-011 e definindo o schema de entrada e saída.

**Por quê:** a política do RH continha pelo menos 8 ambiguidades que precisavam
de decisão explícita antes de qualquer implementação.

**O que isso invalidou:** —

**Tasks afetadas:** criação de T-001 a T-016.

**Custo:** spec criada do zero; `plan.md` e `tasks.md` escritos a partir da spec.
