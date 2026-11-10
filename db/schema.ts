import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), authorName: text('author_name').notNull().default('Photographer'), title: text('title').notNull(),
  shared: integer('shared').notNull().default(0), category: text('category').notNull().default('Reflection'), walk: text('walk').notNull().default(''),
  caption: text('caption').notNull().default(''), place: text('place').notNull(),
  lat: real('lat').notNull(), lng: real('lng').notNull(), key: text('key').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('photos_owner_created').on(t.owner, t.createdAt)]);

export const messages = sqliteTable('messages', {id:text('id').primaryKey(),owner:text('owner').notNull(),authorName:text('author_name').notNull(),content:text('content').notNull(),createdAt:integer('created_at').notNull()},t=>[index('messages_created').on(t.createdAt)]);
