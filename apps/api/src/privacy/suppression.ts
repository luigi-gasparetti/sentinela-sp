import { LIMIAR_SUPRESSAO, type ContagemPublica } from '@sentinela/shared';

/**
 * Supressão de contagens pequenas, aplicada antes de serializar qualquer resposta.
 *
 * Regras:
 * 1. Supressão primária: contagens de 1 a 4 viram `null`. Zero é exibido, porque não
 *    identifica ninguém, exceto quando o total do grupo também é pequeno (aí tudo é suprimido).
 * 2. Supressão complementar: num grupo cujas células somam um total conhecido, uma única
 *    célula suprimida seria recuperada por subtração (total − demais). Por isso, sempre
 *    que sobra exatamente uma célula suprimida, a menor célula positiva restante também
 *    é suprimida.
 *
 * Todo grupo é tratado como de total conhecido, mesmo que a resposta não traga o total,
 * porque ele pode aparecer em outra resposta (ex.: o total de casos da curva semanal).
 */

export interface SuppressedGroup {
  cells: ContagemPublica[];
  total: ContagemPublica;
}

export interface SuppressedProportion {
  numerator: ContagemPublica;
  denominator: ContagemPublica;
  proportion: number | null;
}

function assertCount(value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Contagem inválida: ${value}. Use um inteiro maior ou igual a zero.`);
  }
}

function isSmall(value: number): boolean {
  return value > 0 && value < LIMIAR_SUPRESSAO;
}

/** Supressão primária de uma contagem isolada. */
export function suppressCount(value: number): ContagemPublica {
  assertCount(value);
  return isSmall(value) ? null : value;
}

/**
 * Suprime as células de um grupo cujas contagens somam um total
 * (ex.: casos por faixa etária, casos por semana de um ano).
 */
export function suppressGroup(counts: readonly number[]): SuppressedGroup {
  counts.forEach(assertCount);
  const total = counts.reduce((sum, value) => sum + value, 0);

  // Com total pequeno, até um zero exibido ajuda a localizar os casos
  // (ex.: [0, 0, 3] diria que todos estão na mesma faixa). Suprime tudo.
  if (isSmall(total)) {
    return { cells: counts.map(() => null), total: null };
  }

  const suppressed = counts.map(isSmall);
  const suppressedCount = suppressed.filter(Boolean).length;

  if (suppressedCount === 1) {
    // Menor célula positiva ainda exibida. Zeros não servem: suprimir um zero
    // deixaria a soma das suprimidas igual à célula original.
    let complement = -1;
    counts.forEach((value, index) => {
      if (suppressed[index] || value === 0) return;
      if (complement === -1 || value < counts[complement]!) complement = index;
    });
    if (complement !== -1) suppressed[complement] = true;
  }

  return {
    cells: counts.map((value, index) => (suppressed[index] ? null : value)),
    total,
  };
}

/**
 * Suprime uma proporção, como internados / casos da faixa etária.
 * Equivale ao grupo [numerador, denominador − numerador]: se qualquer um dos dois for
 * pequeno, a proporção revelaria o outro por subtração.
 */
export function suppressProportion(numerator: number, denominator: number): SuppressedProportion {
  assertCount(numerator);
  assertCount(denominator);
  if (numerator > denominator) {
    throw new RangeError(`Numerador (${numerator}) maior que o denominador (${denominator}).`);
  }

  const { cells, total } = suppressGroup([numerator, denominator - numerator]);
  const shownNumerator = cells[0] ?? null;

  return {
    numerator: shownNumerator,
    denominator: total,
    proportion: shownNumerator === null || denominator === 0 ? null : shownNumerator / denominator,
  };
}
