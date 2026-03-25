import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const PROF_ID   = "00000000-0000-0000-0000-000000000001";
const PARENT_ID = "00000000-0000-0000-0000-000000000003";
const SCHOOL_ID = "00000000-0000-0000-0000-000000000010";

async function createGoTrueUser(supabaseUrl: string, serviceKey: string, payload: object) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== "klasbook-init-2025") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const errors: string[] = [];

  // ── 1. Create prof with exact UUID via GoTrue REST ───────────────────────
  const profRes = await createGoTrueUser(supabaseUrl, serviceKey, {
    id: PROF_ID,
    email: "demo@klasbook.be",
    password: "KlasbookDemo2025!",
    email_confirm: true,
    user_metadata: { full_name: "Prof Démo", email_verified: true },
    app_metadata: { provider: "email", providers: ["email"] },
  });
  if (profRes.error || profRes.msg) {
    errors.push(`createUser prof: ${profRes.error || profRes.msg}`);
  }

  // ── 2. Create parent with exact UUID via GoTrue REST ─────────────────────
  const parentRes = await createGoTrueUser(supabaseUrl, serviceKey, {
    id: PARENT_ID,
    email: "parent@klasbook.be",
    password: "KlasbookDemo2025!",
    email_confirm: true,
    user_metadata: { full_name: "Parent Démo", email_verified: true },
    app_metadata: { provider: "email", providers: ["email"] },
  });
  if (parentRes.error || parentRes.msg) {
    errors.push(`createUser parent: ${parentRes.error || parentRes.msg}`);
  }

  // ── 3. Restore school_memberships ────────────────────────────────────────
  const { error: smProfErr } = await supabaseAdmin.from("school_memberships").upsert({
    user_id: PROF_ID,
    school_id: SCHOOL_ID,
    role: "teacher",
    matiere: "Néerlandais",
  }, { onConflict: "user_id,school_id" });
  if (smProfErr) errors.push(`sm_prof: ${smProfErr.message}`);

  const { error: smParentErr } = await supabaseAdmin.from("school_memberships").upsert({
    user_id: PARENT_ID,
    school_id: SCHOOL_ID,
    role: "parent",
  }, { onConflict: "user_id,school_id" });
  if (smParentErr) errors.push(`sm_parent: ${smParentErr.message}`);

  // ── 4. Restore parent_links ──────────────────────────────────────────────
  for (const [i, studentSuffix] of ["b00000000001", "b00000000002"].entries()) {
    const { error: plErr } = await supabaseAdmin.from("parent_links").upsert({
      id: `aaaaaaaa-0000-0000-0000-00000000000${i + 1}`,
      school_id: SCHOOL_ID,
      parent_user_id: PARENT_ID,
      student_id: `00000000-0000-0000-0000-${studentSuffix}`,
      relationship: "parent",
      visibility_level: "full",
    }, { onConflict: "id" });
    if (plErr) errors.push(`parent_link ${i + 1}: ${plErr.message}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    errors,
    profResult: profRes,
    parentResult: parentRes,
  });
}
