CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legal_projects" ALTER COLUMN "estado" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "legal_projects" ALTER COLUMN "camara" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "legal_projects" ALTER COLUMN "urgencia" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "legal_projects" ALTER COLUMN "comision" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "project_snapshots" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "project_snapshots" ALTER COLUMN "chamber_current" SET DATA TYPE text;