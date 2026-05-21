import React from 'react';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">{label}</p>
        <p className="text-2xl font-bold text-primary mb-1">{value}</p>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full", 
          trend.includes('+') ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
        )}>
          {trend}
        </span>
      </div>
      <div className="p-3 bg-slate-50 rounded-xl">
        {icon}
      </div>
    </div>
  );
}
