import { z } from "zod";
import type { ModelClientInterface } from "../model-client.js";
import { GROUNDING_SYSTEM_PROMPT, RECALL_QUESTIONS_PROMPT } from "@hakim/prompts";

export const RecallQuestionsOutputSchema = z.object({
  recallQuestions: z.array(
    z.object({
      question: z.string().min(5),
      idealAnswer: z.string().min(3),
    })
  ).min(1),
  reflectionPrompt: z.string().min(5),
});
export type RecallQuestionsOutput = z.infer<typeof RecallQuestionsOutputSchema>;

export class QuestionGenerator {
  private client: ModelClientInterface;

  constructor(client: ModelClientInterface) {
    this.client = client;
  }

  public async generate(highlightText: string): Promise<RecallQuestionsOutput> {
    const userPrompt = RECALL_QUESTIONS_PROMPT.replace("{{HIGHLIGHT_TEXT}}", highlightText);

    const res = await this.client.generateStructured(
      {
        systemPrompt: GROUNDING_SYSTEM_PROMPT,
        userPrompt,
      },
      RecallQuestionsOutputSchema
    );

    return res.structuredOutput!;
  }
}
