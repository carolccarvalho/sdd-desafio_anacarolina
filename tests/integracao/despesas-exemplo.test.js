import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInput } from '../../src/loader.js';
import { calculate } from '../../src/engine.js';

test('integração valida cada item relevante do exemplo', async () => {
  const output = calculate(await loadInput('exemplos/despesas-exemplo.json'));
  const byId = new Map(output.itens.map(item => [item.id, item]));

  assert.deepEqual(byId.get('d-001'), { ...byId.get('d-001'), valor_original: 72.5, valor_reembolsavel: 39.37, status: 'aprovado_parcial' });
  assert.equal(byId.get('d-003').valor_reembolsavel, 55);
  assert.equal(byId.get('d-003').status, 'aprovado');
  assert.equal(byId.get('d-004').status, 'recusado');
  assert.equal(byId.get('d-007').status, 'ignorado');
  assert.equal(byId.get('d-008').status, 'ignorado');
  assert.equal(byId.get('d-009').status, 'ignorado');
  assert.equal(byId.get('d-010').num_diarias, 2);
  assert.equal(byId.get('d-010').limite_item, 500);
  assert.equal(byId.get('d-011').valor_original, 33.333);
  assert.equal(byId.get('d-011').valor_reembolsavel, 33.33);
  assert.equal(byId.get('d-011').status, 'aprovado');
  assert.equal(byId.get('d-014').categoria, 'alimentacao');
  assert.equal(byId.get('d-014').valor_reembolsavel, 60);
  assert.equal(byId.get('d-014').status, 'aprovado_parcial');
});
