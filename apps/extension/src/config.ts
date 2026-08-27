import { z } from "zod";

export const AmazonDomainSchema = z.enum([
  "read.amazon.com",
  "read.amazon.co.uk",
  "read.amazon.de",
  "read.amazon.co.jp",
  "read.amazon.ca",
  "read.amazon.com.au",
]);
export type AmazonDomain = z.infer<typeof AmazonDomainSchema>;

export const ExtensionConfigSchema = z.object({
  version: z.literal(2),
  notionParentPageId: z.string().default(""),
  booksDatabaseId: z.string().optional(),
  booksDataSourceId: z.string().optional(),
  highlightsDatabaseId: z.string().optional(),
  highlightsDataSourceId: z.string().optional(),
  legacyBooksDatabaseId: z.string().optional(),
  legacyHighlightsDatabaseId: z.string().optional(),
  amazonDomain: AmazonDomainSchema.default("read.amazon.com"),
  autoSyncIntervalMinutes: z.union([z.literal(0), z.literal(60), z.literal(360), z.literal(720), z.literal(1440)]).default(360),
  notificationsEnabled: z.boolean().default(false),
  migrationApprovedAt: z.string().datetime().optional(),
  secretRiskAcceptedAt: z.string().datetime().optional(),
});
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

export const DEFAULT_CONFIG: ExtensionConfig = ExtensionConfigSchema.parse({ version: 2 });

const CONFIG_KEY = "hakim_config_v2";
const SECRET_KEY = "hakim_notion_secret";
const LEGACY_KEY = "hakim_standalone_config";

interface LegacyConfig {
  notionApiKey?: string;
  notionParentPageId?: string;
  booksDbId?: string;
  highlightsDbId?: string;
  amazonDomain?: string;
  autoSyncIntervalMinutes?: number;
}

export async function restrictStorageAccess(): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local?.setAccessLevel) return;
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export async function migrateLegacyConfig(): Promise<ExtensionConfig> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return DEFAULT_CONFIG;
  const stored = await chrome.storage.local.get([CONFIG_KEY, LEGACY_KEY, SECRET_KEY]);
  const current = ExtensionConfigSchema.safeParse(stored[CONFIG_KEY]);
  if (current.success) return current.data;

  const legacy = (stored[LEGACY_KEY] ?? {}) as LegacyConfig;
  const amazonDomain = AmazonDomainSchema.safeParse(legacy.amazonDomain);
  const interval = [0, 60, 360, 720, 1440].includes(legacy.autoSyncIntervalMinutes ?? -1)
    ? legacy.autoSyncIntervalMinutes
    : 360;
  const migrated = ExtensionConfigSchema.parse({
    version: 2,
    notionParentPageId: legacy.notionParentPageId ?? "",
    legacyBooksDatabaseId: legacy.booksDbId,
    legacyHighlightsDatabaseId: legacy.highlightsDbId,
    amazonDomain: amazonDomain.success ? amazonDomain.data : DEFAULT_CONFIG.amazonDomain,
    autoSyncIntervalMinutes: interval,
  });

  const writes: Record<string, unknown> = { [CONFIG_KEY]: migrated };
  if (!stored[SECRET_KEY] && legacy.notionApiKey?.trim()) writes[SECRET_KEY] = legacy.notionApiKey.trim();
  await chrome.storage.local.set(writes);
  if (legacy.notionApiKey) {
    await chrome.storage.local.set({ [LEGACY_KEY]: { ...legacy, notionApiKey: undefined } });
  }
  return migrated;
}

export async function getConfig(): Promise<ExtensionConfig> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return DEFAULT_CONFIG;
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const parsed = ExtensionConfigSchema.safeParse(stored[CONFIG_KEY]);
  return parsed.success ? parsed.data : migrateLegacyConfig();
}

export async function saveConfig(input: unknown): Promise<ExtensionConfig> {
  const current = await getConfig();
  const next = ExtensionConfigSchema.parse({ ...current, ...(input as Record<string, unknown>), version: 2 });
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    await chrome.storage.local.set({ [CONFIG_KEY]: next });
  }
  return next;
}

export async function getNotionSecret(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return "";
  const stored = await chrome.storage.local.get(SECRET_KEY);
  return typeof stored[SECRET_KEY] === "string" ? stored[SECRET_KEY].trim() : "";
}

export async function saveNotionSecret(secret: string): Promise<void> {
  const trimmed = secret.trim();
  if (!trimmed) throw new Error("Notion secret cannot be empty");
  await chrome.storage.local.set({ [SECRET_KEY]: trimmed });
}

export async function clearNotionSecret(): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) await chrome.storage.local.remove(SECRET_KEY);
}
