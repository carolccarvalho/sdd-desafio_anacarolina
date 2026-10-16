# Tasks — Motor de Cálculo de Reembolso

> Tasks pequenas o bastante para commits rastreáveis. Cada task identifica
> requisitos/decisões, dependências, aceite verificável, testes e commit sugerido.

## Fase 1 — Fundação

- [x] **T-001 — Fundação do projeto**
  - **Registro desta execução:** `npm test` passou; commit `fc1b549`.
  - **Atende:** DT-003; estrutura técnica do plano.
  - **Depende de:** —
  - **Aceite:** scripts `start` e `test` executam; módulos/pastas-base existem.
  - **Testes:** smoke do runner e importação da política.
  - **Commit:** `chore(T-001): cria fundação do projeto`

- [ ] **T-002 — Loader e contrato estrutural de entrada**
  - **Atende:** spec 4.1; A9/D-003.
  - **Faz:** lê JSON, valida campos, tipos e formatos; valida `periodo.competencia` apenas como `AAAA-MM`; não exige correspondência com início/fim; preserva valores com mais de duas casas.
  - **Depende de:** T-001.
  - **Aceite:** JSON válido, JSON inválido, campo ausente, formato de competência inválido e competência divergente das datas são testados; somente o formato inválido falha.
  - **Testes:** `tests/loader.test.js`.
  - **Commit:** `feat(T-002): valida entrada e competência informativa`

- [ ] **T-003A — Núcleo decimal interno**
  - **Atende:** RN-010, AMB-009, A4/D-003 e D-004.
  - **Faz:** define `DecimalInterno` com `{ units: BigInt, scale: integer }`; implementa alinhamento de escalas, soma, subtração, comparação, multiplicação, half-up decimal exato e conversão controlada para centavos.
  - **Depende de:** T-001.
  - **Aceite:** `1.005 → 1.01`, `2.675 → 2.68`, `0.1 + 0.2 → 0.3`; valores com três casas permanecem exatos internamente até os pontos de arredondamento definidos pela spec; nenhuma operação interna usa `Number`.
  - **Testes:** `tests/rules/decimal.test.js` e `tests/rules/RN-010-arredondamento.test.js`, cobrindo fronteiras half-up, soma decimal, alinhamento de escalas e valores com três casas.
  - **Commit:** `feat(T-003A): cria núcleo decimal exato com BigInt`

- [ ] **T-003B — Parser lexical e loader monetário**
  - **Atende:** spec 4.1, RN-010, AMB-009 e A9/D-003.
  - **Faz:** lê o JSON como texto; preserva lexemas numéricos até a conversão; implementa parser seguro para objetos, arrays, strings escapadas, booleanos, `null`, números negativos e notação científica; converte campos monetários para `DecimalInterno`; rejeita JSON inválido.
  - **Depende de:** T-002 e T-003A.
  - **Aceite:** números como `33.333`, `-45.123` e `1e-3` são convertidos exatamente; estruturas JSON válidas são preservadas; strings escapadas, arrays, objetos, booleanos e `null` são aceitos; JSON inválido produz erro controlado; nenhum valor monetário passa por `JSON.parse` como `Number` antes da conversão decimal.
  - **Testes:** `tests/loader.test.js` e `tests/rules/parser-json.test.js`.
  - **Commit:** `feat(T-003B): preserva lexemas no parser monetário`

- [ ] **T-003C1 — Adapter lexical do loader**
  - **Atende:** RN-010, seção 4.1, T-003B e compatibilidade de entrada.
  - **Faz:** prepara a integração entre `parseJsonLexical` e o domínio; valida objetos de protótipo nulo com `Object.hasOwn`; converte lexemas monetários para `DecimalInterno` em adapter isolado; não substitui o fluxo ativo loader → engine.
  - **Depende de:** T-003A e T-003B.
  - **Aceite:** `33.333` chega ao adapter como `DecimalInterno` exato; `1e-3` chega como `0.001` exato; erros de JSON, estrutura e tipo continuam controlados; não há dependência de métodos herdados em objetos parseados; o loader ativo pré-migração continua compatível com o engine atual; `npm test` permanece verde.
  - **Testes:** `tests/loader.test.js`, `tests/rules/loader-decimal-adapter.test.js` e `tests/rules/parser-json.test.js`.
  - **Commit:** `feat(T-003C1): cria adapter lexical monetário compatível`

