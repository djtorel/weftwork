// story: e12s03
// Untrusted one-line text for a Markdown file, such as the backlog a
// conversion writes: as plain text, or as a code span. Either way an HTML
// comment, raw HTML, a stray backtick or asterisk stays text and does not
// change how the rest of the file renders (CommonMark 0.31 §2.4 backslash
// escapes, §6.1 code spans). docs/CONVERT.md.

/** `text` with `\`, a backtick, `*` and `<` backslash-escaped. */
export function inlineText(text: string): string {
  return text.replace(/[\\`*<]/g, '\\$&');
}

/** `text` as a code span: the fence is one backtick longer than the longest
 * run inside, with a space each side when the text starts or ends with one. */
export function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}
