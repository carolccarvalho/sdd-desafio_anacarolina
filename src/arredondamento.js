export function roundHalfUp(value, decimals = 2) {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  return (scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5)) / factor;
}

export function allocateLargestRemainder(items, limit, valueGetter = item => item.valorEfetivo) {
  const total = items.reduce((sum, item) => sum + valueGetter(item), 0);
  const targetCents = Math.round(limit * 100);
  const exactCents = items.map(item => (valueGetter(item) / total) * targetCents);
  const floors = exactCents.map(value => Math.floor(value));
  let remaining = targetCents - floors.reduce((sum, value) => sum + value, 0);
  const order = exactCents.map((value, index) => ({ index, remainder: value - floors[index], position: items[index].posicaoEntrada }))
    .sort((a, b) => b.remainder - a.remainder || a.position - b.position);
  const cents = floors.slice();
  for (let index = 0; index < remaining; index += 1) cents[order[index].index] += 1;
  return cents.map(value => value / 100);
}
