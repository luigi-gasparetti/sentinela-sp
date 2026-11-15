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

export type HealthFacility = typeof healthFacilities.$inferSelect;
export type NewHealthFacility = typeof healthFacilities.$inferInsert;
export type HospitalCapacitySnapshot = typeof hospitalCapacitySnapshots.$inferSelect;
export type NewHospitalCapacitySnapshot = typeof hospitalCapacitySnapshots.$inferInsert;
export type ArbovirusNotification = typeof arbovirusNotifications.$inferSelect;
export type NewArbovirusNotification = typeof arbovirusNotifications.$inferInsert;
