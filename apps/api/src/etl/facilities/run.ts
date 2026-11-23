import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { NewHealthFacility } from '../../db/schema.ts';
import { paginate, type JsonRecord } from '../demas/paginate.ts';
import { loadFacilities } from './load.ts';
import { facilityFromUbs, SAO_PAULO_IBGE, selectCurrentHospitals } from './transform.ts';

/** Lê a fonte inteira, guardando só os registros que passam no filtro. */
async function collect(
  source: AsyncIterable<JsonRecord>,
  keep: (record: JsonRecord) => boolean,
  label: string,
): Promise<JsonRecord[]> {
  const kept: JsonRecord[] = [];
  let read = 0;
  for await (const record of source) {
    if (keep(record)) kept.push(record);
    if (++read % 20_000 === 0) console.log(`${label}: ${read} registros lidos`);
  }
  return kept;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Copie o .env.example para .env.');
  }

  // A API ignora filtros de município nas UBS: percorre o país e filtra aqui.
  const primaryCare: NewHealthFacility[] = [];
  for await (const record of paginate('/assistencia-a-saude/unidade-basicas-de-saude', 'ubs')) {
    const facility = facilityFromUbs(record);
    if (facility) primaryCare.push(facility);
  }
  console.log(`UBS no município: ${primaryCare.length}`);

  const hospitalRecords = await collect(
    paginate('/assistencia-a-saude/hospitais-e-leitos', 'hospitais_leitos', {
      params: { uf: 'SP' },
    }),
    // Só as linhas recentes do município interessam (ver selectCurrentHospitals).
    (record) => String(record.codigo_ibge_do_municipio) === SAO_PAULO_IBGE,
    'Hospitais (SP)',
  );
  const hospitals = selectCurrentHospitals(hospitalRecords);
  console.log(`Hospitais atuais no município: ${hospitals.length}`);

  // Uma resposta vazia indica problema na fonte; carregá-la apagaria os dados atuais.
  if (primaryCare.length === 0 || hospitals.length === 0) {
    throw new Error('A fonte não devolveu UBS ou hospitais do município. Carga abortada.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await loadFacilities(drizzle({ client: pool }), primaryCare, hospitals);
    console.log(
      `Carga concluída: ${result.primaryCare} UBS (${result.removedPrimaryCare} removidas) e ${result.hospitals} hospitais.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('Falha no ETL de estabelecimentos:', error);
  process.exitCode = 1;
});
