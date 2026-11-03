#!/usr/bin/env node
// Normalizes raw `n8n export:workflow` output into the committed files under
// n8n/workflows/. Keeps the workflow `id` (other workflows reference it through
// settings.errorWorkflow) and strips instance-specific or sensitive fields.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , exportDir, outDir] = process.argv;
if (!exportDir || !outDir) {
  console.error("usage: n8n-clean-export.mjs <export-dir> <out-dir>");
  process.exit(1);
}

// Stable ids are set in the committed JSON; map them to the documented filenames.
const FILENAMES = {
  LLloanNotify0001: "request-notification.json",
  LLoverdueRemind1: "overdue-reminders.json",
  LLerrorHandler01: "error-handler.json",
};

const STRIP = [
  "versionId",
  "activeVersionId",
  "versionCounter",
  "pinData",
  "staticData", // holds runtime dedupe state, never commit it
  "shared",
  "createdAt",
  "updatedAt",
  "triggerCount",
  "isArchived",
  "parentFolderId",
  "activeVersion",
  "versionMetadata",
  "sourceWorkflowId",
];

for (const file of readdirSync(exportDir).filter((f) => f.endsWith(".json"))) {
  const wf = JSON.parse(readFileSync(join(exportDir, file), "utf8"));
  for (const key of STRIP) delete wf[key];
  if (wf.meta) {
    delete wf.meta.instanceId;
    if (Object.keys(wf.meta).length === 0) delete wf.meta;
  }
  // Drop empty noise so diffs only show real changes.
  for (const [key, value] of Object.entries(wf)) {
    if (value === null || (Array.isArray(value) && value.length === 0 && key !== "tags")) delete wf[key];
  }
  wf.active = false;
  for (const node of wf.nodes ?? []) {
    // Credentials are referenced by id/name only; drop anything else defensively.
    for (const [type, ref] of Object.entries(node.credentials ?? {})) {
      node.credentials[type] = { id: ref.id, name: ref.name };
    }
  }

  const name =
    FILENAMES[wf.id] ??
    `${wf.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
  writeFileSync(join(outDir, name), JSON.stringify(wf, null, 2) + "\n");
  console.log(`wrote ${join(outDir, name)}`);
}

rmSync(exportDir, { recursive: true, force: true });
