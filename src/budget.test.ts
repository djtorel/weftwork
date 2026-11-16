// story: e09s01, e09s02, e09s03
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
  const limits = limitsOf({ user: user('budget:\n  max_failures: 2\n  stall_after: 4\n') });
  assert.deepEqual(limits, { maxFailures: 2, stallAfter: 4 });
});

test('the repository file overrides the user file, key by key', () => {
  const limits = limitsOf({
    user: user('budget:\n  max_failures: 2\n  stall_after: 4\n'),
    repo: repo('budget:\n  max_failures: 7\n'),
  });
  assert.deepEqual(limits, { maxFailures: 7, stallAfter: 4 });
});

test('a request value lower than the files is used', () => {
  const limits = limitsOf({ repo: repo('budget:\n  max_failures: 4\n'), request: { maxFailures: 2 } });
  assert.equal(limits.maxFailures, 2);
});

test('a request value higher than the files is ignored', () => {
  const limits = limitsOf({ repo: repo('budget:\n  max_failures: 4\n'), request: { maxFailures: 9 } });
  assert.equal(limits.maxFailures, 4);
});

test('a request value higher than the built-in default is ignored', () => {
  assert.deepEqual(limitsOf({ request: { maxFailures: 20, stallAfter: 9 } }), { maxFailures: 5, stallAfter: 3 });
});

test('a request value equal to the limit gives that limit', () => {
  assert.equal(limitsOf({ request: { stallAfter: 3 } }).stallAfter, 3);
});

test('top-level keys other than budget are ignored', () => {
  const limits = limitsOf({ repo: repo('other: 1\nbudget:\n  stall_after: 2\n') });
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
  assert.deepEqual(limitsOf({ repo: repo('budget:\n  max_failures: 1\n  stall_after: 2\n') }), {
    maxFailures: 1,
    stallAfter: 2,
  });
  assert.deepEqual(limitsOf({ repo: repo('budget:\n  max_failures: 1000\n  stall_after: 1000\n') }), {
    maxFailures: 1000,
    stallAfter: 1000,
  });
});

const refused: [string, string, string][] = [
  ['maxFailures 0', 'budget:\n  max_failures: 0\n', 'budget.max_failures'],
  ['maxFailures 1001', 'budget:\n  max_failures: 1001\n', 'budget.max_failures'],
  ['stallAfter 1', 'budget:\n  stall_after: 1\n', 'budget.stall_after'],
  ['a quoted number', 'budget:\n  max_failures: "2"\n', 'budget.max_failures'],
  ['a fraction', 'budget:\n  max_failures: 2.5\n', 'budget.max_failures'],
  ['an unknown key', 'budget:\n  maxFailure: 2\n', 'budget.maxFailure'],
  ['a budget that is a list', 'budget:\n  - 2\n', 'budget'],
  ['an empty budget', 'budget:\n', 'budget'],
  ['a top level that is a list', '- budget\n', 'mapping'],
  ['a top level that is a scalar', 'budget\n', 'mapping'],
  ['text that is not YAML', 'budget: [\n', 'YAML'],
  ['duplicate keys', 'budget:\n  max_failures: 2\n  max_failures: 3\n', 'YAML'],
  ['two documents', 'budget:\n  max_failures: 2\n---\nother: 1\n', 'YAML'],
];

test('the budget keys are snake_case, as in every other setting, and each sets its limit', () => {
  const text = 'budget:\n  max_failures: 2\n  stall_after: 4\n  max_runs: 9\n  reserve_runs: 1\n';
  assert.deepEqual(limitsOf({ repo: repo(text) }), { maxFailures: 2, stallAfter: 4, maxRuns: 9, reserveRuns: 1 });
});

for (const [old, renamed] of [['maxFailures', 'max_failures'], ['stallAfter', 'stall_after'], ['maxRuns', 'max_runs'], ['reserveRuns', 'reserve_runs']]) {
  test(`the old budget key ${old} is refused with an error that names ${renamed}`, () => {
    const error = errorOf({ user: user(`budget:\n  ${old}: 4\n`) });
    assert.match(error, /^\/home\/u\/\.config\/weftwork\/config\.yaml: /);
    assert.ok(error.includes(`budget.${old} was renamed to budget.${renamed}; rename the key`), error);
  });
}

test('an old budget key is named as renamed even beside an unknown key', () => {
  const error = errorOf({ repo: repo('budget:\n  max_failure: 2\n  maxRuns: 4\n') });
  assert.ok(error.includes('budget.maxRuns was renamed to budget.max_runs'), error);
});

test('an inherited name such as constructor is an unknown key, not a renamed one', () => {
  const error = errorOf({ repo: repo('budget:\n  constructor: 4\n') });
  assert.ok(error.includes('budget.constructor is not a known key'), error);
});

for (const [name, text, key] of refused) {
  test(`the repository file is refused with ${name}, naming the file and ${key}`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(key), error);
  });
}

