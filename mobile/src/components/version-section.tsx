// "This version" on the Account tab, in preview builds and while developing:
// the newest pull request and commit in the code the app is running, which
// build and update it's on, and a button to check for a newer one right away.
// The app also checks each time it opens. On Android it also says whether
// Google Play has a newer build (src/lib/play-update.ts).

import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Button, Divider, haptic, Section, Text } from "@/components/ui";
import { pullRequestLabel, runningBuild, showsBuildInfo, stamp, updateBuildInfo } from "@/lib/build-info";
import { checkPlay, checksPlay, installPlayUpdate, usePlayUpdate } from "@/lib/play-update";
import { spacing } from "@/lib/theme";

const canCheck = !__DEV__ && Updates.isEnabled && Platform.OS !== "web";

export function VersionSection() {
  if (!showsBuildInfo) return null;
  const build = runningBuild;
  const branch = build?.branch && build.branch !== "main" && build.branch !== "HEAD" ? build.branch : null;
  const running = __DEV__
    ? "Development build, from the dev server on your computer"
    : Updates.isEmbeddedLaunch || !Updates.createdAt
      ? "The version it was built with"
      : `Update from ${stamp(Updates.createdAt)}`;

  return (
    <Section
      title="This version"
      footer={
        canCheck
          ? "Each pull request merged into main that changes the app arrives as an update. A change to native code comes as a new build instead, which an update can't replace."
          : "Reload the app to get the latest changes from your computer."
      }
    >
      <Info label="Latest pull request" lines={[pullRequestLabel(build) ?? "Not known"]} />
      <Divider inset={spacing.lg} />
      <Info
        label="Commit"
        lines={[
          build?.commit ? [build.commit, build.committedAt && stamp(build.committedAt)].filter(Boolean).join(", ") : "Not known",
          branch && `On ${branch}`,
          build?.changed ? "With changes not committed yet" : null,
        ]}
      />
      <Divider inset={spacing.lg} />
      <Info label="Running" lines={[running]} />
      {Application.nativeBuildVersion ? (
        <>
          <Divider inset={spacing.lg} />
          <Info
            label="Build"
            lines={[`Version ${Application.nativeApplicationVersion ?? "?"}, build ${Application.nativeBuildVersion}`]}
          />
        </>
      ) : null}
      {checksPlay ? (
        <>
          <Divider inset={spacing.lg} />
          <PlayCheck />
        </>
      ) : null}
      {canCheck ? (
        <>
          <Divider inset={spacing.lg} />
          <UpdateCheck />
        </>
      ) : null}
    </Section>
  );
}

function Info({ label, lines }: { label: string; lines: (string | null | undefined | false)[] }) {
  return (
    <View style={styles.info} accessible>
      <Text variant="footnote" tone="secondary">
        {label}
      </Text>
      {lines.filter(Boolean).map((line) => (
        <Text key={line as string} variant="callout" selectable>
          {line}
        </Text>
      ))}
    </View>
  );
}

/** What a newer update holds: ": #170 Add group gifts", or nothing when its manifest doesn't say. */
function describe(update: Updates.UpdateInfo | undefined) {
  // A rollback to the version the app was built with has no manifest.
  if (update && !update.manifest) return ": the version it was built with";
  const pr = pullRequestLabel(updateBuildInfo(update?.manifest));
  return pr ? `: ${pr}` : "";
}

function UpdateCheck() {
  const {
    isChecking,
    isDownloading,
    isUpdateAvailable,
    isUpdatePending,
    availableUpdate,
    downloadedUpdate,
    checkError,
    downloadError,
    lastCheckForUpdateTimeSinceRestart,
  } = Updates.useUpdates();
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);

  async function check() {
    setError(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable || result.isRollBackToEmbedded) {
        await Updates.fetchUpdateAsync();
        haptic("success");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function restart() {
    setRestarting(true);
    Updates.reloadAsync().catch((e: unknown) => {
      setRestarting(false);
      setError(e instanceof Error ? e.message : String(e));
    });
  }

  const incoming = describe(downloadedUpdate ?? availableUpdate);
  const problem = error ?? (checkError ?? downloadError)?.message ?? null;
  let status: string | null = null;
  if (isUpdatePending) status = `A newer version has downloaded${incoming}. Restart Regibee to use it.`;
  else if (isDownloading) status = `Downloading a newer version${incoming}…`;
  else if (isChecking) status = null;
  else if (problem) status = `Couldn't check for updates. ${problem}`;
  else if (isUpdateAvailable) status = `A newer version is available${incoming}.`;
  else if (lastCheckForUpdateTimeSinceRestart) {
    status = `You have the latest update for this build. Checked ${clock(lastCheckForUpdateTimeSinceRestart)}.`;
  }

  return (
    <View style={styles.check}>
      {status ? (
        <Text variant="subhead" tone={problem && !isUpdatePending && !isDownloading ? "danger" : "secondary"} selectable>
          {status}
        </Text>
      ) : null}
      {isUpdatePending ? (
        <Button title="Restart now" icon="refresh" size="medium" loading={restarting} onPress={restart} />
      ) : (
        <Button
          title="Check for updates"
          variant="secondary"
          icon="refresh"
          size="medium"
          loading={isChecking || isDownloading}
          onPress={check}
        />
      )}
    </View>
  );
}

/** Whether Google Play has a newer build, and a button to install it or ask again. */
function PlayCheck() {
  const play = usePlayUpdate();
  let status: string | null = null;
  if (play.available) {
    const build = play.available.versionCode ? ` (build ${play.available.versionCode})` : "";
    status = `Google Play has a newer build${build}. Updates made after it only reach that build, so install it to get them.`;
    if (play.error) status += ` Couldn't open Google Play's update screen. ${play.error}`;
  } else if (play.error) {
    // Play only answers for a copy installed from Play.
    status = `Couldn't ask Google Play for a newer build. A copy that wasn't installed from Play can't check. ${play.error}`;
  } else if (play.checkedAt) {
    status = `Google Play has no newer build. Checked ${clock(play.checkedAt)}.`;
  }

  return (
    <View style={styles.check}>
      {status ? (
        <Text variant="subhead" tone={play.error && !play.available ? "danger" : "secondary"} selectable>
          {status}
        </Text>
      ) : null}
      {play.available ? (
        <Button
          title="Update from Google Play"
          icon="update"
          size="medium"
          loading={play.installing}
          onPress={() => void installPlayUpdate()}
        />
      ) : (
        <Button
          title="Check Google Play"
          variant="secondary"
          icon="refresh"
          size="medium"
          loading={play.checking}
          onPress={() => void checkPlay()}
        />
      )}
    </View>
  );
}

/** "10:42 AM" */
function clock(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const styles = StyleSheet.create({
  info: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 2 },
  check: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
});
