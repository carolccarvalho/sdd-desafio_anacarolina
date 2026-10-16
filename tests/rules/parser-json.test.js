import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonLexical } from '../../src/json-lexical.js';

const numberLexemes = value => {
  if (Array.isArray(value)) return value.flatMap(numberLexemes);
  if (value && typeof value === 'object') {
    if (value.type === 'number') return [value.lexeme];
    return Object.values(value).flatMap(numberLexemes);
  }
  return [];
};

test('parseia objeto simples preservando número', () => {
  const result = parseJsonLexical('{"valor":1.005}');
  assert.equal(result.valor.type, 'number');
  assert.equal(result.valor.lexeme, '1.005');
});

test('parseia objetos aninhados e arrays', () => {
  const result = parseJsonLexical('{"a":{"b":[1,2,{"c":3}]}}');
  assert.deepEqual(numberLexemes(result), ['1', '2', '3']);
});

test('parseia strings com escapes e Unicode', () => {
  const result = parseJsonLexical('{"text":"aspas \\\" barra \\\\ \u263A"}');
  assert.equal(result.text, 'aspas " barra \\ ☺');
});

test('parseia booleanos e null', () => {
  assert.deepEqual(parseJsonLexical('[true,false,null]'), [true, false, null]);
});

test('preserva todos os formatos numéricos exigidos', () => {
  const result = parseJsonLexical('[1.005,33.333,0.1,-45.123,1e-3,1.2e2,-4.50e-1]');
  assert.deepEqual(numberLexemes(result), ['1.005', '33.333', '0.1', '-45.123', '1e-3', '1.2e2', '-4.50e-1']);
});

test('rejeita vírgula inválida', () => assert.throws(() => parseJsonLexical('[1,]'), /valor JSON esperado/));
test('rejeita string não terminada', () => assert.throws(() => parseJsonLexical('{"x":"fim'), /string não terminada/));
test('rejeita número malformado', () => assert.throws(() => parseJsonLexical('1.2.3'), /número JSON malformado/));
test('rejeita objeto não fechado', () => assert.throws(() => parseJsonLexical('{"x":1'), /vírgula esperada|valor JSON esperado/));
test('rejeita array não fechado', () => assert.throws(() => parseJsonLexical('[1'), /vírgula esperada|valor JSON esperado/));
test('rejeita conteúdo após raiz', () => assert.throws(() => parseJsonLexical('true false'), /conteúdo após o valor raiz/));
