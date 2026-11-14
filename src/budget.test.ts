// story: e09s01
// resolveLimits: the built-in limits, overridden by the user file, overridden
// by the repository file; a request value is used only when it is lower. A
// file that cannot be used is an error that names the file and the key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLimits, type BudgetSources } from './budget.ts';
import { aliasBomb } from './test-helpers.ts';

const user = (text: string) => ({ path: '/home/u/.config/weftwork/config.yaml', text });
const repo = (text: string) => ({ path: '/repo/weftwork.yaml', text });

function sources(over: Partial<BudgetSources> = {}): BudgetSources {
  return { user: null, repo: null, request: {}, ...over };
}

function limitsOf(over: Partial<BudgetSources>) {
  const result = resolveLimits(sources(over));
  assert.ok(result.ok, result.ok ? '' : result.error);
  return result.limits;
}

function errorOf(over: Partial<BudgetSources>): string {
  const result = resolveLimits(sources(over));
  assert.equal(result.ok, false, 'expected an error');
  return result.ok ? '' : result.error;
}

test('with no file and no request the limits are the built-in defaults', () => {
  assert.deepEqual(limitsOf({}), { maxFailures: 5, stallAfter: 3 });
});

test('the user file overrides the built-in defaults', () => {
  const limits = limitsOf({ user: user('budget:\n  maxFailures: 2\n  stallAfter: 4\n') });
  assert.deepEqual(limits, { maxFailures: 2, stallAfter: 4 });
});

test('the repository file overrides the user file, key by key', () => {
  const limits = limitsOf({
    user: user('budget:\n  maxFailures: 2\n  stallAfter: 4\n'),
    repo: repo('budget:\n  maxFailures: 7\n'),
  });
  assert.deepEqual(limits, { maxFailures: 7, stallAfter: 4 });
});

test('a request value lower than the files is used', () => {
  const limits = limitsOf({ repo: repo('budget:\n  maxFailures: 4\n'), request: { maxFailures: 2 } });
  assert.equal(limits.maxFailures, 2);
});

test('a request value higher than the files is ignored', () => {
  const limits = limitsOf({ repo: repo('budget:\n  maxFailures: 4\n'), request: { maxFailures: 9 } });
  assert.equal(limits.maxFailures, 4);
});

test('a request value higher than the built-in default is ignored', () => {
  assert.deepEqual(limitsOf({ request: { maxFailures: 20, stallAfter: 9 } }), { maxFailures: 5, stallAfter: 3 });
});

test('a request value equal to the limit gives that limit', () => {
  assert.equal(limitsOf({ request: { stallAfter: 3 } }).stallAfter, 3);
});

test('top-level keys other than budget are ignored', () => {
  const limits = limitsOf({ repo: repo('other: 1\nbudget:\n  stallAfter: 2\n') });
  assert.equal(limits.stallAfter, 2);
});

test('a file with no budget key leaves the limits alone', () => {
  assert.deepEqual(limitsOf({ repo: repo('other: 1\n') }), { maxFailures: 5, stallAfter: 3 });
});

test('an empty file counts as no setting', () => {
  assert.deepEqual(limitsOf({ repo: repo(''), user: user('# only a comment\n') }), {
    maxFailures: 5,
    stallAfter: 3,
  });
});

test('the range boundaries are accepted', () => {
  assert.deepEqual(limitsOf({ repo: repo('budget:\n  maxFailures: 1\n  stallAfter: 2\n') }), {
    maxFailures: 1,
    stallAfter: 2,
  });
  assert.deepEqual(limitsOf({ repo: repo('budget:\n  maxFailures: 1000\n  stallAfter: 1000\n') }), {
    maxFailures: 1000,
    stallAfter: 1000,
  });
});

const refused: [string, string, string][] = [
  ['maxFailures 0', 'budget:\n  maxFailures: 0\n', 'budget.maxFailures'],
  ['maxFailures 1001', 'budget:\n  maxFailures: 1001\n', 'budget.maxFailures'],
  ['stallAfter 1', 'budget:\n  stallAfter: 1\n', 'budget.stallAfter'],
  ['a quoted number', 'budget:\n  maxFailures: "2"\n', 'budget.maxFailures'],
  ['a fraction', 'budget:\n  maxFailures: 2.5\n', 'budget.maxFailures'],
  ['an unknown key', 'budget:\n  maxFailure: 2\n', 'budget.maxFailure'],
  ['a budget that is a list', 'budget:\n  - 2\n', 'budget'],
  ['an empty budget', 'budget:\n', 'budget'],
  ['a top level that is a list', '- budget\n', 'mapping'],
  ['a top level that is a scalar', 'budget\n', 'mapping'],
  ['text that is not YAML', 'budget: [\n', 'YAML'],
  ['duplicate keys', 'budget:\n  maxFailures: 2\n  maxFailures: 3\n', 'YAML'],
  ['two documents', 'budget:\n  maxFailures: 2\n---\nother: 1\n', 'YAML'],
];

