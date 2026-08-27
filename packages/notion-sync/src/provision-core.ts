import { BOOK_CORE_PROPERTIES, BOOK_PROPERTY_NAMES, HIGHLIGHT_CORE_PROPERTIES, HIGHLIGHT_PROPERTY_NAMES } from "./core-schema.js";
import type { NotionApiClient } from "./client.js";

interface CreatedDatabaseResponse {
  id: string;
  data_sources?: Array<{ id: string; name?: string }>;
}

export interface CoreWorkspaceIds {
  booksDatabaseId: string;
  booksDataSourceId: string;
  highlightsDatabaseId: string;
  highlightsDataSourceId: string;
}

function firstDataSourceId(response: CreatedDatabaseResponse, label: string): string {
  const id = response.data_sources?.[0]?.id;
  if (!id) throw new Error(`Notion did not return an initial data source for ${label}`);
  return id;
}

export async function provisionCoreWorkspace(
  client: NotionApiClient,
  parentPageId: string,
): Promise<CoreWorkspaceIds> {
  const booksDatabase = await client.request<CreatedDatabaseResponse>("/databases", "POST", {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Hakim: Books" } }],
    icon: { type: "emoji", emoji: "📖" },
    initial_data_source: { properties: BOOK_CORE_PROPERTIES },
  });
  const booksDataSourceId = firstDataSourceId(booksDatabase, "Books");

  const highlightsProperties = {
    ...HIGHLIGHT_CORE_PROPERTIES,
    [HIGHLIGHT_PROPERTY_NAMES.book]: {
      relation: {
        data_source_id: booksDataSourceId,
        dual_property: { synced_property_name: BOOK_PROPERTY_NAMES.highlights },
      },
    },
  };
  const highlightsDatabase = await client.request<CreatedDatabaseResponse>("/databases", "POST", {
    parent: { type: "page_id", page_id: parentPageId },
    title: [{ type: "text", text: { content: "Hakim: Highlights" } }],
    icon: { type: "emoji", emoji: "💡" },
    initial_data_source: { properties: highlightsProperties },
  });
  const highlightsDataSourceId = firstDataSourceId(highlightsDatabase, "Highlights");

  return {
    booksDatabaseId: booksDatabase.id,
    booksDataSourceId,
    highlightsDatabaseId: highlightsDatabase.id,
    highlightsDataSourceId,
  };
}
