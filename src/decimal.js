const DECIMAL_LEXEM = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function assertScale(scale) {
  if (!Number.isInteger(scale) || scale < 0) throw new RangeError('scale deve ser inteiro não negativo');
}

function powerOfTen(exponent) {
  assertScale(exponent);
  return 10n ** BigInt(exponent);
}

function makeDecimal(units, scale) {
  if (typeof units !== 'bigint') throw new TypeError('units deve ser BigInt');
  assertScale(scale);
  return Object.freeze({ units, scale });
}

export function fromUnits(units, scale) {
  return normalize(makeDecimal(units, scale));
}

export function fromCents(cents) {
  if (typeof cents !== 'bigint') throw new TypeError('cents deve ser BigInt');
  return fromUnits(cents, 2);
}

export function fromDecimalLexeme(lexeme) {
  if (typeof lexeme !== 'string' || !DECIMAL_LEXEM.test(lexeme)) throw new SyntaxError('lexema decimal inválido');
  const negative = lexeme.startsWith('-');
  const unsigned = lexeme.replace(/^[+-]/, '');
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const digits = `${integerPart}${fractionPart}`.replace(/^0+(?=\d)/, '') || '0';
  const units = BigInt(digits) * (negative ? -1n : 1n);
  return fromUnits(units, fractionPart.length);
}

export function normalize(decimal) {
  const value = makeDecimal(decimal.units, decimal.scale);
  if (value.units === 0n) return makeDecimal(0n, 0);
  let units = value.units;
  let scale = value.scale;
  while (scale > 0 && units % 10n === 0n) {
    units /= 10n;
    scale -= 1;
  }
  return makeDecimal(units, scale);
}

export function alignScales(left, right) {
  const a = makeDecimal(left.units, left.scale);
  const b = makeDecimal(right.units, right.scale);
  const scale = Math.max(a.scale, b.scale);
  return {
    left: makeDecimal(a.units * powerOfTen(scale - a.scale), scale),
    right: makeDecimal(b.units * powerOfTen(scale - b.scale), scale),
  };
}

export function add(left, right) {
  const aligned = alignScales(left, right);
  return normalize({ units: aligned.left.units + aligned.right.units, scale: aligned.left.scale });
}

export function subtract(left, right) {
  const aligned = alignScales(left, right);
  return normalize({ units: aligned.left.units - aligned.right.units, scale: aligned.left.scale });
}

export function compare(left, right) {
  const aligned = alignScales(left, right);
  return aligned.left.units < aligned.right.units ? -1 : aligned.left.units > aligned.right.units ? 1 : 0;
}

export function multiply(left, right) {
  return normalize({ units: left.units * right.units, scale: left.scale + right.scale });
}

export function truncateToCents(decimal) {
  const value = makeDecimal(decimal.units, decimal.scale);
  if (value.scale <= 2) return value.units * powerOfTen(2 - value.scale);
  return value.units / powerOfTen(value.scale - 2);
}

export function roundHalfUpToCents(decimal) {
  const value = makeDecimal(decimal.units, decimal.scale);
  if (value.scale <= 2) return value.units * powerOfTen(2 - value.scale);
  const divisor = powerOfTen(value.scale - 2);
  const magnitude = value.units < 0n ? -value.units : value.units;
  let cents = magnitude / divisor;
  if (2n * (magnitude % divisor) >= divisor) cents += 1n;
  return value.units < 0n ? -cents : cents;
}

export function decimalToString(decimal) {
  const value = makeDecimal(decimal.units, decimal.scale);
  const negative = value.units < 0n;
  const digits = (negative ? -value.units : value.units).toString().padStart(value.scale + 1, '0');
  if (value.scale === 0) return `${negative ? '-' : ''}${digits}`;
  const split = digits.length - value.scale;
  return `${negative ? '-' : ''}${digits.slice(0, split)}.${digits.slice(split)}`;
}
