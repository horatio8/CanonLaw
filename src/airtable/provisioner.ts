/**
 * Base provisioner — translates `schema/airtable-schema.json` into Airtable
 * Metadata API calls, creating tables and fields. Handles the link-field
 * circularity (Persons ↔ Cases, Tribunals → Tribunals) with a two-pass
 * strategy:
 *
 *   Pass 1 — create every table carrying only its NON-link fields.
 *   Pass 2 — add link fields by `linkedTableId` once all tables exist.
 *
 * Can also upsert into an existing base: tables that already exist are left
 * in place; missing tables/fields are added. The provisioner never destroys
 * data.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { AirtableClient, BaseSchema } from "./client.ts";

// Resolve the shipped schema file relative to THIS file so the package is
// runnable wherever it's installed.
const here = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(here, "..", "..", "schema", "airtable-schema.json");
const SEED_GROUNDS_PATH = join(here, "..", "..", "schema", "seed-grounds.json");

export interface SchemaFieldSpec {
  name: string;
  type: string;
  description?: string;
  options?: {
    choices?: Array<{ name: string }>;
    linkedTableName?: string;
  };
}

export interface SchemaTableSpec {
  name: string;
  description?: string;
  fields: SchemaFieldSpec[];
}

export interface SchemaSpec {
  base: { name: string; description?: string };
  tables: SchemaTableSpec[];
}

export interface ProvisionResult {
  baseId: string;
  baseName: string;
  /** Logical table name → Airtable tableId. */
  tableIds: Record<string, string>;
  /** Tables that already existed and were left untouched. */
  preexistingTables: string[];
  /** Tables that were created fresh. */
  createdTables: string[];
  /** Fields that were added to existing tables. */
  addedFields: Array<{ table: string; field: string }>;
  /** Any warnings (e.g. choice sets that differ). */
  warnings: string[];
}

export function loadSchemaSpec(): SchemaSpec {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as SchemaSpec;
}

export function loadSeedGrounds(): Array<{
  canonReference: string;
  shortName: string;
  category: string;
  description: string;
  expertUsuallyRequired: boolean;
}> {
  return JSON.parse(readFileSync(SEED_GROUNDS_PATH, "utf8"));
}

/** Partition fields by whether they reference other tables. */
function splitFields(fields: SchemaFieldSpec[]): {
  nonLink: SchemaFieldSpec[];
  link: SchemaFieldSpec[];
} {
  const nonLink: SchemaFieldSpec[] = [];
  const link: SchemaFieldSpec[] = [];
  for (const f of fields) {
    if (f.type === "multipleRecordLinks") link.push(f);
    else nonLink.push(f);
  }
  return { nonLink, link };
}

/**
 * Translate a schema-file field into the payload the Airtable Metadata API
 * expects. For link fields the caller must inject the resolved linkedTableId.
 */
function toApiField(f: SchemaFieldSpec, linkedTableId?: string) {
  const base: { name: string; type: string; description?: string; options?: Record<string, unknown> } = {
    name: f.name,
    type: f.type,
  };
  if (f.description) base.description = f.description;
  if (f.type === "singleSelect" || f.type === "multipleSelects") {
    base.options = { choices: f.options?.choices ?? [] };
  } else if (f.type === "multipleRecordLinks") {
    if (!linkedTableId) {
      throw new Error(`Link field "${f.name}" missing linkedTableId.`);
    }
    base.options = { linkedTableId };
  }
  return base;
}

/**
 * Provision a brand-new base in the given workspace from our schema JSON.
 * Creates the base + all non-link fields in one call, then a second pass
 * to add the link fields.
 */
export async function provisionNewBase(
  client: AirtableClient,
  workspaceId: string,
  spec: SchemaSpec = loadSchemaSpec(),
): Promise<ProvisionResult> {
  // Pass 1: build a CreateBase request where every table has only non-link fields.
  // Airtable requires each table to have at least one field; our schemas all
  // have a non-link primary field first, so this is safe.
  const createReq = {
    name: spec.base.name,
    workspaceId,
    tables: spec.tables.map((t) => {
      const table: {
        name: string;
        description?: string;
        fields: ReturnType<typeof toApiField>[];
      } = {
        name: t.name,
        fields: splitFields(t.fields).nonLink.map((f) => toApiField(f)),
      };
      if (t.description !== undefined) table.description = t.description;
      return table;
    }),
  };
  const created = await client.createBase(createReq);

  const tableIds: Record<string, string> = {};
  for (const t of created.tables) tableIds[t.name] = t.id;

  // Pass 2: add link fields now that every target has an id.
  for (const t of spec.tables) {
    const { link } = splitFields(t.fields);
    if (link.length === 0) continue;
    const tid = tableIds[t.name];
    if (!tid) throw new Error(`Missing table id for ${t.name} after creation.`);
    for (const f of link) {
      const target = f.options?.linkedTableName;
      if (!target) throw new Error(`Link field ${t.name}.${f.name} missing linkedTableName.`);
      const linkedId = tableIds[target];
      if (!linkedId) throw new Error(`Cannot resolve linked table "${target}".`);
      await client.createField(created.id, tid, toApiField(f, linkedId));
    }
  }

  return {
    baseId: created.id,
    baseName: spec.base.name,
    tableIds,
    preexistingTables: [],
    createdTables: spec.tables.map((t) => t.name),
    addedFields: [],
    warnings: [],
  };
}

