"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { AdminAnalytics, getAdminAnalytics } from "@/lib/api";

const COLORS = ["#3B4FD9", "#1B7A5E", "#B8432B", "#C9A227", "#6B5CE0"];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "follow_up_needed") return "Follow-up needed";
  if (status === "completed") return "Completed";
  if (status === "open") return "Open";
  return status;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminAnalytics()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{error || "Failed to load analytics."}</p>;
  }

  const hasArchData = data.predictions_by_architecture.length > 0;
  const hasInterventionData = data.interventions_by_status.length > 0;
  const hasTimeData = data.predictions_over_time.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform-wide activity across students, predictions, and advisor interventions.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Students" value={String(data.total_students)} />
        <StatCard label="Courses" value={String(data.total_courses)} />
        <StatCard label="Predictions run" value={String(data.total_predictions)} />
        <StatCard
          label="Dropout rate"
          value={`${(data.dropout_rate * 100).toFixed(1)}%`}
          sub="share of predictions flagged at-risk"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border p-6">
          <h2 className="text-base font-semibold mb-1">Predictions by architecture</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Volume and average risk score per model, across all recorded predictions.
          </p>
          {!hasArchData ? (
            <p className="text-sm text-muted-foreground">
              No predictions recorded with a model version attached yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.predictions_by_architecture}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="architecture" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 1]}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: any, name: any) =>
                    name === "avg_risk_score"
                      ? [`${(Number(value) * 100).toFixed(1)}%`, "Avg. risk score"]
                      : [value, "Predictions"]
                  }
                />
                <Legend
                  formatter={(value) => (value === "count" ? "Predictions" : "Avg. risk score")}
                />
                <Bar yAxisId="left" dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="avg_risk_score" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="text-base font-semibold mb-1">Interventions by status</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Where advisor follow-ups currently stand, across all students.
          </p>
          {!hasInterventionData ? (
            <p className="text-sm text-muted-foreground">No interventions logged yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.interventions_by_status}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry: any) => statusLabel(entry.name)}
                >
                  {data.interventions_by_status.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any) => [value, statusLabel(name)]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="text-base font-semibold mb-1">Predictions over time</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Daily count of predictions run across all advisors.
        </p>
        {!hasTimeData ? (
          <p className="text-sm text-muted-foreground">No predictions recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.predictions_over_time}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}