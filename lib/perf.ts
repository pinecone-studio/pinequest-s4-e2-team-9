export function perfLog(label: string, values: Record<string, number | string | undefined>) {
  if (process.env.NODE_ENV === "production" && process.env.PERF_LOGS !== "1") {
    return;
  }

  const details = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  console.info(`[perf:${label}] ${details}`);
}

export function msSince(startedAt: number) {
  return Date.now() - startedAt;
}

export function perfNow() {
  return Date.now();
}
