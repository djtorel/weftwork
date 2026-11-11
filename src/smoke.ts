// Smoke module: proves the compiler and the test runner run (e05s02).
// e06 replaces it with the engine.

/** True when a verify command's exit code means it passed. */
export function passed(exitCode: number): boolean {
  return exitCode === 0;
}