test('a bad user file is refused and named, even when the repository file is good', () => {
  const error = errorOf({
    user: user('budget:\n  stall_after: 0\n'),
    repo: repo('budget:\n  stall_after: 4\n'),
  });
  assert.match(error, /config\.yaml/);
  assert.ok(error.includes('budget.stall_after'), error);
});

test('an alias bomb is refused as an error value, not a throw (security review F1)', () => {
  const error = errorOf({ repo: repo(aliasBomb()) });
  assert.match(error, /\/repo\/weftwork\.yaml/);
  assert.match(error, /YAML/);
});

test('a YAML error is one line with its position, without the file excerpt (review round 1)', () => {
  const error = errorOf({ repo: repo('budget:\n  max_failures: 2\n  max_failures: 3\n') });
  assert.doesNotMatch(error, /\n/);
  assert.match(error, /Map keys must be unique at line 3, column 3$/);
});

const notPlain: [string, string, string][] = [
  ['a budget that is a !!set', 'budget: !!set {maxFailures}\n', 'budget'],
  ['a budget that is a !!omap', 'budget: !!omap [{max_failures: 2}]\n', 'budget'],
  ['a top level that is a !!set', '!!set {budget}\n', 'mapping'],
  ['a %YAML 1.1 document', '%YAML 1.1\n---\nbudget:\n  max_failures: 010\n', 'YAML 1.1'],
];

for (const [name, text, key] of notPlain) {
  test(`the repository file is refused with ${name} (review round 1)`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(key), error);
  });
}

test('an explicit %YAML 1.2 document is read', () => {
  assert.equal(limitsOf({ repo: repo('%YAML 1.2\n---\nbudget:\n  max_failures: 2\n') }).maxFailures, 2);
});

test('any YAML 1.2 form of a whole number is accepted', () => {
  assert.equal(limitsOf({ repo: repo('budget:\n  max_failures: 2.0\n') }).maxFailures, 2);
  assert.equal(limitsOf({ repo: repo('budget:\n  max_failures: 0x2\n') }).maxFailures, 2);
});

test('more than one YAML document is named plainly, with its position (review round 2)', () => {
  const error = errorOf({ repo: repo('budget: {max_failures: 2}\n---\nx: 1\n') });
  assert.match(error, /holds more than one YAML document at line 2, column 1$/);
  assert.doesNotMatch(error, /parseAllDocuments/);
});

test('a long YAML error is cut to 200 characters (review round 2)', () => {
  const error = errorOf({ repo: repo(`budget: {max_failures: *${'a'.repeat(5000)}}\n`) });
  const reason = error.slice(error.indexOf('not valid YAML: ') + 'not valid YAML: '.length);
  assert.ok(reason.length <= 200, `reason is ${reason.length} characters`);
  assert.match(reason, /…$/);
});

const badDirectives: [string, string][] = [
  ['%YAML 1.0\n---\nbudget: {max_failures: 3}\n', 'YAML version 1.0'],
  ['%YAML 2.0\n---\nbudget: {max_failures: 3}\n', 'YAML version 2.0'],
  ['%FOO bar\n---\nbudget: {max_failures: 3}\n', '%FOO'],
];

for (const [text, named] of badDirectives) {
  test(`a file with ${text.split('\n')[0]} is refused, naming it (review round 3)`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /\/repo\/weftwork\.yaml/);
    assert.ok(error.includes(named), error);
  });
}

test('a long unknown key is cut to 200 characters in the error (review round 3)', () => {
  // An explicit key (?) gets past the yaml package's 1024-character limit
  // on implicit keys, so the whole key reaches the unknown-key check.
  const error = errorOf({ repo: repo(`budget:\n  ? ${'k'.repeat(5000)}\n  : 1\n`) });
  const key = error.slice(error.indexOf('budget.') + 'budget.'.length, error.indexOf(' is not a known key'));
  assert.ok(key.length <= 200, `key is ${key.length} characters`);
  assert.match(key, /…$/);
});

test('the cut never splits a character in two (review round 3)', () => {
  const error = errorOf({ repo: repo(`budget: {max_failures: *${'😀'.repeat(150)}}\n`) });
  // Without the u flag the regex sees code units, so it finds a lone half.
  const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
  assert.doesNotMatch(error, loneSurrogate);
  assert.match(error, /…$/);
});

test('two %YAML lines are refused, even when the last says 1.2 (review round 4)', () => {
  const error = errorOf({ repo: repo('%YAML 1.1\n%YAML 1.2\n---\nbudget: {max_failures: 010}\n') });
  assert.match(error, /\/repo\/weftwork\.yaml/);
  assert.match(error, /more than one %YAML line/);
});

const unresolvedTags: [string, string][] = [
  ['budget: !!seq {max_failures: 2}\n', 'tag:yaml.org,2002:seq'],
  ['budget: !custom {max_failures: 2}\n', '!custom'],
  ['budget:\n  max_failures: !foo 2\n', '!foo'],
];

