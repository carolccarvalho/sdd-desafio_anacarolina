# Relatório — Desafio SDD

> Eu preenchi este relatório com as evidências disponíveis nas sessões exportadas,
> no histórico Git e nas verificações registradas. Mantive pendentes apenas os
> campos que dependem de informação pessoal ou de sessões ainda não exportadas.

**Aluna:** `Ana Carolina Carvalho` · **Repositório:** `https://github.com/carolccarvalho/sdd-desafio_anacarolina` · **Data:** `2026-10-19`

**Atualização desta revisão:** em 2026-10-19, executei a suíte completa: 34 testes passaram e nenhum falhou. Também alinhei este relatório ao estado atual do repositório.

---

## Delegação

Eu distribuí as atividades da seguinte forma:

| Atividade | Minha participação e evidência |
|---|---|
| Identificar ambiguidades | Eu levantei 11 pontos na sessão `docs/sessions/01-spec-ambiguidades.md` e depois registrei 15 achados na sessão 03. |
| Decidir as ambiguidades | Eu tomei as decisões sobre hospedagem, estornos, duplicatas, totais e valores zero, conforme as sessões 01 e 03. |
| Escrever e revisar a spec | Eu escrevi e revisei a especificação com apoio do assistente, nos commits `89f1ff9`, `b624391`, `9050533` e `6aa2c3d`. |
| Desenhar arquitetura e tasks | Eu defini os requisitos e o assistente os organizou em arquitetura e tasks nos commits `1b11835`, `bd0dfc9`, `3ea9dff` e `5e6eb2f`. |
| Implementar | Eu conduzi a implementação com assistência, incluindo os commits `fc1b549`, `a8a0a6b`, `ce3ca17` e a migração posterior para `decimal.js`. |
| Escrever e revisar testes | Eu solicitei e validei a execução dos testes. A última execução passou com 34 testes, cobrindo arredondamento, estornos, loader, CLI, resumo e integração. |
| Absorver o envelope / mudança D-004 | Eu decidi absorver a mudança; o assistente implementou a decisão após minha aprovação, nos commits `cb96139`, `807a4c6` e `a8ad9fe`. |
| Simplificar a estratégia monetária | Eu aprovei a adoção de `decimal.js` 10.6.0 e a remoção da estratégia BigInt/parser lexical, alinhando também `plan.md` e `tasks.md`. |
| Auditar as tasks | Eu acompanhei a auditoria final de T-002, T-007A, T-007B, T-012, T-013, T-014A, T-014B, T-015A, T-015B e T-016, registrada nas sessões 07 e 08. |

**Onde deleguei e me arrependi:** não há registro de delegação a subagente. Eu concentrei inicialmente muitas regras em `src/engine.js`, embora o `plan.md` previsse módulos separados em `src/rules/`; isso reduziu a rastreabilidade por task.

**Onde não deleguei e deveria ter delegado:** eu deveria ter transformado mais cedo a auditoria da cobertura de tasks e a auditoria monetária em testes dedicados por arquivo, em vez de concentrá-las em `tests/rules/motor.test.js` e `tests/smoke.test.js`.

**Usei subagentes, skills, MCP ou hooks?** Não há evidência de uso no histórico ou nas sessões exportadas. Eu não configurei subagentes, skills, MCP ou hooks.

---

## Descrição

### Caso escolhido: limite diário de alimentação

**Versão inicial da regra:** eu encontrei a frase “Alimentação tem limite de R$ 60 por dia”, que não esclarecia se o limite era individual ou agregado por data.

**Versão final:** eu defini na spec que o total reembolsável de despesas de `alimentacao` por dia de calendário é R$ 60,00. Quando a soma ultrapassa o limite, distribuo o reembolso proporcionalmente e fecho os centavos pelos maiores restos fracionários, usando a posição no array como desempate.

Eu identifiquei a ambiguidade ao comparar a política com `exemplos/despesas-exemplo.json`, que contém d-001 (R$ 72,50) e d-002 (R$ 38,00) no mesmo dia. Registrei a decisão na sessão 01, consolidei-a na sessão 03 e em D-003.

