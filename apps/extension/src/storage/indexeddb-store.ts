import {
  HakimLibrarySnapshotV2Schema,
  type AnnotationUserState,
  type HakimLibrarySnapshotV2,
  type IdentityAlias,
  type LocalAnnotationRecord,
  type LocalBookRecord,
  type MigrationReviewItem,
  type NotionProjection,
  type SnapshotCompleteness,
  type SyncJobV1,
  type SyncRun,
} from "@hakim/domain";

const DB_NAME = "hakim-extension";
const DB_VERSION = 1;

const STORE_NAMES = {
  books: "books",
  annotations: "annotations",
  userStates: "userStates",
  identityAliases: "identityAliases",
  notionProjections: "notionProjections",
  syncRuns: "syncRuns",
  syncJobs: "syncJobs",
  migrationReview: "migrationReview",
  metadata: "metadata",
} as const;

type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES];

interface MetadataRecord {
  key: string;
  value: unknown;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class HakimIndexedDbStore {
  private databasePromise: Promise<IDBDatabase> | undefined;

  public constructor(private readonly indexedDbFactory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDbFactory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAMES.books)) {
          db.createObjectStore(STORE_NAMES.books, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.annotations)) {
          const store = db.createObjectStore(STORE_NAMES.annotations, { keyPath: "id" });
          store.createIndex("bookId", "bookId", { unique: false });
          store.createIndex("sourceAnnotationKey", "sourceAnnotationKey", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.userStates)) {
          db.createObjectStore(STORE_NAMES.userStates, { keyPath: "annotationId" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.identityAliases)) {
          db.createObjectStore(STORE_NAMES.identityAliases, { keyPath: "legacyId" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.notionProjections)) {
          db.createObjectStore(STORE_NAMES.notionProjections, { keyPath: "entityId" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.syncRuns)) {
          db.createObjectStore(STORE_NAMES.syncRuns, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.syncJobs)) {
          db.createObjectStore(STORE_NAMES.syncJobs, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.migrationReview)) {
          db.createObjectStore(STORE_NAMES.migrationReview, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.metadata)) {
          db.createObjectStore(STORE_NAMES.metadata, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open Hakim IndexedDB"));
      request.onblocked = () => reject(new Error("Hakim IndexedDB upgrade is blocked by another extension context"));
    });

    return this.databasePromise;
  }

  private async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.open();
    const transaction = db.transaction(storeName, "readonly");
    const result = await requestResult(transaction.objectStore(storeName).getAll() as IDBRequest<T[]>);
    await transactionDone(transaction);
    return result;
  }

  private async put<T>(storeName: StoreName, value: T): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
  }

  public getBooks(): Promise<LocalBookRecord[]> {
    return this.getAll(STORE_NAMES.books);
  }

  public getAnnotations(): Promise<LocalAnnotationRecord[]> {
    return this.getAll(STORE_NAMES.annotations);
  }

  public getUserStates(): Promise<AnnotationUserState[]> {
    return this.getAll(STORE_NAMES.userStates);
  }

  public getIdentityAliases(): Promise<IdentityAlias[]> {
    return this.getAll(STORE_NAMES.identityAliases);
  }

  public getNotionProjections(): Promise<NotionProjection[]> {
    return this.getAll(STORE_NAMES.notionProjections);
  }

  public getSyncRuns(): Promise<SyncRun[]> {
    return this.getAll(STORE_NAMES.syncRuns);
  }

  public getMigrationReviewItems(): Promise<MigrationReviewItem[]> {
    return this.getAll(STORE_NAMES.migrationReview);
  }

  public putBook(value: LocalBookRecord): Promise<void> {
    return this.put(STORE_NAMES.books, value);
  }

  public putAnnotation(value: LocalAnnotationRecord): Promise<void> {
    return this.put(STORE_NAMES.annotations, value);
  }

  public putUserState(value: AnnotationUserState): Promise<void> {
    return this.put(STORE_NAMES.userStates, value);
  }

  public putIdentityAlias(value: IdentityAlias): Promise<void> {
    return this.put(STORE_NAMES.identityAliases, value);
  }

  public putNotionProjection(value: NotionProjection): Promise<void> {
    return this.put(STORE_NAMES.notionProjections, value);
  }

  public putSyncRun(value: SyncRun): Promise<void> {
    return this.put(STORE_NAMES.syncRuns, value);
  }

  public putMigrationReviewItem(value: MigrationReviewItem): Promise<void> {
    return this.put(STORE_NAMES.migrationReview, value);
  }

  public putSyncJob(value: SyncJobV1): Promise<void> {
    return this.put(STORE_NAMES.syncJobs, value);
  }

