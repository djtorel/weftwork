// story: e13s04
// The TAP reading of the base check (docs/BASE-CHECK.md): when a test file's
// run on the base prints TAP, the leaf tests and whether each passed, so one
// weak new test in a file that also has a strong one is seen. TAP names
// itself (a version line or a plan line), so no runner-specific code and no
// setting are needed: the owner's proof.run prints TAP or it does not.

export type TapTest = { name: string; passed: boolean };

const version = /^TAP version \d+\s*$/;
const plan = /^1\.\.\d+/;
const point = /^(\s*)(not ok|ok)\b(?:\s+\d+)?(?:\s+-)?\s*(.*)$/;

/** The text before the first `#` that has no backslash in front: the name. */
function splitDirective(rest: string): { name: string; directive: string } {
  const at = rest.search(/(?<!\\)#/);
  if (at === -1) return { name: rest.trim(), directive: '' };
  return { name: rest.slice(0, at).trim(), directive: rest.slice(at + 1).trim() };
}

/** Undo the escapes a TAP producer puts in a name (`\#`, `\\`, `\n`). */
function unescape(name: string): string {
  return name.replace(/\\(.)/g, (_, char: string) => (char === 'n' ? '\n' : char));
}

/**
 * The leaf tests of a TAP run, in order, or null when the output is not TAP.
 * A test point is a parent (a suite or a test with subtests) when the point
 * just before it is nested deeper: TAP prints the subtests first. SKIP and
 * TODO points and the YAML blocks after points are left out.
 */
export function tapTests(output: string): TapTest[] | null {
  const lines = output.split('\n');
  if (!lines.some((line) => version.test(line) || plan.test(line))) return null;
  const points: { indent: number; name: string; passed: boolean; counts: boolean }[] = [];
  let yamlIndent: number | null = null;
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (yamlIndent !== null) {
      if (line.trim() === '...' && indent === yamlIndent) yamlIndent = null;
      continue;
    }
    if (line.trim() === '---' && points.length > 0) {
      yamlIndent = indent;
      continue;
    }
    const match = point.exec(line);
    if (match === null) continue;
    const { name, directive } = splitDirective(match[3] ?? '');
    const counts = !/^(skip|todo)\b/i.test(directive);
    points.push({ indent, name: unescape(name), passed: match[2] === 'ok', counts });
  }
  return points
    .filter((test, i) => test.counts && !(i > 0 && (points[i - 1]?.indent ?? 0) > test.indent))
    .map(({ name, passed }) => ({ name, passed }));
}