**Evidências:** `docs/sessions/01-spec-ambiguidades.md`, `docs/sessions/03-revisao-spec-ambiguidades.md` e `specs/001-motor-reembolso/spec.md` (RN-001/RN-010). Commits relacionados: `89f1ff9`, `b624391` e `9050533`.

---

## Discernimento

### Caso 1 — Totais provisórios incorretos

Eu mantive inicialmente na documentação os totais provisórios de R$ 791,43 reembolsáveis e R$ 974,51 recusados. Depois descobri que d-014 (`ALIMENTACAO`, R$ 61,00) deveria ser normalizada para `alimentacao` e limitada a R$ 60,00. Portanto, o excedente de R$ 1,00 não poderia ser reembolsado.

Eu detectei o erro executando a CLI e auditando cada item. O resultado mostrou d-014 com R$ 60,00 e total reembolsável de R$ 790,43. Registrei D-004 e atualizei a documentação para R$ 1.765,94 solicitados, R$ 790,43 reembolsáveis e R$ 975,51 recusados.

**Evidências:** `specs/001-motor-reembolso/DECISIONS.md`, spec v1.4, commit `cb96139`, `tests/smoke.test.js` e commit `a8ad9fe`.

### Caso 2 — Status de d-011 após arredondamento

Eu inicialmente considerei que d-011 poderia ser `aprovado_parcial`, pois a saída de R$ 33,33 é menor que o original de R$ 33,333. Depois verifiquei que a despesa estava abaixo do limite e que a diferença resultava apenas do arredondamento de apresentação. Em D-004, defini que o status deve ser decidido antes do arredondamento final.

Eu corrigi `src/engine.js` para classificar grupos não limitados usando o valor interno, sem arredondar antes da decisão. Também adicionei testes para d-011, para corte real por limite e para d-003 após o estorno.

**Evidências:** D-004, `src/engine.js`, `tests/rules/motor.test.js` e commits `cb96139`, `807a4c6` e `a8ad9fe`.

### Limitação técnica e simplificação monetária

Eu descobri que `Number` não atendia integralmente RN-010: por exemplo, `roundHalfUp(1.005)` produzia `1`, em vez de `1.01`. Como o plano exigia representação decimal exata, migrei o cálculo para `decimal.js` 10.6.0.

Hoje o fluxo é `JSON.parse → Decimal(String(valor)) → cálculo Decimal → arredondamento half-up → Number na saída JSON`. Migrei despesas, estornos, limites, totais, maiores restos, status e reembolsos. Removi o parser lexical, o adapter de loader, o núcleo BigInt e os testes exclusivos dessa estratégia.

Eu aceitei a limitação de que `JSON.parse` não preserva o lexema bruto de números JSON arbitrariamente longos, porque isso não é necessário para os valores monetários previstos no projeto. Validei a migração com 34 testes aprovados.

**Evidências:** `package.json`, `package-lock.json`, `src/loader.js`, `src/engine.js`, `src/arredondamento.js`, `specs/001-motor-reembolso/plan.md`, `specs/001-motor-reembolso/tasks.md` e a execução final de `npm test`.

---

## Diligência

Eu segui este procedimento:

1. Li `spec.md`, `plan.md`, `tasks.md`, `DECISIONS.md` e o exemplo antes de implementar.
2. Comparei a documentação com o exemplo e registrei ambiguidades antes do código.
3. Executei testes depois das alterações.
4. Executei a CLI e recompus os totais do exemplo.
5. Revisei os diffs antes dos commits.
6. Auditei status, totais, itens ignorados e precisão monetária quando encontrei inconsistências.
7. Instalei `decimal.js` com versão fixa e migrei apenas os cálculos monetários reais.
8. Executei a suíte após cada correção da migração.
9. Removi artefatos exclusivos da estratégia BigInt/parser lexical e alinhei o plano e as tasks.
10. Verifiquei que a saída final contém somente números JSON, nunca instâncias `Decimal`.
11. Criei testes dedicados para loader, estornos, pipeline, resumo, CLI e integração item a item.
12. Reindexei o code graph depois de criar os módulos de teste.

