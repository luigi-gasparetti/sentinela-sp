import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const facilityTypeEnum = pgEnum('facility_type', ['primary_care', 'hospital']);

export const arbovirusEnum = pgEnum('arbovirus', ['dengue', 'chikungunya', 'zika']);

export type ClinicalIndicatorStatus = 'present' | 'absent' | 'unknown';
export type ClinicalIndicators = Record<string, ClinicalIndicatorStatus>;

export const healthFacilities = pgTable(
  'health_facilities',
  {
    id: serial('id').primaryKey(),
    cnes: varchar('cnes', { length: 7 }),
    type: facilityTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    stateCode: varchar('state_code', { length: 2 }),
    municipalityCode: varchar('municipality_code', { length: 7 }),
    municipalityName: varchar('municipality_name', { length: 120 }),
    neighborhood: varchar('neighborhood', { length: 120 }),
    street: varchar('street', { length: 255 }),
    streetNumber: varchar('street_number', { length: 30 }),
    addressComplement: varchar('address_complement', { length: 120 }),
    postalCode: varchar('postal_code', { length: 8 }),
    phoneNumber: varchar('phone_number', { length: 30 }),
    latitude: numeric('latitude', { precision: 9, scale: 6 }),
    longitude: numeric('longitude', { precision: 9, scale: 6 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('health_facilities_cnes_idx').on(table.cnes),
    index('health_facilities_location_idx').on(table.stateCode, table.municipalityCode),
    index('health_facilities_type_idx').on(table.type),
  ],
);

export const hospitalCapacitySnapshots = pgTable(
  'hospital_capacity_snapshots',
  {
    id: serial('id').primaryKey(),
    facilityId: integer('facility_id')
      .notNull()
      .references(() => healthFacilities.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    generalBedsTotal: integer('general_beds_total'),
    generalBedsSus: integer('general_beds_sus'),
    intensiveCareBedsTotal: integer('intensive_care_beds_total'),
    intensiveCareBedsSus: integer('intensive_care_beds_sus'),
  },
  (table) => [
    uniqueIndex('hospital_capacity_facility_observed_idx').on(table.facilityId, table.observedAt),
    index('hospital_capacity_observed_idx').on(table.observedAt),
  ],
);

export const arbovirusNotifications = pgTable(
  'arbovirus_notifications',
  {
    id: serial('id').primaryKey(),
    disease: arbovirusEnum('disease').notNull(),
    notifiedAt: date('notified_at'),
    symptomOnsetAt: date('symptom_onset_at'),
    onsetEpiYear: integer('onset_epi_year'),
    onsetEpiWeek: integer('onset_epi_week'),
    ageYears: integer('age_years'),
    residenceMunicipalityCode: varchar('residence_municipality_code', {
      length: 7,
    }),
    notifyingMunicipalityCode: varchar('notifying_municipality_code', {
      length: 7,
    }),
    reportingFacilityCnes: varchar('reporting_facility_cnes', { length: 7 }),
    reportingFacilityId: integer('reporting_facility_id').references(() => healthFacilities.id, {
      onDelete: 'set null',
    }),
    isConfirmed: boolean('is_confirmed'),
    wasHospitalized: boolean('was_hospitalized'),
    symptoms: jsonb('symptoms').$type<ClinicalIndicators>().notNull().default({}),
    warningSigns: jsonb('warning_signs').$type<ClinicalIndicators>().notNull().default({}),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('arbovirus_notifications_epi_curve_idx').on(
      table.disease,
      table.isConfirmed,
      table.onsetEpiYear,
      table.onsetEpiWeek,
    ),
    index('arbovirus_notifications_residence_idx').on(table.residenceMunicipalityCode),
    index('arbovirus_notifications_facility_idx').on(table.reportingFacilityId),
    index('arbovirus_notifications_facility_cnes_idx').on(table.reportingFacilityCnes),
  ],
);

// ---------------------------------------------------------------------------
// Agregados
//
// Guardam os totais já calculados pelo ETL (apps/api/src/etl/demas/aggregates.ts),
// para que a API responda rápido sem somar as notificações a cada requisição.
// A semana usada é a de início dos sintomas, como no ETL.
// ---------------------------------------------------------------------------

/** Casos por doença e semana epidemiológica (curva epidêmica, US01 e US03). */
export const weeklyCaseCounts = pgTable(
  'weekly_case_counts',
  {
    id: serial('id').primaryKey(),
    disease: arbovirusEnum('disease').notNull(),
    epiYear: integer('epi_year').notNull(),
    epiWeek: integer('epi_week').notNull(),
    total: integer('total').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('weekly_case_counts_disease_week_uq').on(table.disease, table.epiYear, table.epiWeek),
  ],
);

/**
 * Casos por doença, semana e estabelecimento notificador (CNES).
 * Notificações sem CNES ficam num grupo próprio, com facility_cnes nulo;
 * por isso a restrição de unicidade trata nulos como iguais (NULLS NOT DISTINCT).
 */
export const weeklyCaseCountsByFacility = pgTable(
  'weekly_case_counts_by_facility',
  {
    id: serial('id').primaryKey(),
    disease: arbovirusEnum('disease').notNull(),
    epiYear: integer('epi_year').notNull(),
    epiWeek: integer('epi_week').notNull(),
    facilityCnes: varchar('facility_cnes', { length: 7 }),
    total: integer('total').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('weekly_case_counts_by_facility_uq')
      .on(table.disease, table.epiYear, table.epiWeek, table.facilityCnes)
      .nullsNotDistinct(),
    index('weekly_case_counts_by_facility_cnes_idx').on(table.facilityCnes),
  ],
);

export type HealthFacility = typeof healthFacilities.$inferSelect;
export type NewHealthFacility = typeof healthFacilities.$inferInsert;
export type HospitalCapacitySnapshot = typeof hospitalCapacitySnapshots.$inferSelect;
export type NewHospitalCapacitySnapshot = typeof hospitalCapacitySnapshots.$inferInsert;
export type ArbovirusNotification = typeof arbovirusNotifications.$inferSelect;
export type NewArbovirusNotification = typeof arbovirusNotifications.$inferInsert;
export type WeeklyCaseCount = typeof weeklyCaseCounts.$inferSelect;
export type NewWeeklyCaseCount = typeof weeklyCaseCounts.$inferInsert;
export type WeeklyCaseCountByFacility = typeof weeklyCaseCountsByFacility.$inferSelect;
export type NewWeeklyCaseCountByFacility = typeof weeklyCaseCountsByFacility.$inferInsert;