- [ ] **T-003C2 — Migração do motor para decimal exato**
  - **Atende:** RN-001 a RN-011, RN-010, D-004 e saída compatível.
  - **Faz:** ativa o loader decimal; migra o estado monetário do engine, política, estornos, limites, totais e status; implementa distribuição por quociente/resto e maiores restos exatos; troca loader e engine de modo atômico.
  - **Depende de:** T-003A, T-003B, T-003C1, T-011A e T-012.
  - **Aceite:** nenhuma operação monetária usa `Number`; limites entram como lexemas ou `DecimalInterno`; d-003, d-011 e d-014 preservam os comportamentos v1.4; `100.000 − 45.123 = 54.877` internamente; grupos limitados fecham exatamente em centavos; empates matemáticos usam `posicaoEntrada`; resumo usa decimal exato; formato externo permanece compatível com a CLI atual; testes anteriores e novos passam.
  - **Testes:** regras de estorno, limites, resumo, distribuição e integração do exemplo.
  - **Commit:** `feat(T-003C2): migra engine para decimal exato`

- [ ] **T-003C3 — Serialização segura e CLI decimal**
  - **Atende:** RN-010, seção 4.2, D-004 e critérios operacionais de saída.
  - **Faz:** serializa `DecimalInterno` somente na fronteira; impede `BigInt`/`DecimalInterno` em `JSON.stringify`; verifica round-trip de centavos; adapta CLI e erros de serialização; valida a saída completa do exemplo.
  - **Depende de:** T-003A, T-003B, T-003C2, T-014A e T-014B.
  - **Aceite:** campos monetários continuam `number` JSON; valores finais são arredondados conforme RN-010; conversão que perderia centavos falha controladamente; CLI escreve saída válida e não deixa arquivo enganoso em erro; `processado_em` e schema permanecem válidos; o exemplo mantém `1765.94 / 790.43 / 975.51`.
  - **Testes:** `tests/rules/serializacao-monetaria.test.js`, `tests/integracao/cli-sucesso.test.js`, `tests/integracao/cli-erros.test.js` e `tests/integracao/totais-exemplo.test.js`.
  - **Commit:** `feat(T-003C3): fecha serialização monetária e CLI decimal`

## Fase 2 — Fases preliminares

- [ ] **T-004 — Normalização de categorias e aliases**
  - **Atende:** RN-006, RN-009, AMB-007, A8/D-003.
  - **Faz:** normaliza caixa e aplica somente alias `alimentação` → `alimentacao`; preserva posição original.
  - **Depende de:** T-001.
  - **Aceite:** `ALIMENTACAO`, `alimentação` e `alimentacao` produzem `alimentacao`; alias desconhecido não é aceito como permitido.
  - **Testes:** `tests/rules/RN-006-categoria.test.js`.
  - **Commit:** `feat(T-004): normaliza categorias e aliases canônicos`

- [ ] **T-005 — Filtro de período antes de valor zero**
  - **Atende:** RN-007, AMB-006, A6/D-003.
  - **Faz:** ignora datas fora do intervalo inclusivo antes de qualquer validação de zero.
  - **Depende de:** T-002, T-004.
  - **Aceite:** item fora do período, inclusive com valor zero, é `ignorado`; primeiro e último dia são processados; competência divergente não altera o resultado.
  - **Testes:** `tests/rules/RN-007-periodo.test.js`.
  - **Commit:** `feat(T-005): filtra competência antes de validar valor`

- [ ] **T-006 — Deduplicação determinística**
  - **Atende:** RN-009, AMB-008.
  - **Depende de:** T-004, T-005.
  - **Aceite:** primeira posição permanece principal; duplicata comum e estorno duplicado são ignorados; ordem lexicográfica do ID não interfere.
  - **Testes:** `tests/rules/RN-009-duplicatas.test.js`.
  - **Commit:** `feat(T-006): deduplica pela primeira posição do array`

- [ ] **T-017 — Rejeição de valor zero**
  - **Atende:** RN-011, A6/D-003.
  - **Faz:** dentro do período, zero vira `recusado`; não entra em limites; participa dos conjuntos de totais com contribuição zero; negativos permanecem estornos.
  - **Depende de:** T-005.
  - **Aceite:** zero dentro do período é recusado; zero fora é ignorado; `0.01` é inalterado; negativo não é afetado.
  - **Testes:** `tests/rules/RN-011-valor-zero.test.js`.
  - **Commit:** `feat(T-017): rejeita valores zero dentro da competência`

## Fase 3 — Estornos e validações

