import { ALIASES_CATEGORIA, CATEGORIAS_PERMITIDAS, LIMITES, LIMITE_NOTA_FISCAL } from './politica.js';
import { roundHalfUp, allocateLargestRemainder } from './arredondamento.js';

const normalizeCategory = value => ALIASES_CATEGORIA[value.toLowerCase()] ?? value.toLowerCase();
const supplierKey = value => value.toLowerCase();
const groupKey = item => `${item.categoria}|${supplierKey(item.fornecedor)}`;

function inferDiarias(description) {
  const matches = [...description.matchAll(/(\d+)\s+(diária|diárias|diaria|diarias|noite|noites)\b/gi)];
  if (matches.length !== 1) return undefined;
  const value = Number(matches[0][1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function makeItem(expense, position) {
  return { ...expense, categoria: normalizeCategory(expense.categoria), valor_original: expense.valor, valorEfetivo: expense.valor, valorReembolsavel: 0, posicaoEntrada: position };
}

function applyRefunds(items) {
  const groups = new Map();
  for (const item of items) {
    if (item.status || item.valor >= 0) continue;
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, { refunds: [], expenses: [] });
    groups.get(key).refunds.push(item);
  }
  for (const item of items) {
    if (item.status || item.valor < 0) continue;
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, { refunds: [], expenses: [] });
    groups.get(key).expenses.push(item);
  }
  for (const group of groups.values()) {
    const expenses = group.expenses.sort((a, b) => a.posicaoEntrada - b.posicaoEntrada);
    let credit = group.refunds.sort((a, b) => a.posicaoEntrada - b.posicaoEntrada).reduce((sum, item) => sum - item.valor, 0);
    for (const expense of expenses) {
      const applied = Math.min(expense.valorEfetivo, credit);
      expense.valorEfetivo -= applied;
      credit -= applied;
    }
    for (const refund of group.refunds) {
      refund.status = 'ignorado';
      refund.motivo = expenses.length ? `Estorno: compensou despesas de ${refund.categoria} do fornecedor ${refund.fornecedor} no período` : 'Estorno sem despesa elegível para compensar';
    }
    for (const expense of expenses) {
      if (expense.valorEfetivo === 0) {
        expense.status = 'recusado';
        expense.motivo = 'Valor integral compensado por estorno';
      }
    }
  }
}

function applyLimits(items) {
  const groups = new Map();
  for (const item of items) {
    if (item.status || item.valorEfetivo < 0) continue;
    const key = item.categoria === 'hospedagem' ? `${item.data}|hospedagem` : `${item.data}|${item.categoria}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  for (const group of groups.values()) {
    const category = group[0].categoria;
    const limit = category === 'hospedagem' ? group.reduce((sum, item) => sum + item.limite_item, 0) : LIMITES[category];
    if (category === 'hospedagem') for (const item of group) item.limite_grupo = roundHalfUp(limit);
    const total = group.reduce((sum, item) => sum + item.valorEfetivo, 0);
    const values = total > limit ? allocateLargestRemainder(group, limit) : group.map(item => roundHalfUp(item.valorEfetivo));
    group.forEach((item, index) => {
      item.valorReembolsavel = values[index];
      item.status = values[index] < item.valorEfetivo ? 'aprovado_parcial' : 'aprovado';
      item.motivo = item.status === 'aprovado_parcial' ? `Limite diário de ${category} atingido.` : 'Despesa elegível dentro da política';
    });
  }
}

export function calculate(input) {
  const items = input.despesas.map(makeItem);
  const seen = new Map();
  for (const item of items) {
    if (item.data < input.periodo.inicio || item.data > input.periodo.fim) {
      item.status = 'ignorado';
      item.motivo = `Data fora do período de competência (${item.data} não está em ${input.periodo.inicio} a ${input.periodo.fim})`;
      continue;
    }
    if (item.valor === 0) {
      item.status = 'recusado';
      item.motivo = 'Valor zero não é uma despesa válida';
      continue;
    }
    const duplicate = seen.get(`${item.data}|${item.categoria}|${supplierKey(item.fornecedor)}|${item.valor}`);
    if (duplicate) {
      item.status = 'ignorado';
      item.motivo = `Duplicata da despesa ${duplicate.id}`;
    } else seen.set(`${item.data}|${item.categoria}|${supplierKey(item.fornecedor)}|${item.valor}`, item);
  }
  for (const item of items) {
    if (item.status || item.valor < 0) continue;
    if (!CATEGORIAS_PERMITIDAS.includes(item.categoria)) {
      item.status = 'recusado';
      item.motivo = 'Categoria não coberta pela política de reembolso';
    } else if (item.valor > LIMITE_NOTA_FISCAL && !item.tem_nota_fiscal) {
      item.status = 'recusado';
      item.motivo = 'Nota fiscal obrigatória para valores acima de R$ 100,00';
    } else if (item.categoria === 'hospedagem') {
      item.num_diarias = inferDiarias(item.descricao);
      if (!item.num_diarias) {
        item.status = 'recusado';
        item.motivo = 'Não foi possível determinar o número de diárias a partir da descrição';
      } else {
        item.limite_unitario_diaria = LIMITES.hospedagem_por_diaria;
        item.limite_item = item.num_diarias * item.limite_unitario_diaria;
      }
    }
  }
  applyRefunds(items);
  applyLimits(items);
  const outputItems = items.map(item => {
    const result = { id: item.id, data: item.data, categoria: item.categoria, valor_original: item.valor_original, valor_reembolsavel: roundHalfUp(item.valorReembolsavel), status: item.status, motivo: item.motivo };
    if (item.status !== 'recusado' && item.num_diarias !== undefined) {
      result.num_diarias = item.num_diarias;
      result.limite_unitario_diaria = roundHalfUp(item.limite_unitario_diaria);
      result.limite_item = roundHalfUp(item.limite_item);
      result.limite_grupo = roundHalfUp(item.limite_grupo);
    }
    return result;
  });
  const considered = items.filter(item => ['aprovado', 'aprovado_parcial', 'recusado'].includes(item.status));
  const totalSolicitado = roundHalfUp(considered.reduce((sum, item) => sum + item.valor_original, 0));
  const totalReembolsavel = roundHalfUp(items.filter(item => ['aprovado', 'aprovado_parcial'].includes(item.status)).reduce((sum, item) => sum + item.valorReembolsavel, 0));
  return { colaborador: input.colaborador, periodo: input.periodo, processado_em: new Date().toISOString(), resumo: { total_solicitado: totalSolicitado, total_reembolsavel: totalReembolsavel, total_recusado: roundHalfUp(totalSolicitado - totalReembolsavel) }, itens: outputItems };
}
