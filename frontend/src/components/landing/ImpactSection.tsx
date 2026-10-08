import React from 'react';
import { TrendingUp, IndianRupee, Shield, Leaf, Zap } from 'lucide-react';

export const ImpactSection: React.FC = () => {
  const stats = [
    {
      value: '₹4.8 Cr+',
      label: 'Projected 5-Year Campus Savings',
      description: 'Via peak shaving, dynamic VNM energy routing, and avoided maximum demand charges.',
      icon: IndianRupee,
      color: 'text-amber-400',
    },
    {
      value: '84.2%',
      label: 'Average Clean Self-Consumption',
      description: 'Solar & wind generation utilized directly on-site rather than curtalied or spilled.',
      icon: Zap,
      color: 'text-emerald-400',
    },
    {
      value: '2,400+ MT',
      label: 'Carbon Dioxide (CO₂) Abated',
      description: 'Equivalent to planting over 110,000 mature neem and khejri trees across Rajasthan.',
      icon: Leaf,
      color: 'text-teal-400',
    },
    {
      value: '99.98%',
      label: 'Critical Facility Power SLA',
      description: 'Continuous uninterrupted power guaranteed to computer centers, servers, and labs.',
      icon: Shield,
      color: 'text-sky-400',
    },
  ];

  return (
    <section id="impact" className="relative w-full bg-slate-950 py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
      <div className="relative mx-auto max-w-7xl">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Statewide Economic & Climate Impact</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Quantifiable Results for Rajasthan Higher Education
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-300">
            Empowering technical colleges and polytechnic institutes with self-sustaining clean energy economics.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div
                key={idx}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur-xl transition-all hover:border-amber-400/40 hover:bg-slate-900/80"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className={`mt-4 text-3xl font-black tracking-tight font-mono ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-white">
                  {stat.label}
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{stat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
