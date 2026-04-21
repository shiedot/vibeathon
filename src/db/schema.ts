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
 * All monetary values are stored as integer TravellerBux (₿). 1 ₿ = ৳1.
 */
import type { AdapterAccountType } from "next-auth/adapters";
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
 * Auth.js (next-auth v5) tables.
 * Shape mandated by @auth/drizzle-adapter. We link a participant row to a user
 * row via `participants.user_id` (set at sign-in by email auto-match).
 * ------------------------------------------------------------------------ */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
    withTimezone: true,
  }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.credentialID] }),
  }),
);

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
  "seed", // initial 1000 ₿ personal bankroll granted
  "stake", // participant bankroll -> team pot at R1
  "win_pot", // team pot credited after battle win
  "consol", // losing captain's 20% consolation into personal bankroll
  "bet_place", // personal bankroll -> bet escrow
  "bet_payout", // bet escrow -> personal bankroll on win
  "bet_refund", // bet escrow -> personal bankroll (no-contest or admin)
  "admin_override",
  "play_in_bonus", // mentor-honor / learner-bankroll (organizer-funded)
  "settlement", // final prize payout
]);

/* ---------------------------------------------------------------------------
 * Participants
 * ------------------------------------------------------------------------ */
export const participants = pgTable("participants", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Link to the Auth.js `users` row for this Traveller (null until first login).
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" })
    .unique(),

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

  // Current team / captaincy denormalised for fast reads; source of truth is
  // `teams.captain_id` and `team_members`.
  currentTeamId: uuid("current_team_id"),
  personalBankroll: integer("personal_bankroll").notNull().default(1000),

  // Root captain of the R1 team this Traveller started on; enforces
  // bet-eligibility ("lineage broken" = current_team.lineage_root_captain !=
  // participant.r1_lineage_root_id).
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

  // null once teams leave the pod rounds (QF+).
  podId: integer("pod_id"),
  currentRound: integer("current_round").notNull().default(1),

  captainId: uuid("captain_id").notNull(),
  teamPot: integer("team_pot").notNull().default(0),

  // Parent teams that merged to form this one; empty for R1 solo teams.
  parentTeamIds: jsonb("parent_team_ids").$type<string[]>().notNull().default([]),

  // Original R1 captain whose lineage this team descends from; used by §6
  // betting-eligibility.
  lineageRootCaptainId: uuid("lineage_root_captain_id").notNull(),

  isActive: boolean("is_active").notNull().default(true),
  displayName: text("display_name"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Participant <-> team membership. History preserved via leftAt.
 */
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

  // Persisted so betting-close math remains stable even if round config is
  // later edited.
  roundDurationMinutes: integer("round_duration_minutes").notNull().default(60),
  bettingClosesAt: timestamp("betting_closes_at", { withTimezone: true }).notNull(),

  stakeA: integer("stake_a").notNull().default(0),
  stakeB: integer("stake_b").notNull().default(0),
  combinedPool: integer("combined_pool").notNull().default(0),

  winnerTeamId: uuid("winner_team_id").references(() => teams.id),
  judgeInterventionNote: text("judge_intervention_note"),

  // Judge votes for SF/Final per §5 (1 judge vote = 1 member vote, max 3).
  judgeVotes: jsonb("judge_votes")
    .$type<{ judgeId: string; teamVotedFor: string }[]>()
    .notNull()
    .default([]),

  // Snapshot of pre-resolve membership for reverseBattleResolution().
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

/**
 * Consensus votes: both teams combine; simple majority decides.
 */
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
  byUserId: text("by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
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
