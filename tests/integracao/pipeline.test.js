import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInput } from '../../src/loader.js';
import { calculate } from '../../src/engine.js';

test('pipeline completa não deixa despesas sem status', async () => {
  const output = calculate(await loadInput('exemplos/despesas-exemplo.json'));
  assert.ok(output.itens.length > 0);
  for (const item of output.itens) assert.ok(['aprovado', 'aprovado_parcial', 'recusado', 'ignorado'].includes(item.status));
  assert.ok(output.itens.every(item => typeof item.motivo === 'string' && item.motivo.length > 0));
});
