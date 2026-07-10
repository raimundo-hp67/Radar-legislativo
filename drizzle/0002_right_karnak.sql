ALTER TABLE "legal_projects" DROP CONSTRAINT IF EXISTS "legal_projects_boletin_unique";--> statement-breakpoint
-- Se agrega primero como NULL para poder rellenar las filas existentes.
ALTER TABLE "legal_projects" ADD COLUMN "user_id" text;--> statement-breakpoint
-- Backfill: los proyectos que ya existían se asignan al primer usuario (admin).
UPDATE "legal_projects" SET "user_id" = (SELECT "id" FROM "user" ORDER BY "created_at" ASC LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
-- Si no había ningún usuario todavía, esos proyectos eran datos de ejemplo
-- previos al modelo por-usuario: se eliminan para no dejarlos sin dueño.
DELETE FROM "legal_projects" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "legal_projects" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_user_boletin" ON "legal_projects" USING btree ("user_id","boletin");--> statement-breakpoint
CREATE INDEX "idx_projects_user" ON "legal_projects" USING btree ("user_id");
