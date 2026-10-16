# Motor de Reembolso

CLI em Node.js 20 para calcular o reembolso conforme `specs/001-motor-reembolso/spec.md`.

## Executar

```bash
npm start -- --input exemplos/despesas-exemplo.json --output resultado.json
```

## Testar

```bash
npm test
```

A entrada deve seguir o contrato documentado na spec. A saída é JSON com itens auditáveis, resumo financeiro e `processado_em` em UTC.

Erros de argumentos, arquivo inexistente ou JSON inválido são escritos em `stderr` e encerram a execução com código diferente de zero. A suíte cobre validação do loader, pipeline, estornos, arredondamento decimal, limites, integração do exemplo, serialização e CLI.
