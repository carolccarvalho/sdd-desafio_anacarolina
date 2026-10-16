import test from 'node:test';
import assert from 'node:assert/strict';
import { decimalToString } from '../../src/decimal.js';
import { loadInputLexical } from '../../src/loader-lexical.js';

const base = despesas => JSON.stringify({
  colaborador: { id: 'c-1', nome: 'Ana', centro_custo: 'CC-1' },
  periodo: { competencia: '2026-07', inicio: '2026-07-01', fim: '2026-07-31' },
  despesas,
});

const expense = (overrides = {}) => ({
  id: 'd-1', data: '2026-07-10', categoria: 'alimentacao', descricao: 'refeicao',
  fornecedor: 'F', valor: 33.333, tem_nota_fiscal: true, ...overrides,
});

test('converte valor 33.333 para DecimalInterno exato', () => {
  const result = loadInputLexical(base([expense()]));
  assert.equal(decimalToString(result.despesas[0].valor), '33.333');
  assert.equal(result.despesas[0].valor.units, 33333n);
  assert.equal(result.despesas[0].valor.scale, 3);
});

test('converte notação científica sem passar por Number', () => {
  const result = loadInputLexical(base([expense({ valor: 'placeholder' })]).replace('"placeholder"', '1e-3'));
  assert.equal(decimalToString(result.despesas[0].valor), '0.001');
  assert.equal(result.despesas[0].valor.units, 1n);
  assert.equal(result.despesas[0].valor.scale, 3);
});

test('preserva strings, booleanos e múltiplas despesas', () => {
  const result = loadInputLexical(base([
    expense({ id: 'a', valor: 1, tem_nota_fiscal: false }),
    expense({ id: 'b', categoria: 'hospedagem', descricao: '2 diárias', fornecedor: 'Hotel', valor: -45.123 }),
  ]));
  assert.deepEqual(result.despesas.map(item => [item.id, item.categoria, item.descricao, item.fornecedor, item.tem_nota_fiscal]), [
    ['a', 'alimentacao', 'refeicao', 'F', false],
    ['b', 'hospedagem', '2 diárias', 'Hotel', true],
  ]);
  assert.equal(decimalToString(result.despesas[1].valor), '-45.123');
});

test('aceita objetos de protótipo nulo', () => {
  const result = loadInputLexical(base([expense()]));
  assert.equal(Object.getPrototypeOf(result.colaborador), Object.prototype);
  assert.equal(result.colaborador.id, 'c-1');
});

test('rejeita valor ausente, string e decimal malformado', () => {
  assert.throws(() => loadInputLexical(base([expense({ valor: undefined })])), /Despesa inválida/);
  assert.throws(() => loadInputLexical(base([expense({ valor: '33.333' })])), /Despesa inválida/);
  assert.throws(() => loadInputLexical(base([expense({ valor: 'placeholder' })]).replace('"placeholder"', '1.2.3')), /número JSON malformado/);
});

test('rejeita JSON inválido e raiz inválida', () => {
  assert.throws(() => loadInputLexical('{'), SyntaxError);
  assert.throws(() => loadInputLexical('[]'), /Entrada deve ser um objeto JSON/);
});

test('rejeita campos obrigatórios ausentes e tipos inválidos', () => {
  const input = JSON.parse(base([expense()]));
  delete input.periodo.inicio;
  assert.throws(() => loadInputLexical(JSON.stringify(input)), /Período inválido/);
  const invalid = JSON.parse(base([expense()]));
  invalid.despesas[0].tem_nota_fiscal = 'sim';
  assert.throws(() => loadInputLexical(JSON.stringify(invalid)), /Despesa inválida/);
});
