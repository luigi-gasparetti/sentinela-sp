import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  arbovirusNotifications,
  healthFacilities,
  hospitalCapacitySnapshots,
  weeklyCaseCounts,
  weeklyCaseCountsByFacility,
} from './schema.ts';

// Localmente, lê o .env da raiz. No CI, DATABASE_URL vem do próprio workflow.
try {
  process.loadEnvFile(new URL('../../../../.env', import.meta.url));
} catch {
  // Sem .env: segue com as variáveis de ambiente que já existirem.
}

const databaseUrl = process.env.DATABASE_URL;

// Estes testes precisam de um PostgreSQL com as migrations aplicadas
// (npm run db:migrate -w @sentinela/api). Sem DATABASE_URL, são pulados.
describe.skipIf(!databaseUrl)('schema do banco', () => {
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
    await db.delete(weeklyCaseCountsByFacility);
    await db.delete(weeklyCaseCounts);
    await db.delete(arbovirusNotifications);
    await db.delete(hospitalCapacitySnapshots);
    await db.delete(healthFacilities);
  });

  it('grava uma notificação ligada ao estabelecimento que a registrou', async () => {
    const [facility] = await db
      .insert(healthFacilities)
      .values({ cnes: '1234567', type: 'primary_care', name: 'UBS Teste' })
      .returning({ id: healthFacilities.id });

    await db.insert(arbovirusNotifications).values({
      disease: 'dengue',
      onsetEpiYear: 2026,
      onsetEpiWeek: 18,
      reportingFacilityCnes: '1234567',
      reportingFacilityId: facility!.id,
    });

    const rows = await db
      .select()
      .from(arbovirusNotifications)
      .where(eq(arbovirusNotifications.reportingFacilityId, facility!.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.disease).toBe('dengue');
    expect(rows[0]!.symptoms).toEqual({});
  });

  it('mantém a notificação quando o estabelecimento é apagado', async () => {
    const [facility] = await db
      .insert(healthFacilities)
      .values({ cnes: '7654321', type: 'hospital', name: 'Hospital Teste' })
      .returning({ id: healthFacilities.id });
    await db
      .insert(arbovirusNotifications)
      .values({ disease: 'zika', reportingFacilityId: facility!.id });

    await db.delete(healthFacilities).where(eq(healthFacilities.id, facility!.id));

    const [notification] = await db.select().from(arbovirusNotifications);
    expect(notification!.reportingFacilityId).toBeNull();
  });

  it('não aceita dois totais para a mesma doença e semana', async () => {
    const week = { disease: 'chikungunya' as const, epiYear: 2026, epiWeek: 18 };
    await db.insert(weeklyCaseCounts).values({ ...week, total: 25 });

    await expect(db.insert(weeklyCaseCounts).values({ ...week, total: 30 })).rejects.toThrow();
  });

  it('trata notificações sem CNES como um único grupo por semana', async () => {
    const week = { disease: 'dengue' as const, epiYear: 2026, epiWeek: 18 };
    await db.insert(weeklyCaseCountsByFacility).values({ ...week, facilityCnes: null, total: 3 });

    await expect(
      db.insert(weeklyCaseCountsByFacility).values({ ...week, facilityCnes: null, total: 4 }),
    ).rejects.toThrow();
  });
});
