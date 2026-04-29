import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const candidatesTable = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Identity
  candidateIdCode: text("candidate_id_code"),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  dob: text("dob"),
  gender: text("gender"),
  maritalStatus: text("marital_status"),
  religion: text("religion"),
  // Category
  caste: text("caste"),
  pwd: text("pwd"),
  disabilityType: text("disability_type"),
  bpl: text("bpl"),
  bplNumber: text("bpl_number"),
  // Address
  address: text("address"),
  village: text("village"),
  policeStation: text("police_station"),
  postOffice: text("post_office"),
  district: text("district"),
  state: text("state"),
  pin: text("pin"),
  area: text("area"),
  // Course
  course: text("course"),
  skillCentreName: text("skill_centre_name"),
  // Identity docs
  aadhaarNumber: text("aadhaar_number"),
  // Education
  education: text("education"),
  yearOfPassing: text("year_of_passing"),
  // Bank
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  bankBranch: text("bank_branch"),
  ifsc: text("ifsc"),
  // Files
  photoPath: text("photo_path"),
  aadhaarFrontPath: text("aadhaar_front_path"),
  aadhaarBackPath: text("aadhaar_back_path"),
  educationCertPath: text("education_cert_path"),
  bankPassbookPath: text("bank_passbook_path"),
  casteCertPath: text("caste_cert_path"),
  signaturePath: text("signature_path"),
  pdfPath: text("pdf_path"),
  // Submission
  mobilizer: text("mobilizer"),
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

export const candidateAuditLogTable = pgTable("candidate_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: text("candidate_id").notNull(),
  candidateName: text("candidate_name").notNull(),
  actionBy: text("action_by").notNull(),
  actionByPhone: text("action_by_phone"),
  oldStatus: text("old_status"),
  newStatus: text("new_status").notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InsertCandidate = typeof candidatesTable.$inferInsert;
export type Candidate = typeof candidatesTable.$inferSelect;
export type InsertCandidateNotification =
  typeof candidateNotificationsTable.$inferInsert;
export type CandidateNotification =
  typeof candidateNotificationsTable.$inferSelect;
export type InsertCandidateAuditLog = typeof candidateAuditLogTable.$inferInsert;
export type CandidateAuditLog = typeof candidateAuditLogTable.$inferSelect;
