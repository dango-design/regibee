import { NextResponse } from "next/server";
import { appError, authenticateApp, navigationFromError, runAsAppUser } from "@/lib/app-request";
import { APP_LOADERS } from "@/lib/app-loaders";

export const dynamic = "force-dynamic";

// POST { loader: "<name>", args: [...] } → what one of the website's pages
// loads, as JSON, for the same screen in the app: { data }, or { notFound }
// when the user can't see it. Each loader checks who's asking, the same way
// the website's page does (src/lib/app-loaders.ts).
export async function POST(request: Request) {
  const auth = await authenticateApp(request);
  if (auth.response) return auth.response;

  let body: { loader?: unknown; args?: unknown };
  try {
    body = await request.json();
  } catch {
    return appError("Invalid request", 400);
  }
  const name = typeof body.loader === "string" ? body.loader : "";
  const loader = Object.hasOwn(APP_LOADERS, name) ? APP_LOADERS[name as keyof typeof APP_LOADERS] : undefined;
  if (!loader) return appError("Unknown loader", 404);
  const args = Array.isArray(body.args) ? body.args : [];

  try {
    const data = await runAsAppUser(auth.accessToken, auth.user, () =>
      (loader as (...args: unknown[]) => Promise<unknown>)(...args),
    );
    if (data === null || data === undefined) return NextResponse.json({ notFound: true });
    return NextResponse.json({ data });
  } catch (error) {
    try {
      return NextResponse.json(navigationFromError(error));
    } catch {
      console.error(`[app] loader ${name} failed:`, error);
      return appError("Something went wrong. Try again.", 500);
    }
  }
}
