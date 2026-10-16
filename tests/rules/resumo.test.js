import test from 'node:test';
import assert from 'node:assert/strict';
import { loadInput } from '../../src/loader.js';
import { calculate } from '../../src/engine.js';

test('resumo do exemplo recompõe totais e exclui ignorados', async () => {
  const output = calculate(await loadInput('exemplos/despesas-exemplo.json'));
  const { total_solicitado, total_reembolsavel, total_recusado } = output.resumo;
  assert.deepEqual(output.resumo, { total_solicitado: 1765.94, total_reembolsavel: 790.43, total_recusado: 975.51 });
  assert.equal(total_solicitado, total_reembolsavel + total_recusado);
  const recalculatedRequested = output.itens
    .filter(item => item.status !== 'ignorado')
    .reduce((sum, item) => sum + item.valor_original, 0);
  const recalculatedRefundable = output.itens
    .filter(item => item.status === 'aprovado' || item.status === 'aprovado_parcial')
    .reduce((sum, item) => sum + item.valor_reembolsavel, 0);
  assert.equal(recalculatedRequested.toFixed(2), total_solicitado.toFixed(2));
  assert.equal(recalculatedRefundable.toFixed(2), total_reembolsavel.toFixed(2));
});

test('resumo vazio preserva a invariante financeira', () => {
  const output = calculate({ colaborador: { id: 'c', nome: 'N', centro_custo: 'CC' }, periodo: { competencia: '2026-07', inicio: '2026-07-01', fim: '2026-07-31' }, despesas: [] });
  assert.deepEqual(output.resumo, { total_solicitado: 0, total_reembolsavel: 0, total_recusado: 0 });
});
