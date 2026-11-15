export const DOENCAS = ['dengue', 'chikungunya', 'zika'] as const;
export type Doenca = (typeof DOENCAS)[number];

export interface HealthResponse {
  status: 'ok';
}