- [ ] **T-007A — Associação de estornos**
  - **Atende:** RN-008, AMB-008, A1/A2/D-003.
  - **Faz:** associa estornos não duplicados a grupos candidatos após período/zero/deduplicação, sem alterar valores; ordena estornos pela posição do array.
  - **Depende de:** T-004, T-005, T-006, T-017.
  - **Aceite:** d-009 é associado a d-003/d-004; associação não muda valores; múltiplos estornos preservam a ordem.
  - **Testes:** `tests/rules/RN-008-associacao-estornos.test.js`.
  - **Commit:** `feat(T-007A): associa estornos sem aplicar compensação`

- [ ] **T-008 — Validação de categoria permitida**
  - **Atende:** RN-006.
  - **Depende de:** T-004, T-007A.
  - **Aceite:** categoria não permitida é recusada; categorias canônicas não são recusadas.
  - **Testes:** `tests/rules/RN-006-categoria.test.js`.
  - **Commit:** `feat(T-008): valida categorias permitidas`

- [ ] **T-009 — Nota fiscal sobre valor original**
  - **Atende:** RN-005, AMB-004, A1/D-003.
  - **Faz:** compara sempre `valor_original`, sem usar valor efetivo após estorno.
  - **Depende de:** T-008.
  - **Aceite:** R$100,00 sem nota passa; R$100,01 sem nota recusa; estorno não reduz a base da decisão.
  - **Testes:** `tests/rules/RN-005-nota-fiscal.test.js`.
  - **Commit:** `feat(T-009): valida nota fiscal pelo valor original`

- [ ] **T-010 — Contrato de diárias**
  - **Atende:** RN-003, AMB-003, A5/D-003.
  - **Faz:** aceita exatamente um número inteiro positivo em algarismos imediatamente antes de `diária(s)` ou `noite(s)`; rejeita número depois, por extenso, zero, negativo ou múltiplos candidatos.
  - **Depende de:** T-008, T-009.
  - **Aceite:** padrões válidos preenchem `num_diarias`; todos os inválidos recusam com motivo especificado.
  - **Testes:** `tests/rules/RN-003-diarias.test.js`.
  - **Commit:** `feat(T-010): valida contrato de diárias`

- [ ] **T-007B — Aplicação efetiva de estornos**
  - **Atende:** RN-008, AMB-010, AMB-011, A1/A2/D-003.
  - **Faz:** após categoria, nota e diárias, aplica estornos somente a elegíveis, sequencialmente por posição; não permite valor efetivo negativo.
  - **Depende de:** T-007A, T-008, T-009, T-010.
  - **Aceite:** d-004 recusada não recebe abatimento; d-009 reduz d-003; dois estornos atravessam mais de uma despesa pela ordem; excedente não migra de grupo.
  - **Testes:** `tests/rules/RN-008-aplicacao-estornos.test.js`.
  - **Commit:** `feat(T-007B): aplica estornos somente a despesas elegíveis`

## Fase 4 — Limites e saída

- [ ] **T-011A — Agrupamento e limites diários**
  - **Atende:** RN-001, RN-002, RN-003, RN-004, AMB-001, AMB-010, A3/D-003.
  - **Faz:** agrupa alimentação/transporte por data+categoria; hospedagem por data; soma limites individuais de hospedagem.
  - **Depende de:** T-007B, T-010.
  - **Aceite:** hospedagens na mesma data com diárias diferentes usam soma de `num_diarias × 250`; recusadas/ignoradas não entram; grupos abaixo, iguais e acima do limite são classificados corretamente. Na ausência do campo de viagem na entrada, os limites-base são usados sem multiplicador de viagem.
  - **Testes:** `tests/rules/RN-001-alimentacao.test.js`, `RN-002-transporte.test.js`, `RN-003-hospedagem.test.js`, incluindo caso sem `em_viagem`.
  - **Commit:** `feat(T-011A): calcula limites diários e grupos de hospedagem`

- [ ] **T-011B — Distribuição proporcional e resíduos**
  - **Atende:** RN-001/RN-002/RN-003/RN-010, A4/D-003 e D-004.
  - **Faz:** calcula proporções com quociente e resto inteiros, trunca inicialmente, distribui centavos pelos maiores restos comparados por multiplicação cruzada e desempata pela posição original.
  - **Depende de:** T-003A, T-003B, T-003C3 e T-011A.
  - **Aceite:** soma de grupo limitado é exatamente o limite; casos com resíduos e empate matemático são determinísticos; teste diferencia arredondamento de apresentação de corte real por limite, mantendo d-011 como `aprovado` e d-003 como `aprovado` após estorno quando seu valor efetivo permanece integralmente dentro do limite.
  - **Testes:** `tests/rules/distribuicao-residuos.test.js`, incluindo proporções, empate exato de restos e fechamento em centavos.
  - **Commit:** `feat(T-011B): fecha limites com restos decimais exatos`

