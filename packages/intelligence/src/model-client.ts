import { z } from "zod";

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  responseSchema?: z.ZodTypeAny;
}

export interface LLMResponse<T = unknown> {
  rawText: string;
  structuredOutput?: T;
  model: string;
}

export interface ModelClientInterface {
  generateStructured<T>(request: LLMRequest, schema: z.ZodType<T>): Promise<LLMResponse<T>>;
}

/**
 * Mock / Test Double Model Client for deterministic evaluation
 */
export class MockModelClient implements ModelClientInterface {
  private customHandler?: (req: LLMRequest) => unknown;

  constructor(customHandler?: (req: LLMRequest) => unknown) {
    this.customHandler = customHandler;
  }

  public async generateStructured<T>(request: LLMRequest, schema: z.ZodType<T>): Promise<LLMResponse<T>> {
    let output: unknown;
    if (this.customHandler) {
      output = this.customHandler(request);
    } else if (request.userPrompt.includes("active recall") || request.userPrompt.includes("recallQuestions")) {
      output = {
        recallQuestions: [
          {
            question: "What defines high-leverage activities?",
            idealAnswer: "Activities that produce disproportionate impact per unit time.",
          },
        ],
        reflectionPrompt: "Identify one task you did this week that could be automated or delegated.",
      };
    } else {
      // Default claim response
      output = {
        coreClaim: "High leverage activities drive disproportionate career and engineering output.",
        category: "principle",
        confidence: 0.95,
        keyKeywords: ["leverage", "productivity", "engineering"],
      };
    }

    const validated = schema.parse(output);
    return {
      rawText: JSON.stringify(validated),
      structuredOutput: validated,
      model: "mock-llm-v1",
    };
  }
}
