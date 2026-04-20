CREATE TYPE "public"."battle_status" AS ENUM('pending', 'voting', 'resolved', 'deadlocked', 'disqualified');--> statement-breakpoint
CREATE TYPE "public"."named_prize" AS ENUM('founder', 'runner_up', 'top_scout', 'best_coach', 'mentor_honor');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bkash', 'nagad', 'bank');--> statement-breakpoint
CREATE TYPE "public"."pitch_language" AS ENUM('english', 'bangla', 'either');--> statement-breakpoint
CREATE TYPE "public"."play_in_result" AS ENUM('won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."play_in_role" AS ENUM('junior', 'senior_volunteer');--> statement-breakpoint
CREATE TYPE "public"."redemption_method" AS ENUM('voucher', 'travel', 'activity', 'cash_equivalent');--> statement-breakpoint
CREATE TYPE "public"."setup_status" AS ENUM('incomplete', 'pending_review', 'ready');--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "authenticators" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticators_userId_credentialID_pk" PRIMARY KEY("userId","credentialID"),
	CONSTRAINT "authenticators_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_number" integer NOT NULL,
	"is_play_in" boolean DEFAULT false NOT NULL,
	"team_a_id" uuid NOT NULL,
	"team_b_id" uuid NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"actual_start" timestamp with time zone,
	"actual_end" timestamp with time zone,
	"betting_closes_at" timestamp with time zone NOT NULL,
	"stake_a" integer DEFAULT 0 NOT NULL,
	"stake_b" integer DEFAULT 0 NOT NULL,
	"combined_pool" integer DEFAULT 0 NOT NULL,
	"winner_team_id" uuid,
	"judge_intervention_note" text,
	"status" "battle_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bettor_id" uuid NOT NULL,
	"battle_id" uuid NOT NULL,
	"team_backed_id" uuid NOT NULL,
	"stake_amount" integer NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"payout_amount" integer
);
--> statement-breakpoint
CREATE TABLE "coach_nominations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nominator_id" uuid NOT NULL,
	"nominee_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_votes" (
	"battle_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"team_voted_for_id" uuid NOT NULL,
	"cast_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consensus_votes_battle_id_voter_id_pk" PRIMARY KEY("battle_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"department" text NOT NULL,
	"employee_id" varchar(64) NOT NULL,
	"years_coding" integer DEFAULT 0 NOT NULL,
	"comfort_level" integer DEFAULT 1 NOT NULL,
	"primary_stack" text NOT NULL,
	"tool_of_choice" text NOT NULL,
	"license_status" text NOT NULL,
	"tool_installed_tested" boolean DEFAULT false NOT NULL,
	"completed_test_pr" boolean DEFAULT false NOT NULL,
	"shipping_confidence" integer DEFAULT 1 NOT NULL,
	"preferred_pitch_language" "pitch_language" DEFAULT 'either' NOT NULL,
	"payment_method" "payment_method",
	"payment_account" text,
	"setup_status" "setup_status" DEFAULT 'incomplete' NOT NULL,
	"is_play_in_participant" boolean DEFAULT false NOT NULL,
	"play_in_role" "play_in_role",
	"play_in_result" "play_in_result",
	"mentor_honor_bonus" integer DEFAULT 0 NOT NULL,
	"learner_bankroll" integer DEFAULT 0 NOT NULL,
	"current_team_id" uuid,
	"personal_bankroll" integer DEFAULT 1000 NOT NULL,
	"r1_lineage_root_id" uuid,
	"eliminated_by_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "participants_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "prize_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"participant_id" uuid NOT NULL,
	"bankroll_taka" integer DEFAULT 0 NOT NULL,
	"consolation_taka" integer DEFAULT 0 NOT NULL,
	"bet_winnings_taka" integer DEFAULT 0 NOT NULL,
	"named_prize_taka" integer DEFAULT 0 NOT NULL,
	"named_prize_type" "named_prize",
	"participation_floor_taka" integer DEFAULT 200 NOT NULL,
	"total_taka" integer DEFAULT 0 NOT NULL,
	"redemption_method" "redemption_method",
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "team_members_team_id_participant_id_pk" PRIMARY KEY("team_id","participant_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pod_id" integer,
	"current_round" integer DEFAULT 1 NOT NULL,
	"captain_id" uuid NOT NULL,
	"team_pot" integer DEFAULT 0 NOT NULL,
	"parent_team_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lineage_root_captain_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_bettor_id_participants_id_fk" FOREIGN KEY ("bettor_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_team_backed_id_teams_id_fk" FOREIGN KEY ("team_backed_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_nominations" ADD CONSTRAINT "coach_nominations_nominator_id_participants_id_fk" FOREIGN KEY ("nominator_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_nominations" ADD CONSTRAINT "coach_nominations_nominee_id_participants_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_votes" ADD CONSTRAINT "consensus_votes_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_votes" ADD CONSTRAINT "consensus_votes_voter_id_participants_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consensus_votes" ADD CONSTRAINT "consensus_votes_team_voted_for_id_teams_id_fk" FOREIGN KEY ("team_voted_for_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_ledger" ADD CONSTRAINT "prize_ledger_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;