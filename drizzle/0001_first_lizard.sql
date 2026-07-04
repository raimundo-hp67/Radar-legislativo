CREATE TABLE "portal_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"logo_data_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