for (const [name, text, key] of refused) {
  test(`the repository file is refused with ${name}, naming the file and ${key}`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(key), error);
  });
}

test('a bad user file is refused and named, even when the repository file is good', () => {
  const error = errorOf({
    user: user('budget:\n  stallAfter: 0\n'),
    repo: repo('budget:\n  stallAfter: 4\n'),
  });
  assert.match(error, /config\.yaml/);
  assert.ok(error.includes('budget.stallAfter'), error);
});

test('an alias bomb is refused as an error value, not a throw (security review F1)', () => {
  const error = errorOf({ repo: repo(aliasBomb()) });
  assert.match(error, /\/repo\/weftwork\.yaml/);
  assert.match(error, /YAML/);
});

test('a YAML error is one line with its position, without the file excerpt (review round 1)', () => {
  const error = errorOf({ repo: repo('budget:\n  maxFailures: 2\n  maxFailures: 3\n') });
  assert.doesNotMatch(error, /\n/);
  assert.match(error, /Map keys must be unique at line 3, column 3$/);
});

const notPlain: [string, string, string][] = [
  ['a budget that is a !!set', 'budget: !!set {maxFailures}\n', 'budget'],
  ['a budget that is a !!omap', 'budget: !!omap [{maxFailures: 2}]\n', 'budget'],
  ['a top level that is a !!set', '!!set {budget}\n', 'mapping'],
  ['a %YAML 1.1 document', '%YAML 1.1\n---\nbudget:\n  maxFailures: 010\n', 'YAML 1.1'],
];

for (const [name, text, key] of notPlain) {
  test(`the repository file is refused with ${name} (review round 1)`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(key), error);
  });
}

test('an explicit %YAML 1.2 document is read', () => {
  assert.equal(limitsOf({ repo: repo('%YAML 1.2\n---\nbudget:\n  maxFailures: 2\n') }).maxFailures, 2);
});

test('any YAML 1.2 form of a whole number is accepted', () => {
  assert.equal(limitsOf({ repo: repo('budget:\n  maxFailures: 2.0\n') }).maxFailures, 2);
  assert.equal(limitsOf({ repo: repo('budget:\n  maxFailures: 0x2\n') }).maxFailures, 2);
});

test('more than one YAML document is named plainly, with its position (review round 2)', () => {
  const error = errorOf({ repo: repo('budget: {maxFailures: 2}\n---\nx: 1\n') });
  assert.match(error, /holds more than one YAML document at line 2, column 1$/);
  assert.doesNotMatch(error, /parseAllDocuments/);
});

test('a long YAML error is cut to 200 characters (review round 2)', () => {
  const error = errorOf({ repo: repo(`budget: {maxFailures: *${'a'.repeat(5000)}}\n`) });
  const reason = error.slice(error.indexOf('not valid YAML: ') + 'not valid YAML: '.length);
  assert.ok(reason.length <= 200, `reason is ${reason.length} characters`);
  assert.match(reason, /…$/);
});

const badDirectives: [string, string][] = [
  ['%YAML 1.0\n---\nbudget: {maxFailures: 3}\n', 'YAML version 1.0'],
  ['%YAML 2.0\n---\nbudget: {maxFailures: 3}\n', 'YAML version 2.0'],
  ['%FOO bar\n---\nbudget: {maxFailures: 3}\n', '%FOO'],
];

for (const [text, named] of badDirectives) {
  test(`a file with ${text.split('\n')[0]} is refused, naming it (review round 3)`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(named), error);
  });
}

test('a long unknown key is cut to 200 characters in the error (review round 3)', () => {
  const error = errorOf({ repo: repo(`budget:\n  "${'k'.repeat(5000)}": 1\n`) });
  const key = error.slice(error.indexOf('budget.') + 'budget.'.length, error.indexOf(' is not a known key'));
  assert.ok(key.length <= 200, `key is ${key.length} characters`);
  assert.match(key, /…$/);
});

test('the cut never splits a character in two (review round 3)', () => {
  const error = errorOf({ repo: repo(`budget: {maxFailures: *${'😀'.repeat(150)}}\n`) });
  // Without the u flag the regex sees code units, so it finds a lone half.
  const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  assert.doesNotMatch(error, loneSurrogate);
  assert.match(error, /…$/);
});
