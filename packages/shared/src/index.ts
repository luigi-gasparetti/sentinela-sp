export const DOENCAS = ['dengue', 'chikungunya', 'zika'] as const;
export type Doenca = (typeof DOENCAS)[number];

/** Menor contagem que pode ser exibida. Contagens de 1 a LIMIAR_SUPRESSAO - 1 são suprimidas. */
export const LIMIAR_SUPRESSAO = 5;

/** Contagem como sai da API: `null` quando foi suprimida para proteger dados individuais. */
export type ContagemPublica = number | null;

export interface HealthResponse {
  status: 'ok';
}
