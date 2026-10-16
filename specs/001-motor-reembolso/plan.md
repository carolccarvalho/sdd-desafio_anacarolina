# Plano Técnico — Motor de Cálculo de Reembolso

**Versão:** 1.4 · **Baseado na spec:** 1.4

> Aqui mora o COMO. Este arquivo pode falar de linguagem, biblioteca e
> arquitetura, mas não cria regras de negócio novas. Regras e comportamentos
> obrigatórios vêm exclusivamente de `spec.md`.

---

## 1. Stack

| Escolha | O quê | Por quê | Alternativa descartada |
|---|---|---|---|
| Linguagem | Node.js 20 (JavaScript ESM) | Runtime disponível e JSON nativo | TypeScript, por exigir build adicional |
| CLI | `process.argv` nativo | Apenas dois argumentos fixos | `commander`/`yargs`, por adicionarem dependências |
| Testes | `node:test` e `node:assert` | Runner nativo e sem dependências | Jest/Vitest, por custo desnecessário |
| Validação | Validação manual | Mensagens de erro controladas | Bibliotecas de schema, por adicionarem dependências |

---

## 2. Arquitetura e pipeline

A separação é feita entre I/O, orquestração e regras puras:

```text
src/
├── cli.js          entrada de argumentos, execução e escrita do resultado
├── loader.js       leitura e validação estrutural do JSON
├── engine.js       orquestração das fases
├── rules/
│   ├── normalize.js       fase 1: categorias canônicas
│   ├── periodo.js         fase 2: intervalo de datas
│   ├── valor-zero.js      fase 3: valor zero
│   ├── duplicatas.js      fase 4: deduplicação
│   ├── estornos.js        fases 5 e 9: associação e aplicação
│   ├── categoria.js       fase 6: categorias permitidas
│   ├── nota-fiscal.js     fase 7: nota sobre valor original
│   ├── diarias.js         fase 8: contrato de diárias
│   └── limites.js         fase 10: limites e resíduos
├── arredondamento.js      fase 11: representação monetária final
└── resumo.js              totais do resultado
```

O fluxo obrigatório possui 11 etapas:

1. normalização de categoria e aliases;
2. filtro de período;
3. validação de valor zero;
4. deduplicação;
5. associação de estornos a grupos candidatos, sem alterar valores;
6. validação de categoria permitida;
7. validação de nota fiscal sobre `valor_original`;
8. validação/inferência de diárias;
9. aplicação efetiva de estornos somente às despesas elegíveis;
10. limites diários e distribuição proporcional;
11. arredondamento final e fechamento de resíduos.

A associação de estornos e sua aplicação são operações distintas. A fase 5
preserva referências ao grupo candidato. A fase 9 recebe o estado após as fases
6–8 e aplica os estornos apenas às despesas que continuam elegíveis. O engine
conhece a ordem; cada regra não conhece a implementação das demais.

`cli.js` e `loader.js` não implementam regras de negócio. `rules/` não lê nem
escreve arquivos. `resumo.js` opera apenas sobre o estado final produzido pelo
engine.

A implementação monetária usa `decimal.js` como dependência única para aritmética decimal. O loader continua usando `JSON.parse`, converte valores monetários com `Decimal(String(valor))` e o engine converte para `Number` somente depois do arredondamento final de saída. Não há parser JSON lexical, `BigInt` ou escala manual.

---

## 3. Precisão e representação monetária

Valores monetários internos usam instâncias de `Decimal` da versão fixa `10.6.0` de `decimal.js`. A entrada continua sendo lida com `JSON.parse`; cada valor monetário é convertido imediatamente com `Decimal(String(valor))`. A biblioteca é usada para soma, subtração, comparação, proporção, estornos, limites e totais.

A configuração de arredondamento usa `Decimal.ROUND_HALF_UP`. Assim, `1.005`
produz `1.01`, `2.675` produz `2.68` e `0.1 + 0.2` produz `0.3` sem depender
da aritmética binária de `Number`.

A simplificação não preserva o lexema bruto de números JSON arbitrariamente
longos após `JSON.parse`. Ela é adotada para o domínio e os valores monetários
previstos neste projeto; não há parser JSON lexical, `BigInt` ou escala manual.

Para grupos limitados, a divisão proporcional usa `Decimal` para calcular as
parcelas e os resíduos. Os resíduos são comparados com `Decimal.comparedTo`; em
empate matemático, a posição original no array resolve deterministicamente.

O arredondamento ocorre somente:

- no `valor_reembolsavel` final de cada item;
- nos totais do resumo;
- na serialização dos campos monetários de auditoria.

`total_solicitado` soma os `valor_original` dos status aplicáveis sem arredondar
cada item antes da soma. O resultado final é arredondado para duas casas.

### Serialização segura

Após o arredondamento final com `Decimal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)`,
os campos monetários são convertidos para `Number` na fronteira de saída. Apenas
números JavaScript chegam a `JSON.stringify`; instâncias de `Decimal` nunca são
serializadas diretamente.

### Fechamento de grupos limitados

Para cada grupo cujo total exceda o limite:

1. calcular a parcela proporcional de cada item com `Decimal`;
2. truncar cada parcela para centavos;
3. calcular quantos centavos faltam para alcançar exatamente o limite;
4. ordenar itens pelo maior resíduo usando `Decimal.comparedTo`;
5. em empate matemático, ordenar pela posição original no array de entrada;
6. adicionar um centavo aos primeiros itens necessários.

A soma final dos itens deve ser exatamente o limite do grupo. O algoritmo é
aplicado separadamente para alimentação, transporte urbano e cada grupo diário
de hospedagem.

