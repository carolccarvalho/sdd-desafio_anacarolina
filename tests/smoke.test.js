import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES } from '../src/politica.js';
import { loadInput } from '../src/loader.js';
import { calculate } from '../src/engine.js';

test('política e cálculo de exemplo', async () => {
  assert.equal(LIMITES.alimentacao, 60);
  const input = await loadInput('exemplos/despesas-exemplo.json');
  const output = calculate(input);
  assert.equal(output.itens.find(item => item.id === 'd-003').valor_reembolsavel, 55);
  assert.equal(output.itens.find(item => item.id === 'd-004').status, 'recusado');
  assert.equal(output.itens.find(item => item.id === 'd-010').num_diarias, 2);
});
