import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../../src/engine.js';

const base = despesas => ({ colaborador: { id: 'c', nome: 'N', centro_custo: 'CC' }, periodo: { competencia: '2026-07', inicio: '2026-07-01', fim: '2026-07-31' }, despesas });
const expense = (overrides = {}) => ({ id: 'x', data: '2026-07-10', categoria: 'transporte_urbano', descricao: 'corrida', fornecedor: 'F', valor: 10, tem_nota_fiscal: true, ...overrides });

test('associa estorno ao grupo sem compensar despesa de outro fornecedor', () => {
  const result = calculate(base([
    expense({ id: 'a', valor: 100, fornecedor: 'F', data: '2026-07-10' }),
    expense({ id: 'b', valor: 100, fornecedor: 'G', data: '2026-07-11' }),
    expense({ id: 'r', valor: -45, fornecedor: 'F', data: '2026-07-10' }),
  ]));
  assert.equal(result.itens.find(item => item.id === 'a').valor_reembolsavel, 55);
  assert.equal(result.itens.find(item => item.id === 'b').valor_reembolsavel, 80);
  assert.equal(result.itens.find(item => item.id === 'r').status, 'ignorado');
});

test('aplica múltiplos estornos em ordem de entrada', () => {
  const result = calculate(base([
    expense({ id: 'a', valor: 100 }),
    expense({ id: 'r1', valor: -30 }),
    expense({ id: 'r2', valor: -25 }),
  ]));
  assert.equal(result.itens.find(item => item.id === 'a').valor_reembolsavel, 45);
  assert.equal(result.itens.find(item => item.id === 'r1').status, 'ignorado');
  assert.equal(result.itens.find(item => item.id === 'r2').status, 'ignorado');
});

test('estorno excedente não produz valor efetivo negativo nem migra para outro grupo', () => {
  const result = calculate(base([
    expense({ id: 'a', valor: 20, fornecedor: 'F' }),
    expense({ id: 'b', valor: 20, fornecedor: 'G' }),
    expense({ id: 'r', valor: -50, fornecedor: 'F' }),
  ]));
  assert.equal(result.itens.find(item => item.id === 'a').status, 'recusado');
  assert.equal(result.itens.find(item => item.id === 'b').valor_reembolsavel, 20);
  assert.equal(result.itens.find(item => item.id === 'r').status, 'ignorado');
});