---

## 4. Modelo de dados interno

O objeto interno preserva os campos de entrada e adiciona estado de processamento:

```js
{
  id: string,
  data: string,
  categoria: string,              // nome canônico
  descricao: string,
  fornecedor: string,
  valor: decimal,                 // valor original sem perda de escala
  valor_original: decimal,
  tem_nota_fiscal: boolean,
  posicaoEntrada: integer,
  num_diarias: integer | ausente,
  limite_unitario_diaria: decimal | ausente,
  limite_item: decimal | ausente,
  limite_grupo: decimal | ausente,
  grupoEstorno: referência | ausente,
  valorEfetivo: decimal,
  valorReembolsavel: decimal,
  status: string,
  motivo: string
}
```

Os quatro campos de auditoria de hospedagem só são criados quando a quantidade
de diárias foi determinada com sucesso. Eles são omitidos, nunca preenchidos
com `null`, para outras categorias ou hospedagens cuja inferência falhou. Quando
presentes, `limite_grupo` é atribuído a todos os itens de hospedagem da mesma
data cuja quantidade de diárias foi determinada com sucesso.

---

## 5. Representação técnica da política

Os limites base e categorias canônicas ficam centralizados em um módulo de
política:

```js
LIMITES = {
  alimentacao: 60.00,
  transporte_urbano: 80.00,
  hospedagem_por_diaria: 250.00
}
CATEGORIAS_PERMITIDAS = ["alimentacao", "transporte_urbano", "hospedagem"]
ALIASES_CATEGORIA = { "alimentação": "alimentacao" }
LIMITE_NOTA_FISCAL = 100.00
```

Os limites monetários da política devem ser definidos como lexemas decimais ou
convertidos em uma única fronteira controlada para `DecimalInterno`. Nenhum
cálculo monetário pode usar `Number`; `Number` fica restrito a escala, posição
de array e metadados não monetários.

A comparação de fornecedor para agrupamento usa uma forma técnica
case-insensitive. A normalização de categoria utiliza a tabela explícita de
aliases da spec; não se generaliza remoção de acentos para outras categorias.

`periodo.competencia` é validado pelo loader somente pelo formato `AAAA-MM` e
copiado ao resultado. A inclusão de despesas usa apenas `data` comparada ao
intervalo inclusivo de `periodo.inicio` e `periodo.fim`.

---

## 6. Detalhamento técnico das fases

### 6.1 Normalização, período, zero e duplicatas

A normalização preserva a posição original e produz o nome canônico. O filtro de
período ocorre antes da validação de valor zero. A deduplicação usa data,
categoria canônica, fornecedor case-insensitive e valor, mantendo a primeira
posição do array.

### 6.2 Associação e aplicação de estornos

A associação cria grupos por categoria, fornecedor e período após as fases 1–4.
Estornos duplicados já descartados não são associados. A aplicação ocorre só
após categoria, nota e diárias. Estornos são ordenados pela posição original;
despesas elegíveis também. O saldo de cada estorno reduz sequencialmente os
valores efetivos das despesas, sem permitir saldo negativo.

### 6.3 Limites e hospedagem

Alimentação e transporte agrupam por data e categoria. Hospedagem agrupa por
data; o limite do grupo é a soma de `num_diarias × 250,00` de cada item
hospedagem elegível. A fase produz os quatro campos de auditoria para esses
itens e usa o algoritmo de fechamento descrito na seção 3.

### 6.4 Saída

A saída segue o schema da seção 4.2 da spec. Campos de auditoria de hospedagem
são serializados apenas quando presentes no estado interno. Campos ausentes não
são serializados como `null`.

---

## 7. Estratégia de testes

- testes unitários por fase, com nomes RN/AMB;
- testes específicos para associação versus aplicação de estornos;
- testes de precisão com valores de três casas;
- testes do parser JSON lexical para decimais, notação científica (`1e-3`) e preservação do valor matemático antes de `JSON.parse`;
- testes de half-up em `1.005` e `2.675`;
- testes de soma `0.1 + 0.2`, soma de valores com três casas e estornos com três casas;
- testes de quociente/resto, maiores restos e empate matemático por posição;
- testes de serialização segura e rejeição de perda silenciosa de centavos;
- testes de maiores restos e desempate por posição;
- testes de hospedagens múltiplas e campos auditáveis;
- testes de contrato de descrições de diárias;
- testes de aliases e competência informativa;
- testes de valor zero dentro e fora do período;
- testes do loader para JSON inválido, campos ausentes e erros de formato;
- testes da CLI para sucesso, argumentos ausentes, arquivo inexistente e JSON
  inválido;
- teste de lista vazia;
- integração completa do arquivo de exemplo, incluindo recálculo dos totais.

---

## 8. Riscos técnicos

| Risco | Mitigação |
|---|---|
| Perda de precisão em valores com mais de duas casas | decimal interno com `BigInt` e escala variável; parser lexical antes de `JSON.parse` monetário |
| Resíduo diferente entre execuções | quociente/resto inteiro, comparação por multiplicação cruzada e posição como desempate |
| Estorno aplicado antes de exclusões | fases separadas e teste de integração d-003/d-004/d-009 |
| Campos de hospedagem inconsistentes | gerar auditoria somente após inferência e calcular limite do grupo uma vez |
| Erro de entrada mascarado | parser lexical valida JSON e loader retorna erro em `stderr` com código não zero |
| Perda de centavos na saída JSON | serialização a partir de centavos inteiros com round-trip verificável antes de produzir `number` |
