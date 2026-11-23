import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  healthFacilities,
  hospitalCapacitySnapshots,
  type NewHealthFacility,
} from '../../db/schema.ts';
import type { HospitalWithCapacity } from './transform.ts';

export interface LoadResult {
  primaryCare: number;
  removedPrimaryCare: number;
  hospitals: number;
}

const excluded = (column: string) => sql.raw(`excluded.${column}`);

/**
 * Grava os estabelecimentos numa única transação.
 *
 * - UBS: upsert pelo CNES, para manter o id estável (as notificações apontam para ele).
 *   UBS que saíram da fonte são removidas; as notificações ficam com a referência nula.
 * - Hospitais: não têm CNES na fonte, então são substituídos a cada carga,
 *   junto com os retratos de leitos (apagados em cascata).
 */
export async function loadFacilities(
  db: NodePgDatabase,
  primaryCare: NewHealthFacility[],
  hospitals: HospitalWithCapacity[],
): Promise<LoadResult> {
  return db.transaction(async (tx) => {
    const now = new Date();

    if (primaryCare.length) {
      await tx
        .insert(healthFacilities)
        .values(primaryCare.map((facility) => ({ ...facility, updatedAt: now })))
        .onConflictDoUpdate({
          target: healthFacilities.cnes,
          set: {
            type: excluded('type'),
            name: excluded('name'),
            stateCode: excluded('state_code'),
            municipalityCode: excluded('municipality_code'),
            municipalityName: excluded('municipality_name'),
            neighborhood: excluded('neighborhood'),
            street: excluded('street'),
            latitude: excluded('latitude'),
            longitude: excluded('longitude'),
            updatedAt: excluded('updated_at'),
          },
        });
    }

    const currentCnes = primaryCare.flatMap((facility) => (facility.cnes ? [facility.cnes] : []));
    const removed = await tx
      .delete(healthFacilities)
      .where(
        currentCnes.length
          ? and(
              eq(healthFacilities.type, 'primary_care'),
              notInArray(healthFacilities.cnes, currentCnes),
            )
          : eq(healthFacilities.type, 'primary_care'),
      )
      .returning({ id: healthFacilities.id });

    await tx.delete(healthFacilities).where(eq(healthFacilities.type, 'hospital'));

    if (hospitals.length) {
      const inserted = await tx
        .insert(healthFacilities)
        .values(hospitals.map(({ facility }) => ({ ...facility, updatedAt: now })))
        .returning({ id: healthFacilities.id });

      await tx.insert(hospitalCapacitySnapshots).values(
        hospitals.map(({ capacity }, index) => {
          const facility = inserted[index];
          if (!facility) throw new Error('Hospital inserido sem id correspondente.');
          return { ...capacity, facilityId: facility.id, observedAt: now };
        }),
      );
    }

    return {
      primaryCare: primaryCare.length,
      removedPrimaryCare: removed.length,
      hospitals: hospitals.length,
    };
  });
}
