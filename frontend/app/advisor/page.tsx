"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getToken, clearToken, predictDropout, getHistory,
  PredictResponse, PredictionHistoryItem,
} from "@/lib/api";
import NotificationsBell from "@/components/notifications-bell";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"] });

const INK = "#14181F";
const MUTED = "#5B6169";
const RULE = "#DADDD7";
const PAPER = "#F5F5F1";
const RISK = "#B8432B";
const SAFE = "#1B7A5E";
const SIGNAL = "#3B4FD9";
const WEEKS = 40;
const MAX_SCALE = 200;

type Mode = "visual" | "paste";

function parseRaw(text: string): number[] {
  return text
    .split(",")
    .map((v) => parseFloat(v.trim()))
    .filter((v) => !isNaN(v));
}

function buildPreset(kind: "atRisk" | "engaged" | "lateDecline"): number[] {
  return Array.from({ length: WEEKS }, (_, i) => {
    if (kind === "engaged") {
      return Math.round(90 + Math.random() * 40 - 20);
    }
    if (kind === "lateDecline") {
      if (i < 28) return Math.round(80 + Math.random() * 30);
      return Math.round(20 - i * 0.3 + Math.random() * 10);
    }
    // atRisk: early moderate use, a mid-term spike, then a sharp drop-off
    if (i < 20) return Math.round(15 + Math.random() * 10);
    if (i < 34) return Math.round(60 + Math.random() * 100);
    return Math.round(5 + Math.random() * 10);
  }).map((v) => Math.max(0, v));
}