/**
 * Upsert our schema into an EXISTING base. Creates any missing tables and
 * appends any missing fields. Never modifies or deletes existing data.
 */
export async function provisionExistingBase(
  client: AirtableClient,
  baseId: string,
  spec: SchemaSpec = loadSchemaSpec(),
): Promise<ProvisionResult> {
  const existing: BaseSchema = await client.getBaseSchema(baseId);
  const tableIds: Record<string, string> = {};
  const preexistingTables: string[] = [];
  const createdTables: string[] = [];
  const addedFields: Array<{ table: string; field: string }> = [];
  const warnings: string[] = [];

  // Pass 1: ensure every table exists with its non-link fields.
  for (const t of spec.tables) {
    const existingTable = existing.tables.find((x) => x.name === t.name);
    if (existingTable) {
      tableIds[t.name] = existingTable.id;
      preexistingTables.push(t.name);
      // Add any missing non-link fields.
      const nonLink = splitFields(t.fields).nonLink;
      for (const f of nonLink) {
        if (existingTable.fields.some((x) => x.name === f.name)) continue;
        await client.createField(baseId, existingTable.id, toApiField(f));
        addedFields.push({ table: t.name, field: f.name });
      }
    } else {
      const created = await client.createTable(baseId, {
        name: t.name,
        ...(t.description !== undefined ? { description: t.description } : {}),
        fields: splitFields(t.fields).nonLink.map((f) => toApiField(f)),
      });
      tableIds[t.name] = created.id;
      createdTables.push(t.name);
    }
  }

  // Pass 2: add link fields.
  for (const t of spec.tables) {
    const tid = tableIds[t.name]!;
    const links = splitFields(t.fields).link;
    if (links.length === 0) continue;
    // Re-fetch the table's fields so we don't duplicate what's already there.
    const current = (await client.getBaseSchema(baseId)).tables.find((x) => x.id === tid);
    if (!current) {
      warnings.push(`Table ${t.name} vanished after creation — skipping link pass.`);
      continue;
    }
    for (const f of links) {
      if (current.fields.some((x) => x.name === f.name)) continue;
      const target = f.options?.linkedTableName;
      if (!target) {
        warnings.push(`Link field ${t.name}.${f.name} missing linkedTableName.`);
        continue;
      }
      const linkedId = tableIds[target];
      if (!linkedId) {
        warnings.push(`Cannot resolve link target "${target}" for ${t.name}.${f.name}.`);
        continue;
      }
      await client.createField(baseId, tid, toApiField(f, linkedId));
      addedFields.push({ table: t.name, field: f.name });
    }
  }

  return {
    baseId,
    baseName: spec.base.name,
    tableIds,
    preexistingTables,
    createdTables,
    addedFields,
    warnings,
  };
}

/**
 * Seed the Grounds of Nullity table with the 28 canonical grounds shipped in
 * `schema/seed-grounds.json`. Skips grounds already present by canon reference.
 */
export async function seedGrounds(
  client: AirtableClient,
  baseId: string,
  tableIds: Record<string, string>,
): Promise<{ inserted: number; skipped: number }> {
  const tableId = tableIds["Grounds of Nullity"];
  if (!tableId) throw new Error("Grounds of Nullity table not found.");
  const data = loadSeedGrounds();

  // Map our category enum to the Airtable singleSelect choice names.
  const categoryMap: Record<string, string> = {
    DefectOfConsent: "Defect of Consent",
    Impediment: "Impediment",
    DefectOfForm: "Defect of Form",
    DefectOfMandate: "Defect of Mandate",
    PriorBond: "Prior Bond",
    Condition: "Condition",
    Simulation: "Simulation",
    ForceFear: "Force-Fear",
    Error: "Error",
  };

  const records = data.map((g) => ({
    "Canon Reference": g.canonReference,
    "Short Name": g.shortName,
    Category: categoryMap[g.category] ?? g.category,
    Description: g.description,
    "Expert Usually Required": g.expertUsuallyRequired,
  }));

  const created = await client.createRecords(baseId, tableId, records);
  return { inserted: created.length, skipped: 0 };
}
