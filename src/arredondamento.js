import Decimal from 'decimal.js';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function roundHalfUp(value, decimals = 2) {
  const decimal = Decimal.isDecimal(value) ? value : new Decimal(String(value));
  return Number(decimal.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toString());
}

export function allocateLargestRemainder(items, limit, valueGetter = item => item.valorEfetivo) {
  const total = items.reduce((sum, item) => sum.plus(valueGetter(item)), new Decimal(0));
  const targetCents = new Decimal(limit).times(100).toDecimalPlaces(0, Decimal.ROUND_DOWN);
  const exactCents = items.map(item => new Decimal(valueGetter(item)).div(total).times(targetCents));
  const floors = exactCents.map(value => value.toDecimalPlaces(0, Decimal.ROUND_DOWN));
  let remaining = targetCents.minus(floors.reduce((sum, value) => sum.plus(value), new Decimal(0))).toNumber();
  const order = exactCents.map((value, index) => ({
    index,
    remainder: value.minus(floors[index]),
    position: items[index].posicaoEntrada,
  })).sort((a, b) => b.remainder.comparedTo(a.remainder) || a.position - b.position);
  const cents = floors.slice();
  for (let index = 0; index < remaining; index += 1) cents[order[index].index] = cents[order[index].index].plus(1);
  return cents.map(value => value.div(100));
}
