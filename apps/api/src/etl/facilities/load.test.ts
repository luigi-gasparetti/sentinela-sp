import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  arbovirusNotifications,
  healthFacilities,
  hospitalCapacitySnapshots,
  type NewHealthFacility,
} from '../../db/schema.ts';
import { loadFacilities } from './load.ts';
import type { HospitalWithCapacity } from './transform.ts';

// Localmente, lê o .env da raiz. No CI, DATABASE_URL vem do próprio workflow.
try {
  process.loadEnvFile(new URL('../../../../../.env', import.meta.url));
} catch {
  // Sem .env: segue com as variáveis de ambiente que já existirem.
}

const databaseUrl = process.env.DATABASE_URL;

function ubs(cnes: string, name = `UBS ${cnes}`): NewHealthFacility {
  return { cnes, type: 'primary_care', name, municipalityCode: '355030' };
}

function hospital(name: string, generalBedsTotal: number): HospitalWithCapacity {
  return {
    facility: { cnes: null, type: 'hospital', name, municipalityCode: '355030' },
    capacity: {
      generalBedsTotal,
      generalBedsSus: null,
      intensiveCareBedsTotal: null,
      intensiveCareBedsSus: null,
    },
  };
}

// Precisa de um PostgreSQL com as migrations aplicadas. Sem DATABASE_URL, é pulado.
describe.skipIf(!databaseUrl)('loadFacilities', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle>;

  beforeAll(() => {
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzle({ client: pool });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.delete(arbovirusNotifications);
    await db.delete(hospitalCapacitySnapshots);
    await db.delete(healthFacilities);
  });

  it('grava UBS, hospitais e os leitos de cada hospital', async () => {
    const result = await loadFacilities(
      db,
      [ubs('0000001'), ubs('0000002')],
      [hospital('Hospital A', 120), hospital('Hospital B', 40)],
    );

    expect(result).toEqual({ primaryCare: 2, removedPrimaryCare: 0, hospitals: 2 });
    const snapshots = await db
      .select({ name: healthFacilities.name, beds: hospitalCapacitySnapshots.generalBedsTotal })
      .from(hospitalCapacitySnapshots)
      .innerJoin(healthFacilities, eq(healthFacilities.id, hospitalCapacitySnapshots.facilityId))
      .orderBy(healthFacilities.name);
    expect(snapshots).toEqual([
      { name: 'Hospital A', beds: 120 },
      { name: 'Hospital B', beds: 40 },
    ]);
  });

  it('atualiza UBS pelo CNES mantendo o id e o vínculo das notificações', async () => {
    await loadFacilities(db, [ubs('0000001', 'Nome antigo')], []);
    const [before] = await db.select().from(healthFacilities);
    await db
      .insert(arbovirusNotifications)
      .values({ disease: 'dengue', reportingFacilityId: before!.id });

    await loadFacilities(db, [ubs('0000001', 'Nome novo')], []);

    const [after] = await db.select().from(healthFacilities);
    expect(after).toMatchObject({ id: before!.id, name: 'Nome novo' });
    const [notification] = await db.select().from(arbovirusNotifications);
    expect(notification!.reportingFacilityId).toBe(before!.id);
  });

  it('remove UBS que saíram da fonte', async () => {
    await loadFacilities(db, [ubs('0000001'), ubs('0000002')], []);

    const result = await loadFacilities(db, [ubs('0000002')], []);

    expect(result.removedPrimaryCare).toBe(1);
    const rows = await db.select({ cnes: healthFacilities.cnes }).from(healthFacilities);
    expect(rows).toEqual([{ cnes: '0000002' }]);
  });

  it('substitui os hospitais e os leitos a cada carga', async () => {
    await loadFacilities(db, [], [hospital('Hospital A', 100), hospital('Hospital B', 50)]);

    await loadFacilities(db, [], [hospital('Hospital A', 110)]);

    const hospitals = await db
      .select({ name: healthFacilities.name })
      .from(healthFacilities)
      .where(eq(healthFacilities.type, 'hospital'));
    expect(hospitals).toEqual([{ name: 'Hospital A' }]);
    const snapshots = await db.select().from(hospitalCapacitySnapshots);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.generalBedsTotal).toBe(110);
  });
});
