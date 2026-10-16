import test from 'node:test';
import assert from 'node:assert/strict';
import {
  add,
  compare,
  decimalToString,
  fromCents,
  fromDecimalLexeme,
  fromUnits,
  multiply,
  roundHalfUpToCents,
  subtract,
  truncateToCents,
} from '../../src/decimal.js';

test('soma decimal exata: 0.1 + 0.2 = 0.3', () => {
  assert.equal(decimalToString(add(fromDecimalLexeme('0.1'), fromDecimalLexeme('0.2'))), '0.3');
});

test('half-up exato: 1.005 → 1.01', () => {
  assert.equal(roundHalfUpToCents(fromDecimalLexeme('1.005')), 101n);
});

test('half-up exato: 2.675 → 2.68', () => {
  assert.equal(roundHalfUpToCents(fromDecimalLexeme('2.675')), 268n);
});

test('soma de valores com três casas', () => {
  const result = add(add(fromDecimalLexeme('33.333'), fromDecimalLexeme('0.002')), fromDecimalLexeme('0.005'));
  assert.equal(decimalToString(result), '33.34');
  assert.equal(roundHalfUpToCents(result), 3334n);
});

test('números negativos e subtração', () => {
  const result = subtract(fromDecimalLexeme('0'), fromDecimalLexeme('45.123'));
  assert.equal(decimalToString(result), '-45.123');
  assert.equal(roundHalfUpToCents(result), -4512n);
});

test('escalas diferentes representam o mesmo valor', () => {
  assert.equal(compare(fromDecimalLexeme('1.0'), fromDecimalLexeme('1.000')), 0);
  assert.equal(decimalToString(add(fromDecimalLexeme('1.0'), fromDecimalLexeme('0.005'))), '1.005');
});

test('zero é normalizado', () => {
  const zero = fromDecimalLexeme('-0.000');
  assert.equal(zero.units, 0n);
  assert.equal(zero.scale, 0);
  assert.equal(decimalToString(zero), '0');
});

test('multiplicação exata', () => {
  assert.equal(decimalToString(multiply(fromDecimalLexeme('1.25'), fromDecimalLexeme('2'))), '2.5');
});

test('truncamento controlado para centavos', () => {
  assert.equal(truncateToCents(fromDecimalLexeme('33.339')), 3333n);
  assert.equal(truncateToCents(fromDecimalLexeme('-33.339')), -3333n);
});

test('half-up negativo usa magnitude e preserva sinal', () => {
  assert.equal(roundHalfUpToCents(fromDecimalLexeme('-1.005')), -101n);
});

test('operações monetárias não dependem de Number', () => {
  const value = fromDecimalLexeme('9007199254740992.005');
  assert.equal(value.units, 9007199254740992005n);
  assert.equal(roundHalfUpToCents(value), 900719925474099201n);
});

test('fromCents converte centavos exatamente', () => {
  assert.equal(decimalToString(fromCents(101n)), '1.01');
});

test('fromUnits preserva valor e valida argumentos', () => {
  assert.equal(decimalToString(fromUnits(1005n, 3)), '1.005');
  assert.throws(() => fromUnits(1005, 3), TypeError);
  assert.throws(() => fromUnits(1005n, -1), RangeError);
  assert.throws(() => fromUnits(1005n, 1.5), RangeError);
  assert.throws(() => fromCents(101), TypeError);
});
