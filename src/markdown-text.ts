// story: e12s03
// Untrusted one-line text for a Markdown file, such as the backlog a
// conversion writes: as plain text, or as a code span. Either way an HTML
// comment, raw HTML, a link, an entity, a stray backtick, asterisk, tilde or
// underscore stays text and does not change how the rest of the file renders
// (CommonMark 0.31 §2.4 backslash escapes, §2.5 entity references, §6.1 code
// spans, §6.2: an underscore inside a word cannot open or close emphasis;
// GFM 0.29 §6.5 strikethrough). docs/CONVERT.md.

/** `text` with `\`, a backtick, `*`, `<`, `[`, `~`, a `&` that starts an
 * entity, and a `_` not inside a word backslash-escaped. */
export function inlineText(text: string): string {
  return text.replace(/[\\`*<[~]|&(?=#?\w+;)|(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\$&');
}

/** `text` as a code span: the fence is one backtick longer than the longest
 * run inside, with a space each side when the text starts or ends with one. */
export function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}
