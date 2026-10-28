import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
export const forecasts = sqliteTable('forecasts', {
 id: text('id').primaryKey(), raceId: text('race_id').notNull(), probability: real('probability').notNull(),
 method: text('method').notNull(), rationale: text('rationale').notNull(), evidence: text('evidence').notNull(),
 createdAt: text('created_at').notNull(), author: text('author').notNull(), margin: real('margin'), sigma: real('sigma')
});
export const outcomes = sqliteTable('outcomes', {
 id: text('id').primaryKey(), raceId: text('race_id').notNull(), won: integer('won').notNull(),
 source: text('source').notNull(), createdAt: text('created_at').notNull()
});
export const nationalForecasts = sqliteTable('national_forecasts', {id:text('id').primaryKey(),contestId:text('contest_id').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()});
export const nationalOutcomes = sqliteTable('national_outcomes', {id:text('id').primaryKey(),contestId:text('contest_id').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()});
