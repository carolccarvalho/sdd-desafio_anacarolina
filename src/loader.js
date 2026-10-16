import fs from 'node:fs/promises';
import Decimal from 'decimal.js';

const isString = value => typeof value === 'string';
const isDate = value => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function validateInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Entrada deve ser um objeto JSON');
  const collaborator = data.colaborador;
  const period = data.periodo;
  if (!collaborator || !isString(collaborator.id) || !isString(collaborator.nome) || !isString(collaborator.centro_custo)) throw new Error('Colaborador inválido');
  if (!period || !/^\d{4}-\d{2}$/.test(period.competencia) || !isDate(period.inicio) || !isDate(period.fim)) throw new Error('Período inválido');
  if (!Array.isArray(data.despesas)) throw new Error('despesas deve ser uma lista');
  for (const expense of data.despesas) {
    if (!expense || !isString(expense.id) || !isDate(expense.data) || !isString(expense.categoria) || !isString(expense.descricao) || !isString(expense.fornecedor) || typeof expense.valor !== 'number' || !Number.isFinite(expense.valor) || typeof expense.tem_nota_fiscal !== 'boolean') throw new Error('Despesa inválida');
  }
  return { ...data, despesas: data.despesas.map(expense => ({ ...expense, valor: new Decimal(String(expense.valor)) })) };
}

export async function loadInput(filePath) { return validateInput(JSON.parse(await fs.readFile(filePath, 'utf8'))); }
