import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  fatherName: text("father_name"),
  dob: text("dob"),
  gender: text("gender"),
  address: text("address"),
  area: text("area"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertCandidate = typeof candidatesTable.$inferInsert;
export type Candidate = typeof candidatesTable.$inferSelect;
