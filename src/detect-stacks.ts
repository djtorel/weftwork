// story: e12s01
// What one stack's files say: languages, package managers, frameworks and the
// commands to test, lint, typecheck, build and run. Pure: each reader gets the
// text of the top-level files detect.ts read and the names that exist, so no
// model and no command is involved (H2). docs/DETECT.md.
import { messageOf } from './errors.ts';
import { isRecord } from './json.ts';

export type CommandKind = 'test' | 'lint' | 'typecheck' | 'build' | 'run';

/** A command found in a file. `body` is what a script or make target runs,
 * when the file says, so the checker can see a deploy hidden behind a name. */
export type FoundCommand = { kind: CommandKind; command: string; source: string; body?: string };

export type Stack = { languages: string[]; packageManagers: string[]; frameworks: string[]; commands: FoundCommand[]; notes: string[] };

/** The top-level files: the text of each one read, and every name that exists. */
export type Files = { text: Map<string, string>; present: Set<string> };

/** The names whose text the stack readers need. */
export const textFiles = ['package.json', 'pyproject.toml', 'requirements.txt', 'setup.cfg', 'Pipfile', 'go.mod', 'Cargo.toml', 'Makefile', 'makefile', 'GNUmakefile'];

/** The names whose presence alone tells something. */
export const markerFiles = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'tsconfig.json', 'poetry.lock', 'uv.lock', 'setup.py', 'pytest.ini'];

const scriptNames: [CommandKind, string[]][] = [
  ['test', ['test']],
  ['lint', ['lint']],
  ['typecheck', ['typecheck', 'type-check', 'check-types', 'tsc']],
  ['build', ['build']],
  ['run', ['start', 'dev', 'serve']],
];

