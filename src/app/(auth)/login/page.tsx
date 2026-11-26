"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/base/input/input";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/client";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Same message as the phone app's sign-in screen.
      setError(/invalid login/i.test(error.message) ? "That email and password don't match." : error.message);
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center gap-2 font-semibold mb-4">
            <Logo size="lg" />
          </Link>
          {/* Like the app's sign-in screen: the logo and tagline. The heading is for screen readers. */}
          <h1 className="sr-only">Sign in to Regibee</h1>
          <CardDescription>One registry, every occasion.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              enterKeyHint="next"
              value={email}
              onChange={(val) => setEmail(val)}
              isRequired
            />
            <div>
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(val) => setPassword(val)}
                isRequired
              />
              <div className="mt-1 text-right">
                <Link href="/forgot-password" className="text-sm text-brand-tertiary underline-offset-4 hover:underline max-sm:inline-block max-sm:py-2.5">
                  Forgot your password?
                </Link>
              </div>
            </div>
            {error && (
              <p className="text-sm text-error-primary">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-tertiary">
            New to Regibee?{" "}
            <Link href={redirectTo !== "/dashboard" ? `/signup?redirect=${encodeURIComponent(redirectTo)}` : "/signup"} className="text-brand-tertiary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
