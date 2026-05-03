export * from "./generated/api";
// Note: ./generated/types contains plain TS type aliases with the same names
// as the Zod schemas above.  Exporting both creates TS2308 duplicate-export
// errors for body/param schemas, so we only expose the Zod validators there.
// Below we selectively export response DTO types that have no Zod-schema conflict.
export type { ActivityKind } from "./generated/types/activityKind";
export type { ActivityEvent } from "./generated/types/activityEvent";
export type { ActivityDetail } from "./generated/types/activityDetail";
export type { ActivityPage } from "./generated/types/activityPage";
export type { CenterAttendanceRow } from "./generated/types/centerAttendanceRow";
export type { CenterAttendanceRowStatus } from "./generated/types/centerAttendanceRowStatus";
export type { Staff } from "./generated/types/staff";
export type { Company } from "./generated/types/company";
