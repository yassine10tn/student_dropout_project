"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { registerUser, googleLogin, getCurrentUser } from "@/lib/api";

const MODELS = [
  { key: "mlp", label: "MLP", target: 71, color: "#4FB6C7", fill: "rgba(79,182,199,0.35)" },
  { key: "gru", label: "GRU", target: 83, color: "#4FB6C7", fill: "rgba(79,182,199,0.7)" },
  { key: "transformer", label: "Transformer", target: 92, color: "#D9A441", fill: "#D9A441" },
];

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // presentational-only state — does not touch the auth flow above
  const [mounted, setMounted] = useState(false);
  const [counts, setCounts] = useState({ mlp: 0, gru: 0, transformer: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMounted(true);

    if (reduced) {
      setCounts({ mlp: 71, gru: 83, transformer: 92 });
      return;
    }

    const duration = 1100;
    const start = performance.now() + 150; // let bars start growing first
    let raf: number;

    function tick(now: number) {
      const t = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCounts({
        mlp: Math.round(71 * eased),
        gru: Math.round(83 * eased),
        transformer: Math.round(92 * eased),
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerUser(email, password);
      setSuccess(true);
      setTimeout(() => router.push("/login"), 1000);
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
          document.getElementById("google-signup-button"),
          { theme: "outline", size: "large", width: 320, text: "signup_with" }
        );
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#FAFAF7] overflow-hidden">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      {/* Left: comparative-study panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#10121A] px-14 py-12">
        <div className="orb pointer-events-none absolute h-[28rem] w-[28rem] rounded-full opacity-[0.14] blur-3xl" />

        <span
          className={`relative text-sm font-medium text-[#FAFAF7]/70 transition-all duration-700 ease-out ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
        >
          Elios-Academy
        </span>

        <div className="relative">
          <h2 className="font-serif text-4xl leading-[1.15] text-[#FAFAF7] max-w-sm">
            {["Three architectures.", "One question: who", "spots risk first?"].map((line, i) => (
              <span key={line} className="block overflow-hidden">
                <span
                  className="block transition-all duration-700 ease-out"
                  style={{
                    transitionDelay: `${150 + i * 110}ms`,
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateY(0)" : "translateY(100%)",
                  }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h2>

          <p
            className="mt-4 text-sm leading-relaxed text-[#FAFAF7]/50 max-w-xs transition-all duration-700 ease-out"
            style={{
              transitionDelay: "560ms",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
            }}
          >
            Create an account to compare MLP, GRU, and Transformer models
            side by side on the same engagement data.
          </p>

          {/* model comparison bars */}
          <div
            className="mt-11 w-full max-w-md transition-opacity duration-500"
            style={{ transitionDelay: "650ms", opacity: mounted ? 1 : 0 }}
          >
            <div className="flex items-end gap-7 h-32">
              {MODELS.map((m, i) => (
                <div key={m.key} className="flex flex-col items-center gap-2 flex-1">
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: m.key === "transformer" ? "#D9A441" : "#FAFAF7B3" }}
                  >
                    {counts[m.key as keyof typeof counts]}%
                  </span>
                  <div className="relative w-full h-full flex items-end">
                    <div className="absolute inset-x-0 bottom-0 h-full w-full rounded-t-sm bg-[#FAFAF7]/[0.06]" />
                    <div
                      className="relative w-full rounded-t-sm origin-bottom transition-transform ease-out"
                      style={{
                        height: "100%",
                        backgroundColor: m.fill,
                        transitionDuration: "900ms",
                        transitionDelay: `${250 + i * 180}ms`,
                        transform: mounted ? `scaleY(${m.target / 100})` : "scaleY(0)",
                        boxShadow:
                          m.key === "transformer" && mounted
                            ? "0 0 18px rgba(217,164,65,0.35)"
                            : "none",
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-[#FAFAF7]/40">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-[#FAFAF7]/35">
              <span>early-week accuracy</span>
              <span className="inline-flex items-center gap-1.5 text-[#D9A441]/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#D9A441] opacity-60 ping-slow" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#D9A441]" />
                </span>
                best fit
              </span>
            </div>
          </div>
        </div>

        <p
          className="relative text-xs text-[#FAFAF7]/35 transition-all duration-700 ease-out"
          style={{ transitionDelay: "750ms", opacity: mounted ? 1 : 0 }}
        >
          A comparative study of sequence models for early dropout detection.
        </p>
      </div>

      {/* Right: form panel */}
      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div
            className="mb-9 transition-all duration-600 ease-out"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(10px)" }}
          >
            <h1 className="font-serif text-3xl text-[#10121A]">Create account</h1>
            <p className="mt-2 text-sm text-[#6B6E76]">
              Join Elios-Academy to run and compare dropout-risk models.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 border-l-2 border-[#B3261E] bg-[#B3261E]/5 py-2.5 pl-3.5 text-sm text-[#B3261E] fade-in-fast"
            >
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-center gap-3 border-l-2 border-[#4FB6C7] bg-[#4FB6C7]/5 py-2.5 pl-3.5 text-sm text-[#10121A] fade-in-fast">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" stroke="#4FB6C7" strokeWidth="1.5" className="check-ring" />
                <path
                  d="M7 12.5l3 3 7-7"
                  stroke="#4FB6C7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength={1}
                  className="check-mark"
                />
              </svg>
              <span>Account created. Taking you to sign in…</span>
            </div>
          )}

          <div className="space-y-6">
            {[
              { id: "email", label: "Email", type: "email", value: email, set: setEmail, ph: "you@university.edu", ac: "email" },
              { id: "password", label: "Password", type: "password", value: password, set: setPassword, ph: "••••••••", ac: "new-password" },
            ].map((f, i) => (
              <div
                key={f.id}
                className="group relative transition-all ease-out"
                style={{
                  transitionDuration: "600ms",
                  transitionDelay: `${180 + i * 90}ms`,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(8px)",
                }}
              >
                <label htmlFor={f.id} className="block text-sm text-[#10121A] mb-1.5">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={f.type}
                  required
                  autoComplete={f.ac}
                  placeholder={f.ph}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="peer w-full border-0 border-b-2 border-[#10121A]/15 bg-transparent px-0 py-2.5 text-[#10121A] placeholder:text-[#6B6E76]/40 outline-none"
                />
                <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#4FB6C7] transition-transform duration-300 ease-out peer-focus:scale-x-100" />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-shine relative mt-9 flex w-full items-center justify-center gap-2 overflow-hidden bg-[#10121A] py-3 text-sm font-medium text-[#FAFAF7] transition-all duration-200 hover:bg-[#4FB6C7] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              transitionDelay: mounted ? "0ms" : "360ms",
              opacity: mounted ? 1 : 0,
              transform: mounted ? "translateY(0)" : "translateY(8px)",
            }}
          >
            {loading && (
              <svg className="h-4 w-4 animate-spin text-[#FAFAF7]/70" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            <span className="relative z-10">{loading ? "Creating account…" : "Register"}</span>
          </button>

          <div
            className="mt-8 flex items-center gap-3 transition-opacity duration-700"
            style={{ transitionDelay: "550ms", opacity: mounted ? 1 : 0 }}
          >
            <div className="h-px flex-1 bg-[#10121A]/10" />
            <span className="text-xs text-[#6B6E76]">or</span>
            <div className="h-px flex-1 bg-[#10121A]/10" />
          </div>

          <div
            className="mt-6 flex justify-center transition-opacity duration-700"
            style={{ transitionDelay: "600ms", opacity: mounted ? 1 : 0 }}
            id="google-signup-button"
          />

          <p
            className="mt-8 text-center text-sm text-[#6B6E76] transition-opacity duration-700"
            style={{ transitionDelay: "500ms", opacity: mounted ? 1 : 0 }}
          >
            Already have an account?{" "}
            <Link href="/login" className="text-[#10121A] underline underline-offset-4 hover:text-[#4FB6C7]">
              Log in
            </Link>
          </p>
        </form>
      </div>

      <style jsx>{`
        .orb {
          left: -8rem;
          bottom: -6rem;
          background: radial-gradient(circle, #d9a441 0%, transparent 70%);
          animation: drift 14s ease-in-out infinite;
        }
        @keyframes drift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(60px, -40px) scale(1.15);
          }
        }
        .ping-slow {
          animation: pingSlow 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes pingSlow {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          75%,
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
        .check-ring {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: draw 0.4s ease-out forwards;
        }
        .check-mark {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: draw 0.35s ease-out 0.3s forwards;
        }
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        .fade-in-fast {
          animation: fadeIn 0.35s ease-out both;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .btn-shine::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.18) 40%, transparent 60%);
          transform: translateX(-120%);
          transition: transform 0.6s ease;
        }
        .btn-shine:hover::after {
          transform: translateX(120%);
        }
        @media (prefers-reduced-motion: reduce) {
          .orb,
          .ping-slow,
          .check-ring,
          .check-mark,
          .fade-in-fast,
          .btn-shine::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}