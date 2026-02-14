import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action?: "load" | "save_draft" | "publish" | "rollback" | "history";
  key?: string;
  payload?: Record<string, unknown>;
  targetRevision?: number;
  note?: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(500, { error: "Missing Supabase env vars" });
  }

  const authHeader = req.headers.get("Authorization") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json(401, { error: "Unauthorized" });
  }

  const { data: roleRow, error: roleError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (roleError || roleRow?.role !== "admin") {
    return json(403, { error: "Admin only" });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const action = body.action;
  const key = body.key || "homepage";

  if (!action) {
    return json(400, { error: "Missing action" });
  }

  if (action === "load" || action === "history") {
    return await handleReadOnly(serviceClient, key);
  }

  if (action === "save_draft") {
    return await handleSaveDraft(serviceClient, key, user.id, body.payload, body.note);
  }

  if (action === "publish") {
    return await handlePublish(serviceClient, key, user.id, body.note);
  }

  if (action === "rollback") {
    return await handleRollback(serviceClient, key, user.id, body.targetRevision, body.note);
  }

  return json(400, { error: "Unsupported action" });
});

async function handleReadOnly(serviceClient: ReturnType<typeof createClient>, key: string) {
  const { data: row, error } = await serviceClient
    .from("site_content")
    .select("key,payload_draft,payload_published,current_revision,published_revision,published_at")
    .eq("key", key)
    .maybeSingle();

  if (error) return json(500, { error: error.message });

  const { data: revisions, error: revError } = await serviceClient
    .from("site_content_revisions")
    .select("revision_no,action,note,created_at,meta")
    .eq("content_key", key)
    .order("revision_no", { ascending: false })
    .limit(30);

  if (revError) return json(500, { error: revError.message });

  return json(200, {
    payloadDraft: row?.payload_draft || null,
    payloadPublished: row?.payload_published || null,
    currentRevision: row?.current_revision || 0,
    publishedRevision: row?.published_revision || null,
    publishedAt: row?.published_at || null,
    revisions: revisions || [],
  });
}

