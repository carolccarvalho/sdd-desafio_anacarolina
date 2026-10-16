# Relatório — Desafio SDD

> Relatório preenchido apenas com evidências disponíveis nas sessões exportadas,
> no histórico Git e nas verificações registradas. Campos que dependem de
> informação pessoal do aluno ou de sessões ainda não exportadas permanecem
> explicitamente pendentes.

**Aluno:** `<preencher pelo aluno>` · **Repositório:** `https://github.com/carolccarvalho/sdd-desafio_anacarolina` · **Data:** `2026-10-16`

---

## Delegação

A divisão observada nas sessões foi:

| Atividade | Quem | Evidência / motivo |
|---|---|---|
| Identificar ambiguidades | Assistente, revisado pelo usuário | Sessão `docs/sessions/01-spec-ambiguidades.md`; foram levantados 11 pontos e depois 15 achados na sessão 03. |
| Decidir as ambiguidades | Usuário | Sessão 01 registra escolhas sobre hospedagem, estornos, duplicatas, totais e valores zero; sessão 03 registra aprovações das recomendações. |
| Escrever e revisar a spec | Assistente sob decisão do usuário | Commits `89f1ff9`, `b624391`, `9050533`, `6aa2c3d`; sessões 01 e 03. |
| Desenhar a arquitetura e tasks | Assistente sob requisitos aprovados | Commits `1b11835`, `bd0dfc9`, `3ea9dff`, `5e6eb2f`; sessões 02, 03 e 04. |
| Implementar | Assistente | Commits `fc1b549`, `a8a0a6b`, `ce3ca17` e a migração monetária posterior para `decimal.js`. |
| Escrever e revisar testes | Assistente, com validação por execução da suíte | Commits `807a4c6`, `a8ad9fe` e ajustes posteriores para arredondamento, estornos, loader, CLI, resumo e integração; última execução: 34 testes passaram. |
| Absorver o envelope / mudança D-004 | Usuário decidiu; assistente implementou após aprovação | Commit documental `cb96139`, correção `807a4c6` e teste de integração `a8ad9fe`. |
| Simplificar a estratégia monetária | Usuário aprovou; assistente executou | Dependência fixa `decimal.js` 10.6.0, migração de loader/engine/arredondamento, remoção da estratégia BigInt/parser lexical e simplificação de `plan.md`/`tasks.md`. |\n| Auditoria final de tasks | Assistente | T-002, T-007A, T-007B, T-012, T-013, T-014A, T-014B, T-015A, T-015B e T-016 receberam testes dedicados; sessões 07 e 08 registram as evidências. |

**Onde deleguei e me arrependi:** não há registro de delegação a subagente. A implementação inicial concentrou muitas regras em `src/engine.js`, apesar de `plan.md` prever módulos separados em `src/rules/`; isso reduziu a rastreabilidade por task.

**Onde não deleguei e deveria ter delegado:** a auditoria da cobertura de tasks e a auditoria monetária deveriam ter sido transformadas mais cedo em testes dedicados por arquivo previsto em `tasks.md`, em vez de permanecerem concentradas em `tests/rules/motor.test.js` e `tests/smoke.test.js`.

**Usei subagentes / skills / MCP / hooks?** Não há evidência de uso no histórico ou nas sessões exportadas. Não foram configurados subagentes, skills, MCP ou hooks.

---

## Descrição

### Caso escolhido: limite diário de alimentação

**Versão 1 — regra ambígua da política:**

> “Alimentação tem limite de R$ 60 por dia.”

Essa redação não definia se o limite era individual por despesa ou agregado por data.

**Versão final na spec:**

> O total reembolsável de despesas de `alimentacao` por dia de calendário é de R$ 60,00. Quando a soma ultrapassa o limite, o reembolso dos itens elegíveis é proporcional e fechado por maiores restos fracionários, com empate pela posição no array.

**O que estava ambíguo:** aplicação individual ou agregado diário; também não estava definido como distribuir os centavos restantes.

**Como percebi:** a comparação entre a política e `exemplos/despesas-exemplo.json` mostrou d-001 (R$ 72,50) e d-002 (R$ 38,00) no mesmo dia. A sessão 01 registrou a decisão agregada; a sessão 03 e D-003 consolidaram a distribuição determinística.

**Evidência:** `docs/sessions/01-spec-ambiguidades.md`, `docs/sessions/03-revisao-spec-ambiguidades.md`, `specs/001-motor-reembolso/spec.md` (RN-001/RN-010).

**Commits relacionados:** `89f1ff9`, `b624391`, `9050533`.

---

## Discernimento

### Caso 1 — Totais provisórios incorretos

**O que foi proposto inicialmente:** a documentação v1.3 mantinha provisoriamente `total_reembolsavel = R$ 791,43` e `total_recusado = R$ 974,51`.

