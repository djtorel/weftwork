// story: e12s03
// Untrusted text written into a Markdown file stays text: an HTML comment,
// raw HTML, a stray backtick or asterisk does not change how the rest renders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeSpan, inlineText } from './markdown-text.ts';

test('AC-e12s03-04 inline text escapes backslash, backtick, asterisk and <, and leaves the rest', () => {
  assert.equal(inlineText('Pay <!-- now'), 'Pay \\<!-- now');
  assert.equal(inlineText('a `b * c\\d'), 'a \\`b \\* c\\\\d');
  assert.equal(inlineText('Hotfix (INSERTED). 02-01_x'), 'Hotfix (INSERTED). 02-01_x');
});

test('AC-e12s03-05 a code span is fenced longer than any backtick run inside, padded when it starts or ends with one', () => {
  assert.equal(codeSpan('npm test'), '`npm test`');
  assert.equal(codeSpan('echo `date`'), '`` echo `date` ``');
  assert.equal(codeSpan('a``b'), '```a``b```');
  assert.equal(codeSpan('<!-- x'), '`<!-- x`');
});