for (const [text, tag] of unresolvedTags) {
  test(`a tag the parser cannot resolve is refused, naming it: ${tag} (review round 4)`, () => {
    const error = errorOf({ repo: repo(text) });
    assert.match(error, /Unresolved tag/);
    assert.ok(error.includes(tag), error);
  });
}

test('a %TAG directive is still accepted', () => {
  const text = '%TAG !e! tag:example.com,2000:\n---\nbudget: {max_failures: 2}\n';
  assert.equal(limitsOf({ repo: repo(text) }).maxFailures, 2);
});

// e09s02: maxRuns, the loop ceiling. Off unless a source sets it.
test('AC-e09s02-07 with no source setting maxRuns the loop ceiling stays off', () => {
  assert.equal('maxRuns' in limitsOf({ repo: repo('budget:\n  max_failures: 4\n') }), false);
});

test('AC-e09s02-07 a file sets maxRuns, and the repository file overrides the user file', () => {
  assert.equal(limitsOf({ user: user('budget:\n  max_runs: 9\n') }).maxRuns, 9);
  const both = { user: user('budget:\n  max_runs: 9\n'), repo: repo('budget:\n  max_runs: 4\n') };
  assert.equal(limitsOf(both).maxRuns, 4);
});

test('AC-e09s02-07 a request maxRuns lower than the file is used, a higher one is not', () => {
  const file = repo('budget:\n  max_runs: 4\n');
  assert.equal(limitsOf({ repo: file, request: { maxRuns: 2 } }).maxRuns, 2);
  assert.equal(limitsOf({ repo: file, request: { maxRuns: 9 } }).maxRuns, 4);
});

test('AC-e09s02-07 with no file value a request maxRuns turns the ceiling on', () => {
  assert.equal(limitsOf({ request: { maxRuns: 2 } }).maxRuns, 2);
});

test('AC-e09s02-06 maxRuns from 1 to 1000 is accepted', () => {
  assert.equal(limitsOf({ repo: repo('budget:\n  max_runs: 1\n') }).maxRuns, 1);
  assert.equal(limitsOf({ repo: repo('budget:\n  max_runs: 1000\n') }).maxRuns, 1000);
});

for (const value of ['0', '1001', '2.5', '"3"']) {
  test(`AC-e09s02-06 maxRuns ${value} is refused, naming the file and budget.max_runs`, () => {
    const error = errorOf({ repo: repo(`budget:\n  max_runs: ${value}\n`) });
    assert.match(error, /\/repo\/weftwork\.yaml: budget\.max_runs must be an integer from 1 to 1000/);
  });
}

test('AC-e09s02-07 a request maxRuns is checked against the user file as well', () => {
  const file = user('budget:\n  max_runs: 4\n');
  assert.equal(limitsOf({ user: file, request: { maxRuns: 2 } }).maxRuns, 2);
  assert.equal(limitsOf({ user: file, request: { maxRuns: 9 } }).maxRuns, 4);
});

// e09s03: reserveRuns, a file-only key, so the agent cannot turn it off.
test('AC-e09s03-04 reserveRuns from 0 to 1000 is accepted', () => {
  assert.equal(limitsOf({ repo: repo('budget:\n  reserve_runs: 0\n') }).reserveRuns, 0);
  assert.equal(limitsOf({ repo: repo('budget:\n  reserve_runs: 1000\n') }).reserveRuns, 1000);
});

for (const value of ['-1', '1001', '2.5', '"3"']) {
  test(`AC-e09s03-04 reserveRuns ${value} is refused, naming the file and budget.reserve_runs`, () => {
    const error = errorOf({ repo: repo(`budget:\n  reserve_runs: ${value}\n`) });
    assert.match(error, /\/repo\/weftwork\.yaml: budget\.reserve_runs must be an integer from 0 to 1000/);
  });
}

test('AC-e09s03-04 an unknown key error lists reserve_runs as known', () => {
  assert.match(errorOf({ repo: repo('budget:\n  max_failure: 2\n') }), /known: stall_after, max_failures, max_runs, reserve_runs\)/);
});

test('AC-e09s03-05 the repository file reserveRuns overrides the user file', () => {
  assert.equal(limitsOf({ user: user('budget:\n  reserve_runs: 2\n') }).reserveRuns, 2);
  const both = { user: user('budget:\n  reserve_runs: 2\n'), repo: repo('budget:\n  reserve_runs: 1\n') };
  assert.equal(limitsOf(both).reserveRuns, 1);
});

test('AC-e09s03-07 a request reserveRuns is ignored, lower or higher', () => {
  const file = repo('budget:\n  reserve_runs: 2\n');
  assert.equal(limitsOf({ repo: file, request: { reserveRuns: 0 } }).reserveRuns, 2);
  assert.equal(limitsOf({ repo: file, request: { reserveRuns: 9 } }).reserveRuns, 2);
  assert.equal('reserveRuns' in limitsOf({ request: { reserveRuns: 0 } }), false, 'no file: unset');
});
