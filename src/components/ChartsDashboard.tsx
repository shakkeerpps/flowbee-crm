import React, { useState } from 'react';
import type { Lead, DailySpendLog, SalesRep } from '../types';
import type { Activity } from '../App';
import {
  Trophy,
  Users,
  Target,
  DollarSign,
  TrendingUp,
  MousePointerClick,
  Award,
  BarChart2,
  PieChart,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
  Calculator
} from 'lucide-react';

interface ChartsDashboardProps {
  spendLogs: DailySpendLog[];
  leads: Lead[];
  salesReps: SalesRep[];
  activities?: Activity[];
}

export const ChartsDashboard: React.FC<ChartsDashboardProps> = ({
  spendLogs,
  leads,
  salesReps,
  activities = []
}) => {
  // 🗓️ CURRENT MONTH DEFAULT DATES (ഈ മാസത്തെ ഒന്നാം തീയതി മുതൽ ഇന്ന് വരെ)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
  const [toDate, setToDate] = useState<string>(todayStr);

  // --- FILTERING DATA BASED ON DATE RANGE ---
  const filteredSpendLogs = spendLogs.filter(s => {
    const matchesFrom = !fromDate || s.date >= fromDate;
    const matchesTo = !toDate || s.date <= toDate;
    return matchesFrom && matchesTo;
  });

  const filteredLeads = leads.filter(l => {
    const matchesFrom = !fromDate || (l.dateAdded && l.dateAdded >= fromDate);
    const matchesTo = !toDate || (l.dateAdded && l.dateAdded <= toDate);
    return matchesFrom && matchesTo;
  });

  // --- OVERALL CALCULATIONS ---
  const totalSpend = filteredSpendLogs.reduce((acc, curr) => acc + curr.spendAmount, 0);
  const totalClicks = filteredSpendLogs.reduce((acc, curr) => acc + curr.clicks, 0);
  const totalLeads = filteredLeads.length;
  const closedWonLeads = filteredLeads.filter(l => l.status === 'Closed Won').length;
  const closedLostLeads = filteredLeads.filter(l => l.status === 'Closed Lost').length;

  const overallCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';
  const overallCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';
  const overallWinRate = totalLeads > 0 ? ((closedWonLeads / totalLeads) * 100).toFixed(1) : '0.0';

  // --- SALESMAN PERFORMANCE SCOPE ---
  const salesmanStats = salesReps.map(rep => {
    const repLeads = filteredLeads.filter(l => l.assignedSalesId === rep.id);
    const wonCount = repLeads.filter(l => l.status === 'Closed Won').length;
    const lostCount = repLeads.filter(l => l.status === 'Closed Lost').length;
    const conversionRate = repLeads.length > 0 ? Number(((wonCount / repLeads.length) * 100).toFixed(1)) : 0;

    return {
      ...rep,
      totalLeads: repLeads.length,
      wonCount,
      lostCount,
      conversionRate
    };
  });

  const sortedSalesmen = [...salesmanStats].sort((a, b) => b.wonCount - a.wonCount || b.conversionRate - a.conversionRate);
  const topPerformer = sortedSalesmen.length > 0 && sortedSalesmen[0].wonCount > 0 ? sortedSalesmen[0] : null;

  // --- PLATFORM ROI SCOPE ---
  const platformsList = ['Meta (FB/IG)', 'Google Ads', 'TikTok', 'LinkedIn', 'Snapchat'];
  const platformStats = platformsList.map(platform => {
    const platSpendLogs = filteredSpendLogs.filter(s => s.platform === platform);
    const pSpend = platSpendLogs.reduce((acc, curr) => acc + curr.spendAmount, 0);
    const pClicks = platSpendLogs.reduce((acc, curr) => acc + curr.clicks, 0);
    const pLeads = filteredLeads.filter(l => l.platform === platform).length;
    const pWon = filteredLeads.filter(l => l.platform === platform && l.status === 'Closed Won').length;

    const pCPC = pClicks > 0 ? (pSpend / pClicks).toFixed(2) : '0.00';
    const pCPL = pLeads > 0 ? (pSpend / pLeads).toFixed(2) : '0.00';

    return { platform, spend: pSpend, clicks: pClicks, leadsCount: pLeads, wonCount: pWon, cpc: pCPC, cPL: pCPL };
  });

  return (
    <div className="space-y-5">

      {/* 📅 DATE RANGE FILTER BAR */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-slate-800 font-bold text-xs md:text-sm">
          <Filter size={16} className="text-blue-600" />
          <span>Report Period Filter</span>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
          <div className="flex flex-col bg-slate-50 p-1.5 px-2.5 rounded-xl border">
            <span className="font-bold text-slate-400 text-[9px] uppercase">From Date</span>
            <input 
              type="date" 
              value={fromDate} 
              onChange={e => setFromDate(e.target.value)}
              className="bg-transparent outline-none font-bold text-blue-600 text-xs"
            />
          </div>

          <div className="flex flex-col bg-slate-50 p-1.5 px-2.5 rounded-xl border">
            <span className="font-bold text-slate-400 text-[9px] uppercase">To Date</span>
            <input 
              type="date" 
              value={toDate} 
              onChange={e => setToDate(e.target.value)}
              className="bg-transparent outline-none font-bold text-blue-600 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 🏆 TOP PERFORMER CARD & SUMMARY METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        
        {/* Top Performer Highlight */}
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center w-fit">
                <Award size={12} className="mr-1" /> Top Sales Executive
              </span>
              <h3 className="text-xl font-black mt-2">
                {topPerformer ? topPerformer.name : 'No Won Deals Yet'}
              </h3>
            </div>
            <Trophy size={32} className="text-amber-200" />
          </div>

          {topPerformer && (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/20 text-center">
              <div>
                <p className="text-[9px] text-amber-100 font-bold uppercase">Deals Won</p>
                <p className="text-lg font-black">{topPerformer.wonCount}</p>
              </div>
              <div>
                <p className="text-[9px] text-amber-100 font-bold uppercase">Total Leads</p>
                <p className="text-lg font-bold">{topPerformer.totalLeads}</p>
              </div>
              <div>
                <p className="text-[9px] text-amber-100 font-bold uppercase">Win Rate</p>
                <p className="text-lg font-bold">{topPerformer.conversionRate}%</p>
              </div>
            </div>
          )}
        </div>

        {/* 📊 SUMMARY CARDS (CPC & CPL INCLUDED) */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Budget Spent</p>
            <h4 className="text-base md:text-xl font-black text-slate-800">₹{totalSpend.toLocaleString('en-IN')}</h4>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg CPC</p>
            <h4 className="text-base md:text-xl font-black text-blue-600">₹{overallCPC}</h4>
            <p className="text-[9px] text-slate-400">{totalClicks} Clicks</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg CPL</p>
            <h4 className="text-base md:text-xl font-black text-indigo-600">₹{overallCPL}</h4>
            <p className="text-[9px] text-slate-400">{totalLeads} Leads</p>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Win Rate</p>
            <h4 className="text-base md:text-xl font-black text-emerald-600">{overallWinRate}%</h4>
            <p className="text-[9px] text-slate-400">{closedWonLeads} Closed Won</p>
          </div>
        </div>

      </div>

      {/* 👥 SALESMAN LEADERBOARD TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center space-x-2">
            <Users size={16} className="text-blue-600" />
            <span>Salesman Performance Report</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold">
              <tr>
                <th className="p-3">Rank & Salesman</th>
                <th className="p-3">Assigned Leads</th>
                <th className="p-3">Closed Won</th>
                <th className="p-3">Closed Lost</th>
                <th className="p-3">Conversion Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSalesmen.map((rep, idx) => (
                <tr key={rep.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-slate-800 flex items-center space-x-2">
                    <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px]">#{idx + 1}</span>
                    <span>{rep.name}</span>
                  </td>
                  <td className="p-3 font-semibold">{rep.totalLeads} Leads</td>
                  <td className="p-3 font-bold text-emerald-600">{rep.wonCount} Deals</td>
                  <td className="p-3 font-semibold text-rose-500">{rep.lostCount} Lost</td>
                  <td className="p-3 font-bold text-blue-600">{rep.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📢 AD SPEND, CLICKS & CPL ROI REPORT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-bold text-slate-900 text-sm md:text-base flex items-center space-x-2">
            <BarChart2 size={16} className="text-emerald-600" />
            <span>Ad Spend, Clicks, CPC & CPL Report</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-semibold">
              <tr>
                <th className="p-3">Platform</th>
                <th className="p-3">Spend (₹)</th>
                <th className="p-3">Clicks</th>
                <th className="p-3">CPC (₹)</th>
                <th className="p-3">Leads</th>
                <th className="p-3">CPL (₹)</th>
                <th className="p-3 text-right">Closed Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {platformStats.map(p => (
                <tr key={p.platform} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-bold text-slate-800">{p.platform}</td>
                  <td className="p-3 font-bold">₹{p.spend.toLocaleString('en-IN')}</td>
                  <td className="p-3 font-semibold text-slate-600">{p.clicks}</td>
                  <td className="p-3 font-bold text-slate-700">₹{p.cpc}</td>
                  <td className="p-3 font-bold text-blue-600">{p.leadsCount}</td>
                  <td className="p-3 font-bold text-indigo-600">₹{p.cPL}</td>
                  <td className="p-3 text-right font-extrabold text-emerald-600">{p.wonCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};