// story: e12s02
// A line diff for the setup plan, so the owner sees what a re-run would
// change in a file they edited. Every line is printed with ' ', '-' or '+';
// setup files are short, so there are no hunks. docs/SETUP.md.

/** The most lines on one side that are diffed; past it, the diff says so. */
const maxLines = 2000;

/** `before` to `after` as lines marked ' ', '-' and '+', from a longest
 * common subsequence of their lines. */
export function lineDiff(before: string, after: string): string {
  const a = before === '' ? [] : before.replace(/\n$/, '').split('\n');
  const b = after === '' ? [] : after.replace(/\n$/, '').split('\n');
  if (a.length > maxLines || b.length > maxLines) return `(more than ${maxLines} lines; not diffed)`;
  // common[i][j]: the longest common subsequence of a[i..] and b[j..].
  const common = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      common[i][j] = a[i] === b[j] ? common[i + 1][j + 1] + 1 : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push(` ${a[i++]}`);
      j++;
    } else if (j < b.length && (i === a.length || common[i][j + 1] >= common[i + 1][j])) out.push(`+${b[j++]}`);
    else out.push(`-${a[i++]}`);
  }
  return out.join('\n');
}
