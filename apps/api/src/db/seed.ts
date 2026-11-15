import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { Doenca } from '@sentinela/shared';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  arbovirusNotifications,
  healthFacilities,
  hospitalCapacitySnapshots,
  type ClinicalIndicatorStatus,
  type NewArbovirusNotification,
  type NewHealthFacility,
  type NewHospitalCapacitySnapshot,
} from './schema.ts';

type JsonRecord = Record<string, unknown>;
type Disease = Doenca;

const stateByIbgeCode: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

const symptomFields: Record<string, string[]> = {
  fever: ['febre'],
  myalgia: ['mialgia'],
  headache: ['cefaleia'],
  rash: ['exantema'],
  retro_orbital_pain: ['dor_retro'],
  arthralgia: ['artralgia'],
  arthritis: ['artrite'],
  nausea: ['nausea', 'nauseas'],
  vomiting: ['vomito'],
  back_pain: ['dor_costas'],
  conjunctivitis: ['conjuntvit'],
  petechiae: ['petequias', 'petequia_n'],
  leukopenia: ['leucopenia'],
  tourniquet_test: ['laco'],
  abdominal_pain: ['dor', 'abdominal'],
  prostration: ['prostacao'],
  diarrhea: ['diarreia'],
};

const warningSignFields: Record<string, string> = {
  hypotension: 'alrm_hipot',
  low_platelets: 'alrm_plaq',
  persistent_vomiting: 'alrm_vom',
  bleeding: 'alrm_sang',
  hematocrit_increase: 'alrm_hemat',
  abdominal_pain: 'alrm_abdom',
  lethargy: 'alrm_letar',
  hepatomegaly: 'alrm_hepat',
  fluid_accumulation: 'alrm_liq',
};

function valueAsText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || ['nan', 'null', 'none'].includes(text.toLowerCase())) {
    return null;
  }
  return text;
}

function sourceCode(value: unknown): string | null {
  const text = valueAsText(value);
  if (!text) return null;
  return /^\d+$/.test(text) ? text.padStart(6, '0') : text;
}

function cnesCode(value: unknown): string | null {
  const text = valueAsText(value);
  if (!text) return null;
  return /^\d+$/.test(text) ? text.padStart(7, '0') : text;
}

function parseInteger(value: unknown): number | null {
  const text = valueAsText(value);
  if (!text) return null;
  const result = Number(text);
  return Number.isInteger(result) ? result : null;
}

function parseDate(value: unknown): string | null {
  const text = valueAsText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : text;
}

function parseCoordinate(value: unknown): string | null {
  const text = valueAsText(value)?.replace(',', '.');
  if (!text || !Number.isFinite(Number(text))) return null;
  return Number(text).toFixed(6);
}

function parseEpidemiologicalWeek(value: unknown): {
  year: number | null;
  week: number | null;
} {
  const text = valueAsText(value);
  if (!text || !/^\d{6}$/.test(text)) return { year: null, week: null };

  const yearFirstYear = Number(text.slice(0, 4));
  const yearFirstWeek = Number(text.slice(4, 6));
  if (yearFirstYear >= 1900 && yearFirstYear <= 2100 && yearFirstWeek >= 1 && yearFirstWeek <= 53) {
    return { year: yearFirstYear, week: yearFirstWeek };
  }

  const weekFirstWeek = Number(text.slice(0, 2));
  const weekFirstYear = Number(text.slice(2, 6));
  if (weekFirstYear >= 1900 && weekFirstYear <= 2100 && weekFirstWeek >= 1 && weekFirstWeek <= 53) {
    return { year: weekFirstYear, week: weekFirstWeek };
  }
  return { year: null, week: null };
}

function parseAgeYears(record: JsonRecord, referenceDate: string | null): number | null {
  const encodedAge = valueAsText(record.nu_idade_n);
  if (encodedAge && /^\d{4}$/.test(encodedAge)) {
    const value = Number(encodedAge.slice(1));
    const unit = encodedAge[0];
    if (unit === '4' && value <= 120) return value;
    if (['1', '2', '3'].includes(unit ?? '')) return 0;
  }

  const legacyAge = valueAsText(record.nu_idade);
  const legacyMatch = legacyAge?.match(/^([A-Za-z])(\d{3})$/);
  if (legacyMatch) {
    const unit = legacyMatch[1]?.toUpperCase();
    const value = Number(legacyMatch[2]);
    if (unit === 'A' && value <= 120) return value;
    if (['D', 'M', 'H'].includes(unit ?? '')) return 0;
  }

  const birthYear = parseInteger(record.ano_nasc);
  const eventYear = referenceDate ? Number(referenceDate.slice(0, 4)) : null;
  if (birthYear && eventYear && eventYear >= birthYear) {
    const age = eventYear - birthYear;
    return age <= 120 ? age : null;
  }
  return null;
}

