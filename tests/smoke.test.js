import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITES } from '../src/politica.js';
import { loadInput } from '../src/loader.js';
import { calculate } from '../src/engine.js';

test('política e cálculo de exemplo', async () => {
  assert.equal(LIMITES.alimentacao, 60);
  const input = await loadInput('exemplos/despesas-exemplo.json');
  const output = calculate(input);
  const d003 = output.itens.find(item => item.id === 'd-003');
  const d011 = output.itens.find(item => item.id === 'd-011');
  const d014 = output.itens.find(item => item.id === 'd-014');
  assert.equal(d003.valor_original, 100);
  assert.equal(d003.valor_reembolsavel, 55);
  assert.equal(d003.status, 'aprovado');
  assert.equal(output.itens.find(item => item.id === 'd-004').status, 'recusado');
  assert.equal(output.itens.find(item => item.id === 'd-010').num_diarias, 2);
  assert.equal(d011.valor_original, 33.333);
  assert.equal(d011.valor_reembolsavel, 33.33);
  assert.equal(d011.status, 'aprovado');
  assert.equal(d014.valor_reembolsavel, 60);
  assert.equal(d014.status, 'aprovado_parcial');
  assert.deepEqual(output.resumo, { total_solicitado: 1765.94, total_reembolsavel: 790.43, total_recusado: 975.51 });
  assert.equal(output.resumo.total_solicitado, output.resumo.total_reembolsavel + output.resumo.total_recusado);
});
