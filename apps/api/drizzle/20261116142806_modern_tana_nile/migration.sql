CREATE TYPE "arbovirus" AS ENUM('dengue', 'chikungunya', 'zika');--> statement-breakpoint
CREATE TYPE "facility_type" AS ENUM('primary_care', 'hospital');--> statement-breakpoint
CREATE TABLE "arbovirus_notifications" (
	"id" serial PRIMARY KEY,
	"disease" "arbovirus" NOT NULL,
	"notified_at" date,
	"symptom_onset_at" date,
	"onset_epi_year" integer,
	"onset_epi_week" integer,
	"age_years" integer,
	"residence_municipality_code" varchar(7),
	"notifying_municipality_code" varchar(7),
	"reporting_facility_cnes" varchar(7),
	"reporting_facility_id" integer,
	"is_confirmed" boolean,
	"was_hospitalized" boolean,
	"symptoms" jsonb DEFAULT '{}' NOT NULL,
	"warning_signs" jsonb DEFAULT '{}' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_facilities" (
	"id" serial PRIMARY KEY,
	"cnes" varchar(7),
	"type" "facility_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"state_code" varchar(2),
	"municipality_code" varchar(7),
	"municipality_name" varchar(120),
	"neighborhood" varchar(120),
	"street" varchar(255),
	"street_number" varchar(30),
	"address_complement" varchar(120),
	"postal_code" varchar(8),
	"phone_number" varchar(30),
	"latitude" numeric(9,6),
	"longitude" numeric(9,6),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hospital_capacity_snapshots" (
	"id" serial PRIMARY KEY,
	"facility_id" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"general_beds_total" integer,
	"general_beds_sus" integer,
	"intensive_care_beds_total" integer,
	"intensive_care_beds_sus" integer
);
--> statement-breakpoint
CREATE TABLE "weekly_case_counts" (
	"id" serial PRIMARY KEY,
	"disease" "arbovirus" NOT NULL,
	"epi_year" integer NOT NULL,
	"epi_week" integer NOT NULL,
	"total" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_case_counts_disease_week_uq" UNIQUE("disease","epi_year","epi_week")
);
--> statement-breakpoint
CREATE TABLE "weekly_case_counts_by_facility" (
	"id" serial PRIMARY KEY,
	"disease" "arbovirus" NOT NULL,
	"epi_year" integer NOT NULL,
	"epi_week" integer NOT NULL,
	"facility_cnes" varchar(7),
	"total" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_case_counts_by_facility_uq" UNIQUE NULLS NOT DISTINCT("disease","epi_year","epi_week","facility_cnes")
);
--> statement-breakpoint
CREATE INDEX "arbovirus_notifications_epi_curve_idx" ON "arbovirus_notifications" ("disease","is_confirmed","onset_epi_year","onset_epi_week");--> statement-breakpoint
CREATE INDEX "arbovirus_notifications_residence_idx" ON "arbovirus_notifications" ("residence_municipality_code");--> statement-breakpoint
CREATE INDEX "arbovirus_notifications_facility_idx" ON "arbovirus_notifications" ("reporting_facility_id");--> statement-breakpoint
CREATE INDEX "arbovirus_notifications_facility_cnes_idx" ON "arbovirus_notifications" ("reporting_facility_cnes");--> statement-breakpoint
CREATE UNIQUE INDEX "health_facilities_cnes_idx" ON "health_facilities" ("cnes");--> statement-breakpoint
CREATE INDEX "health_facilities_location_idx" ON "health_facilities" ("state_code","municipality_code");--> statement-breakpoint
CREATE INDEX "health_facilities_type_idx" ON "health_facilities" ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "hospital_capacity_facility_observed_idx" ON "hospital_capacity_snapshots" ("facility_id","observed_at");--> statement-breakpoint
CREATE INDEX "hospital_capacity_observed_idx" ON "hospital_capacity_snapshots" ("observed_at");--> statement-breakpoint
CREATE INDEX "weekly_case_counts_by_facility_cnes_idx" ON "weekly_case_counts_by_facility" ("facility_cnes");--> statement-breakpoint
ALTER TABLE "arbovirus_notifications" ADD CONSTRAINT "arbovirus_notifications_bU4yxmv3khOi_fkey" FOREIGN KEY ("reporting_facility_id") REFERENCES "health_facilities"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "hospital_capacity_snapshots" ADD CONSTRAINT "hospital_capacity_snapshots_Bp9UP29hBCaG_fkey" FOREIGN KEY ("facility_id") REFERENCES "health_facilities"("id") ON DELETE CASCADE;