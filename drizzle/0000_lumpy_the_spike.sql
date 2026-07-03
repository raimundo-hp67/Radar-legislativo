CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "legal_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"boletin" varchar(20) NOT NULL,
	"title" text NOT NULL,
	"relevance" varchar(10) NOT NULL,
	"date_ingreso" date,
	"estado" varchar(50),
	"camara" varchar(50),
	"urgencia" varchar(50),
	"comision" varchar(100),
	"autores" text,
	"objetivo" text,
	"link_proyecto" text,
	"link_informes" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "legal_projects_boletin_unique" UNIQUE("boletin")
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"boletin" varchar(20) NOT NULL,
	"stage" varchar(100),
	"chamber_current" varchar(50),
	"last_action" text,
	"last_action_date" date,
	"urgency" varchar(50),
	"commission" text,
	"source_provider" varchar(50) NOT NULL,
	"source_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"changes_detected" jsonb
);
--> statement-breakpoint
CREATE TABLE "lobby_audiencias" (
	"id" serial PRIMARY KEY NOT NULL,
	"infolobby_id" varchar(100) NOT NULL,
	"fecha" varchar(20),
	"lugar" text,
	"forma" varchar(50),
	"tipo_audiencia" varchar(100),
	"sujeto_pasivo" text,
	"sujeto_pasivo_cargo" text,
	"sujeto_pasivo_institucion" text,
	"sujeto_activo" text,
	"sujeto_activo_tipo" varchar(50),
	"sujeto_activo_organizacion" text,
	"materia" text,
	"observaciones" text,
	"search_text" text,
	"source_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "lobby_audiencias_infolobby_id_unique" UNIQUE("infolobby_id")
);
--> statement-breakpoint
CREATE TABLE "project_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"boletin" text NOT NULL,
	"titulo" text NOT NULL,
	"fecha_ingreso" text,
	"estado" text,
	"etapa" text,
	"subetapa" text,
	"camara_origen" text,
	"urgencia" text,
	"ultimo_tramite" text,
	"fecha_ultimo_tramite" text,
	"autores" text,
	"materias" text,
	"resumen" text,
	"search_text" text,
	"is_active" boolean DEFAULT true,
	"source_url" text,
	"last_synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "project_cache_boletin_unique" UNIQUE("boletin")
);
--> statement-breakpoint
CREATE INDEX "idx_projects_relevance" ON "legal_projects" USING btree ("relevance");--> statement-breakpoint
CREATE INDEX "idx_projects_created_at" ON "legal_projects" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_snapshots_boletin" ON "project_snapshots" USING btree ("boletin");--> statement-breakpoint
CREATE INDEX "idx_snapshots_fetched_at" ON "project_snapshots" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_snapshots_boletin_fetched" ON "project_snapshots" USING btree ("boletin","fetched_at");--> statement-breakpoint
CREATE INDEX "idx_lobby_infolobby_id" ON "lobby_audiencias" USING btree ("infolobby_id");--> statement-breakpoint
CREATE INDEX "idx_lobby_fecha" ON "lobby_audiencias" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "idx_lobby_sujeto_pasivo" ON "lobby_audiencias" USING btree ("sujeto_pasivo");--> statement-breakpoint
CREATE INDEX "idx_lobby_sujeto_activo" ON "lobby_audiencias" USING btree ("sujeto_activo");--> statement-breakpoint
CREATE INDEX "idx_lobby_institucion" ON "lobby_audiencias" USING btree ("sujeto_pasivo_institucion");--> statement-breakpoint
CREATE INDEX "idx_lobby_search_text" ON "lobby_audiencias" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "project_cache_boletin_idx" ON "project_cache" USING btree ("boletin");--> statement-breakpoint
CREATE INDEX "project_cache_search_text_idx" ON "project_cache" USING btree ("search_text");--> statement-breakpoint
CREATE INDEX "project_cache_is_active_idx" ON "project_cache" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "project_cache_fecha_ingreso_idx" ON "project_cache" USING btree ("fecha_ingreso");