# Story screenshots

These tests take a screenshot of every Storybook story and compare it with a saved one, called its baseline. A story that looks different fails the **Story screenshots** check on its pull request. This does the same job as Chromatic's UI Tests, with no monthly snapshot limit.

## How it works

- `.github/workflows/story-screenshots.yml` runs on pull requests that change `src/`, `public/`, `.storybook/`, this folder or `package.json`.
- It builds Storybook, then `stories.spec.ts` opens each story in Chromium with Playwright and takes a picture of the whole page.
- The baselines are PNG files in `baselines/`, one for each story, named by the story's id. They are committed, so each branch carries its own baselines and a merge brings them to `main`.
- It skips the stories Chromatic skips: the ones with `parameters: { chromatic: { disableSnapshot: true } }`.
- A story with `globals: { viewport: { value: "mobile1" } }` is taken at that viewport's size. Every other story is 1200 pixels wide.
- Any pixel that differs fails the story.

## When the check fails

The run's summary page on GitHub lists the stories that changed, have no baseline yet, or didn't render.

1. Look at the pictures. Download the `story-screenshots-report` artifact from the run and open its `index.html`. Each failed story shows the baseline, the new picture and the difference.
2. If a change is a mistake, fix the code and push.
3. If the changes are meant, accept them on the branch:

   ```bash
   npm run screenshots:accept
   ```

   That downloads the new pictures from the run for the commit you are on and puts them in `baselines/`. It needs the `gh` CLI. Then commit and push `story-screenshots/baselines`. The pull request's Files tab shows each changed PNG before and after, and the check runs again and passes.

A new story fails the check once, since it has no baseline. Accept it the same way. A deleted story's baseline is listed as having no story, and accepting removes it.

Two pull requests that change the same story's picture conflict on its PNG. Merge `main` into the branch, keep either copy, push, and accept again once the check has run.

## Baselines come only from GitHub

Don't add pictures taken on your own computer to `baselines/`. A Mac draws text a little differently from GitHub's Linux runner, so they would never match. `npm run screenshots:accept` is the only way pictures get there.

For the same reason the workflow runs on a named Ubuntu version, not `ubuntu-latest`. Moving to a newer one, or to a newer Playwright with a newer Chromium, can change many pictures at once. Do that in its own pull request and accept the baselines there.

## Running it here

```bash
npm run build-storybook
```

```bash
npm run test:screenshots
```

On a Mac nearly every story fails, because the baselines are Linux pictures. A local run is still useful to see that stories render, and to work on the test itself. `npx playwright test --config story-screenshots/playwright.config.ts -g "Badge"` runs the stories whose name matches.

The tests need no server and no port. Playwright answers the story's requests straight from `storybook-static`.

## What keeps the pictures the same from run to run

- Requests to anything but the built Storybook and Google's font files are blocked. An image from another site shows as broken every time.
- Font files are downloaded once for a run, and the test fails if a font didn't load.
- The clock is fixed (`NOW` in `stories.spec.ts`), so text such as "in 3 days" doesn't change from day to day. If stories start to show dates that look wrong, move `NOW` and accept the changes.
- CSS animations are stopped, and the browser reports that the person prefers reduced motion.
- Confetti is hidden, since its pieces land in random places.
- A screenshot is used only once two in a row are identical, so a menu that is still opening doesn't get captured halfway.

## Unstable stories

A few stories still look different from one run to the next. They are in `UNSTABLE` in `stories.spec.ts`, each with the reason. They are opened and must render, but no picture is compared. When a story fails with a small difference nobody made, run the check again. If it keeps happening, fix the story, or add it to that list and open an issue.

## Files

| File | What it does |
| --- | --- |
| `stories.spec.ts` | Opens each story and compares its screenshot. |
| `playwright.config.ts` | Sizes, where results go. |
| `collect.mjs` | Runs after the tests on GitHub. Lists what changed and gathers the new pictures into `new-baselines/`. |
| `accept.mjs` | `npm run screenshots:accept`. |
| `baselines/` | The saved pictures. |
