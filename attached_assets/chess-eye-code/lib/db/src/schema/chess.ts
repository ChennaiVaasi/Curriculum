import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./auth";

export const clubStatusEnum = pgEnum("club_status", [
  "pending",
  "approved",
  "rejected",
]);

export const tournamentTypeEnum = pgEnum("tournament_type", [
  "swiss",
  "knockout",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "active",
  "completed",
]);

export const roundStatusEnum = pgEnum("round_status", [
  "pending",
  "active",
  "completed",
]);

export const pairingResultEnum = pgEnum("pairing_result", [
  "white_wins",
  "black_wins",
  "draw",
  "bye",
  "forfeit",
  "pending",
]);

export const playerRegistrationStatusEnum = pgEnum("player_registration_status", [
  "pending",
  "approved",
  "rejected",
]);

export const clubsTable = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  yourName: text("your_name"),
  yourRole: text("your_role"),
  instaId: text("insta_id"),
  facebookId: text("facebook_id"),
  district: text("district"),
  taluka: text("taluka"),
  status: clubStatusEnum("status").notNull().default("pending"),
  createdByUserId: text("created_by_user_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const registeredPlayersTable = pgTable("registered_players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gender: text("gender"),
  dateOfBirth: text("date_of_birth"),
  schoolName: text("school_name"),
  country: text("country"),
  state: text("state"),
  district: text("district"),
  taluka: text("taluka"),
  clubName: text("club_name"),
  phone: text("phone"),
  instaId: text("insta_id"),
  facebookId: text("facebook_id"),
  fideId: text("fide_id"),
  fideRating: integer("fide_rating"),
  status: playerRegistrationStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  tournamentType: tournamentTypeEnum("tournament_type").notNull(),
  totalRounds: integer("total_rounds").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  status: tournamentStatusEnum("status").notNull().default("draft"),
  isOfficial: boolean("is_official").notNull().default(false),
  organizerName: text("organizer_name"),
  organizerContact: text("organizer_contact"),
  attachmentUrl: text("attachment_url"),
  tieBreakOrder: text("tie_break_order").default('["buchholz","sonnebornBerger","wins"]'),
  ageCategories: text("age_categories").default('[10,14,18]'),
  mapLocation: text("map_location"),
  links: text("links"),
  organizerUsername: text("organizer_username"),
  organizerPassword: text("organizer_password"),
  clubId: integer("club_id").references(() => clubsTable.id, {
    onDelete: "set null",
  }),
  createdByUserId: text("created_by_user_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournamentRecordsTable = pgTable("tournament_records", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileUrl: text("file_url"),
  driveLink: text("drive_link"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentReviewsTable = pgTable("tournament_reviews", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  birthYear: integer("birth_year"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  school: text("school"),
  clubName: text("club_name"),
  fideId: text("fide_id"),
  federation: text("federation"),
  contactNumber: text("contact_number"),
  country: text("country"),
  state: text("state"),
  district: text("district"),
  taluka: text("taluka"),
  points: real("points").notNull().default(0),
  rating: integer("rating"),
  withdrawn: boolean("withdrawn").notNull().default(false),
  selfRegistered: boolean("self_registered").notNull().default(false),
  registeredPlayerId: integer("registered_player_id").references(
    () => registeredPlayersTable.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roundsTable = pgTable("rounds", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  status: roundStatusEnum("status").notNull().default("pending"),
  scheduledTime: text("scheduled_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pairingsTable = pgTable("pairings", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => roundsTable.id, { onDelete: "cascade" }),
  boardNumber: integer("board_number").notNull(),
  whitePlayerId: integer("white_player_id")
    .notNull()
    .references(() => playersTable.id, { onDelete: "cascade" }),
  blackPlayerId: integer("black_player_id").references(
    () => playersTable.id,
    { onDelete: "cascade" },
  ),
  result: pairingResultEnum("result").notNull().default("pending"),
  isBye: boolean("is_bye").notNull().default(false),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubsTable.$inferSelect;

export const insertRegisteredPlayerSchema = createInsertSchema(registeredPlayersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRegisteredPlayer = z.infer<typeof insertRegisteredPlayerSchema>;
export type RegisteredPlayer = typeof registeredPlayersTable.$inferSelect;

export const insertTournamentSchema = createInsertSchema(
  tournamentsTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;

export const insertRoundSchema = createInsertSchema(roundsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertRound = z.infer<typeof insertRoundSchema>;
export type Round = typeof roundsTable.$inferSelect;

export const insertPairingSchema = createInsertSchema(pairingsTable).omit({
  id: true,
});
export type InsertPairing = z.infer<typeof insertPairingSchema>;
export type Pairing = typeof pairingsTable.$inferSelect;

export const insertTournamentRecordSchema = createInsertSchema(tournamentRecordsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTournamentRecord = z.infer<typeof insertTournamentRecordSchema>;
export type TournamentRecord = typeof tournamentRecordsTable.$inferSelect;

export const insertTournamentReviewSchema = createInsertSchema(tournamentReviewsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTournamentReview = z.infer<typeof insertTournamentReviewSchema>;
export type TournamentReview = typeof tournamentReviewsTable.$inferSelect;

export const libraryBooksTable = pgTable("library_books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  level: text("level").notNull(),
  bookLink: text("book_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLibraryBookSchema = createInsertSchema(libraryBooksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertLibraryBook = z.infer<typeof insertLibraryBookSchema>;
export type LibraryBook = typeof libraryBooksTable.$inferSelect;

export const tournamentScheduleTable = pgTable("tournament_schedule", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournamentsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  scheduledAt: text("scheduled_at"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTournamentScheduleSchema = createInsertSchema(tournamentScheduleTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTournamentSchedule = z.infer<typeof insertTournamentScheduleSchema>;
export type TournamentScheduleItem = typeof tournamentScheduleTable.$inferSelect;

export const chessEyePositionsTable = pgTable("chess_eye_positions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Untitled Position"),
  fen: text("fen").notNull(),
  pgn: text("pgn"),
  notes: text("notes"),
  arrows: text("arrows"),
  highlights: text("highlights"),
  sourceImageUrl: text("source_image_url"),
  engineEval: integer("engine_eval"),
  engineLines: text("engine_lines"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chessEyeBooksTable = pgTable("chess_eye_books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  totalPages: integer("total_pages"),
  diagramCount: integer("diagram_count").notNull().default(0),
  status: text("status").notNull().default("done"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chessEyeDiagramsTable = pgTable("chess_eye_diagrams", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => chessEyeBooksTable.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  diagramNumber: integer("diagram_number").notNull().default(1),
  fen: text("fen").notNull(),
  thumbnailData: text("thumbnail_data"),
  notes: text("notes"),
  tags: text("tags"),
  confidence: integer("confidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChessEyePositionSchema = createInsertSchema(chessEyePositionsTable).omit({ id: true, createdAt: true });
export type InsertChessEyePosition = z.infer<typeof insertChessEyePositionSchema>;
export type ChessEyePosition = typeof chessEyePositionsTable.$inferSelect;

export const insertChessEyeBookSchema = createInsertSchema(chessEyeBooksTable).omit({ id: true, createdAt: true });
export type InsertChessEyeBook = z.infer<typeof insertChessEyeBookSchema>;
export type ChessEyeBook = typeof chessEyeBooksTable.$inferSelect;

export const insertChessEyeDiagramSchema = createInsertSchema(chessEyeDiagramsTable).omit({ id: true, createdAt: true });
export type InsertChessEyeDiagram = z.infer<typeof insertChessEyeDiagramSchema>;
export type ChessEyeDiagram = typeof chessEyeDiagramsTable.$inferSelect;

export const chessEyeToolEnum = pgEnum("chess_eye_tool", [
  "scan",
  "scoresheet",
  "analyze",
]);

export const chessEyeUsageTable = pgTable("chess_eye_usage", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  tool: chessEyeToolEnum("tool").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChessEyeUsage = typeof chessEyeUsageTable.$inferSelect;
