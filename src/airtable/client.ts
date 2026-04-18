/**
 * Minimal Airtable REST + Metadata client.
 *
 * Docs:
 *   https://airtable.com/developers/web/api/list-bases
 *   https://airtable.com/developers/web/api/create-base
 *   https://airtable.com/developers/web/api/create-table
 *   https://airtable.com/developers/web/api/create-field
 */

const META_BASE = "https://api.airtable.com/v0/meta";
const DATA_BASE = "https://api.airtable.com/v0";

export interface BaseSummary {
  id: string;
  name: string;
  permissionLevel: "none" | "read" | "comment" | "edit" | "create";
}

export interface TableSummary {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: FieldSummary[];
}

export interface FieldSummary {
  id: string;
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

export interface BaseSchema {
  tables: TableSummary[];
}

export interface CreateBaseRequest {
  name: string;
  workspaceId: string;
  tables: Array<{
    name: string;
    description?: string;
    fields: Array<{ name: string; type: string; description?: string; options?: Record<string, unknown> }>;
  }>;
}

export interface CreateBaseResponse {
  id: string;
  tables: Array<{ id: string; name: string; fields: Array<{ id: string; name: string }> }>;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
}

export class AirtableClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async req<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable ${res.status} ${res.statusText}: ${body}`);
    }
    // Some DELETE endpoints return empty body.
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  /** List all bases the token can access. Paginates transparently. */
  async listBases(): Promise<BaseSummary[]> {
    const bases: BaseSummary[] = [];
    let offset: string | undefined;
    do {
      const url = new URL(`${META_BASE}/bases`);
      if (offset) url.searchParams.set("offset", offset);
      const page = await this.req<{ bases: BaseSummary[]; offset?: string }>(url.toString());
      bases.push(...page.bases);
      offset = page.offset;
    } while (offset);
    return bases;
  }

  async getBaseSchema(baseId: string): Promise<BaseSchema> {
    return this.req<BaseSchema>(`${META_BASE}/bases/${baseId}/tables`);
  }

  async createBase(req: CreateBaseRequest): Promise<CreateBaseResponse> {
    return this.req<CreateBaseResponse>(`${META_BASE}/bases`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async createTable(
    baseId: string,
    table: CreateBaseRequest["tables"][number],
  ): Promise<{ id: string; name: string; fields: Array<{ id: string; name: string }> }> {
    return this.req(`${META_BASE}/bases/${baseId}/tables`, {
      method: "POST",
      body: JSON.stringify(table),
    });
  }

  async createField(
    baseId: string,
    tableId: string,
    field: { name: string; type: string; description?: string; options?: Record<string, unknown> },
  ): Promise<{ id: string; name: string }> {
    return this.req(`${META_BASE}/bases/${baseId}/tables/${tableId}/fields`, {
      method: "POST",
      body: JSON.stringify(field),
    });
  }

  /** Data API: create one record. */
  async createRecord<T extends Record<string, unknown>>(
    baseId: string,
    tableIdOrName: string,
    fields: T,
  ): Promise<{ id: string; fields: T }> {
    return this.req<{ id: string; fields: T }>(
      `${DATA_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
      { method: "POST", body: JSON.stringify({ fields, typecast: true }) },
    );
  }

  /** Data API: create up to 10 records per request. */
  async createRecords<T extends Record<string, unknown>>(
    baseId: string,
    tableIdOrName: string,
    records: T[],
  ): Promise<Array<{ id: string; fields: T }>> {
    const all: Array<{ id: string; fields: T }> = [];
    for (let i = 0; i < records.length; i += 10) {
      const chunk = records.slice(i, i + 10);
      const res = await this.req<{ records: Array<{ id: string; fields: T }> }>(
        `${DATA_BASE}/${baseId}/${encodeURIComponent(tableIdOrName)}`,
        {
          method: "POST",
          body: JSON.stringify({
            records: chunk.map((f) => ({ fields: f })),
            typecast: true,
          }),
        },
      );
      all.push(...res.records);
    }
    return all;
  }

  /**
   * Airtable's /meta/whoami returns the authenticated user. Helpful for showing
   * "Signed in as ..." in the UI.
   */
  async whoAmI(): Promise<{ id: string; email?: string; scopes?: string[] }> {
    return this.req(`${META_BASE}/whoami`);
  }
}
