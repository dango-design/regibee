import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getViewer } from "@/lib/viewer";
import { AcceptInviteButton } from "./accept-invite-button";
import { Logo } from "@/components/logo";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch invite details using admin client (no RLS)
  const { data: invite } = await supabaseAdmin
    .from("registry_invites")
    .select("id, registry_id, email, max_uses, use_count, expires_at")
    .eq("token", token)
    .single();

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-error-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
            <p className="text-tertiary text-center">
              This invite link is invalid or has been revoked.
            </p>
            <Button asChild className="mt-6">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Guests who reserved a gift have an anonymous session. That isn't an
  // account, so they count as signed out here and get the sign-in links.
  const [user, { data: registry }] = await Promise.all([
    getViewer(),
    supabaseAdmin
      .from("registries")
      .select("title, parent_names")
      .eq("id", invite.registry_id)
      .single(),
  ]);

  const registryTitle = registry?.title || "a registry";
  const ownerName = registry?.parent_names || "Someone";

  // Someone who already manages the registry doesn't need the invite. The
  // dashboard accepts emailed invites for the signed-in address, which uses
  // up a one-use invite before the person clicks the link in the email. So
  // check this before the expiry and use count.
  const { data: membership } = user
    ? await supabaseAdmin
        .from("registry_managers")
        .select("role")
        .eq("registry_id", invite.registry_id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (membership) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-success-primary mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold mb-2">
              {membership.role === "owner" ? "This Is Your Registry" : "You Already Help Manage This"}
            </h2>
            <p className="text-tertiary text-center">
              {membership.role === "owner" ? (
                <>
                  <strong>{registryTitle}</strong> is yours, so there&apos;s nothing to accept.
                </>
              ) : (
                <>
                  You already help manage <strong>{registryTitle}</strong>, so there&apos;s nothing
                  to accept.
                </>
              )}
            </p>
            <Button asChild className="mt-6">
              <Link href={`/dashboard/registry/${invite.registry_id}`}>Open Registry</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-error-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invite Expired</h2>
            <p className="text-tertiary text-center">
              This invite link has expired. Please ask the registry owner for a new invite.
            </p>
            <Button asChild className="mt-6">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check max uses
  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertCircle className="h-12 w-12 text-error-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invite Fully Used</h2>
            <p className="text-tertiary text-center">
              This invite link has reached its maximum number of uses.
            </p>
            <Button asChild className="mt-6">
              <Link href="/login">Go to Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    // Not logged in — show invite info with login/signup links
    const redirectUrl = `/invite/${token}`;
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Link href="/" className="mx-auto flex items-center gap-2 font-semibold mb-4">
              <Logo size="lg" />
            </Link>
            <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
              <strong>{ownerName}</strong> invited you to help manage{" "}
              <strong>{registryTitle}</strong>.
            </p>
            <p className="text-tertiary text-sm">
              Sign in or create an account to accept this invitation.
            </p>
            <div className="flex gap-3 justify-center mt-6">
              <Button asChild>
                <Link href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}>
                  Sign in
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/signup?redirect=${encodeURIComponent(redirectUrl)}`}>
                  Create account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in — show accept button
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/dashboard" className="mx-auto flex items-center gap-2 font-semibold mb-4">
            <Logo size="lg" />
          </Link>
          <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-secondary">
            <strong>{ownerName}</strong> invited you to help manage{" "}
            <strong>{registryTitle}</strong>.
          </p>
          <p className="text-tertiary text-sm">
            As a manager, you&apos;ll be able to add and edit items, view gift
            activity, and help organize the registry.
          </p>
          <AcceptInviteButton token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
