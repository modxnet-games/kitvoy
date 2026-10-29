"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/language-context";
import { X } from "lucide-react";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Where the user should be sent after a social login (Google).
   * Email/password sign-in stays on the current page and just refreshes.
   */
  redirectUrl?: string;
}

export function SignInModal({ open, onClose, redirectUrl }: SignInModalProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const effectiveRedirectUrl =
    redirectUrl ||
    (typeof window !== "undefined" ? window.location.pathname : "/shop");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset modal content when reopened.
  useEffect(() => {
    if (open) setMode("signin");
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { loginAction } = await import("@/app/login/actions");
      const result = await loginAction(email, password);

      if (result.success) {
        // Save email as subscriber in background
        fetch("/api/subscribers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source: "login" }),
        }).catch(() => {});

        setEmail("");
        setPassword("");
        setError(null);
        onClose();
        router.refresh();
      } else {
        setError(
          result.error?.startsWith("auth.")
            ? t(result.error)
            : result.error ?? t("auth.login.invalidCredentials")
        );
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const googleHref = `/api/auth/google?redirect=${encodeURIComponent(
    effectiveRedirectUrl,
  )}`;

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupLoading(true);

    try {
      const { registerAction } = await import("@/app/register/actions");
      const result = await registerAction(
        fullName,
        signupEmail,
        signupPassword,
        confirmPassword,
        effectiveRedirectUrl,
      );

      if (result.success) {
        setFullName("");
        setSignupEmail("");
        setSignupPassword("");
        setConfirmPassword("");
        onClose();
        router.refresh();
      } else {
        setSignupError(
          result.error?.startsWith("auth.")
            ? t(result.error)
            : result.error ?? "Something went wrong",
        );
      }
    } catch {
      setSignupError("Something went wrong. Please try again.");
    } finally {
      setSignupLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes modalOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sign-in-overlay {
          animation: modalOverlayIn 0.2s ease-out forwards;
        }
        .sign-in-card {
          animation: modalCardIn 0.25s ease-out forwards;
        }
      `}</style>

      {/* Overlay */}
      <div
        className="sign-in-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Card */}
        <div className="sign-in-card relative w-full max-w-sm rounded-2xl border bg-background p-6 shadow-2xl sm:p-8">
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>

          {/* Title */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight">
              {mode === "signin"
                ? t("auth.login.title") || "Sign In"
                : t("auth.register.title") || "Create account"}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signin"
                ? t("auth.login.subtitle") || "Sign in to your account"
                : t("auth.register.subtitle") || "Create your account"}
            </p>
          </div>

          {mode === "signin" ? (
            <>
              {/* Google Sign-In */}
              <a
                href={googleHref}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                {t("auth.login.googleButton") ||
                  "Continue with Google"}
              </a>

              {/* Divider */}
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground">
                    {t("auth.login.orContinueWith") ||
                      "or continue with email"}
                  </span>
                </div>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="signin-email"
                    className="text-sm font-medium"
                  >
                    {t("auth.login.email") || "Email"}
                  </label>
                  <input
                    id="signin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label
                    htmlFor="signin-password"
                    className="text-sm font-medium"
                  >
                    {t("auth.login.password") || "Password"}
                  </label>
                  <input
                    id="signin-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading
                    ? t("auth.login.submitting") || "Signing in..."
                    : t("auth.login.submit") || "Sign In"}
                </button>
              </form>

              {/* Register switch */}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {t("auth.login.noAccount") || "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-medium text-primary hover:underline"
                >
                  {t("auth.login.registerLink") || "Create account"}
                </button>
              </p>
            </>
          ) : (
            <>
              <form onSubmit={handleSignupSubmit} className="space-y-4">
                {signupError && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {signupError}
                  </div>
                )}

                <div>
                  <label htmlFor="signup-fullName" className="text-sm font-medium">
                    {t("auth.register.fullName")}
                  </label>
                  <input
                    id="signup-fullName"
                    type="text"
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label htmlFor="signup-email" className="text-sm font-medium">
                    {t("auth.register.email")}
                  </label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label htmlFor="signup-password" className="text-sm font-medium">
                    {t("auth.register.password")}
                  </label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div>
                  <label
                    htmlFor="signup-confirmPassword"
                    className="text-sm font-medium"
                  >
                    {t("auth.register.confirmPassword")}
                  </label>
                  <input
                    id="signup-confirmPassword"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-input bg-transparent px-4 py-2.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={signupLoading}
                  className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {signupLoading
                    ? t("auth.register.submitting") || "Creating..."
                    : t("auth.register.submit") || "Create account"}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {t("auth.register.hasAccount") || "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-medium text-primary hover:underline"
                >
                  {t("auth.register.loginLink") || "Sign in"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
