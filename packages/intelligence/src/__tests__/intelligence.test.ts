import { describe, it, expect } from "vitest";
import { ClaimExtractor } from "../tasks/claim-extractor.js";
import { QuestionGenerator } from "../tasks/question-generator.js";
import { MockModelClient } from "../model-client.js";

describe("Reading Intelligence Pipeline", () => {
  it("extracts structured claims from highlights with high confidence", async () => {
    const mockClient = new MockModelClient(() => ({
      coreClaim: "Prioritize activities that yield compounding returns on your effort.",
      category: "principle",
      confidence: 0.96,
      keyKeywords: ["leverage", "compounding", "prioritization"],
    }));

    const extractor = new ClaimExtractor(mockClient);
    const result = await extractor.extract(
      "Focus on high-leverage activities that produce outsized value per unit time."
    );

    expect(result.coreClaim).toContain("compounding returns");
    expect(result.category).toBe("principle");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.keyKeywords.length).toBe(3);
  });

  it("extracts structured Arabic claims faithfully", async () => {
    const mockClient = new MockModelClient(() => ({
      coreClaim: "العاقل يرتب أولوياته ويحاسب نفسه باستمرار.",
      category: "principle",
      confidence: 0.98,
      keyKeywords: ["محاسبة النفس", "الوقت", "الأولويات"],
    }));

    const extractor = new ClaimExtractor(mockClient);
    const result = await extractor.extract(
      "العاقل من حاسب نفسه وميز بين ما ينفعه وما يضره، ورتب وقته لأولوياته."
    );

    expect(result.coreClaim).toContain("العاقل يرتب أولوياته");
    expect(result.keyKeywords).toContain("محاسبة النفس");
  });

  it("generates active recall questions and reflection prompts", async () => {
    const mockClient = new MockModelClient(() => ({
      recallQuestions: [
        {
          question: "What defines high-leverage activities?",
          idealAnswer: "Activities that produce disproportionate impact per unit of time invested.",
        },
      ],
      reflectionPrompt: "Identify one task you did this week that could be automated or delegated.",
    }));

    const generator = new QuestionGenerator(mockClient);
    const result = await generator.generate(
      "Focus on high-leverage activities that produce outsized value per unit time."
    );

    expect(result.recallQuestions.length).toBe(1);
    expect(result.recallQuestions[0]?.question).toContain("What defines high-leverage activities?");
    expect(result.reflectionPrompt).toContain("Identify one task you did this week");
  });

  it("rejects malformed model outputs that violate Zod schema", async () => {
    const brokenClient = new MockModelClient(() => ({
      coreClaim: "Too short", // valid string, but category is missing
      confidence: 5.0, // invalid (must be <= 1.0)
    }));

    const extractor = new ClaimExtractor(brokenClient);
    await expect(extractor.extract("Some highlight")).rejects.toThrow();
  });
});
