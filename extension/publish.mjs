// Uploads a built extension to the Chrome Web Store and sends it for review.
// Google publishes it when the review passes. Chrome then updates everyone
// who has it installed.
//
//   node extension/publish.mjs <zip of extension/dist>
//
// .github/workflows/extension-publish.yml runs this after a merge to main.
// It needs three environment variables, kept as repo secrets:
//
//   CWS_SERVICE_ACCOUNT_KEY  the JSON key of the Google service account that
//                            the developer dashboard lets publish
//   CWS_PUBLISHER_ID         the developer account's publisher ID
//   CWS_ITEM_ID              the extension's ID in the store
//
// See "Publishing" in extension/README.md. The API is documented at
// https://developer.chrome.com/docs/webstore/api/reference/rest.

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const API = "https://chromewebstore.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function required(name) {
  const value = process.env[name];
  if (!value) fail(`${name} isn't set. See "Publishing" in extension/README.md.`);
  return value;
}

/** Trades the service account's key for an access token, with a signed JWT. */
async function accessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) fail(`Google didn't give an access token (${response.status}): ${body.error_description ?? body.error ?? "no reason given"}`);
  return body.access_token;
}

const zipPath = process.argv[2];
if (!zipPath) fail("Give the zip to upload: node extension/publish.mjs <zip>");

let key;
try {
  key = JSON.parse(required("CWS_SERVICE_ACCOUNT_KEY"));
} catch {
  fail("CWS_SERVICE_ACCOUNT_KEY isn't valid JSON. Paste the whole key file into the secret.");
}
const item = `publishers/${required("CWS_PUBLISHER_ID")}/items/${required("CWS_ITEM_ID")}`;
const token = await accessToken(key);

/** Calls the store's API. `action` names the call in errors, since the URL holds the IDs. */
async function call(action, method, url, body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` }, body });
  const text = await response.text();
  if (!response.ok) fail(`${action} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : {};
}

const fetchStatus = () => call("Reading the item's status", "GET", `${API}/v2/${item}:fetchStatus`);

// Only one version can wait for review at a time. If an older one still is,
// cancel it and send this one instead, so testers get the newest code. Its
// review starts over.
const before = await fetchStatus();
if (before.takenDown) fail("The store took the extension down for a policy problem. The developer dashboard says why.");
if (before.warned) console.log("::warning::The store warned the extension about a policy problem. The developer dashboard says what to fix.");
const waiting = before.submittedItemRevisionStatus;
if (waiting?.state === "PENDING_REVIEW") {
  const version = waiting.distributionChannels?.[0]?.crxVersion ?? "An older version";
  console.log(`${version} is still waiting for review. Cancelling it so this build goes instead.`);
  await call("Cancelling the waiting version", "POST", `${API}/v2/${item}:cancelSubmission`);
}

const upload = await call("Uploading", "POST", `${API}/upload/v2/${item}:upload`, await readFile(zipPath));
let uploadState = upload.uploadState;
// Large uploads finish in the background. Check every 10 seconds, for up to 5 minutes.
for (let tries = 0; uploadState === "IN_PROGRESS" && tries < 30; tries++) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  uploadState = (await fetchStatus()).lastAsyncUploadState;
}
if (uploadState !== "SUCCEEDED") fail(`The upload didn't succeed. Its state is ${uploadState}.`);
console.log(`Uploaded ${upload.crxVersion ?? "the new version"}.`);

// Publishes on its own as soon as the review passes.
const submitted = await call("Sending it for review", "POST", `${API}/v2/${item}:publish`);
for (const warning of submitted.warningInfo?.warnings ?? []) console.log(`::warning::${warning.reason}: ${warning.description}`);
console.log(`Sent for review. The store says: ${submitted.state}.`);
