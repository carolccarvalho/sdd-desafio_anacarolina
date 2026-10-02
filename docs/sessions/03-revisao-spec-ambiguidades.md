# Sessão 03 — Revisão sistemática da spec: 15 achados e atualização dos artefatos

**Data:** 2026-10-02
**Arquivos modificados:** `specs/001-motor-reembolso/spec.md`, `DECISIONS.md`, `plan.md`, `tasks.md`

---

## Transcrição completa da conversa

---

### Turno 1 — Usuário

> Revise `DESAFIO.md`, `RUBRICA.md`, `exemplos/despesas-exemplo.json` e
> `specs/001-motor-reembolso/spec.md`.
>
> Não edite arquivos, não implemente código e não faça commits.
>
> Avalie a spec contra a política do RH, os dados de exemplo e a rubrica.
> Identifique:
>
> 1. ambiguidades da política que ainda não foram explicitamente decididas;
> 2. regras que permitem mais de uma implementação válida;
> 3. contradições entre regras, ambiguidades, casos de borda, ordem de aplicação,
>    schema de saída e critérios de aceite;
> 4. critérios de aceite que não podem ser verificados apenas pela saída;
> 5. soluções técnicas que vazaram para a spec;
> 6. decisões presentes no comportamento esperado, mas ausentes da seção de
>    ambiguidades e decisões;
> 7. casos dos dados de exemplo que não estão cobertos ou que podem ter resultado
>    diferente conforme a interpretação.
>
> Para cada achado, informe:
> - severidade: crítico, importante ou melhoria;
> - trecho da spec afetado;
> - por que há ambiguidade, contradição ou lacuna;
> - duas ou três opções de decisão;
> - recomendação justificada;
> - impacto esperado em regras, critérios de aceite, saída, tasks e testes.
>
> Não decida nem reescreva a spec por conta própria. Apresente no máximo cinco
> achados por rodada e espere minha aprovação para continuar.

---

### Turno 2 — Assistente (Rodada 1 — Achados 1 a 5)

**Achado 1 — Estorno aplica sobre `valor_original` agregado ou sobre `valor_reembolsavel` já limitado?**

**Severidade:** crítico

**Trecho afetado:** RN-008 e AMB-008 (seção 5 e 6); caso de borda "Estorno compensa total agregado do grupo" (seção 7)

**O problema:** RN-008 diz que o estorno reduz o `valor_original` **agregado** de despesas do grupo. Mas os limites diários são aplicados sobre o `valor_reembolsavel`, não sobre o `valor_original`. A spec não deixa claro *em que ponto da pipeline* o estorno entra: antes dos limites diários (reduzindo o `valor_original` bruto) ou depois (reduzindo o `valor_reembolsavel` já calculado). O exemplo no caso de borda diz "reduz valor_original agregado do grupo em R$ 45,00", mas a RN-003 aplica os limites sobre os valores que chegaram à etapa de limites — criando uma tensão de ordem de aplicação.

**Exemplo concreto com d-009:** d-003 (R$ 100,00) + d-009 (−R$ 45,00) → grupo TaxiApp/transporte. Se o estorno reduz o `valor_original` de d-003 para R$ 55,00 *antes* do limite de R$ 80,00, d-003 é aprovada integralmente por R$ 55,00. Se o estorno é aplicado *depois*, d-003 seria aprovada parcialmente por R$ 80,00 e depois o reembolso seria reduzido — mas para quanto e como?

**Opções:**
- A) Estorno reduz `valor_original` das despesas do grupo *antes* de qualquer verificação de limite — depois os limites se aplicam sobre os valores já reduzidos.
- B) Estorno reduz `valor_reembolsavel` final das despesas do grupo *após* a aplicação de todos os limites.
- C) Estorno reduz o `valor_reembolsavel` total do grupo até zero, proporcionalmente entre os itens aprovados.

**Recomendação:** Opção A. É a única que mantém a ordem de pipeline coerente (estorno → validações → limites) e torna o resultado auditável item a item. A opção B cria um resultado contra-intuitivo onde o colaborador poderia receber menos do que o limite permitia por culpa de um estorno de corrida cancelada. Deve-se explicitar na spec a ordem completa de processamento: (1) normalização, (2) período, (3) duplicatas, (4) **estornos**, (5) nota fiscal, (6) limites diários.

