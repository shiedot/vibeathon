/**
 * Vibe-a-thon data model.
 *
 * Mirrors §10 of `vibeathon_app_spec.md` with hardening for a live event:
 *
 * - `bankroll_ledger`: append-only ₿ movement audit; invariant `Σ delta == 0`
 *   across all rows (ignoring organizer-bonus rows which are tagged).
 * - `round_config`: per-round timing the admin can nudge.
 * - Role enum on participants so we can gate admin/judge UI on the same model.
 *
 * Auth is cookie-based (see `@/server/current-participant`); there is no
 * external identity provider, so `by_user_id` on the ledger is a free-form
 * audit tag (usually the acting participant id, sometimes `"admin"`).
 *
 * All monetary values are stored as integer TravellerBux (₿). 1 ₿ = ৳1.
 */
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------ */
export const setupStatusEnum = pgEnum("setup_status", [
  "incomplete",
  "pending_review",
  "ready",
]);

export const participantRoleEnum = pgEnum("participant_role", [
  "participant",
  "organizer",
  "judge",
]);

export const playInRoleEnum = pgEnum("play_in_role", [
  "junior",
  "senior_volunteer",
]);

export const playInResultEnum = pgEnum("play_in_result", ["won", "lost"]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "bkash",
  "nagad",
  "bank",
]);

export const pitchLanguageEnum = pgEnum("pitch_language", [
  "english",
  "bangla",
  "either",
]);

export const battleStatusEnum = pgEnum("battle_status", [
  "pending",
  "voting",
  "resolved",
  "deadlocked",
  "disqualified",
]);

export const namedPrizeEnum = pgEnum("named_prize", [
  "founder",
  "runner_up",
  "top_scout",
  "best_coach",
  "mentor_honor",
]);

export const redemptionEnum = pgEnum("redemption_method", [
  "voucher",
  "travel",
  "activity",
  "cash_equivalent",
]);

export const ledgerKindEnum = pgEnum("ledger_kind", [
  "seed",
  "stake",
  "win_pot",
  "consol",
  "bet_place",
  "bet_payout",
  "bet_refund",
  "admin_override",
  "play_in_bonus",
  "settlement",
]);

/* ---------------------------------------------------------------------------
 * Participants
 * ------------------------------------------------------------------------ */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  employeeId: varchar("employee_id", { length: 64 }).notNull().unique(),

  role: participantRoleEnum("role").notNull().default("participant"),

  yearsCoding: integer("years_coding").notNull().default(0),
  comfortLevel: integer("comfort_level").notNull().default(1), // 1-4
  primaryStack: text("primary_stack").notNull().default(""),
  toolOfChoice: text("tool_of_choice").notNull().default(""),
  licenseStatus: text("license_status").notNull().default(""),
  toolInstalledTested: boolean("tool_installed_tested").notNull().default(false),
  completedTestPr: boolean("completed_test_pr").notNull().default(false),
  shippingConfidence: integer("shipping_confidence").notNull().default(1), // 1-5

  preferredPitchLanguage: pitchLanguageEnum("preferred_pitch_language")
    .notNull()
    .default("either"),
  paymentMethod: paymentMethodEnum("payment_method"),
  paymentAccount: text("payment_account"),

  setupStatus: setupStatusEnum("setup_status").notNull().default("incomplete"),

  isPlayInParticipant: boolean("is_play_in_participant")
    .notNull()
    .default(false),
  playInRole: playInRoleEnum("play_in_role"),
  playInResult: playInResultEnum("play_in_result"),

  mentorHonorBonus: integer("mentor_honor_bonus").notNull().default(0),
  learnerBankroll: integer("learner_bankroll").notNull().default(0),

  currentTeamId: uuid("current_team_id"),
  personalBankroll: integer("personal_bankroll").notNull().default(1000),

  r1LineageRootId: uuid("r1_lineage_root_id"),
  eliminatedByTeamId: uuid("eliminated_by_team_id"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Teams
 * ------------------------------------------------------------------------ */
export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),

  podId: integer("pod_id"),
  currentRound: integer("current_round").notNull().default(1),

  captainId: uuid("captain_id").notNull(),
  teamPot: integer("team_pot").notNull().default(0),

  parentTeamIds: jsonb("parent_team_ids").$type<string[]>().notNull().default([]),

  lineageRootCaptainId: uuid("lineage_root_captain_id").notNull(),

  isActive: boolean("is_active").notNull().default(true),
  displayName: text("display_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.participantId] }),
  }),
);

/* ---------------------------------------------------------------------------
 * Battles
 * ------------------------------------------------------------------------ */
