CREATE TYPE "public"."ledger_kind" AS ENUM('seed', 'stake', 'win_pot', 'consol', 'bet_place', 'bet_payout', 'bet_refund', 'admin_override', 'play_in_bonus', 'settlement');--> statement-breakpoint
CREATE TYPE "public"."participant_role" AS ENUM('participant', 'organizer', 'judge');--> statement-breakpoint
CREATE TABLE "bankroll_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"participant_id" uuid,
	"team_id" uuid,
	"battle_id" uuid,
	"bet_id" uuid,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "round_config" (
	"round_number" integer PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"team_size" integer NOT NULL,
	"is_pod" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "primary_stack" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "tool_of_choice" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "license_status" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "round_duration_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "judge_votes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "battles" ADD COLUMN "pre_resolve_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "refunded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "role" "participant_role" DEFAULT 'participant' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bankroll_ledger" ADD CONSTRAINT "bankroll_ledger_by_user_id_users_id_fk" FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_email_unique" UNIQUE("email");