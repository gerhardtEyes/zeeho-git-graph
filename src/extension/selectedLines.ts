export type TextSelection = {
  end: { character: number; line: number };
  isEmpty: boolean;
  start: { line: number };
};

/** Return each line touched by one or more selections, without duplicates. */
export function getSelectedLineNumbers(
  selections: ReadonlyArray<TextSelection>,
  lineCount: number
): number[] {
  if (lineCount <= 0) {
    return [];
  }

  const selected = new Set<number>();
  for (const selection of selections) {
    let endLine = selection.end.line;
    if (!selection.isEmpty && selection.end.character === 0 && endLine > selection.start.line) {
      endLine--;
    }

    const startLine = Math.max(0, selection.start.line);
    endLine = Math.min(endLine, lineCount - 1);
    for (let line = startLine; line <= endLine; line++) {
      selected.add(line);
    }
  }

  return [...selected].toSorted((a, b) => a - b);
}
