import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../../src/engine.js';
import { allocateLargestRemainder, roundHalfUp } from '../../src/arredondamento.js';

const base = despesas => ({ colaborador: { id: 'c', nome: 'N', centro_custo: 'CC' }, periodo: { competencia: '2026-07', inicio: '2026-07-01', fim: '2026-07-31' }, despesas });
const expense = (overrides = {}) => ({ id: 'x', data: '2026-07-10', categoria: 'alimentacao', descricao: 'refeicao', fornecedor: 'F', valor: 10, tem_nota_fiscal: true, ...overrides });

test('RN-010 preserva três casas até arredondamento', () => assert.equal(roundHalfUp(33.333), 33.33));
test('RN-006 normaliza caixa e alias', () => {
  const result = calculate(base([expense({ id: 'a', categoria: 'ALIMENTACAO' }), expense({ id: 'b', categoria: 'alimentação' })]));
  assert.deepEqual(result.itens.map(item => item.categoria), ['alimentacao', 'alimentacao']);
});
test('RN-007 filtra período antes de zero', () => {
  const result = calculate(base([expense({ id: 'out', data: '2026-06-30', valor: 0 })]));
  assert.equal(result.itens[0].status, 'ignorado');
});
test('RN-011 recusa zero dentro do período', () => {
  const result = calculate(base([expense({ valor: 0 })]));
  assert.equal(result.itens[0].motivo, 'Valor zero não é uma despesa válida');
});
test('RN-009 mantém primeira posição como principal', () => {
  const result = calculate(base([expense({ id: 'z', valor: 20 }), expense({ id: 'a', valor: 20 })]));
  assert.equal(result.itens[1].motivo, 'Duplicata da despesa z');
});
test('RN-005 usa valor original', () => {
  const result = calculate(base([expense({ valor: 100.01, tem_nota_fiscal: false }), expense({ id: 'r', categoria: 'transporte_urbano', fornecedor: 'F', valor: -100 })]));
  assert.equal(result.itens[0].status, 'recusado');
});
test('RN-003 infere diárias e audita hospedagem', () => {
  const item = calculate(base([expense({ categoria: 'hospedagem', descricao: 'Hotel - 2 diárias', valor: 480 })])).itens[0];
  assert.equal(item.num_diarias, 2); assert.equal(item.limite_item, 500); assert.equal(item.limite_grupo, 500);
});
test('RN-003 recusa descrição ambígua', () => {
  const item = calculate(base([expense({ categoria: 'hospedagem', descricao: 'Hotel sem quantidade' })])).itens[0];
  assert.equal(item.status, 'recusado');
});
test('RN-008 aplica estorno sequencial somente ao elegível', () => {
  const result = calculate(base([
    expense({ id: 'a', categoria: 'transporte_urbano', valor: 100, tem_nota_fiscal: true }),
    expense({ id: 'b', categoria: 'transporte_urbano', valor: 100.01, tem_nota_fiscal: false }),
    expense({ id: 'r', categoria: 'transporte_urbano', valor: -45 })
  ]));
  assert.equal(result.itens[0].valor_reembolsavel, 55); assert.equal(result.itens[1].status, 'recusado'); assert.equal(result.itens[2].status, 'ignorado');
});
test('RN-001 fecha limite por maiores restos', () => {
  const result = calculate(base([expense({ id: 'a', fornecedor: 'A', valor: 30.01 }), expense({ id: 'b', fornecedor: 'B', valor: 30.01 }), expense({ id: 'c', fornecedor: 'C', valor: 30.01 })]));
  assert.equal(result.itens.reduce((sum, item) => sum + item.valor_reembolsavel, 0), 60);
});
test('RN-004 aplica limite parcial', () => {
  const result = calculate(base([expense({ valor: 70 })]));
  assert.equal(result.itens[0].valor_reembolsavel, 60); assert.equal(result.itens[0].status, 'aprovado_parcial');
});
test('lista vazia produz totais zero', () => {
  const result = calculate(base([]));
  assert.deepEqual(result.resumo, { total_solicitado: 0, total_reembolsavel: 0, total_recusado: 0 });
});
test('distribuição determinística por posição', () => {
  const items = [{ valorEfetivo: 1, posicaoEntrada: 0 }, { valorEfetivo: 1, posicaoEntrada: 1 }];
  assert.deepEqual(allocateLargestRemainder(items, 1.01), [0.51, 0.5]);
});
