import { AnswerKey } from "./types";

export function parseAnswerKey(input: string): AnswerKey[] {
  const results: AnswerKey[] = [];
  const trimmed = input.trim();
  if (!trimmed) return results;

  const parts = trimmed.split(/\s+/);
  for (const part of parts) {
    const match = part.match(/^(\d+)([A-Da-d])$/);
    if (!match) continue;
    const question = parseInt(match[1], 10);
    const answer = match[2].toUpperCase();
    if (!["A", "B", "C", "D"].includes(answer)) continue;
    results.push({ question, answer: answer as "A" | "B" | "C" | "D" });
  }

  return results.sort((a, b) => a.question - b.question);
}
