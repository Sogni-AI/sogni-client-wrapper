function integerArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: number[] = [];
  for (const entry of value) {
    if (typeof entry !== 'number' || !Number.isInteger(entry)) return null;
    parsed.push(entry);
  }
  return parsed;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const parsed: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    parsed.push(entry);
  }
  return parsed;
}

export function expandSingleSourceFanOutForPerClipPrompts(args: Record<string, unknown>): boolean {
  const prompts = stringArray(args.prompts);
  if (!prompts || prompts.length <= 1) return false;

  const sourceImageIndices = integerArray(args.sourceImageIndices);
  if (!sourceImageIndices || sourceImageIndices.length !== 1) return false;

  args.sourceImageIndices = Array.from(
    { length: prompts.length },
    () => sourceImageIndices[0],
  );

  const endImageIndices = integerArray(args.endImageIndices);
  if (endImageIndices?.length === 1) {
    args.endImageIndices = Array.from(
      { length: prompts.length },
      () => endImageIndices[0],
    );
  }

  return true;
}