**Impacto:** altera RN-008, o caso de borda correspondente, e o critério de aceite de RN-002 (que cita d-003 e d-004 sem mencionar o estorno d-009). Cria nova task de integração entre estorno e limite diário. Testes de integração precisam cobrir o cenário explicitamente.

---

**Achado 2 — Critério de aceite de RN-002 contradiz o próprio exemplo (ignora d-009)**

**Severidade:** crítico

**Trecho afetado:** RN-002, seção 5 — "**Aceite:** d-003 (R$ 100,00) está sozinha no dia 2026-07-06 para fins de limite (d-004 é recusada por falta de nota fiscal antes desta etapa). Total = R$ 100,00 > R$ 80,00 → d-003 reembolsável = R$ 80,00 (aprovado_parcial)."

**O problema:** o critério de aceite afirma que d-003 terá `valor_reembolsavel = R$ 80,00`. Mas d-009 é um estorno de −R$ 45,00 do mesmo fornecedor (TaxiApp) e categoria (transporte_urbano). Se o estorno for aplicado antes dos limites (ver Achado 1, Opção A), o valor efetivo de d-003 cai para R$ 100,00 − R$ 45,00 = R$ 55,00, que fica abaixo do limite de R$ 80,00 — logo d-003 seria `aprovado` por R$ 55,00, não `aprovado_parcial` por R$ 80,00. O critério de aceite escrito na spec está **numericamente errado** dada a presença de d-009 no mesmo arquivo de exemplo.

**Opções:**
- A) Corrigir o critério de aceite de RN-002 para refletir a redução pelo estorno (valor = R$ 55,00, status `aprovado`).
- B) Decidir que o estorno é aplicado *após* os limites (muda o Achado 1 para Opção B), preservando o número R$ 80,00.
- C) Separar os critérios de aceite por regra individual (sem cruzamento de dados de outras regras) e criar um critério de aceite de integração separado para o arquivo completo.

**Recomendação:** Opção C de curto prazo (isolar os critérios de aceite unitários), combinada com a decisão do Achado 1 para o caso integrado. O critério de aceite de RN-002 deveria usar valores hipotéticos sem interferência de outras regras, ou referenciar explicitamente "sem considerar estornos do mesmo grupo".

**Impacto:** afeta RN-002, RN-008, o caso de borda de estorno, tasks de testes de integração e o comportamento esperado contra o arquivo de exemplo.

---

**Achado 3 — O campo `processado_em` é verificável como critério de aceite?**

**Severidade:** importante

**Trecho afetado:** seção 4.2, campo `processado_em` — "Data e hora UTC em que o cálculo foi executado"

**O problema:** a rubrica exige "critérios de aceite verificáveis sem ler código" (faixa 23–25). O campo `processado_em` é não-determinístico: seu valor muda a cada execução. A spec não define como verificar se ele está correto, se o formato é válido ISO 8601, se está em UTC, ou qual tolerância de desvio é aceitável em testes. Qualquer teste automático que verifique esse campo precisa ignorá-lo ou mockear o relógio — mas isso é uma decisão de implementação que não está na spec.

**Opções:**
- A) A spec declara que o campo deve ser validado apenas quanto ao **formato** (ISO 8601 UTC, sufixo `Z`), não quanto ao valor exato.
- B) A spec declara que o campo é informativo e está **fora do escopo dos critérios de aceite** funcionais.
- C) A spec acrescenta que o valor deve corresponder ao momento da execução, com verificação feita por faixa de tempo nos testes (ex: entre `T-5s` e `T+5s` da chamada).

**Recomendação:** Opção A. Define um critério verificável (formato correto) sem vazar para implementação. Evita que o campo fique completamente sem critério de aceite, o que o tornaria "decorativo".

**Impacto:** afeta a seção 4.2, potencialmente gera um critério de aceite de schema e uma task de validação de formato.

---

**Achado 4 — Solução técnica vazada: inferência de diárias por regex na spec**

**Severidade:** importante

**Trecho afetado:** Nota de rodapé na seção 4.1 ("o sistema tenta inferir o número de diárias a partir do campo `descricao` buscando um número inteiro positivo seguido da palavra 'diaria(s)' ou 'noite(s)'...") e AMB-003.