**Por que estava errado:** d-014 (`ALIMENTACAO`, R$ 61,00) deve ser normalizada para `alimentacao` e limitada a R$ 60,00. O R$ 1,00 excedente não pode ser reembolsado.

**Como detectei:** a execução da CLI e a auditoria item a item mostraram d-014 com reembolso de R$ 60,00 e total reembolsável de R$ 790,43. A diferença foi isolada matematicamente como exatamente R$ 1,00.

**O que foi feito:** a decisão foi registrada em D-004 e a documentação v1.4 substituiu os totais provisórios por R$ 1.765,94, R$ 790,43 e R$ 975,51.

**Evidência:** `specs/001-motor-reembolso/DECISIONS.md` (D-004), `specs/001-motor-reembolso/spec.md` v1.4, commit `cb96139`, teste `tests/smoke.test.js`, commit `a8ad9fe`.

### Caso 2 — Status de d-011 após arredondamento

**O que foi proposto inicialmente:** d-011 podia ser classificada como `aprovado_parcial` porque o output R$ 33,33 é numericamente menor que o original R$ 33,333.

**Por que estava errado:** d-011 está abaixo do limite; a diferença resulta somente do arredondamento de apresentação. D-004 determina que o status seja definido antes do arredondamento final. O mesmo raciocínio preserva d-003 como `aprovado` após o estorno reduzir seu valor efetivo para R$ 55,00.

**Como detectei:** a auditoria comparou a definição de status da spec, RN-010, RN-002, RN-008 e o resultado da execução. A inconsistência foi registrada antes da alteração documental.

**O que foi feito:** `src/engine.js` passou a classificar grupos não limitados usando o valor interno, sem arredondar antes da decisão. Foram adicionados testes para d-011, corte real por limite e d-003.

**Evidência:** D-004, `src/engine.js`, `tests/rules/motor.test.js`, commits `cb96139`, `807a4c6` e `a8ad9fe`.

### Limitação técnica encontrada e simplificação adotada

A auditoria identificou que `Number` não satisfazia integralmente RN-010: por exemplo,
`roundHalfUp(1.005)` produzia `1`, em vez de `1.01`. Também foi identificado que
o plano exigia representação decimal exata, enquanto o código usava aritmética de
ponto flutuante.

A migração foi simplificada e executada com `decimal.js` 10.6.0. O fluxo atual é
`JSON.parse → Decimal(String(valor)) → cálculo Decimal → arredondamento half-up →
Number na saída JSON`. Foram migrados valores de despesas, estornos, limites,
maiores restos, status, reembolsos e totais. O parser lexical, o adapter de loader,
o núcleo BigInt e os testes exclusivos dessa estratégia foram removidos.

A simplificação não preserva o lexema bruto de números JSON arbitrariamente longos
após `JSON.parse`; essa limitação foi aceita para os valores monetários previstos no
projeto. Não há parser JSON lexical nem escala manual.

**Evidência:** `package.json`, `package-lock.json`, `src/loader.js`, `src/engine.js`,
`src/arredondamento.js`, `specs/001-motor-reembolso/plan.md`,
`specs/001-motor-reembolso/tasks.md` e execução final de `npm test` com 34 testes aprovados.

---

## Diligência

**Meu procedimento de verificação registrado:**

1. Ler `spec.md`, `plan.md`, `tasks.md`, `DECISIONS.md` e o arquivo de exemplo antes de implementar.
2. Comparar a documentação com o exemplo e registrar ambiguidades antes do código.
3. Executar testes depois das alterações.
4. Executar a CLI com o arquivo de exemplo e recompor os totais.
5. Revisar diffs antes dos commits.
6. Auditar novamente status, totais, itens ignorados e precisão monetária quando surgiram inconsistências.
7. Instalar `decimal.js` com versão fixa e migrar somente os cálculos monetários reais.
8. Executar a suíte após cada correção da migração, incluindo half-up, estornos, limites, maiores restos e integração.
9. Remover os artefatos exclusivos da estratégia BigInt/parser lexical e alinhar `plan.md` e `tasks.md` ao escopo simplificado.
10. Verificar que a saída final contém apenas números JSON, nunca instâncias `Decimal`.
11. Criar testes dedicados do loader, estornos, pipeline, resumo, CLI e integração item a item.
12. Reindexar o code graph após a criação dos novos módulos de teste.

**Li o diff inteiro em que porcentagem das entregas?** Não há registro quantitativo confiável para informar uma porcentagem. O histórico mostra revisões explícitas com `git diff`, mas este campo deve ser confirmado pelo aluno.

