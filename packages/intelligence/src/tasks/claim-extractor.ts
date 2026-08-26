import { z } from "zod";
import type { ModelClientInterface } from "../model-client.js";
import { GROUNDING_SYSTEM_PROMPT, CLAIM_EXTRACTION_PROMPT } from "@hakim/prompts";

export const ExtractedClaimOutputSchema = z.object({
  coreClaim: z.string().min(5),
  category: z.enum(["principle", "mental_model", "empirical_fact", "advice", "reflection"]),
  confidence: z.number().min(0).max(1),
  keyKeywords: z.array(z.string()).min(1),
});
export type ExtractedClaimOutput = z.infer<typeof ExtractedClaimOutputSchema>;

export class ClaimExtractor {
  private client: ModelClientInterface;

  constructor(client: ModelClientInterface) {
    this.client = client;
  }

  public async extract(highlightText: string, userNote?: string): Promise<ExtractedClaimOutput> {
    const userNoteSection = userNote ? `\nUser's Accompanying Note:\n"""\n${userNote}\n"""` : "";
    const userPrompt = CLAIM_EXTRACTION_PROMPT
      .replace("{{HIGHLIGHT_TEXT}}", highlightText)
      .replace("{{USER_NOTE_SECTION}}", userNoteSection);

    const res = await this.client.generateStructured(
      {
        systemPrompt: GROUNDING_SYSTEM_PROMPT,
        userPrompt,
      },
      ExtractedClaimOutputSchema
    );

    return res.structuredOutput!;
  }
}
