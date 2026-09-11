"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { loginUser, googleLogin, getCurrentUser } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginUser(email, password);
      const user = await getCurrentUser();
      router.push(user.role === "admin" ? "/admin" : "/advisor");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleResponse(response: { credential: string }) {
    setError("");
    setLoading(true);
    try {
      await googleLogin(response.credential);
      const user = await getCurrentUser();
      router.push(user.role === "admin" ? "/admin" : "/advisor");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).google) {
        (window as any).google.accounts.id.initialize({
          client_id:
            "343447869611-7ahflff4trudppbhbq3eur5dniuja7ri.apps.googleusercontent.com",
          callback: handleGoogleResponse,
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById("google-signin-button"),
          { theme: "outline", size: "large", width: 320 }
        );
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAF7]">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      {/* Left: signal / brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#10121A] px-14 py-12">
        <div
          className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "#4FB6C7" }}
        />

        <span className="relative text-sm font-medium text-[#FAFAF7]/70">
          Elios-Academy
        </span>

        <div className="relative">
          <p className="font-serif text-4xl leading-[1.15] text-[#FAFAF7] max-w-sm">
            Eighteen weeks of signal. One risk score.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#FAFAF7]/50 max-w-xs">
            Elios-Academy compares MLP, GRU, and Transformer models to flag
            at-risk students before week twelve.
          </p>

          {/* engagement sequence chart */}
          <div className="mt-10 w-full max-w-md">
            <svg
              viewBox="0 0 380 160"
              className="w-full h-auto overflow-visible"
              aria-hidden="true"
            >
              {/* risk threshold */}
              <line
                x1="0"
                y1="100"
                x2="380"
                y2="100"
                stroke="#FAFAF7"
                strokeOpacity="0.15"
                strokeWidth="1"
                strokeDasharray="4 5"
                className="risk-line"
              />
              {/* engagement path */}
              <path
                d="M10,30 L32,25 L55,35 L77,40 L99,38 L122,55 L144,60 L166,58 L188,75 L211,80 L233,95 L255,90 L277,110 L300,120 L322,130 L344,125 L366,145"
                fill="none"
                stroke="#4FB6C7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                className="signal-path"
              />
              {/* risk marker at flagged week */}
              <circle cx="366" cy="145" r="4" fill="#D9A441" className="risk-dot" />
              <circle
                cx="366"
                cy="145"
                r="4"
                fill="none"
                stroke="#D9A441"
                strokeWidth="1.5"
                className="risk-ring"
              />
            </svg>
            <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-[#FAFAF7]/35">
              <span>Wk 01</span>
              <span className="text-[#D9A441]/70">flagged · wk 17</span>
              <span>Wk 18</span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-[#FAFAF7]/35">
          A comparative study of sequence models for early dropout detection.
        </p>
      </div>

      {/* Right: form panel */}
      <div className="flex items-center justify-center px-6 py-16">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm form-rise"
        >
          <div className="mb-9">
            <h1 className="font-serif text-3xl text-[#10121A]">Sign in</h1>
            <p className="mt-2 text-sm text-[#6B6E76]">
              Access your dropout-risk dashboards and model comparisons.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 border-l-2 border-[#B3261E] bg-[#B3261E]/5 py-2.5 pl-3.5 text-sm text-[#B3261E]"
            >
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="group relative">
              <label htmlFor="email" className="block text-sm text-[#10121A] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="peer w-full border-0 border-b-2 border-[#10121A]/15 bg-transparent px-0 py-2.5 text-[#10121A] placeholder:text-[#6B6E76]/40 outline-none"
              />
              <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#4FB6C7] transition-transform duration-300 ease-out peer-focus:scale-x-100" />
            </div>

            <div className="group relative">
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="text-sm text-[#10121A]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#6B6E76] hover:text-[#4FB6C7] transition-colors"
                >
                  Forgot it?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="peer w-full border-0 border-b-2 border-[#10121A]/15 bg-transparent px-0 py-2.5 text-[#10121A] placeholder:text-[#6B6E76]/40 outline-none"
              />
              <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#4FB6C7] transition-transform duration-300 ease-out peer-focus:scale-x-100" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-9 flex w-full items-center justify-center gap-2 bg-[#10121A] py-3 text-sm font-medium text-[#FAFAF7] transition-all duration-200 hover:bg-[#4FB6C7] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin text-[#FAFAF7]/70" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#10121A]/10" />
            <span className="text-xs text-[#6B6E76]">or</span>
            <div className="h-px flex-1 bg-[#10121A]/10" />
          </div>

          <div className="mt-6 flex justify-center" id="google-signin-button" />

          <p className="mt-8 text-center text-sm text-[#6B6E76]">
            New here?{" "}
            <Link href="/register" className="text-[#10121A] underline underline-offset-4 hover:text-[#4FB6C7]">
              Create an account
            </Link>
          </p>
        </form>
      </div>

      <style jsx>{`
        .signal-path {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: draw 1.4s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards;
        }
        .risk-line {
          opacity: 0;
          animation: fadeIn 0.6s ease-out 1.3s forwards;
        }
        .risk-dot {
          opacity: 0;
          animation: fadeIn 0.4s ease-out 1.5s forwards;
        }
        .risk-ring {
          opacity: 0;
          transform-origin: 366px 145px;
          animation: fadeIn 0.4s ease-out 1.5s forwards, pulseRing 2s ease-out 1.9s infinite;
        }
        .form-rise {
          animation: riseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }
        @keyframes pulseRing {
          0% {
            transform: scale(1);
            opacity: 0.9;
          }
          80% {
            transform: scale(2.6);
            opacity: 0;
          }
          100% {
            transform: scale(2.6);
            opacity: 0;
          }
        }
        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .signal-path,
          .risk-line,
          .risk-dot,
          .risk-ring,
          .form-rise {
            animation: none !important;
            opacity: 1 !important;
            stroke-dashoffset: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}