// Stage 2 (§5.2): LLM extraction, run ONLY on candidates Stage 1 could not
// resolve. The contract (schema, prompt, parser, review threshold) is the
// ported v1 module `src/engine/extraction.ts` — this file is just the
// Claude API transport around it.

import Anthropic from "@anthropic-ai/sdk";
import {
  AUTO_ACCEPT_CONFIDENCE,
  EXTRACTION_SYSTEM_PROMPT,
  parseExtraction,
  type ExtractedCharge,
} from "@/engine/extraction";

/** Minimal model surface, injectable for tests — returns the raw text reply. */
export interface ExtractionModel {
  complete(input: { from: string; subject: string; body: string }): Promise<string>;
}

export class ClaudeExtractionModel implements ExtractionModel {
  constructor(
    private client: Anthropic = new Anthropic(),
    private model = "claude-haiku-4-5-20251001",
  ) {}

  async complete(input: { from: string; subject: string; body: string }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `From: ${input.from}\nSubject: ${input.subject}\n\n${input.body.slice(0, 8000)}`,
        },
      ],
    });
    const text = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    return text?.text ?? "null";
  }
}

export interface Stage2Outcome {
  charge: ExtractedCharge | null; // null = not a billing email / unusable reply
  needsReview: boolean;
}

export async function runStage2(
  model: ExtractionModel,
  input: { from: string; subject: string; body: string },
): Promise<Stage2Outcome> {
  const raw = await model.complete(input);
  const charge = parseExtraction(raw);
  if (!charge) return { charge: null, needsReview: false };
  return { charge, needsReview: charge.confidence < AUTO_ACCEPT_CONFIDENCE };
}
