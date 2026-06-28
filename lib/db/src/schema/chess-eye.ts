import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const chessEyePositionsTable = pgTable("chess_eye_positions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("Untitled Position"),
  fen: text("fen").notNull(),
  pgn: text("pgn"),
  notes: text("notes"),
  engineEval: integer("engine_eval"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChessEyePositionSchema = createInsertSchema(chessEyePositionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChessEyePosition = z.infer<typeof insertChessEyePositionSchema>;
export type ChessEyePosition = typeof chessEyePositionsTable.$inferSelect;
