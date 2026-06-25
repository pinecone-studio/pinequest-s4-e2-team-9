export function isValidOptionLabel(label: string) {
  return label.trim().length > 0;
}

export function isValidAnswerLabel(answer: string, labels: string[]) {
  const normalizedAnswer = answer.trim();

  return labels.some((label) => label.trim() === normalizedAnswer);
}

export function parseScoreRanges(input: string, questionCount: number) {
  const scores = new Map<number, number>();

  for (const chunk of input.split(",")) {
    const [range, pointsText, extra] = chunk.split(":").map((part) => part.trim());
    const points = Number(pointsText);

    if (!range || !pointsText || extra !== undefined || !Number.isFinite(points) || points <= 0) {
      continue;
    }

    const [start, end = start] = range.split("-").map((part) => Number(part.trim()));

    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end > questionCount ||
      start > end
    ) {
      continue;
    }

    for (let question = start; question <= end; question += 1) {
      scores.set(question, points);
    }
  }

  return scores;
}
