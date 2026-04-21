ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "authenticators" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verificationTokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "authenticators" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "users" CASCADE;--> statement-breakpoint
DROP TABLE "verificationTokens" CASCADE;--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_user_id_unique";--> statement-breakpoint
ALTER TABLE "bankroll_ledger" DROP CONSTRAINT "bankroll_ledger_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "participants" DROP COLUMN "user_id";