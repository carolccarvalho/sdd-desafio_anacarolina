# Plano Técnico — Motor de Cálculo de Reembolso

**Versão:** 1.1 · **Baseado na spec:** 1.1

> Aqui mora o COMO. Este arquivo pode e deve falar de linguagem, biblioteca e
> arquitetura. O que ele **não** pode é introduzir regra de negócio nova — se
> apareceu uma, ela pertence à `spec.md`.

---

## 1. Stack

| Escolha | O quê | Por quê | O que descartei e por quê |
|---|---|---|---|
| Linguagem | Node.js 20 (JavaScript ESM) | Ubíquo, sem dependência de runtime extra além do Node, bom suporte a JSON nativo | TypeScript: adicionaria build step desnecessário para um projeto de escopo fixo |
| CLI | `node --input-type=module` + `process.argv` nativo | Sem dependência extra para parsing de `--input` e `--output` | `commander` ou `yargs`: overhead desnecessário para dois flags fixos |
| Testes | `node:test` + `node:assert` (test runner nativo do Node 20) | Zero dependências, saída TAP compatível, suficiente para testes unitários e de integração | Jest: mais poder do que o necessário; adiciona `node_modules` pesado sem ganho real aqui |
| Aritmética monetária | Aritmética em **inteiros de centésimos** (multiplicar por 100, operar em inteiros, dividir no output) | Ponto flutuante acumula erro em divisões; `0.1 + 0.2 !== 0.3` em JS. Operar em inteiros elimina esse risco | `decimal.js` ou `big.js`: bibliotecas externas robustas, mas desnecessárias quando a estratégia de inteiros resolve o problema sem dependência |
| Parsing/validação de entrada | Validação manual com mensagens explícitas | Mantém controle total sobre as mensagens de erro; sem schema extra | `zod` ou `ajv`: adicionariam dependência externa e gerariam mensagens genéricas |

---

## 2. Arquitetura

```
src/
├── cli.js          → ponto de entrada: lê args, chama loader, chama motor, escreve saída
├── loader.js       → lê e valida o JSON de entrada; lança erro se inválido
├── engine.js       → orquestra as fases de processamento; retorna resultado completo
├── rules/
│   ├── normalize.js    → fase 1: normalização de categoria
│   ├── periodo.js      → fase 2: filtro de período de competência (RN-007)
│   ├── duplicatas.js   → fase 3: detecção e marcação de duplicatas (RN-009)
│   ├── estornos.js     → fase 4: compensação de estornos (RN-008)
│   ├── categoria.js    → fase 5: validação de categoria permitida (RN-006)
│   ├── nota-fiscal.js  → fase 6: exigência de nota fiscal (RN-005)
│   ├── diarias.js      → fase 7: inferência de diárias para hospedagem (AMB-003)
│   └── limites.js      → fase 8: aplicação de limites diários (RN-001, RN-002, RN-003)
├── arredondamento.js   → fase 9: arredondamento half-up (RN-010)
└── resumo.js           → calcula total_solicitado, total_reembolsavel, total_recusado
```

**Fluxo:**
```
arquivo JSON → loader.js → engine.js → [normalize → periodo → duplicatas →
estornos → categoria → nota-fiscal → diarias → limites → arredondamento] →
resumo.js → objeto resultado → cli.js → arquivo JSON de saída
```

**Fronteiras:**
- `cli.js` e `loader.js` são I/O puro — não conhecem regras de negócio.
- `rules/` é núcleo de negócio puro — não lê arquivos nem escreve stdout.
- `engine.js` é o orquestrador — conhece a ordem das fases mas não implementa nenhuma regra diretamente.
- Essa separação garante que cada fase pode ser testada unitariamente sem montar CLI, e que uma mudança de requisito (ex: nova regra, nova fase) toca um único arquivo.

---

## 3. Modelo de dados

### Despesa interna (objeto enriquecido durante o processamento)

```js
{
  id: string,
  data: string,              // AAAA-MM-DD
  categoria: string,         // normalizada para minúsculas
  descricao: string,
  fornecedor: string,        // original (comparações usam toLowerCase())
  valor: number,             // valor original da entrada (pode ser negativo)
  valorCentavos: integer,    // valor × 100, arredondado para inteiro (operações internas)
  tem_nota_fiscal: boolean,
  num_diarias: integer|null, // inferido da descricao para hospedagem; null se não aplicável
  status: string,            // 'pendente' → evolui para aprovado/aprovado_parcial/recusado/ignorado
  valorReembolsavelCentavos: integer, // calculado ao longo das fases; 0 se recusado/ignorado
  motivo: string             // justificativa legível; preenchido quando status muda
}
```

### Resultado final (objeto de saída)

Conforme definido na spec.md seção 4.2. Valores monetários convertidos de centavos para reais com duas casas decimais no momento da serialização.

---

## 4. Como a política é representada

Os limites e categorias permitidas vivem em `src/politica.js` como constantes exportadas:

```js
export const LIMITES = {
  alimentacao:      { centavos: 6000  },   // R$ 60,00
  transporte_urbano:{ centavos: 8000  },   // R$ 80,00
  hospedagem:       { centavos: 25000 },   // R$ 250,00 por diária
};

export const CATEGORIAS_PERMITIDAS = ['alimentacao', 'transporte_urbano', 'hospedagem'];
export const LIMITE_NOTA_FISCAL_CENTAVOS = 10000; // R$ 100,00
```

**Motivação:** centralizar os limites em um único arquivo significa que uma mudança na política (ex: limite de alimentação passa de R$ 60 para R$ 80) toca exatamente uma linha em um único arquivo, sem risco de inconsistência entre regras. Se a política mudar para um arquivo de configuração externo, só `politica.js` precisa mudar.

