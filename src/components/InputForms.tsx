import React, { useState } from 'react';
import type { Lead, DailySpendLog, PlatformName, SalesRep } from '../types';
import { PlusCircle, DollarSign, UserPlus } from 'lucide-react';

interface InputFormsProps {
  salesReps: SalesRep[];
  onAddLead: (lead: Lead) => void;
  onAddSpendLog: (log: DailySpendLog) => void;
}

const PLATFORMS: PlatformName[] = [
  'Meta (FB/IG)',
  'Google Ads',
  'TikTok',
  'LinkedIn',
  'Snapchat',
];

export const InputForms: React.FC<InputFormsProps> = ({
  salesReps,
  onAddLead,
  onAddSpendLog,
}) => {
  const [activeTab, setActiveTab] = useState<'lead' | 'spend'>('lead');

  // Lead Form State
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leadPlatform, setLeadPlatform] = useState<PlatformName>('Meta (FB/IG)');
  const [assignedSalesId, setAssignedSalesId] = useState(salesReps[0]?.id || '');

  // Spend Form State
  const [spendDate, setSpendDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [spendPlatform, setSpendPlatform] = useState<PlatformName>('Meta (FB/IG)');
  const [spendAmount, setSpendAmount] = useState('');
  const [clicks, setClicks] = useState('');

  // Handle Lead Submit
  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phone) return;

    const rep = salesReps.find((r) => r.id === assignedSalesId);
    const newLead: Lead = {
      id: `l_${Date.now()}`,
      customerName,
      email,
      phone,
      platform: leadPlatform,
      assignedSalesId,
      assignedSalesName: rep ? rep.name : 'Unassigned',
      status: 'New',
      dateAdded: spendDate,
    };

    onAddLead(newLead);
    setCustomerName('');
    setEmail('');
    setPhone('');
  };

  // Handle Spend Log Submit
  const handleSpendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const spend = parseFloat(spendAmount);
    const clickCount = parseInt(clicks, 10);

    if (isNaN(spend) || isNaN(clickCount) || clickCount <= 0) return;

    // Auto-calculate Daily CPC: Spend / Clicks
    const calculatedCPC = Number((spend / clickCount).toFixed(2));

    const newLog: DailySpendLog = {
      id: `s_${Date.now()}`,
      date: spendDate,
      platform: spendPlatform,
      spendAmount: spend,
      clicks: clickCount,
      cpc: calculatedCPC,
    };

    onAddSpendLog(newLog);
    setSpendAmount('');
    setClicks('');
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-100 p-6">
      {/* Tab Switcher */}
      <div className="flex space-x-3 mb-6 border-b border-slate-100 pb-3">
        <button
          onClick={() => setActiveTab('lead')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'lead'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <UserPlus size={18} />
          <span>Add New Lead</span>
        </button>
        <button
          onClick={() => setActiveTab('spend')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
            activeTab === 'spend'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <DollarSign size={18} />
          <span>Log Daily Ad Spend</span>
        </button>
      </div>

      {/* 1. ADD LEAD FORM */}
      {activeTab === 'lead' && (
        <form onSubmit={handleLeadSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Phone Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. +971 50 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Ad Platform Origin
            </label>
            <select
              value={leadPlatform}
              onChange={(e) => setLeadPlatform(e.target.value as PlatformName)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Assign Sales Representative
            </label>
            <select
              value={assignedSalesId}
              onChange={(e) => setAssignedSalesId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {salesReps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.name} ({rep.email})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
            >
              <PlusCircle size={18} />
              <span>Save & Assign Lead</span>
            </button>
          </div>
        </form>
      )}

      {/* 2. LOG DAILY AD SPEND FORM */}
      {activeTab === 'spend' && (
        <form onSubmit={handleSpendSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={spendDate}
              onChange={(e) => setSpendDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Platform
            </label>
            <select
              value={spendPlatform}
              onChange={(e) => setSpendPlatform(e.target.value as PlatformName)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Total Day Spend ($) *
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 250.00"
              value={spendAmount}
              onChange={(e) => setSpendAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Total Day Clicks *
            </label>
            <input
              type="number"
              required
              placeholder="e.g. 400"
              value={clicks}
              onChange={(e) => setClicks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Auto-Calculated Live Preview */}
          {spendAmount && clicks && Number(clicks) > 0 && (
            <div className="md:col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex justify-between items-center text-sm">
              <span className="font-medium text-emerald-800">Calculated Daily CPC:</span>
              <span className="font-bold text-emerald-900 text-base">
                ${(parseFloat(spendAmount) / parseInt(clicks, 10)).toFixed(2)} / click
              </span>
            </div>
          )}

          <div className="md:col-span-2 pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 bg-emerald-600 text-white font-semibold py-2.5 rounded-lg hover:bg-emerald-700 transition"
            >
              <PlusCircle size={18} />
              <span>Log Daily Ad Metrics</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};