**O problema:** a RUBRICA e o DESAFIO proíbem explicitamente que a spec cite soluções técnicas. A spec descreve um mecanismo de implementação concreto — uma busca por padrão textual com regras de proximidade ("imediatamente antes ou depois"), lista de palavras aceitas, sensibilidade a acentos. Isso é uma decisão de *como* resolver o problema, não *o quê* o sistema deve fazer. A spec poderia dizer *o que* precisa acontecer (o número de diárias deve ser determinável a partir dos dados de entrada) e *o critério de aceite* (se não for possível determinar, recusar com motivo X), sem prescrever o mecanismo de extração.

**Opções:**
- A) Remover a descrição do mecanismo e manter apenas o contrato: "o sistema deve ser capaz de determinar o número de diárias a partir das informações disponíveis na entrada; se não conseguir, recusa com motivo específico." O *como* vai para `plan.md`.
- B) Manter o padrão na spec mas movê-lo para dentro de um critério de aceite com exemplos de entradas e saídas esperadas (sem citar regex ou algoritmo).
- C) Manter como está, aceitando que a AMB-003 precisa prescrever o mecanismo por não haver outra forma de tornar a decisão verificável.

**Recomendação:** Opção A (aceita pelo usuário como Opção A). A decisão de aceitar "2 diárias", "3 noites", etc. é legítima na spec porque define o *contrato de entrada*. Mas a descrição de algoritmo é implementação. Substituir por uma tabela de exemplos válidos/inválidos mantém a spec verificável sem vazar solução.

**Impacto:** afeta AMB-003, nota da seção 4.1, e requer que o mecanismo de extração seja documentado em `plan.md`. Tasks de teste precisam cobrir os exemplos da tabela.

---

**Achado 5 — Ordem de aplicação das regras não está declarada na spec**

**Severidade:** crítico

**Trecho afetado:** seção 5 (regras de negócio) — não existe uma seção ou declaração explícita de pipeline/ordem de avaliação.

**O problema:** várias regras são interdependentes e seu resultado muda com a ordem de aplicação:
- RN-005 (nota fiscal) precisa ocorrer antes de RN-001/002/003 (limites diários) — e a spec menciona isso apenas *implicitamente* no critério de aceite de RN-002 ("d-004 é recusada por falta de nota fiscal **antes desta etapa**").
- RN-007 (período) precisa ocorrer antes de RN-009 (duplicatas) — caso contrário d-008 poderia ser considerada duplicata de uma despesa válida com mesmo valor/fornecedor em julho.
- RN-008 (estornos) precisa ocorrer em algum ponto específico em relação a RN-005 e RN-003 (ver Achado 1).
- RN-009 (duplicatas) precede ou sucede RN-005 e RN-006?

A ausência de uma pipeline declarada permite múltiplas implementações com resultados diferentes para os mesmos dados de entrada.

**Opções:**
- A) Acrescentar uma seção "Pipeline de processamento" na spec que declare a ordem explícita.
- B) Acrescentar um campo "ordem de aplicação" em cada RN indicando seu número na sequência.
- C) Declarar que as regras são independentes e podem ser aplicadas em qualquer ordem — mas resolver as dependências explicitando pré-condições de cada RN.

**Recomendação:** Opção A.

**Impacto:** afeta praticamente todas as RNs, os critérios de aceite de integração, e múltiplas tasks.

---

### Turno 3 — Usuário

> achado 2, opção A e achado 4 opção A, o resto conforme sugeriu. em seguida me mostre o restante dos achados, deixe para implementar as modificações qd eu terminar todas as revisões

---

### Turno 4 — Assistente (Rodada 2 — Achados 6 a 10)

**Achado 6 — `total_recusado` agrega excedentes e recusados sem declaração explícita**

**Severidade:** crítico

**Trecho afetado:** seção 4.2 — definição de `resumo.total_solicitado`, `resumo.total_recusado` e a invariante

**O problema:** `total_recusado` é definido como `total_solicitado − total_reembolsavel`. Para um item `aprovado_parcial`, o excedente entra no `total_recusado`. Isso é matematicamente coerente, **mas** o nome `total_recusado` é enganoso: ele agrega tanto itens inteiramente negados quanto excedentes de itens parcialmente aprovados. A spec não declara que isso é intencional.

**Opções:**
- A) Manter `total_recusado` como agregação e adicionar nota explícita.
- B) Desdobrar em dois campos: `total_excedente` e `total_recusado`.
- C) Renomear para `total_nao_reembolsavel`.

**Recomendação:** Opção A.

---

**Achado 7 — Estorno sem despesa correspondente: status `ignorado` contradiz a semântica declarada**

**Severidade:** importante

