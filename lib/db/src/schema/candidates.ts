import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  fatherName: text("father_name"),
  dob: text("dob"),
  gender: text("gender"),
  address: text("address"),
  area: text("area"),
  village: text("village"),
  course: text("course"),
  aadhaarNumber: text("aadhaar_number"),
  education: text("education"),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  ifsc: text("ifsc"),
  caste: text("caste"),
  photoPath: text("photo_path"),
  aadhaarFrontPath: text("aadhaar_front_path"),
  aadhaarBackPath: text("aadhaar_back_path"),
  educationCertPath: text("education_cert_path"),
  bankPassbookPath: text("bank_passbook_path"),
  casteCertPath: text("caste_cert_path"),
  pdfPath: text("pdf_path"),
  submittedBy: text("submitted_by"),
  submittedByPhone: text("submitted_by_phone"),
  // Status workflow
  status: text("status").notNull().default("pending"),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationRemarks: text("verification_remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const candidateNotificationsTable = pgTable(
  "candidate_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffPhone: text("staff_phone").notNull(),
    candidateId: text("candidate_id").notNull(),
    candidateName: text("candidate_name").notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type InsertCandidate = typeof candidatesTable.$inferInsert;
export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidateNotification =
  typeof candidateNotificationsTable.$inferInsert;
export type CandidateNotification =
  typeof candidateNotificationsTable.$inferSelect;