---

## 5. Decisões técnicas

### DT-001 — Aritmética em centavos inteiros

**Contexto:** valores monetários em ponto flutuante acumulam erro em divisões (cálculo proporcional de RN-001). Ex: `72.50 / 110.50 * 60` em IEEE 754 pode resultar em `39.36968...` em vez de `39.37`.

**Decisão:** todos os valores são convertidos para inteiros de centavos na entrada (`Math.round(valor * 100)`). Operações internas (soma, subtração, proporção) operam nesses inteiros. A divisão para proporção usa aritmética de ponto flutuante apenas no momento do cálculo da fração, mas o arredondamento final é aplicado imediatamente sobre o resultado, sem acumular operações.

**Alternativa descartada:** biblioteca `decimal.js` — resolve o problema mas adiciona dependência externa desnecessária para este escopo.

**Consequência:** fácil de auditar (cada valor tem representação exata em inteiro), sem surpresas de arredondamento acumulado. A conversão de volta para reais no output (`centavos / 100`) é trivial.

---

### DT-002 — Pipeline de fases sequencial explícito

**Contexto:** a spec define uma ordem estrita de aplicação de 9 regras (seção 8). Uma implementação que mistura as regras numa única função é difícil de testar e de modificar.

**Decisão:** cada fase é uma função pura que recebe o array de despesas (com estado acumulado) e retorna o mesmo array modificado. O `engine.js` encadeia as fases em ordem. Nenhuma fase conhece as outras.

**Alternativa descartada:** classe `Motor` com métodos encadeados — mais verboso sem ganho real de testabilidade para este tamanho de projeto.

**Consequência:** adicionar, remover ou reordenar uma fase requer mudar apenas `engine.js`. Cada fase tem seu próprio arquivo de teste.

---

### DT-003 — Test runner nativo do Node 20

**Contexto:** o projeto precisa de testes automatizados rastreáveis por requisito (spec → task → teste).

**Decisão:** usar `node:test` e `node:assert` disponíveis nativamente no Node 20, sem instalar Jest ou Vitest.

**Alternativa descartada:** Jest — mais ergonômico, mas adiciona `node_modules` pesado e requer configuração de ESM. Para este escopo, o ganho não justifica o custo.

**Consequência:** zero dependências de teste. O comando `node --test tests/**/*.test.js` roda tudo. Ligeiramente menos ergonômico (sem `expect().toBe()`), mas suficiente.

---

### DT-004 — Inferência de diárias via regex na descrição

**Contexto:** o campo `num_diarias` não existe na entrada (AMB-003). A spec decidiu inferir da `descricao`.

**Decisão:** regex `/(\d+)\s*(?:di[aá]rias?|noites?)/i` aplicada à `descricao`. Captura o número antes ou depois das palavras-chave. Se não houver match ou o número for ≤ 0, a despesa é recusada.

**Alternativa descartada:** exigir `num_diarias` como campo obrigatório na entrada — quebraria o schema do desafio que não prevê esse campo.

**Consequência:** funciona para os casos do exemplo (`"2 diárias"`, `"3 noites"`). Frágil para descrições criativas (`"fim de semana"`). Documentado como limitação na spec (seção 10).

---

## 6. Estratégia de testes

- **Nível:** majoritariamente **unitário por fase** (um arquivo de teste por arquivo de regra). Um teste de **integração ponta-a-ponta** processa `despesas-exemplo.json` e verifica o resultado completo.
- **Cada `RN-NNN` da spec tem teste:** sim — cada arquivo `tests/rules/RN-NNN.test.js` mapeia diretamente para a regra correspondente.
- **Casos de borda da seção 7 da spec:** cada linha da tabela de casos de borda tem um caso de teste nomeado explicitamente (ex: `'RN-005: d-003 R$100,00 sem nota não é recusado'`).
- **Nomenclatura:** `describe('RN-001 — Limite diário de alimentação', () => { it('soma proporcional quando total > limite', ...) })`. O nome do `describe` referencia o código da regra da spec — isso fecha a rastreabilidade spec → teste sem precisar ler o código.

```
tests/
├── rules/
│   ├── RN-001-alimentacao.test.js
│   ├── RN-002-transporte.test.js
│   ├── RN-003-hospedagem.test.js
│   ├── RN-005-nota-fiscal.test.js
│   ├── RN-006-categoria.test.js
│   ├── RN-007-periodo.test.js
│   ├── RN-008-estornos.test.js
│   ├── RN-009-duplicatas.test.js
│   └── RN-010-arredondamento.test.js
└── integracao/
    └── despesas-exemplo.test.js   ← processa o JSON completo, verifica cada item
```

---

## 7. Riscos

| Risco | Probabilidade | O que faço se acontecer |
|---|---|---|
| Regex de inferência de diárias falha em novo formato de descrição | Média | A spec prevê recusa com motivo claro; o usuário corrige a descrição. Se o padrão for comum, ampliar a regex e registrar em DECISIONS.md |
| Mudança de requisito (envelope do dia 2) altera um limite ou adiciona categoria | Alta (é o objetivo) | Alterar `politica.js` e/ou adicionar fase em `rules/`; reexecutar todos os testes |
| Aritmética de centavos produz resultado inesperado em proporções muito pequenas | Baixa | Coberto pelos testes de arredondamento (RN-010); se surgir, revisar a ordem de `Math.round` na fase de limites |
| JSON de entrada malformado ou com campos faltando | Média | `loader.js` valida campos obrigatórios e lança erro com mensagem clara antes de chamar o motor |