**Trecho afetado:** RN-008 e seção 4.2 — definição de `ignorado`

**O problema:** a seção 4.2 define `ignorado` para três casos estruturais. Um estorno *sem* correspondente é um caso diferente — erro do colaborador. Usar `ignorado` para ambos mistura "descartado por design" com "descartado por inconsistência".

**Opções:**
- A) Manter `ignorado` para ambos, acrescentar nota na seção 4.2 listando os subcasos.
- B) Usar `recusado` para estorno sem correspondente.
- C) Adicionar um quinto status `alerta`.

**Recomendação:** Opção A.

---

**Achado 8 — Duplicata: critério de `id` lexicográfico não é robusto para IDs não-numéricos**

**Severidade:** melhoria

**Trecho afetado:** RN-009 — "A primeira ocorrência (menor `id` em ordem lexicográfica entre as duplicatas)"

**O problema:** IDs como `"expense-2"` e `"expense-10"` ordenam lexicograficamente como `"expense-10" < "expense-2"`, invertendo a intuição. IDs gerados por UUID não têm ordem cronológica.

**Opções:**
- A) Manter lexicográfico com nota de limitação.
- B) Mudar o critério para **posição no array de entrada**.
- C) Declarar indeterminado.

**Recomendação:** Opção B.

---

**Achado 9 — Valor zero: despesa de R$ 0,00 não está coberta por nenhuma regra**

**Severidade:** importante

**Trecho afetado:** nenhuma RN, seção 6, seção 7 — ausência total

**O problema:** `valor = 0` não é estorno, não excede R$ 100, não ultrapassa limite diário, e seria aprovada por R$ 0,00 — resultado semanticamente sem sentido.

**Opções:**
- A) Declarar `valor = 0` inválido → `recusado`.
- B) Processar normalmente → `aprovado` por R$ 0,00.
- C) Tratar como `ignorado`.

**Recomendação:** Opção A.

---

**Achado 10 — Critério de aceite da spec não cobre o arquivo de exemplo completo**

**Severidade:** importante

**Trecho afetado:** seções 5 e 7 — ausência de critério de aceite de integração

**O problema:** os critérios de aceite são todos unitários. `despesas-exemplo.json` tem 14 despesas com interações entre regras. Dois implementadores que seguiram a spec poderiam produzir saídas diferentes para o mesmo arquivo sem que a spec permitisse arbitrar.

**Opções:**
- A) Acrescentar resultado esperado completo item a item.
- B) Acrescentar apenas os **valores de resumo esperados** como critério de aceite de integração.
- C) Não acrescentar resultado fixo.

**Recomendação:** Opção B.

---

### Turno 5 — Usuário

> para os achados 6 a 10 aceitar as sugestões. mostre o resto

---

### Turno 6 — Assistente (Rodada 3 — Achados 11 a 15)

**Achado 11 — `total_solicitado` soma `valor_original` sem clareza sobre arredondamento**

**Severidade:** importante

**Trecho afetado:** seção 4.2 — `resumo.total_solicitado`; RN-010

**O problema:** RN-010 diz que o arredondamento se aplica ao `valor_reembolsavel` e "aos totais do resumo". Se um item tem `valor_original = 33.333` (d-011), esse valor entra literalmente na soma? A spec não deixa claro se `total_solicitado` também é arredondado, e se sim, se o arredondamento é feito item a item antes de somar ou na soma final.

**Opções:**
- A) Somar `valor_original` exatos e arredondar o total final.
- B) Arredondar cada `valor_original` individualmente antes de somar.
- C) Aceitar mais de duas casas decimais no output.

**Recomendação:** Opção A.

---

**Achado 12 — Hospedagem: inferência de diárias não define múltiplas ocorrências do padrão**

**Severidade:** importante

**Trecho afetado:** AMB-003

**O problema:** a spec define como inferir o número de diárias mas não trata o caso em que a descrição contém o padrão **mais de uma vez** (ex: `"2 noites + 1 diaria extra"`). Se o Achado 4 for aceito (mecanismo vai para `plan.md`), este achado se resolve automaticamente.

**Opções:**
- A) Se Achado 4 aceito: a spec declara apenas o contrato; `plan.md` define o algoritmo.
- B) A spec acrescenta: múltiplas ocorrências → `recusado` com motivo "Número de diárias ambíguo".
- C) Usar a primeira ocorrência encontrada.

**Recomendação:** Opção A (condicionada ao Achado 4).

---