**O que aceitei sem verificar direito, e o que me custou:** o valor provisório de R$ 791,43 foi mantido até a auditoria executável do exemplo. Isso exigiu uma revisão documental adicional e levou à decisão D-004. Também foi detectado posteriormente que a estratégia com `Number` não atendia integralmente à precisão decimal exigida; a correção foi simplificada para `decimal.js` e validada pela suíte final.

**Testes: quem escreveu, e como sei que testam a coisa certa?** Os testes foram escritos pelo assistente e executados com `node --test`. A execução final passou com 34 testes. A cobertura confirma loader, associação e aplicação de estornos, pipeline, resumo, CLI em sucesso e erro, integração item a item, D-004, d-003, d-011, d-014, half-up decimal, maiores restos, saída numérica e os totais do exemplo.

---

## O envelope

**Mudança documentada:** D-004 confirmou o status antes do arredondamento e corrigiu os totais de integração após a auditoria do exemplo.

**Quantos arquivos toquei na mão:** não há registro confiável de edição manual pelo aluno. O assistente alterou arquivos conforme os comandos da sessão. Preencher pelo aluno se esse dado for exigido pela rubrica.

**Quanto tempo levou:** não registrado nas sessões exportadas.

**Diff de absorção:** não foi calculado como um diff de absorção dedicado. Commits diretamente relacionados ao envelope:

- `cb96139 docs(T-003): define status antes do arredondamento`
- `807a4c6 fix(T-003): define status antes do arredondamento`
- `a8ad9fe test(T-015A): valida status e totais do exemplo`

**Absorveu de graça:** a pipeline já separava estornos, limites e serialização o suficiente para corrigir a decisão de status em `src/engine.js:64-72` sem reescrever a arquitetura. Os testes do exemplo também puderam ser ampliados para d-011, d-014 e os totais.

**Resistiu:** a estratégia monetária baseada em `Number` não absorvia integralmente a exigência de precisão decimal exata. A alternativa BigInt/parser lexical foi considerada complexa demais para o escopo; em seu lugar, foi adotada a biblioteca madura `decimal.js`, mantendo a CLI, o contrato de entrada e a saída JSON.

**Ordem em que fiz:** documentação e decisões foram revisadas antes da correção de código: auditoria numérica → aprovação da decisão → atualização documental v1.4 → correção do engine → testes de integração → instalação do `decimal.js` → migração monetária → limpeza da estratégia BigInt/parser lexical → simplificação de plano e tasks → execução final da suíte.

**Se eu tivesse escrito a spec original sabendo desta mudança:** teria definido desde o início a representação decimal exata, o momento de decisão do status e os totais confirmados do arquivo de exemplo, evitando a divergência provisória e a necessidade de reclassificar d-011.

**O que a spec me poupou, em concreto:** as decisões explícitas sobre pipeline, estornos, d-011 e d-014 permitiram distinguir erro de regra de negócio, erro de arredondamento e erro de documentação. Também tornou possível verificar a invariante `total_solicitado = total_reembolsavel + total_recusado`.

---

## Fechamento

**Para qual tamanho de projeto isto valeu a pena?** Para um motor pequeno, com regras financeiras interdependentes e necessidade de auditoria. A especificação, decisões e critérios evitaram interpretações diferentes sobre estornos, duplicatas, limites e status.

**Para qual não valeria?** Para um script descartável sem regras interdependentes, sem auditoria e sem necessidade de rastrear decisões entre requisitos, código e testes.

**O que eu faria diferente:** separaria o engine em módulos conforme o `plan.md` desde a primeira implementação; criaria os arquivos de teste previstos em `tasks.md` antes de usar testes agregados; e resolveria a representação decimal exata antes de marcar T-003 como concluída.

**A coisa mais desconfortável que aprendi sobre como trabalho com IA:** testes agregados podem passar enquanto ainda faltam critérios importantes. A revisão do diff, a recomposição independente dos totais e a auditoria de precisão revelaram lacunas que não apareceriam apenas olhando o número de testes verdes.

---

## Sessões reais ainda recomendadas

As seguintes sessões devem ser exportadas pelo aluno antes da entrega final, sem serem inventadas pelo agente:

1. Sessão da implementação funcional e dos primeiros testes.
2. Sessão da auditoria numérica que encontrou d-014 e corrigiu os totais.
3. Sessão da decisão D-004 sobre d-011 e status antes do arredondamento.
4. Sessão da correção do engine e dos testes de integração.
5. Sessão da auditoria técnica de `Number` e decisão sobre eventual migração decimal.
6. Sessão da aprovação e execução da simplificação com `decimal.js`, incluindo limpeza dos artefatos BigInt/parser lexical e validação final com 19 testes.
7. Sessão da auditoria final das tasks T-002 a T-016, com 34 testes e revisão do README, exportada em `docs/sessions/08-auditoria-final-t002-a-t016.md`.
