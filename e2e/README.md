# End-to-end tests

These tests use the website the way a person does, in a real browser, and check every email that follows. They run against a local copy of Supabase on your computer, never production. Each test creates its own owners, registries and guests.

Every email the site sends lands in Mailpit, a fake inbox that comes with local Supabase. That includes Supabase's own sign-up and password emails. Tests read Mailpit to check who got which email, and they open the links inside it. You can watch the emails arrive at http://127.0.0.1:54324.

## Set up once

1. Install a Docker runtime. Colima is free and runs from the command line:

   ```bash
   brew install colima docker
   ```

   Docker Desktop or OrbStack work too.

2. Start it. Do this again after you restart your computer:

   ```bash
   colima start --cpu 4 --memory 4 --vm-type vz --mount-type virtiofs
   ```

   Colima runs a small virtual machine with no window. While it runs, it holds the memory you gave it, and macOS may warn that a virtual machine is using a lot of memory. Local Supabase itself uses about 0.5 GB. Stop Colima when you're done testing (see below).

3. Create the local database:

   ```bash
   npm run e2e:db
   ```

   The first run downloads Supabase's images, about 3.5 GB. The command starts local Supabase, empties its database and runs every file in `supabase/migrations` in name order. Run it again after adding a migration or changing `supabase/config.toml`. A new migration that breaks on an empty database will fail here, which is worth knowing before it reaches production.

## Run the tests

```bash
npm run test:e2e
```

The tests start their own website on http://localhost:3100. That server reads local Supabase's address and keys from `supabase status`, and sends email to Mailpit. The values in `.env.local` don't apply to it. It builds into `.next-e2e`, so it can run next to `npm run dev`. If every page in a run comes back "404 This page could not be found" after merging main or switching branches, that build is stale: delete `.next-e2e` and run again.

To run some files, name them:

```bash
npm run test:e2e -- e2e/gift-funds.spec.ts e2e/accounts.spec.ts
```

The whole suite takes a few minutes and keeps the computer busy, so while working on a change, run the files that cover it. The End-to-end tests check runs every file on the pull request.

Only one run at a time can use port 3100. If another is going, for example in another worktree, a second one stops with "http://localhost:3100 is already used". Wait for the first to finish. `npm run e2e:db` empties the database a run is using, so wait for the port to be free before running it too.

Add `--ui` to watch the tests run in Playwright's window, or `--headed` to see the browser.

To stop local Supabase and free Colima's memory when you're done:

```bash
supabase stop
```

```bash
colima stop
```

`supabase stop` keeps the local database. Next time, `colima start` and `supabase start --exclude studio,postgres-meta --ignore-health-check` bring it back as it was, without running `npm run e2e:db` again.

## On pull requests

[`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) runs the same two commands on GitHub's servers, for every pull request that changes `src/`, `e2e/`, `supabase/`, `package.json` or `next.config.ts`, and for every push to `main`. It shows on the pull request as **End-to-end tests** and takes about five minutes, mostly to download local Supabase. It needs no secrets.

- On GitHub, a test that fails gets one more try. One that passes the second time shows as flaky in the log. Fix flaky tests, since a test that fails at random teaches people to ignore it.
- When a test fails, the run keeps its trace as `e2e-test-results` on the run's page for a week. Download it and open the trace with `npx playwright show-trace <file>.zip` to step through what the browser saw.
- It isn't a required check yet, so a pull request can merge while it runs or fails. Once it has proven reliable, make it required in the repository's branch protection for `main`.

## Writing tests that don't fail at random

These are the causes of the flaky failures seen on GitHub so far.

- **Wait for React before the first click on a page.** After `page.goto` or `page.reload`, the page's buttons do nothing until React has taken over the page, and text typed into a field is cleared. On GitHub's runner that can take a few seconds after the page has loaded. Call `waitForReact(<the element>)` from `fixtures.ts` before the first click, fill or `chooseOption` on a page you just loaded. `chooseOption`, `reserveGift`, `joinExchange` and `signIn` already do it. Links work before React, so a click on a link needs no wait. A click in a dialog or menu that React opened needs none either.
- **Sign in with `signIn`.** It returns only once the dashboard has finished loading. Navigating while the login page's redirect is still running can cancel the navigation (`net::ERR_ABORTED`).
- **Make names exact when a longer name contains them.** `getByRole("heading", { name: "Your wishlist" })` also matches "Now add your wishlist", so the check passes before the change it waits for. Use `exact: true`, or wait for something only the new state shows.
- **Don't count what one call to a daily job did.** Every test shares one database, and other tests call the same jobs, so another test's call can do the work first. Check the result instead: the saved row, or the email.

## What keeps tests away from production

- `local-supabase.ts` refuses any Supabase or Mailpit address that isn't on this computer.
- The test server never reuses a server already on its port, which could be using production.
- With `EMAIL_TRANSPORT=mailpit`, `src/lib/mailer.ts` sends to Mailpit instead of Resend. The tests also blank `RESEND_API_KEY`, so Resend couldn't send even if something skipped Mailpit.
- `e2e/db.sh` runs only local commands. Nothing in it takes `--remote`.

## Flow maps

`e2e/flows/` holds scripts that walk a whole user flow the way the tests do, and save a screenshot of every step, the emails included. `build-map.mjs` turns a run into one page: the screens in order, in a lane each for the host, the emails and the guest, with an arrow from each step to the next.

```bash
npx playwright test --config e2e/flows/playwright.config.ts
```

```bash
node e2e/flows/build-map.mjs event-hosting
```

The screenshots, a `steps.json` and the page land in `test-results/flows/<flow>/`, which git ignores. The page is made to be published as a Claude artifact, with the screenshots as its files. Run both again after a change and the map shows the new pages.

- A flow is a file named `<flow>.flow.ts`, so the tests' own config never runs it. `event-hosting.flow.ts` is the example.
- `flow.page(...)` saves the page, and `flow.email(...)` saves an email from Mailpit. Each takes a title and a note for the map. `after` and `via` say which step leads to this one and by which button or link.
- Flows use the same local Supabase and port 3100 as the tests, so run one only when no test run is going.

## Writing a test

- `fixtures.ts` creates test data with the service-role key, such as an owner with a registry and an item, and has steps several tests share, such as reserving a gift.
- `mailbox.ts` reads Mailpit. `waitForEmail(to, subject)` waits for an email, since the site sends most of them after it answers the request. `linkIn(email, pattern)` finds a link in an email to open next.
- Make every email address and slug new (`uniqueEmail`, `uniqueId`), so tests don't depend on each other or on a fresh database.
- For something that happens later, such as a reservation running out, change the time in the database and call the cron route with `CRON_SECRET`, as `guest-reserve.spec.ts` does.
- Sign-up confirmations and password resets come from Supabase itself, and their links go through local Supabase's `/auth/v1/verify` first, as `accounts.spec.ts` shows. The tests open them in the same browser that asked for them.
- The site's server won't fetch addresses on its own machine, which stops anyone pointing autofill at its private network. `add-items.spec.ts` serves a store's product page on 127.0.0.1 anyway, because the test server sets `SCRAPE_ALLOW_LOCAL_TEST_PAGES`, which only lets through 127.0.0.1 and does nothing in a production build.
