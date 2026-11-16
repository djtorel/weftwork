# Changelog

## [0.2.0](https://github.com/djtorel/weftwork/compare/v0.1.0...v0.2.0) (2026-11-16)


### ⚠ BREAKING CHANGES

* **skills:** the weft-ready, weft-review, weft-pr, weft-improve, weft-setup and weft-convert skills are now all-ready, second-opinion, pr-it, retro, bootstrap and migrate. weftwork update deletes an old weft- folder you never changed.
* **engine:** the budget keys maxRuns, maxFailures, stallAfter and reserveRuns in weftwork.yaml and the user config file are now max_runs, max_failures, stall_after and reserve_runs; each old key is refused with an error that names the new one.
* **engine:** the review setting key `council` is now `reviewers`; the old key is refused with an error that names the new one. The skills full-stop, review-loop, file-pr, setup-project and convert-project are now weft-ready (trigger phrase "weft ready"), weft-review, weft-pr, weft-setup and weft-convert.

### Features

* **engine:** an opt-in local history that shows which failures keep recurring, and an improve skill that proposes one checked fix (R20) ([#114](https://github.com/djtorel/weftwork/issues/114)) ([b416fcd](https://github.com/djtorel/weftwork/commit/b416fcd103d6920050625feb1e6640f7733de603))
* **engine:** base check names each new test that passes on the base when the run prints TAP ([#115](https://github.com/djtorel/weftwork/issues/115)) ([00ea2f6](https://github.com/djtorel/weftwork/commit/00ea2f6858f86a1072e349692a43fd0dac9075f3))
* **engine:** catch planned parallel tasks that would change the same file, before dispatch ([#120](https://github.com/djtorel/weftwork/issues/120)) ([11f7dab](https://github.com/djtorel/weftwork/commit/11f7dab660e447ad34091ef89aa24c571d537558))
* **engine:** convert a BMAD v4 project, so its open PRD epics and unfinished stories land in the backlog ([#119](https://github.com/djtorel/weftwork/issues/119)) ([13a7453](https://github.com/djtorel/weftwork/commit/13a7453043b55c7fc524c173d125114700912181))
* **engine:** pair a run with its stop state by run id, so a clock step cannot give a false ready PR proof ([#106](https://github.com/djtorel/weftwork/issues/106)) ([bb69fba](https://github.com/djtorel/weftwork/commit/bb69fba70c8b5e2cf365e8a89a78809f1a52bdc1))
* **engine:** show the session's token use in the PR proof, so a headless run's PR says what it spent ([#108](https://github.com/djtorel/weftwork/issues/108)) ([9f5b7e6](https://github.com/djtorel/weftwork/commit/9f5b7e697ae982b3a797502ddc450fad8398280a))
* **engine:** the live check reports whether the guard runs, and install and live check accept "$CLAUDE_PROJECT_DIR" hook entries without a duplicate ([#118](https://github.com/djtorel/weftwork/issues/118)) ([259b7a2](https://github.com/djtorel/weftwork/commit/259b7a2d00a98fa5203cffdeabcf9f4693c2b5db))
* **engine:** weftwork update brings a project's skills to the installed version, and weftwork upgrade installs the latest ([#128](https://github.com/djtorel/weftwork/issues/128)) ([ce15069](https://github.com/djtorel/weftwork/commit/ce15069beb88e0ef38e86c4ac30c96acada4283e))
* **guard:** block writes to git internals, host hook files and credential files ([#122](https://github.com/djtorel/weftwork/issues/122)) ([5c1a229](https://github.com/djtorel/weftwork/commit/5c1a2298c91e0732813a42aba53778adfb138296))
* **measure:** measure the done gate against seeded false successes, with no model spend (B7) ([#124](https://github.com/djtorel/weftwork/issues/124)) ([d96ea23](https://github.com/djtorel/weftwork/commit/d96ea231660f104b139fd497d11ca7e01b703906))
* **setup:** name each monorepo package's resolving commands in the AGENTS.md letter ([#113](https://github.com/djtorel/weftwork/issues/113)) ([1ec986e](https://github.com/djtorel/weftwork/commit/1ec986eff6562bbe3428f79290f32ac33e3f6a32))
* **skills:** name the chat skills by what you say at the end of a prompt (all ready, all in, second opinion, PR it), and add all-in to merge with no interaction ([#130](https://github.com/djtorel/weftwork/issues/130)) ([e7faca6](https://github.com/djtorel/weftwork/commit/e7faca665f07e438e6c9b52160f75e6f45d160e3))


### Bug fixes

* **engine:** count a transcript whose last line is cut inside a multi-byte character ([#102](https://github.com/djtorel/weftwork/issues/102)) ([53ee67b](https://github.com/djtorel/weftwork/commit/53ee67bcbf2a641068e900f689d80765a1cc1ddd))
* **engine:** refuse a review round on a detached HEAD, where the round ceiling cannot be counted ([#104](https://github.com/djtorel/weftwork/issues/104)) ([e62e3cb](https://github.com/djtorel/weftwork/commit/e62e3cbd3ab0a445c77473beb0ebd624ab1da412))
* **engine:** weftwork --help and the docs say what 0.2.0 ships ([#126](https://github.com/djtorel/weftwork/issues/126)) ([06c5121](https://github.com/djtorel/weftwork/commit/06c5121f2d394757ff08dbfc562687d7f62b1989))
* **guard:** block a push after git switch -- main or to the remote's default branch, and allow a sure checkout off main ([#121](https://github.com/djtorel/weftwork/issues/121)) ([71bee0e](https://github.com/djtorel/weftwork/commit/71bee0edb76c5a67543fd2dd880f133362b90ba6))
* keep an agent worktree in .claude/worktrees/ out of yamllint and out of the tree, so it cannot fail Preflight ([#129](https://github.com/djtorel/weftwork/issues/129)) ([5a4c3db](https://github.com/djtorel/weftwork/commit/5a4c3dbe28e928161be8f730c7ac5d55a920b714))
* **ui:** catch a bad ui.design when screenshots are taken, and refuse a review of screenshots changed since they were taken ([#110](https://github.com/djtorel/weftwork/issues/110)) ([dd3626d](https://github.com/djtorel/weftwork/commit/dd3626d643e538129f77af4f71ad99ab45e8fd6e))


### Performance

* **engine:** skip the 30 s Preflight at a stop when the Stop hook already passed on the same tree ([#109](https://github.com/djtorel/weftwork/issues/109)) ([726d8ff](https://github.com/djtorel/weftwork/commit/726d8ff0f1f08630cd6a8274cbe3399a4c1652e3))


### Refactoring

* **engine:** give every skill its own weft- name so none clashes with tstack, and rename review.council to review.reviewers ([#111](https://github.com/djtorel/weftwork/issues/111)) ([a568140](https://github.com/djtorel/weftwork/commit/a568140074c33360d0232dfbd5a76fd4c81982c3))
* **engine:** write the budget keys in snake_case like every other setting, and keep retired names out with a test ([#127](https://github.com/djtorel/weftwork/issues/127)) ([5dd3fc0](https://github.com/djtorel/weftwork/commit/5dd3fc028389d36265791e075e32bf2cb7b7b523))

## 0.1.0 (2026-11-16)


### Features

* **engine:** hooks run weftwork from PATH so they survive upgrades and block when it is missing, plus a README for npm users ([#101](https://github.com/djtorel/weftwork/issues/101)) ([fc74de3](https://github.com/djtorel/weftwork/commit/fc74de3843215582f966405f9d48d2f01a448269))
* **engine:** install weftwork from npm as one CLI, with weftwork init in the current folder and semver releases ([#100](https://github.com/djtorel/weftwork/issues/100)) ([a68ede1](https://github.com/djtorel/weftwork/commit/a68ede1929067d8eea29625f2b13b877d4b944a7))


### Bug fixes

* **release:** make the first release 0.1.0, not release-please's default 1.0.0 ([#117](https://github.com/djtorel/weftwork/issues/117)) ([e79a56f](https://github.com/djtorel/weftwork/commit/e79a56fb334be378ae5300aa9cd22e55dbcebe15))