  public async applySourceReconciliation(input: {
    books: LocalBookRecord[];
    annotations: LocalAnnotationRecord[];
    userStates: AnnotationUserState[];
    aliases: IdentityAlias[];
    completeness: SnapshotCompleteness;
  }): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(
      [STORE_NAMES.books, STORE_NAMES.annotations, STORE_NAMES.userStates, STORE_NAMES.identityAliases, STORE_NAMES.metadata],
      "readwrite",
    );
    for (const value of input.books) transaction.objectStore(STORE_NAMES.books).put(value);
    for (const value of input.annotations) transaction.objectStore(STORE_NAMES.annotations).put(value);
    for (const value of input.userStates) transaction.objectStore(STORE_NAMES.userStates).put(value);
    for (const value of input.aliases) transaction.objectStore(STORE_NAMES.identityAliases).put(value);
    transaction.objectStore(STORE_NAMES.metadata).put({ key: "lastSnapshotCompleteness", value: input.completeness });
    await transactionDone(transaction);
  }

  public async getSyncJob(id: string): Promise<SyncJobV1 | undefined> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAMES.syncJobs, "readonly");
    const result = await requestResult(
      transaction.objectStore(STORE_NAMES.syncJobs).get(id) as IDBRequest<SyncJobV1 | undefined>
    );
    await transactionDone(transaction);
    return result;
  }

  public async getActiveSyncJob(): Promise<SyncJobV1 | undefined> {
    const jobs = await this.getAll<SyncJobV1>(STORE_NAMES.syncJobs);
    return jobs
      .filter((job) => job.state === "queued" || job.state === "running" || job.state === "paused")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  public async setMetadata(key: string, value: unknown): Promise<void> {
    await this.put<MetadataRecord>(STORE_NAMES.metadata, { key, value });
  }

  public async getMetadata<T>(key: string): Promise<T | undefined> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAMES.metadata, "readonly");
    const result = await requestResult(
      transaction.objectStore(STORE_NAMES.metadata).get(key) as IDBRequest<MetadataRecord | undefined>
    );
    await transactionDone(transaction);
    return result?.value as T | undefined;
  }

  public async removeMetadata(key: string): Promise<void> {
    const db = await this.open();
    const transaction = db.transaction(STORE_NAMES.metadata, "readwrite");
    transaction.objectStore(STORE_NAMES.metadata).delete(key);
    await transactionDone(transaction);
  }

  public async exportSnapshot(completeness?: SnapshotCompleteness): Promise<HakimLibrarySnapshotV2> {
    const snapshot = HakimLibrarySnapshotV2Schema.parse({
      schemaVersion: "2.0",
      exportedAt: new Date().toISOString(),
      source: "hakim_extension",
      completeness: completeness ?? (await this.getMetadata<SnapshotCompleteness>("lastSnapshotCompleteness")) ?? "partial",
      books: await this.getBooks(),
      annotations: await this.getAnnotations(),
      userStates: await this.getUserStates(),
      identityAliases: await this.getIdentityAliases(),
      notionProjections: await this.getNotionProjections(),
      syncRuns: await this.getSyncRuns(),
    });
    return snapshot;
  }

  public async importSnapshot(input: unknown): Promise<HakimLibrarySnapshotV2> {
    const snapshot = HakimLibrarySnapshotV2Schema.parse(input);
    const db = await this.open();
    const stores: StoreName[] = [
      STORE_NAMES.books,
      STORE_NAMES.annotations,
      STORE_NAMES.userStates,
      STORE_NAMES.identityAliases,
      STORE_NAMES.notionProjections,
      STORE_NAMES.syncRuns,
      STORE_NAMES.metadata,
    ];
    const transaction = db.transaction(stores, "readwrite");

    for (const storeName of stores) transaction.objectStore(storeName).clear();
    for (const value of snapshot.books) transaction.objectStore(STORE_NAMES.books).put(value);
    for (const value of snapshot.annotations) transaction.objectStore(STORE_NAMES.annotations).put(value);
    for (const value of snapshot.userStates) transaction.objectStore(STORE_NAMES.userStates).put(value);
    for (const value of snapshot.identityAliases) transaction.objectStore(STORE_NAMES.identityAliases).put(value);
    for (const value of snapshot.notionProjections) transaction.objectStore(STORE_NAMES.notionProjections).put(value);
    for (const value of snapshot.syncRuns) transaction.objectStore(STORE_NAMES.syncRuns).put(value);
    transaction.objectStore(STORE_NAMES.metadata).put({ key: "lastSnapshotCompleteness", value: snapshot.completeness });

    await transactionDone(transaction);
    return snapshot;
  }
}
