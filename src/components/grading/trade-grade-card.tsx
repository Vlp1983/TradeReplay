"use client";

import type { TradeGrade, DimensionScore } from "@/lib/engine/grading";

interface TradeGradeCardProps {
  grade: TradeGrade;
}

function gradeColor(score: number): string {
  if (score >= 90) return "text-green-400";
  if (score >= 80) return "text-blue-400";
  if (score >= 70) return "text-yellow-400";
  if (score >= 60) return "text-orange-400";
  return "text-red-400";
}

function gradeBgColor(score: number): string {
  if (score >= 90) return "bg-green-400";
  if (score >= 80) return "bg-blue-400";
  if (score >= 70) return "bg-yellow-400";
  if (score >= 60) return "bg-orange-400";
  return "bg-red-400";
}

function DimensionRow({ dim }: { dim: DimensionScore }) {
  const barWidth = `${Math.max(dim.score, 2)}%`;
  const color = gradeColor(dim.score);
  const bgColor = gradeBgColor(dim.score);

  return (
    <div className="flex items-center gap-3">
      <div className="w-[130px] shrink-0">
        <span className="text-[13px] text-text-secondary">{dim.label}</span>
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-border/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bgColor}`}
            style={{ width: barWidth }}
          />
        </div>
      </div>
      <div className="w-[90px] shrink-0 text-right">
        <span className={`text-[13px] font-semibold ${color}`}>
          {dim.grade}
        </span>
        <span className="ml-1.5 text-[11px] text-text-muted">
          {dim.score}/100
        </span>
      </div>
    </div>
  );
}

export function TradeGradeCard({ grade }: TradeGradeCardProps) {
  const overallColor = gradeColor(grade.overall);
  const overallBg = gradeBgColor(grade.overall);

  return (
    <div className="rounded-[14px] border border-border bg-surface p-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-[13px] font-semibold text-accent">
          2
        </span>
        <h2 className="text-lg font-semibold text-text-primary">
          Your Trade Grade
        </h2>
      </div>

      {/* Hero grade */}
      <div className="mt-4 mb-6 flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
        {/* Big letter */}
        <div className="flex flex-col items-center">
          <span className={`text-6xl font-black tracking-tight ${overallColor}`}>
            {grade.letterGrade}
          </span>
          <span className="mt-1 text-[13px] text-text-muted">Overall Grade</span>
        </div>

        {/* Score bar */}
        <div className="flex-1 w-full sm:max-w-xs">
          <div className="mb-1 flex justify-between">
            <span className="text-[11px] font-medium text-text-muted">Score</span>
            <span className={`text-[13px] font-bold ${overallColor}`}>
              {grade.overall}/100
            </span>
          </div>
          <div className="h-3 rounded-full bg-border/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${overallBg}`}
              style={{ width: `${grade.overall}%` }}
            />
          </div>
        </div>
      </div>

      {/* Summary line */}
      <p className="mb-5 text-[13px] leading-relaxed text-text-secondary">
        {grade.summary}
      </p>

      {/* Dimension breakdown */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-muted">
          Breakdown
        </h3>
        {grade.dimensions.map((dim, i) => (
          <div key={i}>
            <DimensionRow dim={dim} />
            <p className="mt-0.5 ml-[142px] text-[11px] text-text-muted">
              {dim.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
