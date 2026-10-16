# Sessão 04 — Auditoria final e ajustes documentais da spec v1.3

**Data:** 2026-10-16
**Arquivos alterados nesta sessão:** `specs/001-motor-reembolso/plan.md`, `specs/001-motor-reembolso/tasks.md`, `specs/001-motor-reembolso/DECISIONS.md`
**Código/testes/commits:** nenhum

## Objetivo

Auditar e alinhar a documentação da versão 1.3 antes da implementação, preservando `spec.md` como fonte de verdade e sem alterar código.

## Decisões verificadas

- Pipeline de 11 etapas, com período antes de valor zero.
- Associação de estornos separada da aplicação efetiva.
- Estornos aplicados somente após categoria, nota fiscal e diárias, em ordem do array.
- Nota fiscal sempre baseada em `valor_original`.
- Hospedagens múltiplas usam soma dos limites individuais.
- Resíduos usam maiores restos fracionários, com empate pela posição do array.
- Diárias aceitam número inteiro positivo antes de `diária(s)`/`noite(s)`; número depois, por extenso ou múltiplos candidatos são inválidos.
- Valor zero é recusado dentro do período, não entra nos limites e participa dos conjuntos de totais com contribuição zero.
- Auditoria de hospedagem usa `num_diarias`, `limite_unitario_diaria`, `limite_item` e `limite_grupo`, omitidos quando a quantidade não foi determinada.
- `alimentação` é alias de `alimentacao`.
- `periodo.competencia` é metadado validado apenas como `AAAA-MM`.

## Ajustes realizados

### plan.md

- Atualizada a versão para 1.3.
- Pipeline atualizada para 11 etapas.
- Associação e aplicação de estornos descritas separadamente.
- Preservação de valores com mais de duas casas decimais.
- Estratégia de fechamento exato por maiores restos.
- Limite de hospedagem calculado pela soma dos limites individuais.
- Campos de auditoria de hospedagem emitidos quando a quantidade de diárias é determinada com sucesso, sem condição adicional de item elegível.
- Aliases de categoria documentados.
- `periodo.competencia` tratado como metadado.
- Estratégia de testes e riscos técnicos atualizados.

### tasks.md

- Revisadas tasks de entrada, precisão, normalização, período, estornos, nota fiscal, diárias, limites, engine, resumo e CLI.
- T-007 dividido em T-007A (associação) e T-007B (aplicação).
- T-011 dividido em T-011A (agrupamento/limites), T-011B (resíduos) e T-011C (auditoria).
- T-014 dividido em T-014A (sucesso, incluindo `processado_em` ISO 8601 UTC terminado em `Z`) e T-014B (erros).
- T-015 dividido em T-015A (itens/schema) e T-015B (recálculo e confirmação dos totais).
- Criada T-018 para registro e organização de exports reais em `docs/sessions/`.
- Criada T-019 para `docs/RELATORIO.md`, cobrindo Delegação, Descrição, Discernimento, Diligência e Envelope, com evidência de erro concreto do agente.
- AMB-005 vinculada a T-011A/T-012, exigindo uso de limites-base sem multiplicador de viagem.
- Tabela de cobertura e ordem de implementação atualizadas.

### DECISIONS.md

- D-003 atualizada para referenciar as subdivisões atuais: T-007A/T-007B, T-011A/T-011B/T-011C e T-014A/T-014B quando aplicável.
- A7 ajustada para a condição de quantidade de diárias determinada com sucesso.
- Incluída nota histórica: D-003 substitui, para a spec v1.3, as partes de D-002 relativas à pipeline, aplicação de estornos e arredondamento; D-002 permanece preservada.
- Totais de integração permanecem provisórios e pendentes de validação executável.

## Auditoria final

Confirmado:

1. `plan.md` não condiciona campos de hospedagem a item elegível.
2. T-014A menciona ISO 8601 UTC terminado em `Z`, sem comparar instante exato.
3. T-018 prevê arquivos reais, nomeados e não vazios em `docs/sessions/`.
4. T-019 exige evidência de erro concreto do agente, identificação e correção.
5. T-015B recalcula a partir da saída real antes de confirmar os totais.
6. D-003 referencia as subdivisões atuais.
7. D-003 registra substituição parcial de D-002 sem apagar o histórico.

## Verificação

`git diff --check` foi executado sem erros. Nenhum commit foi criado.