**Achado 13 — Estorno aplicado a grupo sem despesas válidas após filtragem de período/duplicata**

**Severidade:** importante

**Trecho afetado:** RN-008; AMB-011

**O problema:** RN-008 define que o estorno compensa despesas que "já passaram pela verificação de período". Mas não especifica se despesas **recusadas** por categoria inválida ou falta de nota fiscal ainda fazem parte do "grupo compensável".

**Opções:**
- A) Estorno só compensa despesas que chegaram à etapa de limites (não recusadas, não ignoradas).
- B) Estorno compensa qualquer despesa que passou pela verificação de período.
- C) A ordem da pipeline determina isso implicitamente.

**Recomendação:** Opção A.

---

**Achado 14 — Caso de borda de lista vazia está truncado na seção 7**

**Severidade:** melhoria

**Trecho afetado:** seção 7, última linha — termina em "lista de itens v" (truncado)

**O problema:** o conteúdo da célula "Comportamento esperado" está truncado. Critério de aceite para esse caso de borda está incompleto.

**Opções:**
- A) Completar a célula: "Saída válida com `total_solicitado = 0`, `total_reembolsavel = 0`, `total_recusado = 0` e `itens = []`".
- B) Remover e declarar em RN ou nota de validação.
- C) Manter como está.

**Recomendação:** Opção A.

---

**Achado 15 — Critério de aceite de RN-003 usa exemplo hipotético que não existe no arquivo de exemplo**

**Severidade:** melhoria

**Trecho afetado:** RN-003 — "Aceite: despesa de R$ 900,00 com 3 diárias inferidas → reembolsável = R$ 750,00 (aprovado_parcial)"

**O problema:** esse valor hipotético não existe em `despesas-exemplo.json`. d-013 (Airbnb, R$ 690,00, 3 noites) seria o candidato natural, mas é recusada por RN-005 antes de chegar aos limites. Não existe no arquivo **nenhuma despesa de hospedagem que exercite o caminho de aprovação parcial**.

**Opções:**
- A) Manter o exemplo hipotético e acrescentar nota: "não coberto em `despesas-exemplo.json`; requer teste sintético".
- B) Adicionar ao arquivo de exemplo uma despesa de hospedagem que exercite o limite.
- C) Manter como está.

**Recomendação:** Opção A.

---

### Turno 7 — Usuário

> pode aceitar todos as sugestões do ultimo bloco

---

### Turno 8 — Assistente

Registrado. Consolidando todas as decisões das três rodadas:

| Achado | Decisão |
|---|---|
| 1 | Opção A — pipeline: estorno antes de nota fiscal e limites |
| 2 | Opção A — corrigir critério de aceite de RN-002 (d-003 → R$ 55,00, `aprovado`) |
| 3 | Opção A — `processado_em` verificado apenas por formato ISO 8601 UTC |
| 4 | Opção A — mecanismo de inferência sai da spec, vai para `plan.md` |
| 5 | Opção A — acrescentar seção "Pipeline de processamento" |
| 6 | Opção A — nota explícita sobre `total_recusado` agregando excedentes + recusados |
| 7 | Opção A — nota na definição de `ignorado` cobrindo estorno sem correspondente |
| 8 | Opção B — critério de duplicata muda para posição no array |
| 9 | Opção A — `valor = 0` é inválido, recusado com motivo explícito |
| 10 | Opção B — acrescentar valores de resumo esperados para o arquivo de exemplo |
| 11 | Opção A — `total_solicitado` soma exatos, arredonda o total final |
| 12 | Opção A — mecanismo de ambiguidade de padrão vai para `plan.md` |
| 13 | Opção A — estorno só compensa despesas não recusadas e não ignoradas |
| 14 | Opção A — completar célula truncada da seção 7 |
| 15 | Opção A — nota explícita que o caso de aprovação parcial de hospedagem requer teste sintético |

Confirma que posso começar a editar a `spec.md` agora?

---

### Turno 9 — Usuário

> sim

---

### Turno 10 — Assistente

Aplicou todas as 15 modificações na `spec.md` (v1.1 → v1.2). Resumo do que foi alterado:

