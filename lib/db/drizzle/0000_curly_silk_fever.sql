CREATE TYPE "public"."game_mode" AS ENUM('classic', 'mantra');--> statement-breakpoint
CREATE TYPE "public"."lineup_visibility" AS ENUM('always', 'after_deadline', 'hidden_all_season');--> statement-breakpoint
CREATE TYPE "public"."league_visibility" AS ENUM('private', 'public', 'unlisted');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('campionato', 'coppa', 'battle_royale', 'sprint_race', 'formula_uno', 'punteggio_assoluto');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."market_type" AS ENUM('auction', 'trade', 'release', 'free_agent');--> statement-breakpoint
CREATE TYPE "public"."contract_state" AS ENUM('active', 'expired', 'rescinded', 'clause_paid', 'traded');--> statement-breakpoint
CREATE TABLE "template_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"complexity_level" integer NOT NULL,
	"estimated_weekly_minutes" integer NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"feature_flags" jsonb NOT NULL,
	"suggested_markets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_competitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"author_user_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "federations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"template_id" text,
	"mode" "game_mode" DEFAULT 'classic' NOT NULL,
	"feature_flags" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"federation_id" text NOT NULL,
	"template_id" text,
	"visibility" "league_visibility" DEFAULT 'private' NOT NULL,
	"invitation_code" text,
	"max_managers" integer DEFAULT 10 NOT NULL,
	"admin_user_id" text NOT NULL,
	"co_admin_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"lineup_visibility" "lineup_visibility" DEFAULT 'after_deadline' NOT NULL,
	"roster_visibility" "lineup_visibility" DEFAULT 'always' NOT NULL,
	"season" integer NOT NULL,
	"started" boolean DEFAULT false NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_push" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leagues_invitation_code_unique" UNIQUE("invitation_code")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "competition_type" NOT NULL,
	"season" integer NOT NULL,
	"start_giornata" integer NOT NULL,
	"end_giornata" integer NOT NULL,
	"config" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_events" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "market_type" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "market_status" DEFAULT 'scheduled' NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"fanta_team_id" text NOT NULL,
	"player_id" integer NOT NULL,
	"season_start" integer NOT NULL,
	"duration_seasons" integer NOT NULL,
	"purchase_price" integer NOT NULL,
	"clause_default" integer NOT NULL,
	"clause_investment" integer DEFAULT 0 NOT NULL,
	"state" "contract_state" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fanta_teams" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"manager_user_id" text NOT NULL,
	"name" text NOT NULL,
	"name_auction" text,
	"logo_url" text,
	"jersey" jsonb,
	"credits_remaining" integer DEFAULT 0 NOT NULL,
	"roster" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_giornata_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"round" integer NOT NULL,
	"player_id" integer NOT NULL,
	"fixture_id" integer NOT NULL,
	"voto_mister" real,
	"stats_json" jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"real_team" text NOT NULL,
	"role_classic" text NOT NULL,
	"roles_mantra" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"birth_date" text,
	"nationality" text,
	"height_cm" integer,
	"foot" text,
	"photo_url" text,
	"injured" boolean DEFAULT false NOT NULL,
	"current_value" double precision,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_federation_id_federations_id_fk" FOREIGN KEY ("federation_id") REFERENCES "public"."federations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_events" ADD CONSTRAINT "market_events_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_fanta_team_id_fanta_teams_id_fk" FOREIGN KEY ("fanta_team_id") REFERENCES "public"."fanta_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fanta_teams" ADD CONSTRAINT "fanta_teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_giornata_stats" ADD CONSTRAINT "player_giornata_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;