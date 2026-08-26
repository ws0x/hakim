import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { ClaimExtractor, QuestionGenerator, type ModelClientInterface, MockModelClient } from "@hakim/intelligence";

export class IntelligenceService {
  private db: DatabaseSync;
  private claimExtractor: ClaimExtractor;
  private questionGenerator: QuestionGenerator;

  constructor(db: DatabaseSync, modelClient?: ModelClientInterface) {
    this.db = db;
    const client = modelClient || new MockModelClient();
    this.claimExtractor = new ClaimExtractor(client);
    this.questionGenerator = new QuestionGenerator(client);
  }

  public async synthesizeAnnotation(annotationId: string): Promise<{ claim: string; questions: string[] }> {
    const annot = this.db
      .prepare("SELECT id, raw_text, source_note FROM annotations WHERE id = ?")
      .get(annotationId) as { id: string; raw_text: string; source_note: string | null } | undefined;

    if (!annot) {
      throw new Error(`Annotation not found: ${annotationId}`);
    }

    // 1. Extract Claim
    const claimResult = await this.claimExtractor.extract(annot.raw_text, annot.source_note || undefined);

    // 2. Generate Recall Questions
    const questionsResult = await this.questionGenerator.generate(annot.raw_text);

    // 3. Save as Insight Draft in SQLite
    const insightId = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO insights (
          id, title, claim, explanation_in_my_words, evidence, counterevidence, my_position,
          confidence, stage, created_at
        ) VALUES (?, ?, ?, ?, ?, '', '', ?, 'ai_draft', ?)`
      )
      .run(
        insightId,
        claimResult.coreClaim.substring(0, 60),
        claimResult.coreClaim,
        questionsResult.reflectionPrompt,
        annot.raw_text,
        claimResult.confidence,
        now
      );

    return {
      claim: claimResult.coreClaim,
      questions: questionsResult.recallQuestions.map((q) => q.question),
    };
  }

  public async synthesizeAllUnprocessed(): Promise<number> {
    const annots = this.db
      .prepare(
        `SELECT a.id FROM annotations a
         LEFT JOIN insights i ON i.evidence = a.raw_text
         WHERE i.id IS NULL LIMIT 20`
      )
      .all() as Array<{ id: string }>;

    let count = 0;
    for (const { id } of annots) {
      await this.synthesizeAnnotation(id);
      count++;
    }

    return count;
  }
}