- [ ] **T-011C — Auditoria de hospedagem**
  - **Atende:** RN-003, seção 4.2, A7/D-003.
  - **Faz:** produz `num_diarias`, `limite_unitario_diaria`, `limite_item` e `limite_grupo`; repete o limite de grupo por data; omite campos quando inaplicáveis.
  - **Depende de:** T-010, T-011A.
  - **Aceite:** campos existem somente em hospedagens elegíveis com diárias; valores têm duas casas; limite de grupo é igual em todos os itens da data; nenhum campo é `null` ou aparece em outras categorias.
  - **Testes:** `tests/rules/RN-003-hospedagem-auditoria.test.js`.
  - **Commit:** `feat(T-011C): adiciona auditoria de hospedagens`

- [ ] **T-012 — Orquestração da pipeline de 11 etapas**
  - **Atende:** seção 8, A1/A6/D-003.
  - **Faz:** encadeia exatamente as 11 etapas na ordem da spec, incluindo associação separada da aplicação de estornos.
  - **Depende de:** T-004, T-005, T-006, T-017, T-007A, T-008, T-009, T-010, T-007B, T-011A, T-011B, T-011C.
  - **Aceite:** integração verifica ordem, nenhum item permanece pendente e conflitos produzem o status esperado.
  - **Testes:** `tests/integracao/pipeline.test.js`.
  - **Commit:** `feat(T-012): orquestra pipeline de onze etapas`

- [ ] **T-013 — Resumo e totais**
  - **Atende:** seção 4.2, RN-010, RN-011 e D-004.
  - **Depende de:** T-003A, T-003B, T-003C2, T-003C3, T-012.
  - **Aceite:** ignora itens `ignorado`; inclui recusados e zero no conjunto lógico; preserva precisão de originais; determina status antes do arredondamento; d-011 permanece `aprovado` e d-003 permanece `aprovado` após compensação quando seu valor efetivo está dentro do limite; recompõe os totais com decimal exato e satisfaz a invariante dos totais.
  - **Testes:** `tests/rules/resumo.test.js`, incluindo lista vazia, zero, ignorados e recomposição independente.
  - **Commit:** `feat(T-013): calcula totais com decimal exato`

## Fase 5 — CLI e integração

- [ ] **T-014A — CLI de sucesso**
  - **Atende:** saída 4.2 e interface do desafio, incluindo `processado_em`.
  - **Depende de:** T-002, T-012, T-013.
  - **Aceite:** `--input` e `--output` produzem JSON válido com schema completo e campos de hospedagem condicionais; `processado_em` é uma string ISO 8601 UTC válida terminada em `Z`, sem comparação do instante exato.
  - **Testes:** `tests/integracao/cli-sucesso.test.js`, incluindo validação de `processado_em`.
  - **Commit:** `feat(T-014A): implementa execução bem-sucedida da CLI`

- [ ] **T-014B — Erros da CLI**
  - **Atende:** contrato operacional de entrada/saída.
  - **Depende de:** T-014A, T-002.
  - **Aceite:** argumentos ausentes, arquivo inexistente e JSON inválido produzem mensagem em `stderr`, código não zero e nenhum resultado enganoso.
  - **Testes:** `tests/integracao/cli-erros.test.js`.
  - **Commit:** `feat(T-014B): trata erros de argumentos e entrada na CLI`

- [ ] **T-015A — Integração do arquivo de exemplo**
  - **Atende:** seção 9; D-003 A1–A9 e D-004, incluindo confirmação numérica dos totais.
  - **Depende de:** T-003A, T-003B, T-003C3, T-012, T-013, T-014A.
  - **Aceite:** verifica cada item, incluindo d-011 com `valor_original = 33,333`, `valor_reembolsavel = 33,33` e `status = aprovado`, d-003 como `aprovado` após estorno, d-004/d-009, d-010 e seus campos de auditoria, aliases, resíduos, d-007/d-008/d-009 ignorados com motivos definidos nas regras aplicáveis, schema de saída e lista de despesas vazia; usa os totais confirmados após a migração decimal e valida a serialização segura.
  - **Testes:** `tests/integracao/despesas-exemplo.test.js` e caso de entrada vazia, incluindo todos os itens e motivos ignorados.
  - **Commit:** `test(T-015A): valida integração após migração decimal`