export const battles = pgTable("battles", {
  id: uuid("id").defaultRandom().primaryKey(),
  roundNumber: integer("round_number").notNull(),
  isPlayIn: boolean("is_play_in").notNull().default(false),

  teamAId: uuid("team_a_id")
    .notNull()
    .references(() => teams.id),
  teamBId: uuid("team_b_id")
    .notNull()
    .references(() => teams.id),

  scheduledStart: timestamp("scheduled_start", { withTimezone: true }).notNull(),
  actualStart: timestamp("actual_start", { withTimezone: true }),
  actualEnd: timestamp("actual_end", { withTimezone: true }),

  roundDurationMinutes: integer("round_duration_minutes").notNull().default(60),
  bettingClosesAt: timestamp("betting_closes_at", { withTimezone: true }).notNull(),

  stakeA: integer("stake_a").notNull().default(0),
  stakeB: integer("stake_b").notNull().default(0),
  combinedPool: integer("combined_pool").notNull().default(0),

  winnerTeamId: uuid("winner_team_id").references(() => teams.id),
  judgeInterventionNote: text("judge_intervention_note"),

  judgeVotes: jsonb("judge_votes")
    .$type<{ judgeId: string; teamVotedFor: string; castAt?: string }[]>()
    .notNull()
    .default([]),

  preResolveSnapshot: jsonb("pre_resolve_snapshot").$type<{
    teamAPot: number;
    teamBPot: number;
    teamAMembers: string[];
    teamBMembers: string[];
    teamACaptain: string;
    teamBCaptain: string;
  } | null>(),

  status: battleStatusEnum("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const consensusVotes = pgTable(
  "consensus_votes",
  {
    battleId: uuid("battle_id")
      .notNull()
      .references(() => battles.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    teamVotedForId: uuid("team_voted_for_id")
      .notNull()
      .references(() => teams.id),
    castAt: timestamp("cast_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.battleId, t.voterId] }),
  }),
);

/* ---------------------------------------------------------------------------
 * Bets (parimutuel)
 * ------------------------------------------------------------------------ */
export const bets = pgTable("bets", {
  id: uuid("id").defaultRandom().primaryKey(),
  bettorId: uuid("bettor_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  battleId: uuid("battle_id")
    .notNull()
    .references(() => battles.id, { onDelete: "cascade" }),
  teamBackedId: uuid("team_backed_id")
    .notNull()
    .references(() => teams.id),
  stakeAmount: integer("stake_amount").notNull(),
  placedAt: timestamp("placed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  locked: boolean("locked").notNull().default(false),
  refunded: boolean("refunded").notNull().default(false),
  payoutAmount: integer("payout_amount"),
});

/* ---------------------------------------------------------------------------
 * Best Coach nominations
 * ------------------------------------------------------------------------ */
export const coachNominations = pgTable("coach_nominations", {
  id: uuid("id").defaultRandom().primaryKey(),
  nominatorId: uuid("nominator_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  nomineeId: uuid("nominee_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Round configuration (lets admin nudge timings live)
 * ------------------------------------------------------------------------ */
export const roundConfig = pgTable("round_config", {
  roundNumber: integer("round_number").primaryKey(),
  label: text("label").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  teamSize: integer("team_size").notNull(),
  isPod: boolean("is_pod").notNull().default(false),
});

/* ---------------------------------------------------------------------------
 * Bankroll ledger — append-only ₿ movement audit
 *
 * `by_user_id` is a free-form audit tag (typically the acting participant id
 * or the literal `"admin"` when an admin-only session performed the write).
 * No FK — there is no users table in this build.
 * ------------------------------------------------------------------------ */
export const bankrollLedger = pgTable("bankroll_ledger", {
  id: serial("id").primaryKey(),
  kind: ledgerKindEnum("kind").notNull(),
  participantId: uuid("participant_id").references(() => participants.id, {
    onDelete: "set null",
  }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  battleId: uuid("battle_id").references(() => battles.id, { onDelete: "set null" }),
  betId: uuid("bet_id").references(() => bets.id, { onDelete: "set null" }),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  byUserId: text("by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Prize ledger — final settlement
 * ------------------------------------------------------------------------ */
export const prizeLedger = pgTable("prize_ledger", {
  id: serial("id").primaryKey(),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => participants.id, { onDelete: "cascade" }),

  bankrollTaka: integer("bankroll_taka").notNull().default(0),
  consolationTaka: integer("consolation_taka").notNull().default(0),
  betWinningsTaka: integer("bet_winnings_taka").notNull().default(0),
  namedPrizeTaka: integer("named_prize_taka").notNull().default(0),
  namedPrizeType: namedPrizeEnum("named_prize_type"),
  participationFloorTaka: integer("participation_floor_taka")
    .notNull()
    .default(200),

  totalTaka: integer("total_taka").notNull().default(0),
  redemptionMethod: redemptionEnum("redemption_method"),

  settledAt: timestamp("settled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ---------------------------------------------------------------------------
 * Type exports
 * ------------------------------------------------------------------------ */
export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Battle = typeof battles.$inferSelect;
export type NewBattle = typeof battles.$inferInsert;
export type Bet = typeof bets.$inferSelect;
export type NewBet = typeof bets.$inferInsert;
export type CoachNomination = typeof coachNominations.$inferSelect;
export type PrizeLedgerRow = typeof prizeLedger.$inferSelect;
export type BankrollLedgerRow = typeof bankrollLedger.$inferSelect;
export type NewBankrollLedgerRow = typeof bankrollLedger.$inferInsert;
export type RoundConfigRow = typeof roundConfig.$inferSelect;
export type NewRoundConfigRow = typeof roundConfig.$inferInsert;
