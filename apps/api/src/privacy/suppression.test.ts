import { describe, expect, it } from 'vitest';
import { suppressCount, suppressGroup, suppressProportion } from './suppression.ts';

/** Verifica que nenhuma célula suprimida pode ser deduzida por subtração do total. */
function expectNoSingleSuppressedCell(cells: (number | null)[]) {
  expect(cells.filter((cell) => cell === null)).not.toHaveLength(1);
}

describe('suppressCount', () => {
  it.each([
    [0, 0],
    [1, null],
    [4, null],
    [5, 5],
    [1234, 1234],
  ])('%i → %s', (value, expected) => {
    expect(suppressCount(value)).toBe(expected);
  });

  it.each([-1, 2.5, Number.NaN])('rejeita contagem inválida (%s)', (value) => {
    expect(() => suppressCount(value)).toThrow(RangeError);
  });
});

describe('suppressGroup', () => {
  it('mantém o grupo sem contagens pequenas', () => {
    expect(suppressGroup([10, 0, 25])).toEqual({ cells: [10, 0, 25], total: 35 });
  });

  it('suprime a menor célula restante quando só uma seria suprimida', () => {
    const { cells, total } = suppressGroup([3, 40, 12, 90]);

    expect(cells).toEqual([null, 40, null, 90]);
    expect(total).toBe(145);
    expectNoSingleSuppressedCell(cells);
  });

  it('não usa zero como célula complementar', () => {
    // Suprimir o zero deixaria a soma das suprimidas igual a 2.
    const { cells } = suppressGroup([2, 0, 7, 30]);

    expect(cells).toEqual([null, 0, null, 30]);
  });

  it('não precisa de complemento quando já há duas ou mais suprimidas', () => {
    expect(suppressGroup([1, 4, 50, 60]).cells).toEqual([null, null, 50, 60]);
  });

  it('suprime células iguais ao limiar - 1, mas não iguais ao limiar', () => {
    expect(suppressGroup([4, 5, 100]).cells).toEqual([null, null, 100]);
    expect(suppressGroup([5, 5, 100]).cells).toEqual([5, 5, 100]);
  });

  it('em empate escolhe a primeira menor célula como complemento', () => {
    expect(suppressGroup([3, 8, 8]).cells).toEqual([null, null, 8]);
  });

  it('suprime tudo, inclusive zeros, quando o total é pequeno', () => {
    expect(suppressGroup([0, 0, 3])).toEqual({ cells: [null, null, null], total: null });
    expect(suppressGroup([4])).toEqual({ cells: [null], total: null });
  });

  it('exibe um grupo todo zerado', () => {
    expect(suppressGroup([0, 0])).toEqual({ cells: [0, 0], total: 0 });
  });

  it('suprime as duas células de um grupo de duas quando uma é pequena', () => {
    expect(suppressGroup([2, 20])).toEqual({ cells: [null, null], total: 22 });
  });

  it('aceita grupo vazio', () => {
    expect(suppressGroup([])).toEqual({ cells: [], total: 0 });
  });

  it('não altera o array recebido', () => {
    const counts = [3, 40];
    suppressGroup(counts);
    expect(counts).toEqual([3, 40]);
  });

  it('rejeita contagens inválidas', () => {
    expect(() => suppressGroup([10, -1])).toThrow(RangeError);
  });

  it('nunca deixa uma única célula suprimida (varredura exaustiva)', () => {
    for (let a = 0; a <= 8; a++) {
      for (let b = 0; b <= 8; b++) {
        for (let c = 0; c <= 8; c++) {
          const { cells, total } = suppressGroup([a, b, c]);
          if (total !== null) expectNoSingleSuppressedCell(cells);
          for (const [index, cell] of cells.entries()) {
            if (cell !== null) expect(cell).toBe([a, b, c][index]);
            if ([a, b, c][index]! > 0 && [a, b, c][index]! < 5) expect(cell).toBeNull();
          }
        }
      }
    }
  });
});

describe('suppressProportion', () => {
  it('exibe a proporção quando as duas partes são grandes', () => {
    expect(suppressProportion(20, 100)).toEqual({
      numerator: 20,
      denominator: 100,
      proportion: 0.2,
    });
  });

  it('suprime quando o numerador é pequeno', () => {
    expect(suppressProportion(3, 100)).toEqual({
      numerator: null,
      denominator: 100,
      proportion: null,
    });
  });

  it('suprime quando o complemento é pequeno (98 de 100 revelaria 2)', () => {
    expect(suppressProportion(98, 100)).toMatchObject({ numerator: null, proportion: null });
  });

  it('suprime tudo quando o denominador é pequeno', () => {
    expect(suppressProportion(0, 3)).toEqual({
      numerator: null,
      denominator: null,
      proportion: null,
    });
  });

  it('exibe 0% e 100% quando o denominador é grande', () => {
    expect(suppressProportion(0, 50).proportion).toBe(0);
    expect(suppressProportion(50, 50).proportion).toBe(1);
  });

  it('não divide por zero', () => {
    expect(suppressProportion(0, 0)).toEqual({ numerator: 0, denominator: 0, proportion: null });
  });

  it('rejeita numerador maior que o denominador', () => {
    expect(() => suppressProportion(6, 5)).toThrow(RangeError);
  });
});