function parseIndicator(value: unknown): ClinicalIndicatorStatus {
  switch (valueAsText(value)) {
    case '1':
      return 'present';
    case '2':
      return 'absent';
    default:
      return 'unknown';
  }
}

function parseIndicators(
  record: JsonRecord,
  fields: Record<string, string[]>,
): Record<string, ClinicalIndicatorStatus> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, sourceFields]) => {
      const sourceValue = sourceFields
        .map((field) => record[field])
        .find((value) => ['1', '2'].includes(valueAsText(value) ?? ''));
      return [name, parseIndicator(sourceValue)];
    }),
  );
}

function parseWarningSigns(record: JsonRecord): Record<string, ClinicalIndicatorStatus> {
  return Object.fromEntries(
    Object.entries(warningSignFields).map(([name, field]) => [name, parseIndicator(record[field])]),
  );
}

function parseConfirmation(disease: Disease, value: unknown): boolean | null {
  const classification = valueAsText(value);
  if (!classification) return null;

  if (disease === 'dengue' && ['1', '2', '3', '4', '10', '11', '12'].includes(classification)) {
    return true;
  }
  if (disease !== 'dengue' && classification === '1') return true;

  if (
    (disease === 'dengue' && classification === '5') ||
    (disease !== 'dengue' && classification === '2')
  ) {
    return false;
  }
  return null;
}

function parseBooleanCode(value: unknown): boolean | null {
  const code = valueAsText(value);
  if (code === '1') return true;
  if (code === '2') return false;
  return null;
}

function normalizeStateCode(value: unknown, municipalityCode: string | null): string | null {
  const code = valueAsText(value)?.toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) return code;
  const ibgeCode = code?.match(/^\d{2}$/)?.[0] ?? municipalityCode?.slice(0, 2);
  return ibgeCode ? (stateByIbgeCode[ibgeCode] ?? null) : null;
}

function facilityFromUbs(record: JsonRecord): NewHealthFacility {
  const municipalityCode = sourceCode(record.ibge);
  return {
    cnes: cnesCode(record.cnes),
    type: 'primary_care',
    name: valueAsText(record.nome) ?? 'Unnamed primary care unit',
    stateCode: normalizeStateCode(record.uf, municipalityCode),
    municipalityCode,
    neighborhood: valueAsText(record.bairro),
    street: valueAsText(record.logradouro),
    latitude: parseCoordinate(record.latitude),
    longitude: parseCoordinate(record.longitude),
  };
}

function facilityFromHospital(record: JsonRecord): NewHealthFacility {
  const municipalityCode = sourceCode(record.codigo_ibge_do_municipio);
  return {
    cnes: null,
    type: 'hospital',
    name: valueAsText(record.nome_do_hospital) ?? 'Unnamed hospital',
    stateCode: normalizeStateCode(
      record.unidade_da_federacao_onde_fica_o_hospital,
      municipalityCode,
    ),
    municipalityCode,
    municipalityName: valueAsText(record.nome_do_municipio_onde_fica_o_hospital),
    neighborhood: valueAsText(record.nome_do_bairro_do_endereco_do_hosptial),
    street: valueAsText(record.enderco_do_hospital),
    streetNumber: valueAsText(record.numero_do_endereco_do_hospital),
    addressComplement: valueAsText(record.complemento_do_endereco_do_hospital),
    postalCode: valueAsText(record.numero_do_cep_do_hospital),
  };
}

function capacityFromHospital(record: JsonRecord, facilityId: number): NewHospitalCapacitySnapshot {
  return {
    facilityId,
    generalBedsTotal: parseInteger(record.quantidade_total_de_leitos_do_hosptial),
    generalBedsSus: parseInteger(record.quantidade_total_de_leitos_sus_do_hosptial),
    intensiveCareBedsTotal: parseInteger(record.quantidade_de_leitos_de_uti_do_hosptial),
    intensiveCareBedsSus: parseInteger(record.quantidade_de_leitos_de_uti_sus_do_hosptial),
  };
}

function notificationFromRecord(
  disease: Disease,
  record: JsonRecord,
  facilityIdByCnes: Map<string, number>,
): NewArbovirusNotification {
  const symptomOnsetAt = parseDate(record.dt_sin_pri);
  const notifiedAt = parseDate(record.dt_notific);
  const epiWeek = parseEpidemiologicalWeek(record.sem_pri);
  const cnes = cnesCode(record.id_unidade);

  return {
    disease,
    notifiedAt,
    symptomOnsetAt,
    onsetEpiYear: epiWeek.year ?? parseInteger(record.nu_ano),
    onsetEpiWeek: epiWeek.week,
    ageYears: parseAgeYears(record, symptomOnsetAt ?? notifiedAt),
    residenceMunicipalityCode: sourceCode(record.id_mn_resi),
    notifyingMunicipalityCode: sourceCode(record.id_municip),
    reportingFacilityCnes: cnes,
    reportingFacilityId: cnes ? (facilityIdByCnes.get(cnes) ?? null) : null,
    isConfirmed: parseConfirmation(disease, record.classi_fin),
    wasHospitalized: parseBooleanCode(record.hospitaliz),
    symptoms: parseIndicators(record, symptomFields),
    warningSigns: parseWarningSigns(record),
  };
}

