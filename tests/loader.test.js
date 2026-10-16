import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from '../src/loader.js';

const validInput = () => ({
  colaborador: { id: 'c-1', nome: 'Ana', centro_custo: 'CC-1' },
  periodo: { competencia: '2026-08', inicio: '2026-07-01', fim: '2026-07-31' },
  despesas: [{
    id: 'd-1', data: '2026-07-10', categoria: 'alimentacao', descricao: 'refeicao',
    fornecedor: 'F', valor: 33.333, tem_nota_fiscal: true,
  }],
});

test('loader valida entrada válida e converte valores monetários para Decimal', () => {
  const result = validateInput(validInput());
  assert.equal(result.despesas[0].valor.toString(), '33.333');
});

test('loader preserva competência informativa divergente das datas', () => {
  assert.doesNotThrow(() => validateInput(validInput()));
});

test('loader rejeita raiz inválida, JSON inválido é responsabilidade da CLI', () => {
  assert.throws(() => validateInput(null), /Entrada deve ser um objeto JSON/);
  assert.throws(() => validateInput([]), /Entrada deve ser um objeto JSON/);
});

test('loader rejeita colaborador, período e despesas inválidos', () => {
  const missingCollaborator = validInput();
  delete missingCollaborator.colaborador.nome;
  assert.throws(() => validateInput(missingCollaborator), /Colaborador inválido/);

  const invalidPeriod = validInput();
  invalidPeriod.periodo.competencia = '2026/08';
  assert.throws(() => validateInput(invalidPeriod), /Período inválido/);

  const invalidExpenses = validInput();
  invalidExpenses.despesas = 'não é lista';
  assert.throws(() => validateInput(invalidExpenses), /despesas deve ser uma lista/);
});

test('loader rejeita tipos inválidos e valores não finitos', () => {
  for (const value of ['33.333', NaN, Infinity, null]) {
    const input = validInput();
    input.despesas[0].valor = value;
    assert.throws(() => validateInput(input), /Despesa inválida/);
  }
});