const nodeFrameworks: [string, string][] = [
  ['next', 'Next.js'], ['nuxt', 'Nuxt'], ['@remix-run/react', 'Remix'], ['@sveltejs/kit', 'SvelteKit'], ['astro', 'Astro'],
  ['react', 'React'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['@angular/core', 'Angular'], ['electron', 'Electron'],
  ['express', 'Express'], ['fastify', 'Fastify'], ['@nestjs/core', 'NestJS'], ['vite', 'Vite'],
];

function stack(part: Partial<Stack>): Stack {
  return { languages: [], packageManagers: [], frameworks: [], commands: [], notes: [], ...part };
}

function nodePackageManager(present: Set<string>): string {
  if (present.has('pnpm-lock.yaml')) return 'pnpm';
  if (present.has('yarn.lock')) return 'yarn';
  if (present.has('bun.lock') || present.has('bun.lockb')) return 'bun';
  return 'npm';
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** package.json: its scripts, dependencies and the lock file beside it. */
export function nodeStack({ text, present }: Files): Stack | null {
  const raw = text.get('package.json');
  if (raw === undefined) return null;
  const manager = nodePackageManager(present);
  let pkg: unknown;
  try {
    pkg = JSON.parse(raw);
  } catch (error) {
    pkg = messageOf(error);
  }
  if (!isRecord(pkg)) {
    const why = typeof pkg === 'string' ? pkg : 'the top level is not an object';
    return stack({ languages: ['javascript'], packageManagers: [manager], notes: [`package.json is not a JSON object: ${why}`] });
  }
  const deps = { ...stringRecord(pkg.dependencies), ...stringRecord(pkg.devDependencies) };
  const scripts = stringRecord(pkg.scripts);
  const typescript = present.has('tsconfig.json') || 'typescript' in deps;
  const commands = scriptNames.flatMap(([kind, names]) =>
    names.filter((name) => name in scripts).map((name) => ({ kind, command: `${manager} run ${name}`, source: 'package.json', body: scripts[name] ?? '' })),
  );
  return stack({
    languages: [typescript ? 'typescript' : 'javascript'],
    packageManagers: [manager],
    frameworks: nodeFrameworks.filter(([dep]) => dep in deps).map(([, name]) => name),
    commands,
  });
}

const pythonFiles = ['pyproject.toml', 'requirements.txt', 'setup.cfg', 'Pipfile'];

function pythonManager(present: Set<string>, text: string): { name: string; prefix: string } {
  if (present.has('uv.lock')) return { name: 'uv', prefix: 'uv run ' };
  if (present.has('poetry.lock') || text.includes('[tool.poetry]')) return { name: 'poetry', prefix: 'poetry run ' };
  if (present.has('Pipfile')) return { name: 'pipenv', prefix: 'pipenv run ' };
  return { name: 'pip', prefix: '' };
}

/** pyproject.toml, requirements.txt, setup.cfg, Pipfile or setup.py, read as text by word match. */
export function pythonStack({ text, present }: Files): Stack | null {
  const found = pythonFiles.filter((name) => text.has(name));
  if (found.length === 0 && !present.has('setup.py')) return null;
  const all = found.map((name) => text.get(name) ?? '').join('\n').toLowerCase();
  const has = (word: string) => new RegExp(`(^|[^a-z0-9_-])${word}([^a-z0-9_-]|$)`, 'm').test(all);
  const manager = pythonManager(present, all);
  const source = found[0] ?? 'setup.py';
  const tool = (kind: CommandKind, command: string): FoundCommand => ({ kind, command: `${manager.prefix}${command}`, source });
  const commands: FoundCommand[] = [];
  if (has('pytest') || present.has('pytest.ini')) commands.push(tool('test', 'pytest'));
  if (has('ruff')) commands.push(tool('lint', 'ruff check .'));
  else if (has('flake8')) commands.push(tool('lint', 'flake8'));
  if (has('mypy')) commands.push(tool('typecheck', 'mypy .'));
  else if (has('pyright')) commands.push(tool('typecheck', 'pyright'));
  const frameworks = [['django', 'Django'], ['flask', 'Flask'], ['fastapi', 'FastAPI']].filter(([word]) => has(word ?? '')).map(([, name]) => name ?? '');
  return stack({ languages: ['python'], packageManagers: [manager.name], frameworks, commands });
}

/** go.mod: the go tool's own commands, and the web frameworks it requires. */
export function goStack({ text }: Files): Stack | null {
  const mod = text.get('go.mod');
  if (mod === undefined) return null;
  const frameworks = [['github.com/gin-gonic/gin', 'Gin'], ['github.com/labstack/echo', 'Echo'], ['github.com/gofiber/fiber', 'Fiber'], ['github.com/go-chi/chi', 'chi']]
    .filter(([path]) => mod.includes(path ?? ''))
    .map(([, name]) => name ?? '');
  const go = (kind: CommandKind, command: string): FoundCommand => ({ kind, command, source: 'go.mod' });
  return stack({ languages: ['go'], packageManagers: ['go'], frameworks, commands: [go('test', 'go test ./...'), go('lint', 'go vet ./...'), go('build', 'go build ./...')] });
}

/** Cargo.toml: cargo's own commands, and the web frameworks it depends on. */
export function rustStack({ text }: Files): Stack | null {
  const cargo = text.get('Cargo.toml');
  if (cargo === undefined) return null;
  const frameworks = [['axum', 'Axum'], ['actix-web', 'Actix Web'], ['rocket', 'Rocket']]
    .filter(([crate]) => new RegExp(`^\\s*${crate}\\s*=`, 'm').test(cargo))
    .map(([, name]) => name ?? '');
  const run = (kind: CommandKind, command: string): FoundCommand => ({ kind, command, source: 'Cargo.toml' });
  return stack({ languages: ['rust'], packageManagers: ['cargo'], frameworks, commands: [run('test', 'cargo test'), run('typecheck', 'cargo check'), run('build', 'cargo build')] });
}

const makeKinds: Record<string, CommandKind> = { test: 'test', tests: 'test', lint: 'lint', typecheck: 'typecheck', 'type-check': 'typecheck', build: 'build', run: 'run', dev: 'run', serve: 'run', start: 'run' };

/** A Makefile: each target with a known name, and the recipe it runs. */
export function makeStack({ text }: Files): Stack | null {
  const name = ['GNUmakefile', 'makefile', 'Makefile'].find((file) => text.has(file));
  if (name === undefined) return null;
  const lines = (text.get(name) ?? '').split('\n');
  const commands: FoundCommand[] = [];
  lines.forEach((line, index) => {
    const target = /^([A-Za-z0-9][\w.-]*)\s*:(?![:=])/.exec(line)?.[1];
    const kind = target === undefined ? undefined : makeKinds[target];
    if (kind === undefined) return;
    const recipe: string[] = [];
    for (let next = index + 1; lines[next]?.startsWith('\t'); next++) recipe.push((lines[next] ?? '').trim());
    commands.push({ kind, command: `make ${target}`, source: name, body: recipe.join('\n') });
  });
  return stack({ commands });
}

/** Every stack the files show, in a fixed order. */
export function readStacks(files: Files): Stack[] {
  return [nodeStack, pythonStack, goStack, rustStack, makeStack].map((read) => read(files)).filter((found): found is Stack => found !== null);
}
