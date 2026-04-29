import { db, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

function toStaffDTO(r: typeof staffTable.$inferSelect) {
  return {
    id: r.id,
    empCode: r.empCode,
    name: r.name,
    phone: r.phone,
    role: r.role,
    organization: r.organization ?? null,
    area: r.area ?? null,
    adminCode: r.adminCode ?? null,
  };
}

router.get("/staff", async (_req, res, next) => {
  try {
    const rows = await db.select().from(staffTable).orderBy(staffTable.name);
    res.json(rows.map(toStaffDTO));
  } catch (err) {
    next(err);
  }
});

router.post("/staff/register", async (req, res, next) => {
  try {
    const { kind, name, phone, organization, empCode, area, adminCode } =
      req.body as {
        kind?: string;
        name?: string;
        phone?: string;
        organization?: string | null;
        empCode?: string | null;
        area?: string | null;
        adminCode?: string | null;
      };

    if (!kind || !["admin", "staff"].includes(kind)) {
      res.status(400).json({
        title: "Invalid kind",
        detail: "kind must be 'admin' or 'staff'",
        status: 400,
      });
      return;
    }
    if (!name || name.trim().length < 2) {
      res.status(400).json({
        title: "Invalid name",
        detail: "name must be at least 2 characters",
        status: 400,
      });
      return;
    }
    if (!phone || !/^\d{10}$/.test(phone.trim())) {
      res.status(400).json({
        title: "Invalid phone",
        detail: "phone must be exactly 10 digits",
        status: 400,
      });
      return;
    }
    if (kind === "admin" && (!organization || organization.trim().length < 2)) {
      res.status(400).json({
        title: "Organization required",
        detail: "organization name is required for admin accounts",
        status: 400,
      });
      return;
    }

    // Check for duplicate phone.
    const existing = await db
      .select({ id: staffTable.id })
      .from(staffTable)
      .where(eq(staffTable.phone, phone.trim()))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        title: "Phone already registered",
        detail: "An account with this phone number already exists. Please sign in.",
        status: 409,
      });
      return;
    }

    // Auto-generate an empCode if not supplied.
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const resolvedEmpCode =
      empCode?.trim() ||
      (kind === "admin" ? `ADM-${suffix}` : `FS-${suffix}`);

    // Admins get a freshly-generated unique invite code (admin_code).
    // Staff never own an admin_code; instead, if they supply one during
    // registration we use it to look up the admin's organization so we can
    // copy it onto the staff record.
    let resolvedOrganization = organization?.trim() || null;
    const resolvedAdminCode =
      kind === "admin"
        ? Math.random().toString(36).slice(2, 8).toUpperCase()
        : null; // staff never store an admin_code

    if (kind === "staff" && adminCode?.trim()) {
      const [adminRow] = await db
        .select({ organization: staffTable.organization })
        .from(staffTable)
        .where(
          and(
            eq(staffTable.adminCode, adminCode.trim().toUpperCase()),
            eq(staffTable.role, "admin"),
          ),
        )
        .limit(1);
      if (adminRow?.organization) {
        resolvedOrganization = adminRow.organization;
      }
    }

    const [inserted] = await db
      .insert(staffTable)
      .values({
        empCode: resolvedEmpCode,
        name: name.trim(),
        phone: phone.trim(),
        role: kind === "admin" ? "admin" : "staff",
        organization: resolvedOrganization,
        area: area?.trim() || null,
        adminCode: resolvedAdminCode,
      })
      .returning();

    res.status(201).json(toStaffDTO(inserted));
  } catch (err) {
    next(err);
  }
});

export default router;
