/**
 * Vibe-a-thon data model.
 *
 * Mirrors §10 of `vibeathon_app_spec.md`. All monetary values are stored as
 * integer TravellerBux (₿). Conversion: 1 ₿ = ৳1.
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
 * row via `participants.user_id` (added below).
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
  department: text("department").notNull(),
  employeeId: varchar("employee_id", { length: 64 }).notNull().unique(),

  yearsCoding: integer("years_coding").notNull().default(0),
  comfortLevel: integer("comfort_level").notNull().default(1), // 1-4
  primaryStack: text("primary_stack").notNull(),
  toolOfChoice: text("tool_of_choice").notNull(),
  licenseStatus: text("license_status").notNull(),
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

  // bonuses from play-in, paid from organizer pot at settlement.
  mentorHonorBonus: integer("mentor_honor_bonus").notNull().default(0),
  learnerBankroll: integer("learner_bankroll").notNull().default(0),

  // current team + captaincy denormalised for fast reads. Source of truth is
  // `teams.captain_id` / `teams.members`.
  currentTeamId: uuid("current_team_id"),
  personalBankroll: integer("personal_bankroll").notNull().default(1000),

  // the root captain of the R1 team this Traveller started on; used to
  // enforce bet-eligibility ("lineage broken" = current_team.lineage_root !=
  // participant.r1_lineage_root_id).
  r1LineageRootId: uuid("r1_lineage_root_id"),

  // the team that just eliminated this Traveller (nullable while active).
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

  // parent teams that merged to form this one; empty for R1 solo teams.
  parentTeamIds: jsonb("parent_team_ids").$type<string[]>().notNull().default([]),

  // the original R1 captain whose lineage this team descends from. Used for
  // the betting-eligibility check in §6.
  lineageRootCaptainId: uuid("lineage_root_captain_id").notNull(),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Participant <-> team membership. A participant can only belong to exactly one
 * team per round, but history is preserved here.
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
  bettingClosesAt: timestamp("betting_closes_at", { withTimezone: true }).notNull(),

  stakeA: integer("stake_a").notNull().default(0),
  stakeB: integer("stake_b").notNull().default(0),
  combinedPool: integer("combined_pool").notNull().default(0),

  winnerTeamId: uuid("winner_team_id").references(() => teams.id),
  judgeInterventionNote: text("judge_intervention_note"),

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
