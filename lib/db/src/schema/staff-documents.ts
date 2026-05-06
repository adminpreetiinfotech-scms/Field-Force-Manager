import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { staffTable } from "./staff";

export const DOC_TYPES = ["aadhaar", "certificate", "photo", "other"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const staffDocumentsTable = pgTable("staff_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staffTable.id, { onDelete: "cascade" }),
  docType: text("doc_type", { enum: DOC_TYPES }).notNull().default("other"),
  label: text("label").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertStaffDocument = typeof staffDocumentsTable.$inferInsert;
export type StaffDocument = typeof staffDocumentsTable.$inferSelect;
