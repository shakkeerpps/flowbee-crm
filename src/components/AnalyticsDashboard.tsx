import React from 'react';
// Change line 2 to use "import type":
import type { Lead, DailySpendLog, CampaignTarget, PlatformReport, PlatformName } from '../types';
import { TrendingUp, DollarSign, Users, MousePointer, Target } from 'lucide-react';

interface AnalyticsDashboardProps {
  leads: Lead[];
  spendLogs: DailySpendLog[];
  targets: CampaignTarget[];
}

const ALL_PLATFORMS: PlatformName[] = [
  'Meta (FB/IG)',
  'Google Ads',
  'TikTok',
  'LinkedIn',
  'Snapchat',
];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  leads,
  spendLogs,
  targets,
}) => {
  // 1. Calculate platform-wise reports
  const platformReports: PlatformReport[] = ALL_PLATFORMS.map((platform) => {
    // Filter spend logs for this platform
    const platformSpends = spendLogs.filter((s) => s.platform === platform);
    const totalSpend = platformSpends.reduce((acc, curr) => acc + curr.spendAmount, 0);
    const totalClicks = platformSpends.reduce((acc, curr) => acc + curr.clicks, 0);

    // Filter leads for this platform
    const platformLeads = leads.filter((l) => l.platform === platform);
    const totalLeads = platformLeads.length;

    // Target budget setup
    const targetObj = targets.find((t) => t.platform === platform);
    const targetBudget = targetObj ? targetObj.targetBudget : 0;

    // Key calculations
    const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const balanceToSpend = targetBudget - totalSpend;
    const budgetSpentPercent = targetBudget > 0 ? Math.min((totalSpend / targetBudget) * 100, 100) : 0;

    return {
      platform,
      totalSpend,
      totalClicks,
      totalLeads,
      avgCPC,
      costPerLead,
      targetBudget,
      balanceToSpend,
      budgetSpentPercent,
    };
  });

  // 2. High-level totals across ALL platforms
  const grandTotalSpend = platformReports.reduce((acc, r) => acc + r.totalSpend, 0);
  const grandTotalClicks = platformReports.reduce((acc, r) => acc + r.totalClicks, 0);
  const grandTotalLeads = platformReports.reduce((acc, r) => acc + r.totalLeads, 0);
  const grandTotalBudget = platformReports.reduce((acc, r) => acc + r.targetBudget, 0);
  const overallAvgCPC = grandTotalClicks > 0 ? grandTotalSpend / grandTotalClicks : 0;
  const overallCPL = grandTotalLeads > 0 ? grandTotalSpend / grandTotalLeads : 0;
  const remainingTotalBalance = grandTotalBudget - grandTotalSpend;

  return (
    <div className="space-y-6">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Spend */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ad Spend</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">${grandTotalSpend.toLocaleString()}</h3>
            <p className="text-xs text-slate-400 mt-1">Budget: ${grandTotalBudget.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Total Clicks & Avg CPC */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Avg CPC</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">${overallAvgCPC.toFixed(2)}</h3>
            <p className="text-xs text-slate-400 mt-1">{grandTotalClicks.toLocaleString()} Total Clicks</p>
          </div>
          <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
            <MousePointer size={24} />
          </div>
        </div>

        {/* Total Leads & CPL */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cost Per Lead (CPL)</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">${overallCPL.toFixed(2)}</h3>
            <p className="text-xs text-slate-400 mt-1">{grandTotalLeads} Total Leads</p>
          </div>
          <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
            <Users size={24} />
          </div>
        </div>

        {/* Remaining Budget */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Remaining Balance</p>
            <h3 className={`text-2xl font-bold mt-1 ${remainingTotalBalance < 0 ? 'text-red-600' : 'text-slate-800'}`}>
              ${remainingTotalBalance.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Target Balance</p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
            <Target size={24} />
          </div>
        </div>
      </div>

      {/* 2. PLATFORM WISE REPORT TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <TrendingUp className="text-blue-600" size={20} />
            <h2 className="font-bold text-slate-800 text-lg">Platform Performance & Budget Report</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="p-4">Platform</th>
                <th className="p-4">Total Spend</th>
                <th className="p-4">Clicks</th>
                <th className="p-4">Avg. CPC</th>
                <th className="p-4">Leads</th>
                <th className="p-4">Cost / Lead</th>
                <th className="p-4">Target Budget</th>
                <th className="p-4">Balance</th>
                <th className="p-4 w-40">Budget Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {platformReports.map((report) => (
                <tr key={report.platform} className="hover:bg-slate-50 transition">
                  <td className="p-4 font-semibold text-slate-800">{report.platform}</td>
                  <td className="p-4 font-medium">${report.totalSpend.toLocaleString()}</td>
                  <td className="p-4">{report.totalClicks.toLocaleString()}</td>
                  <td className="p-4 font-medium text-emerald-600">${report.avgCPC.toFixed(2)}</td>
                  <td className="p-4 font-semibold text-blue-600">{report.totalLeads}</td>
                  <td className="p-4 font-medium text-purple-600">${report.costPerLead.toFixed(2)}</td>
                  <td className="p-4">${report.targetBudget.toLocaleString()}</td>
                  <td className={`p-4 font-semibold ${report.balanceToSpend < 0 ? 'text-red-500' : 'text-slate-700'}`}>
                    ${report.balanceToSpend.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full ${
                          report.budgetSpentPercent > 90
                            ? 'bg-red-500'
                            : report.budgetSpentPercent > 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${report.budgetSpentPercent}%` }}
                      ></div>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {report.budgetSpentPercent.toFixed(1)}% spent
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};