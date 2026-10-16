import { fromDecimalLexeme } from './decimal.js';
import { parseJsonLexical } from './json-lexical.js';

const hasOwn = (value, key) => Object.hasOwn(value, key);
const isString = value => typeof value === 'string';
const isDate = value => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

function assertObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
}

function assertOwn(value, key, message) {
  if (!hasOwn(value, key)) throw new Error(message);
  return value[key];
}

function validateCollaborator(value) {
  assertObject(value, 'Colaborador inválido');
  if (!isString(assertOwn(value, 'id', 'Colaborador inválido'))
    || !isString(assertOwn(value, 'nome', 'Colaborador inválido'))
    || !isString(assertOwn(value, 'centro_custo', 'Colaborador inválido'))) {
    throw new Error('Colaborador inválido');
  }
  return {
    id: value.id,
    nome: value.nome,
    centro_custo: value.centro_custo,
  };
}

function validatePeriod(value) {
  assertObject(value, 'Período inválido');
  const competencia = assertOwn(value, 'competencia', 'Período inválido');
  const inicio = assertOwn(value, 'inicio', 'Período inválido');
  const fim = assertOwn(value, 'fim', 'Período inválido');
  if (!/^\d{4}-\d{2}$/.test(competencia) || !isDate(inicio) || !isDate(fim)) {
    throw new Error('Período inválido');
  }
  return { competencia, inicio, fim };
}

function parseExpenseValue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.type !== 'number' || !hasOwn(value, 'lexeme') || typeof value.lexeme !== 'string') {
    throw new Error('Despesa inválida');
  }
  try {
    return fromDecimalLexeme(value.lexeme);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Despesa inválida');
    throw error;
  }
}

function validateExpense(value) {
  assertObject(value, 'Despesa inválida');
  const id = assertOwn(value, 'id', 'Despesa inválida');
  const data = assertOwn(value, 'data', 'Despesa inválida');
  const categoria = assertOwn(value, 'categoria', 'Despesa inválida');
  const descricao = assertOwn(value, 'descricao', 'Despesa inválida');
  const fornecedor = assertOwn(value, 'fornecedor', 'Despesa inválida');
  const valor = parseExpenseValue(assertOwn(value, 'valor', 'Despesa inválida'));
  const temNotaFiscal = assertOwn(value, 'tem_nota_fiscal', 'Despesa inválida');
  if (!isString(id) || !isDate(data) || !isString(categoria) || !isString(descricao)
    || !isString(fornecedor) || typeof temNotaFiscal !== 'boolean') {
    throw new Error('Despesa inválida');
  }
  return { id, data, categoria, descricao, fornecedor, valor, tem_nota_fiscal: temNotaFiscal };
}

/**
 * Lê JSON preservando lexemas numéricos e converte apenas despesas[].valor
 * para DecimalInterno. Esta rota é isolada e não é usada pelo loader ativo.
 */
export function loadInputLexical(text) {
  const data = parseJsonLexical(text);
  assertObject(data, 'Entrada deve ser um objeto JSON');
  const colaborador = validateCollaborator(assertOwn(data, 'colaborador', 'Colaborador inválido'));
  const periodo = validatePeriod(assertOwn(data, 'periodo', 'Período inválido'));
  const despesas = assertOwn(data, 'despesas', 'despesas deve ser uma lista');
  if (!Array.isArray(despesas)) throw new Error('despesas deve ser uma lista');
  return { colaborador, periodo, despesas: despesas.map(validateExpense) };
}