- [ ] **T-015B — Recálculo e confirmação dos totais de integração**
  - **Atende:** seção 9, invariante dos totais e D-004.
  - **Depende de:** T-003A, T-003B, T-003C3, T-015A.
  - **Aceite:** recalcula e confirma a partir da saída real `total_solicitado = R$ 1.765,94`, `total_reembolsavel = R$ 790,43` e `total_recusado = R$ 975,51`; recompõe cada total independentemente dos itens com decimal exato, verifica `total_solicitado = total_reembolsavel + total_recusado` e registra a correção do provisório de R$ 791,43 causada pelo limite de R$ 60,00 aplicado a d-014 após a migração decimal.
  - **Testes:** `tests/integracao/totais-exemplo.test.js`, incluindo recomposição independente, d-014 e round-trip dos centavos.
  - **Commit:** `test(T-015B): confirma totais após migração decimal`

- [ ] **T-016 — README operacional**
  - **Atende:** rubrica de execução.
  - **Depende de:** T-014A, T-014B.
  - **Aceite:** pessoa sem contexto executa e testa seguindo apenas o README.
  - **Testes:** checklist manual documentado.
  - **Commit:** `docs(T-016): documenta execução e testes`

- [ ] **T-018 — Registro e organização das sessões**
  - **Atende:** DESAFIO.md, seção de sessões exportadas; RUBRICA.md, critério de relatório.
  - **Depende de:** cada sessão de trabalho relevante e T-016.
  - **Aceite:** `docs/sessions/` contém exports nomeados sequencialmente, não vazios, cobrindo decisões, implementação, testes e mudanças de requisito.
  - **Testes:** checklist documental: arquivos existem, nomes seguem `NN-descricao-curta.md` e cada export contém evidência da sessão.
  - **Commit:** `docs(T-018): organiza exports das sessões`

- [ ] **T-019 — Relatório final com evidências**
  - **Atende:** DESAFIO.md, seção do relatório; RUBRICA.md, critério de relatório e discernimento.
  - **Depende de:** T-018 e histórico de commits; T-015B para os resultados finais.
  - **Aceite:** `docs/RELATORIO.md` contém Delegação, Descrição, Discernimento, Diligência e Envelope; cita sessões e commits; documenta um caso concreto de erro do agente, como foi identificado e como foi corrigido; registra evidências verificáveis do recálculo e da mudança de requisito.
  - **Testes:** checklist documental cruzando cada afirmação com arquivo de sessão, commit ou teste citado.
  - **Commit:** `docs(T-019): elabora relatório final com evidências`

## Cobertura de rastreabilidade

| Requisito/decisão | Tasks | Testes |
|---|---|---|
| RN-001 | T-011A, T-011B | RN-001; resíduos |
| RN-002 | T-011A, T-011B | RN-002; resíduos |
| RN-003 | T-010, T-011A, T-011B, T-011C | diárias, hospedagem, auditoria |
| RN-004 | T-011A, T-011B | limites parciais |
| RN-005/A1 | T-009, T-007B | nota por original; integração estorno |
| RN-006/A8 | T-004, T-008 | aliases/categorias |
| RN-007/A6/A9 | T-002, T-005 | período e competência |
| RN-008/A1/A2 | T-007A, T-007B | associação, aplicação, múltiplos |
| RN-009 | T-006 | duplicatas |
| RN-010/A4 | T-003A, T-003B, T-003C, T-011B | decimal exato, parser, serialização e resíduos |
| RN-011/A6 | T-005, T-017, T-013 | zero dentro/fora e totais |
| Saída hospedagem/A7 | T-011C, T-014A | campos e omissão |
| CLI e erros | T-014A, T-014B | sucesso e falhas |
| Integração | T-015A, T-015B | exemplo completo, serialização e totais |
| Lista vazia | T-013, T-015A | resumo vazio e integração |

## Ordem sugerida de implementação

T-001 → T-002 → T-003A → T-003B → T-003C1 → T-003C2 → T-003C3 → T-004 → T-005 → T-006 → T-017 → T-007A → T-008 → T-009 → T-010 → T-007B → T-011A → T-011B → T-011C → T-012 → T-013 → T-014A → T-014B → T-015A → T-015B → T-016 → T-018 → T-019.

T-003C1 mantém compatibilidade com o loader/engine antigos. T-003C2 migra loader e engine de modo atômico. T-003C3 fecha a fronteira de serialização e CLI. T-003C1, T-003C2 e T-003C3 devem passar antes de T-011B, T-013, T-015A e T-015B; nenhuma dessas tasks pode ser marcada como concluída antes dos testes de adapter, migração decimal, serialização segura, distribuição por quociente/resto, recomposição dos totais e integração do exemplo passarem.