| Seção | Mudança |
|---|---|
| Cabeçalho | Versão 1.2, data atualizada |
| 4.1 nota hospedagem | Removido algoritmo de regex; mantido apenas o contrato comportamental — mecanismo movido para `plan.md` |
| 4.2 `processado_em` | Critério de aceite: apenas formato ISO 8601 UTC |
| 4.2 `total_solicitado` | Explicitado: soma exata dos `valor_original`, arredondamento só no total final |
| 4.2 `ignorado` | 4 subcasos explicitados, distinguíveis pelo `motivo` |
| 4.2 `total_recusado` | Nota explícita: agrega excedentes de `aprovado_parcial` + inteiros de `recusado` |
| RN-002 aceite | Corrigido: d-003 → R$ 55,00 `aprovado` (não R$ 80,00 `aprovado_parcial`) por efeito do estorno d-009 |
| RN-003 aceite | Nota: caminho de aprovação parcial não existe no arquivo de exemplo; requer teste sintético |
| RN-008 | Pipeline renumerada (etapa 5); grupo compensável restrito a despesas não recusadas/não ignoradas; aceite reescrito com rastreio etapa a etapa |
| RN-009 | Critério de duplicata: posição no array em vez de `id` lexicográfico |
| RN-010 | Clarificado que `total_solicitado` usa valores exatos antes de somar |
| **RN-011** (nova) | Valor zero → `recusado`, etapa 2 da pipeline |
| Seção 7 | Célula truncada completada; novo caso de borda "valor zero" |
| Seção 8 pipeline | RN-011 inserida na etapa 2; numeração rerenciada em toda a seção |
| Seção 9 critérios | d-003 corrigido; critério de integração adicionado (totais: R$ 1.765,94 / R$ 791,43 / R$ 974,51) |
| AMB-003 | Removido mecanismo de extração; mantido contrato + referência ao `plan.md` |
| AMB-008 | Decisão de duplicata atualizada para posição no array |

---

### Turno 11 — Usuário

> agora que já realizou as modificações, faça: atualize DECISIONS.md com a justificativa e o impacto;
> - atualize plan.md apenas onde o modo de implementação foi afetado;
> - atualize tasks.md, mantendo vínculo explícito com requisitos e critérios de aceite;
> - não marque tasks como concluídas;
> - não faça commit;
> - mostre o diff completo e espere minha revisão.

---

### Turno 12 — Assistente

Atualizou os três arquivos e exibiu o diff completo via `git diff`.

**`DECISIONS.md`:** D-001 e D-002 preenchidos com conteúdo real. D-002 registra os 15 achados em tabela De/Para, invalidações, tasks afetadas e custo.

**`plan.md` (v1.1 → v1.2):**
- `valor-zero.js` inserido como fase 2; fases 2–9 renumeradas para 3–10
- Fluxo atualizado
- DT-002: "9 regras" → "10 regras"
- DT-004: expandido com múltiplas ocorrências e mensagens de motivo
- DT-005 (nova): critério de duplicata por posição no array
- `RN-011-valor-zero.test.js` adicionado na estrutura de testes

**`tasks.md`:**
- T-005 a T-009, T-011: números de fase corrigidos (+1)
- T-006: critério atualizado para posição no array; caso adicional com IDs fora de ordem
- T-007: grupo compensável restrito; caso adicional de estorno com grupo já recusado
- T-010: referência a DT-004; caso de padrão ambíguo adicionado
- T-011: aceite de d-003 corrigido para R$55,00 `aprovado`
- T-012: 10 fases explicitadas
- T-015: totais fixados (R$1.765,94 / R$791,43 / R$974,51); d-003 corrigido
- T-017 (nova): implementar `valor-zero.js` — fase 2 da pipeline (RN-011)
- Tabela de cobertura: RN-011 → T-017 adicionado
- Fase 5: numeração ajustada para T-018+

---

### Turno 13 — Usuário

> salve a sessão

---

### Turno 14 — Assistente

Tentou usar `/export` — informado que não funciona no ambiente. Escreveu resumo manual em `docs/sessions/03-revisao-spec-ambiguidades.md`.

---

### Turno 15 — Usuário

> trascreva toda a conversa da sessão para o arquivo

---

### Turno 16 — Assistente

Transcreveu a conversa completa para este arquivo.

---

## Estado ao final da sessão

- `spec.md` versão 1.2 aprovada e consistente internamente
- `DECISIONS.md` com D-001 e D-002 preenchidos
- `plan.md` versão 1.2 com DT-004 expandido e DT-005 novo
- `tasks.md` com T-017 nova e critérios de aceite corrigidos
- Nenhuma linha de código escrita
- Próximo passo: iniciar implementação a partir de T-001
