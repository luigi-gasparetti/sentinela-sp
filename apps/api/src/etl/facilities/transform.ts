import type { JsonRecord } from '../demas/paginate.ts';
import type { NewHealthFacility, NewHospitalCapacitySnapshot } from '../../db/schema.ts';

/** Código IBGE de São Paulo no formato de 6 dígitos usado pelos endpoints de estabelecimentos. */
export const SAO_PAULO_IBGE = '355030';

/**
 * Retângulo que contém o município, com folga. Coordenadas fora dele são
 * erros de cadastro (ex.: uma UBS apontando para o interior do estado) e
 * são descartadas para não levar o usuário ao lugar errado no mapa.
 */
const SAO_PAULO_BOUNDS = { minLat: -24.1, maxLat: -23.3, minLon: -47.0, maxLon: -46.3 };

export type HospitalCapacity = Omit<NewHospitalCapacitySnapshot, 'facilityId' | 'observedAt'>;

export interface HospitalWithCapacity {
  facility: NewHealthFacility;
  capacity: HospitalCapacity;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim().replace(/\s+/g, ' ');
  if (!result || ['nan', 'null', 'none'].includes(result.toLowerCase())) return null;
  return result;
}

function cnes(value: unknown): string | null {
  const result = text(value);
  return result && /^\d{1,7}$/.test(result) ? result.padStart(7, '0') : null;
}

function postalCode(value: unknown): string | null {
  const digits = text(value)?.replace(/\D/g, '');
  return digits && digits.length === 8 ? digits : null;
}

function integer(value: unknown): number | null {
  const result = Number(text(value) ?? NaN);
  return Number.isInteger(result) && result >= 0 ? result : null;
}

/** Converte coordenadas com vírgula decimal ("-23,56096") para o formato do banco. */
function coordinate(value: unknown): number | null {
  const result = Number(text(value)?.replace(',', '.') ?? NaN);
  return Number.isFinite(result) ? result : null;
}

function coordinatesInSaoPaulo(
  latitude: number | null,
  longitude: number | null,
): { latitude: string | null; longitude: string | null } {
  const { minLat, maxLat, minLon, maxLon } = SAO_PAULO_BOUNDS;
  if (
    latitude === null ||
    longitude === null ||
    latitude < minLat ||
    latitude > maxLat ||
    longitude < minLon ||
    longitude > maxLon
  ) {
    return { latitude: null, longitude: null };
  }
  return { latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) };
}

/**
 * Converte um registro de `/assistencia-a-saude/unidade-basicas-de-saude`.
 * Devolve `null` para unidades fora do município ou sem CNES válido.
 */
export function facilityFromUbs(record: JsonRecord): NewHealthFacility | null {
  if (text(record.ibge) !== SAO_PAULO_IBGE) return null;
  const code = cnes(record.cnes);
  if (!code) return null;

  return {
    cnes: code,
    type: 'primary_care',
    name: text(record.nome) ?? `UBS ${code}`,
    stateCode: 'SP',
    municipalityCode: SAO_PAULO_IBGE,
    municipalityName: 'São Paulo',
    neighborhood: text(record.bairro),
    street: text(record.logradouro),
    ...coordinatesInSaoPaulo(coordinate(record.latitude), coordinate(record.longitude)),
  };
}

function hospitalKey(record: JsonRecord): string | null {
  const name = text(record.nome_do_hospital);
  if (!name) return null;
  return [name, text(record.enderco_do_hospital), text(record.numero_do_endereco_do_hospital)]
    .join('|')
    .toUpperCase();
}

/**
 * Seleciona os hospitais atuais do município a partir de `/assistencia-a-saude/hospitais-e-leitos`.
 *
 * O endpoint devolve o histórico mensal de cada hospital, sem campo de data e sem CNES.
 * As linhas de cada hospital vêm em ordem cronológica, e só os períodos mais recentes
 * trazem `codigo_ibge_do_municipio` preenchido. Por isso:
 * - um hospital é identificado por nome + endereço + número;
 * - só entram hospitais com alguma linha recente (com código IBGE), o que deixa de fora
 *   os que só aparecem em períodos antigos (fechados ou recadastrados);
 * - os leitos vêm da última linha recente de cada hospital.
 */
export function selectCurrentHospitals(records: Iterable<JsonRecord>): HospitalWithCapacity[] {
  const latestByHospital = new Map<string, JsonRecord>();

  for (const record of records) {
    if (text(record.codigo_ibge_do_municipio) !== SAO_PAULO_IBGE) continue;
    const key = hospitalKey(record);
    if (!key) continue;
    // Map preserva a ordem da primeira inserção; set() sobrescreve com a linha mais nova.
    latestByHospital.set(key, record);
  }

  return [...latestByHospital.values()].map((record) => ({
    facility: {
      cnes: null,
      type: 'hospital',
      name: text(record.nome_do_hospital) ?? 'Hospital sem nome',
      stateCode: 'SP',
      municipalityCode: SAO_PAULO_IBGE,
      municipalityName: 'São Paulo',
      neighborhood: text(record.nome_do_bairro_do_endereco_do_hosptial),
      street: text(record.enderco_do_hospital),
      streetNumber: text(record.numero_do_endereco_do_hospital),
      addressComplement: text(record.complemento_do_endereco_do_hospital),
      postalCode: postalCode(record.numero_do_cep_do_hospital),
    },
    capacity: {
      generalBedsTotal: integer(record.quantidade_total_de_leitos_do_hosptial),
      generalBedsSus: integer(record.quantidade_total_de_leitos_sus_do_hosptial),
      intensiveCareBedsTotal: integer(record.quantidade_de_leitos_de_uti_do_hosptial),
      intensiveCareBedsSus: integer(record.quantidade_de_leitos_de_uti_sus_do_hosptial),
    },
  }));
}