async function handleSaveDraft(
  serviceClient: ReturnType<typeof createClient>,
  key: string,
  userId: string,
  payload?: Record<string, unknown>,
  note?: string,
) {
  if (!payload || typeof payload !== "object") {
    return json(400, { error: "Missing payload for save_draft" });
  }

  const { data: currentRow, error: currentError } = await serviceClient
    .from("site_content")
    .select("current_revision,published_revision,published_at,payload_published")
    .eq("key", key)
    .maybeSingle();

  if (currentError) return json(500, { error: currentError.message });

  const nextRevision = (currentRow?.current_revision || 0) + 1;

  const { error: upsertError } = await serviceClient.from("site_content").upsert(
    {
      key,
      payload_draft: payload,
      current_revision: nextRevision,
      published_revision: currentRow?.published_revision || null,
      payload_published: currentRow?.payload_published || null,
      published_at: currentRow?.published_at || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (upsertError) return json(500, { error: upsertError.message });

  await writeRevision(serviceClient, {
    key,
    revisionNo: nextRevision,
    action: "save_draft",
    payload,
    note,
    actorId: userId,
    meta: {},
  });

  await writeAudit(serviceClient, {
    key,
    action: "save_draft",
    revisionNo: nextRevision,
    actorId: userId,
    details: { note: note || null },
  });

  return await handleReadOnly(serviceClient, key);
}

async function handlePublish(
  serviceClient: ReturnType<typeof createClient>,
  key: string,
  userId: string,
  note?: string,
) {
  const { data: row, error } = await serviceClient
    .from("site_content")
    .select("payload_draft,current_revision")
    .eq("key", key)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!row?.payload_draft) return json(400, { error: "No draft payload to publish" });

  const nextRevision = (row.current_revision || 0) + 1;
  const nowIso = new Date().toISOString();

  const { error: updateError } = await serviceClient
    .from("site_content")
    .update({
      payload_published: row.payload_draft,
      published_revision: nextRevision,
      current_revision: nextRevision,
      published_by: userId,
      published_at: nowIso,
      updated_by: userId,
      updated_at: nowIso,
    })
    .eq("key", key);

  if (updateError) return json(500, { error: updateError.message });

  const { error: publicError } = await serviceClient.from("site_content_public").upsert(
    {
      key,
      payload: row.payload_draft,
      published_revision: nextRevision,
      published_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "key" },
  );

  if (publicError) return json(500, { error: publicError.message });

  await writeRevision(serviceClient, {
    key,
    revisionNo: nextRevision,
    action: "publish",
    payload: row.payload_draft,
    note,
    actorId: userId,
    meta: {},
  });

  await writeAudit(serviceClient, {
    key,
    action: "publish",
    revisionNo: nextRevision,
    actorId: userId,
    details: { note: note || null },
  });

  return await handleReadOnly(serviceClient, key);
}

async function handleRollback(
  serviceClient: ReturnType<typeof createClient>,
  key: string,
  userId: string,
  targetRevision?: number,
  note?: string,
) {
  if (!targetRevision || Number.isNaN(targetRevision)) {
    return json(400, { error: "Missing targetRevision" });
  }

  const { data: target, error: targetError } = await serviceClient
    .from("site_content_revisions")
    .select("revision_no,payload")
    .eq("content_key", key)
    .eq("revision_no", targetRevision)
    .maybeSingle();

  if (targetError) return json(500, { error: targetError.message });
  if (!target) return json(404, { error: "Target revision not found" });

  const { data: row, error: rowError } = await serviceClient
    .from("site_content")
    .select("current_revision")
    .eq("key", key)
    .maybeSingle();

  if (rowError) return json(500, { error: rowError.message });

  const nextRevision = (row?.current_revision || 0) + 1;
  const nowIso = new Date().toISOString();

  const { error: updateError } = await serviceClient
    .from("site_content")
    .update({
      payload_draft: target.payload,
      payload_published: target.payload,
      current_revision: nextRevision,
      published_revision: nextRevision,
      updated_by: userId,
      updated_at: nowIso,
      published_by: userId,
      published_at: nowIso,
    })
    .eq("key", key);

  if (updateError) return json(500, { error: updateError.message });

  const { error: publicError } = await serviceClient.from("site_content_public").upsert(
    {
      key,
      payload: target.payload,
      published_revision: nextRevision,
      published_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "key" },
  );

  if (publicError) return json(500, { error: publicError.message });

  await writeRevision(serviceClient, {
    key,
    revisionNo: nextRevision,
    action: "rollback",
    payload: target.payload,
    note,
    actorId: userId,
    meta: { source_revision: target.revision_no },
  });

  await writeAudit(serviceClient, {
    key,
    action: "rollback",
    revisionNo: nextRevision,
    actorId: userId,
    details: { target_revision: target.revision_no, note: note || null },
  });

  return await handleReadOnly(serviceClient, key);
}

async function writeRevision(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    key: string;
    revisionNo: number;
    action: string;
    payload: unknown;
    note?: string;
    actorId: string;
    meta?: Record<string, unknown>;
  },
) {
  await serviceClient.from("site_content_revisions").insert({
    content_key: input.key,
    revision_no: input.revisionNo,
    action: input.action,
    payload: input.payload,
    note: input.note || null,
    actor_id: input.actorId,
    meta: input.meta || {},
  });
}

async function writeAudit(
  serviceClient: ReturnType<typeof createClient>,
  input: {
    key: string;
    action: string;
    revisionNo: number;
    actorId: string;
    details: Record<string, unknown>;
  },
) {
  await serviceClient.from("content_audit_logs").insert({
    content_key: input.key,
    action: input.action,
    revision_no: input.revisionNo,
    actor_id: input.actorId,
    details: input.details,
  });
}