Eu não consigo informar uma porcentagem confiável de leitura dos diffs, porque esse dado não foi registrado. Sei, porém, que o histórico mostra revisões explícitas com `git diff`.

O principal ponto que aceitei sem verificar adequadamente foi o total provisório de R$ 791,43. A auditoria executável do exemplo revelou o erro de R$ 1,00 e exigiu a decisão D-004. Depois, eu também detectei que `Number` não atendia à precisão decimal e corrigi o problema com `decimal.js`.

Eu escrevi os testes com assistência e validei sua execução com `node --test`. A execução final passou com 34 testes, cobrindo loader, estornos, pipeline, resumo, CLI, integração, D-004, d-003, d-011, d-014, half-up decimal, maiores restos, serialização e totais.

---

## O envelope

Eu documentei no D-004 que o status deve ser definido antes do arredondamento e corrigi os totais de integração após auditar o exemplo.

Eu não tenho registro confiável de quantos arquivos editei manualmente nem de quanto tempo levei; esses campos dependem de confirmação pessoal.

Os commits diretamente relacionados à absorção foram:

- `cb96139 docs(T-003): define status antes do arredondamento`
- `807a4c6 fix(T-003): define status antes do arredondamento`
- `a8ad9fe test(T-015A): valida status e totais do exemplo`

Eu absorvi a mudança sem reescrever a arquitetura porque a pipeline já separava estornos, limites e serialização. O que resistiu foi a estratégia monetária baseada em `Number`; eu substituí a abordagem BigInt/parser lexical, considerada complexa para o escopo, por `decimal.js`, preservando a CLI e os contratos de entrada e saída.

Eu segui esta ordem: revisão documental e de decisões; auditoria numérica; aprovação da mudança; atualização da spec; correção do engine; testes de integração; migração para `decimal.js`; remoção dos artefatos BigInt/parser lexical; simplificação de plano e tasks; e execução final da suíte.

Se eu tivesse escrito a spec original já sabendo dessa mudança, teria definido desde o início a representação decimal exata, o momento da decisão de status e os totais confirmados do exemplo. A spec me ajudou a separar erros de regra, arredondamento e documentação, além de verificar a invariante `total_solicitado = total_reembolsavel + total_recusado`.

---

## Fechamento

Eu considero que esse processo valeu a pena para um motor pequeno com regras financeiras interdependentes e necessidade de auditoria. Para um script descartável, sem regras interdependentes nem rastreabilidade, eu não adotaria o mesmo nível de formalização.

Eu faria três coisas diferentes: separaria o engine em módulos desde a primeira implementação; criaria os arquivos de teste previstos em `tasks.md` antes dos testes agregados; e resolveria a representação decimal exata antes de marcar T-003 como concluída.

A principal lição desconfortável foi perceber que testes agregados podem passar enquanto ainda faltam critérios importantes. A revisão dos diffs, a recomposição independente dos totais e a auditoria de precisão revelaram lacunas que eu não teria encontrado olhando apenas para a quantidade de testes verdes.

---

## Sessões reais ainda recomendadas

Antes da entrega final, eu ainda devo exportar, sem inventar conteúdo, as sessões de:

1. Implementação funcional e primeiros testes.
2. Auditoria numérica que encontrou d-014 e corrigiu os totais.
3. Decisão D-004 sobre d-011 e status antes do arredondamento.
4. Correção do engine e testes de integração.
5. Auditoria técnica de `Number` e decisão sobre migração decimal.
6. Aprovação e execução da simplificação com `decimal.js`, incluindo limpeza dos artefatos BigInt/parser lexical.
7. Auditoria final das tasks T-002 a T-016, já registrada em `docs/sessions/08-auditoria-final-t002-a-t016.md`.