function SequenceEditor({
  values,
  onChange,
}: {
  values: number[];
  onChange: (v: number[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function setValueAtIndex(index: number, clientY: number) {
    const bar = containerRef.current?.children[index] as HTMLElement | undefined;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const next = [...values];
    next[index] = Math.round(ratio * MAX_SCALE);
    onChange(next);
  }

  function handlePointerDown(index: number, e: React.PointerEvent) {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setValueAtIndex(index, e.clientY);
  }

  function handlePointerMove(index: number, e: React.PointerEvent) {
    if (!draggingRef.current) return;
    setValueAtIndex(index, e.clientY);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    let delta = 0;
    if (e.key === "ArrowUp") delta = 5;
    else if (e.key === "ArrowDown") delta = -5;
    else return;
    e.preventDefault();
    const next = [...values];
    next[index] = Math.min(MAX_SCALE, Math.max(0, (next[index] || 0) + delta));
    onChange(next);
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="flex items-end gap-[2px] h-32 select-none touch-none"
        onPointerUp={() => (draggingRef.current = false)}
        onPointerLeave={() => (draggingRef.current = false)}
      >
        {values.map((v, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={MAX_SCALE}
            aria-valuenow={v}
            aria-label={`Week ${i} engagement, ${v} clicks`}
            onPointerDown={(e) => handlePointerDown(i, e)}
            onPointerMove={(e) => handlePointerMove(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="group flex-1 h-full flex items-end cursor-ns-resize outline-none"
          >
            <div
              className="w-full rounded-[1px] motion-safe:transition-[height,opacity] duration-150 group-focus-visible:ring-2 group-focus-visible:ring-offset-1"
              style={{
                height: `${Math.min(100, (v / MAX_SCALE) * 100)}%`,
                minHeight: 2,
                backgroundColor: SIGNAL,
                opacity: 0.3 + 0.7 * Math.min(1, v / MAX_SCALE),
                boxShadow: `0 0 0 2px transparent`,
              }}
            />
          </div>
        ))}
      </div>
      <div className={mono.className + " flex justify-between mt-1 text-[10px]"} style={{ color: MUTED }}>
        <span>wk 0</span>
        <span>wk 10</span>
        <span>wk 20</span>
        <span>wk 30</span>
        <span>wk 39</span>
      </div>
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const isRisk = score >= 0.5;
  const color = isRisk ? RISK : SAFE;
  return (
    <div className="relative w-full max-w-[210px] mx-auto">
      <svg viewBox="0 0 200 120" className="w-full">
        <path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke={RULE} strokeWidth="14" strokeLinecap="round" />
        <path
          d="M20,100 A80,80 0 0 1 180,100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - Math.min(1, Math.max(0, score))}
          style={{ transition: "stroke-dashoffset 700ms cubic-bezier(.22,1,.36,1), stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-x-0 top-[56%] -translate-y-1/2 text-center">
        <p className={mono.className + " text-3xl font-semibold"} style={{ color: INK }}>
          {(score * 100).toFixed(1)}%
        </p>
        <p className="text-xs mt-1" style={{ color: isRisk ? RISK : SAFE }}>
          {isRisk ? "At risk" : "Not at risk"}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [studentLabel, setStudentLabel] = useState("");
  const [mode, setMode] = useState<Mode>("visual");
  const [values, setValues] = useState<number[]>(() => Array(WEEKS).fill(0));
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getHistory().then(setHistory).catch(() => {});
  }, [router]);

  const activeValues = mode === "visual" ? values : parseRaw(rawText);
  const filledCount = mode === "visual" ? values.filter((v) => v > 0).length : activeValues.length;

  const stats = useMemo(() => {
    if (activeValues.length === 0) return null;
    const avg = activeValues.reduce((a, b) => a + b, 0) / activeValues.length;
    const half = Math.floor(activeValues.length / 2);
    const firstHalf = activeValues.slice(0, half);
    const secondHalf = activeValues.slice(half);
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
    const trend = avgSecond - avgFirst;
    return { avg, trend };
  }, [activeValues]);

  function applyPreset(kind: "atRisk" | "engaged" | "lateDecline") {
    const preset = buildPreset(kind);
    setValues(preset);
    setRawText(preset.join(","));
    setMode("visual");
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "paste") setRawText(values.join(","));
    else {
      const parsed = parseRaw(rawText);
      const padded = Array.from({ length: WEEKS }, (_, i) => Math.min(MAX_SCALE, Math.max(0, parsed[i] ?? 0)));
      setValues(padded);
    }
    setMode(next);
  }

  async function handlePredict(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const submitValues = mode === "visual" ? values : parseRaw(rawText);

    if (submitValues.length !== WEEKS) {
      setError(`Expected ${WEEKS} comma-separated weekly values, got ${submitValues.length}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await predictDropout(submitValues, studentLabel || "Unnamed student");
      setResult(res);
      getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  const chartData = useMemo(
    () => result?.attention_by_week.map((v, i) => ({ week: i, attention: v })) || [],
    [result]
  );

  const topIndices = useMemo(() => {
    if (!result) return new Set<number>();
    const ranked = result.attention_by_week
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map((r) => r.i);
    return new Set(ranked);
  }, [result]);

  // Attention (Transformer) vs. gradient-based saliency (MLP/GRU) — same
  // shape of data, different meaning, so label the chart accordingly
  // instead of always implying it's attention.
  const isAttention = result?.interpretability_method !== "saliency";
  const chartLabel = isAttention ? "Attention by week" : "Feature importance by week";
  const chartExplainer = isAttention
    ? "which weeks influenced the prediction most"
    : "which weeks the model's gradient was most sensitive to (this architecture has no native attention mechanism)";

  return (
    <div className={display.className} style={{ backgroundColor: PAPER, minHeight: "100vh", color: INK }}>
      <header className="border-b px-6 py-5" style={{ borderColor: RULE }}>
        <div className="max-w-5xl mx-auto flex justify-between items-start gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dropout risk console</h1>
            <p className="text-sm mt-1 max-w-xl" style={{ color: MUTED }}>
              Predicting student dropout risk from weekly engagement sequences — a comparative study of MLP, GRU
              and Transformer architectures.
            </p>
          </div>
          <NotificationsBell />
        </div>
        <div className="max-w-5xl mx-auto flex gap-2 mt-4">
          {["MLP", "GRU", "Transformer"].map((m) => (
            <span
              key={m}
              className={mono.className + " text-[11px] px-2 py-1 rounded border"}
              style={{
                borderColor: RULE,
                color: result?.model_architecture === m ? PAPER : MUTED,
                backgroundColor: result?.model_architecture === m ? SIGNAL : "transparent",
              }}
            >
              {m}
            </span>
          ))}
          <span className="text-[11px] self-center" style={{ color: MUTED }}>
            {result?.model_architecture
              ? `active model: ${result.model_architecture}`
              : "architectures compared in this study"}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 grid md:grid-cols-5 gap-6">
        <section className="md:col-span-3 border rounded-lg p-6" style={{ borderColor: RULE }}>
          <h2 className="text-base font-semibold mb-4">Input console</h2>
          <form onSubmit={handlePredict} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">Student label (optional)</label>
              <input
                type="text"
                value={studentLabel}
                onChange={(e) => setStudentLabel(e.target.value)}
                placeholder="e.g. Student #123"
                className="w-full border rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
                style={{ borderColor: RULE }}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Weekly engagement, {WEEKS} weeks
                </label>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => switchMode("visual")}
                    className="px-2 py-1 rounded border"
                    style={{
                      borderColor: RULE,
                      backgroundColor: mode === "visual" ? INK : "transparent",
                      color: mode === "visual" ? PAPER : MUTED,
                    }}
                  >
                    Sequence editor
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("paste")}
                    className="px-2 py-1 rounded border"
                    style={{
                      borderColor: RULE,
                      backgroundColor: mode === "paste" ? INK : "transparent",
                      color: mode === "paste" ? PAPER : MUTED,
                    }}
                  >
                    Paste values
                  </button>
                </div>
              </div>

              {mode === "visual" ? (
                <SequenceEditor values={values} onChange={setValues} />
              ) : (
                <div className="space-y-2">
                  <SequenceEditor
                    values={Array.from({ length: WEEKS }, (_, i) => Math.min(MAX_SCALE, Math.max(0, parseRaw(rawText)[i] ?? 0)))}
                    onChange={() => {}}
                  />
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={3}
                    placeholder="10,15,20,18,..."
                    className={mono.className + " w-full border rounded-md px-3 py-2 text-xs"}
                    style={{ borderColor: RULE }}
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs" style={{ color: MUTED }}>Presets:</span>
                <button type="button" onClick={() => applyPreset("atRisk")} className="text-xs underline underline-offset-2" style={{ color: RISK }}>
                  At-risk pattern
                </button>
                <button type="button" onClick={() => applyPreset("lateDecline")} className="text-xs underline underline-offset-2" style={{ color: SIGNAL }}>
                  Late decline
                </button>
                <button type="button" onClick={() => applyPreset("engaged")} className="text-xs underline underline-offset-2" style={{ color: SAFE }}>
                  Consistently engaged
                </button>
              </div>
            </div>

            {stats && (
              <div className={mono.className + " flex gap-6 text-xs pt-2 border-t"} style={{ borderColor: RULE, color: MUTED }}>
                <span>filled: {filledCount}/{WEEKS}</span>
                <span>avg: {stats.avg.toFixed(1)} clicks/wk</span>
                <span>
                  trend: {stats.trend >= 0 ? "+" : ""}
                  {stats.trend.toFixed(1)}
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm rounded-md px-3 py-2" style={{ color: RISK, backgroundColor: "#B8432B14" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm font-medium motion-safe:transition-opacity disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
              style={{ backgroundColor: SIGNAL, color: PAPER }}
            >
              {loading ? "Running model…" : "Run prediction"}
            </button>
          </form>
        </section>

        <section className="md:col-span-2 border rounded-lg p-6" style={{ borderColor: RULE }}>
          <h2 className="text-base font-semibold mb-4">Readout</h2>
          {!result ? (
            <p className="text-sm" style={{ color: MUTED }}>
              Run a prediction to see the risk score and which weeks drove it.
            </p>
          ) : (
            <div className="space-y-6">
              <RiskGauge score={result.risk_score} />
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: INK }}>
                  {chartLabel}
                </p>
                <p className="text-xs mb-2" style={{ color: MUTED }}>
                  {chartExplainer}
                </p>
                <AttentionChart data={chartData} topIndices={topIndices} />
                <div className={mono.className + " flex gap-3 text-[11px] mt-2"} style={{ color: MUTED }}>
                  <span style={{ color: RISK }}>■</span> top 3 weeks
                  <span style={{ color: SIGNAL, marginLeft: 8 }}>■</span> other weeks
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="md:col-span-5 border rounded-lg p-6" style={{ borderColor: RULE }}>
          <h2 className="text-base font-semibold mb-4">Session log</h2>
          {history.length === 0 ? (
            <p className="text-sm" style={{ color: MUTED }}>
              No predictions yet — run one above and it will show up here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: RULE, color: MUTED }}>
                  <th className="py-2 font-medium">Student</th>
                  <th className="py-2 font-medium">Risk score</th>
                  <th className="py-2 font-medium">Prediction</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b" style={{ borderColor: RULE }}>
                    <td className="py-2">{h.student_label || "—"}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: RULE }}>
                          <div
                            className="h-full"
                            style={{
                              width: `${h.risk_score * 100}%`,
                              backgroundColor: h.predicted_dropout ? RISK : SAFE,
                            }}
                          />
                        </div>
                        <span className={mono.className + " text-xs"}>{(h.risk_score * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                          borderColor: h.predicted_dropout ? RISK : SAFE,
                          color: h.predicted_dropout ? RISK : SAFE,
                        }}
                      >
                        {h.predicted_dropout ? "At risk" : "Not at risk"}
                      </span>
                    </td>
                    <td className={mono.className + " py-2 text-xs"} style={{ color: MUTED }}>
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

function AttentionChart({
  data,
  topIndices,
}: {
  data: { week: number; attention: number }[];
  topIndices: Set<number>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={RULE} vertical={false} />
        <XAxis dataKey="week" tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={{ stroke: RULE }} interval={4} />
        <YAxis tick={{ fill: MUTED, fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          cursor={{ fill: "rgba(20,24,31,0.04)" }}
          contentStyle={{ border: `1px solid ${RULE}`, borderRadius: 6, fontSize: 12 }}
          labelFormatter={(w) => `Week ${w}`}
        />
        <Bar dataKey="attention" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={topIndices.has(i) ? RISK : SIGNAL} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}