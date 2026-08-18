import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = [
  "super_admin",
  "managing_director",
  "operations_manager",
  "sales_executive",
  "recruiter",
  "documentation_officer",
  "german_trainer",
  "agency_partner",
  "employer",
  "candidate",
];

/**
 * Invite a new user by email. Creates a Supabase auth user (invitation email
 * with magic link) and provisions an active app_users row with the given role.
 * Admins only (super_admin or managing_director).
 */
export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { email: string; fullName: string; role: string; department?: string }) => {
      const email = input.email?.trim().toLowerCase();
      const fullName = input.fullName?.trim();
      const role = input.role?.trim();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
      if (!fullName) throw new Error("Full name is required");
      if (!STAFF_ROLES.includes(role)) throw new Error("Invalid role");
      return { email, fullName, role, department: input.department?.trim() ?? "" };
    },
  )
  .handler(async ({ data, context }) => {
    // Authorize: caller must be an admin (server-side re-check under RLS).
    const { data: adminCheck } = await context.supabase
      .from("app_users")
      .select("role_key, active")
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (
      !adminCheck?.active ||
      !["super_admin", "managing_director"].includes(adminCheck.role_key)
    ) {
      throw new Error("Forbidden: administrator access required");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Send invite (Supabase generates a magic-link invitation email).
    const redirectOrigin = process.env.SITE_URL ?? undefined;
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        redirectTo: redirectOrigin ? `${redirectOrigin}/dashboard` : undefined,
        data: { full_name: data.fullName },
      });
    if (inviteError) {
      // If user already exists in auth, we still upsert the app_users row.
      if (!/already registered|exists/i.test(inviteError.message)) {
        throw new Error(`Invite failed: ${inviteError.message}`);
      }
    }

    const authUserId = inviteData?.user?.id ?? null;

    // Upsert app_users row (the auth trigger may also create one — we upgrade it).
    const { error: upsertError } = await supabaseAdmin.from("app_users").upsert(
      {
        auth_user_id: authUserId,
        email: data.email,
        full_name: data.fullName,
        role_key: data.role,
        active: true,
        metadata: { department: data.department },
      },
      { onConflict: "email" },
    );
    if (upsertError) throw new Error(`Provision failed: ${upsertError.message}`);

    // Best-effort audit log.
    await supabaseAdmin.from("audit_events").insert({
      entity_type: "app_user",
      entity_id: authUserId ?? "00000000-0000-0000-0000-000000000000",
      event_type: "user.invited",
      actor_id: context.userId,
      new_value: { email: data.email, role: data.role },
    });

    return { ok: true };
  });

/** Update role/active/department on an app_users row. Admins only. */
export const updateAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      role?: string;
      active?: boolean;
      fullName?: string;
      department?: string;
    }) => {
      if (!input.id) throw new Error("id required");
      if (input.role && !STAFF_ROLES.includes(input.role)) throw new Error("Invalid role");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { data: adminCheck } = await context.supabase
      .from("app_users")
      .select("role_key, active")
      .eq("auth_user_id", context.userId)
      .maybeSingle();
    if (
      !adminCheck?.active ||
      !["super_admin", "managing_director"].includes(adminCheck.role_key)
    ) {
      throw new Error("Forbidden: administrator access required");
    }

    const patch: {
      role_key?: string;
      active?: boolean;
      full_name?: string;
      metadata?: { department: string };
    } = {};
    if (data.role !== undefined) patch.role_key = data.role;
    if (data.active !== undefined) patch.active = data.active;
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.department !== undefined) patch.metadata = { department: data.department };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("app_users").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_events").insert({
      entity_type: "app_user",
      entity_id: data.id,
      event_type: "user.updated",
      actor_id: context.userId,
      new_value: patch as Record<string, string | boolean | { department: string }>,
    });

    return { ok: true };
  });
