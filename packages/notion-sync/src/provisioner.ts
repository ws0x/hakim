import { NOTION_DATABASES } from "./schemas/database-definitions.js";

export interface NotionClientInterface {
  databases: {
    create: (params: { parent: { page_id: string }; title: Array<{ text: { content: string } }>; properties: Record<string, unknown> }) => Promise<{ id: string }>;
    retrieve: (params: { database_id: string }) => Promise<{ id: string; title: Array<{ plain_text?: string; text?: { content: string } }> }>;
  };
}

export interface ProvisioningResult {
  databases: Record<string, string>; // databaseName -> notionDatabaseId
  createdCount: number;
  existingCount: number;
}

export class NotionProvisioner {
  private client: NotionClientInterface;

  constructor(client: NotionClientInterface) {
    this.client = client;
  }

  public async provisionAll(parentPageId: string, existingMapping: Record<string, string> = {}): Promise<ProvisioningResult> {
    const databases: Record<string, string> = { ...existingMapping };
    let createdCount = 0;
    let existingCount = 0;

    for (const [key, spec] of Object.entries(NOTION_DATABASES)) {
      if (databases[key]) {
        try {
          await this.client.databases.retrieve({ database_id: databases[key] });
          existingCount++;
          continue;
        } catch {
          // If previous ID is invalid or deleted, recreate
        }
      }

      const created = await this.client.databases.create({
        parent: { page_id: parentPageId },
        title: [{ text: { content: `Hakim: ${spec.name}` } }],
        properties: spec.properties,
      });

      databases[key] = created.id;
      createdCount++;
    }

    return {
      databases,
      createdCount,
      existingCount,
    };
  }
}