async function readCollection(
  directory: string,
  filename: string,
  collectionName: string,
): Promise<JsonRecord[]> {
  const contents = await readFile(resolve(directory, filename), 'utf8');
  const parsed: unknown = JSON.parse(contents);
  if (typeof parsed !== 'object' || parsed === null || !(collectionName in parsed)) {
    throw new Error(`${filename} must contain a "${collectionName}" array.`);
  }

  const records = (parsed as Record<string, unknown>)[collectionName];
  if (!Array.isArray(records)) {
    throw new Error(`${filename}: "${collectionName}" is not an array.`);
  }
  return records as JsonRecord[];
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
  }

  const defaultDataDirectory = fileURLToPath(new URL('../../../../data', import.meta.url));
  const dataDirectory = resolve(process.env.SEED_DATA_DIR ?? defaultDataDirectory);
  const [hospitalRecords, ubsRecords, chikungunyaRecords, dengueRecords, zikaRecords] =
    await Promise.all([
      readCollection(dataDirectory, 'hospitais_e_leitos.json', 'hospitais_leitos'),
      readCollection(dataDirectory, 'unidades_basicas_de_saude.json', 'ubs'),
      readCollection(dataDirectory, 'chikungunya.json', 'chikungunya'),
      readCollection(dataDirectory, 'dengue.json', 'dengue'),
      readCollection(dataDirectory, 'zikavirus.json', 'zikavirus'),
    ]);

  const primaryCareFacilities = ubsRecords.map(facilityFromUbs);
  const hospitals = hospitalRecords.map(facilityFromHospital);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool });
  const reset = process.argv.includes('--reset');

  try {
    const [existingNotifications, existingCapacity, existingFacilities] = await Promise.all([
      db.select({ id: arbovirusNotifications.id }).from(arbovirusNotifications).limit(1),
      db.select({ id: hospitalCapacitySnapshots.id }).from(hospitalCapacitySnapshots).limit(1),
      db.select({ id: healthFacilities.id }).from(healthFacilities).limit(1),
    ]);

    if (
      !reset &&
      (existingNotifications.length > 0 ||
        existingCapacity.length > 0 ||
        existingFacilities.length > 0)
    ) {
      throw new Error(
        'The sample tables already contain data. Use --reset to replace their contents.',
      );
    }

    await db.transaction(async (tx) => {
      if (reset) {
        await tx.delete(arbovirusNotifications);
        await tx.delete(hospitalCapacitySnapshots);
        await tx.delete(healthFacilities);
      }

      const insertedUbs = primaryCareFacilities.length
        ? await tx
            .insert(healthFacilities)
            .values(primaryCareFacilities)
            .returning({ id: healthFacilities.id, cnes: healthFacilities.cnes })
        : [];
      const insertedHospitals = hospitals.length
        ? await tx.insert(healthFacilities).values(hospitals).returning({ id: healthFacilities.id })
        : [];

      const facilityIdByCnes = new Map(
        insertedUbs.flatMap((facility) =>
          facility.cnes ? [[facility.cnes, facility.id] as const] : [],
        ),
      );
      const linkedNotifications = [
        ...chikungunyaRecords.map((record) =>
          notificationFromRecord('chikungunya', record, facilityIdByCnes),
        ),
        ...dengueRecords.map((record) =>
          notificationFromRecord('dengue', record, facilityIdByCnes),
        ),
        ...zikaRecords.map((record) => notificationFromRecord('zika', record, facilityIdByCnes)),
      ];

      const capacitySnapshots = hospitals.map((record, index) => {
        const facility = insertedHospitals[index];
        if (!facility) {
          throw new Error('Could not link a hospital bed snapshot to its facility.');
        }
        return capacityFromHospital(record, facility.id);
      });

      if (capacitySnapshots.length) {
        await tx.insert(hospitalCapacitySnapshots).values(capacitySnapshots);
      }
      if (linkedNotifications.length) {
        await tx.insert(arbovirusNotifications).values(linkedNotifications);
      }

      console.log(
        `Imported ${insertedUbs.length} primary care units, ${insertedHospitals.length} hospitals, ${capacitySnapshots.length} bed snapshots, and ${linkedNotifications.length} notifications.`,
      );
    });
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Sample data import failed:', error);
  process.exitCode = 1;
});
