import type { Lead, DailySpendLog, SalesRep, CampaignTarget } from './types';

export const mockSalesReps: SalesRep[] = [
  { id: '1', name: 'George', email: 'george@company.com' },
  { id: '2', name: 'Sarah', email: 'sarah@company.com' },
  { id: '3', name: 'Alex', email: 'alex@company.com' },
];

export const mockTargets: CampaignTarget[] = [
  { platform: 'Meta (FB/IG)', targetBudget: 5000, maxDailySpend: 250 },
  { platform: 'Google Ads', targetBudget: 4000, maxDailySpend: 200 },
  { platform: 'TikTok', targetBudget: 2000, maxDailySpend: 100 },
];

export const mockSpendLogs: DailySpendLog[] = [
  { id: 's1', date: '2026-07-20', platform: 'Meta (FB/IG)', spendAmount: 180, clicks: 240, cpc: 0.75 },
  { id: 's2', date: '2026-07-20', platform: 'Google Ads', spendAmount: 210, clicks: 105, cpc: 2.00 },
  { id: 's3', date: '2026-07-21', platform: 'Meta (FB/IG)', spendAmount: 195, clicks: 260, cpc: 0.75 },
  { id: 's4', date: '2026-07-21', platform: 'TikTok', spendAmount: 90, clicks: 180, cpc: 0.50 },
];

export const mockLeads: Lead[] = [
  { id: 'l1', customerName: 'John Doe', email: 'john@example.com', phone: '+971501234567', platform: 'Meta (FB/IG)', assignedSalesId: '1', assignedSalesName: 'George', status: 'New', dateAdded: '2026-07-20' },
  { id: 'l2', customerName: 'Jane Smith', email: 'jane@example.com', phone: '+971509876543', platform: 'Google Ads', assignedSalesId: '2', assignedSalesName: 'Sarah', status: 'Qualified', dateAdded: '2026-07-20' },
  { id: 'l3', customerName: 'Ali Hassan', email: 'ali@example.com', phone: '+971505554433', platform: 'Meta (FB/IG)', assignedSalesId: '1', assignedSalesName: 'George', status: 'Closed Won', dateAdded: '2026-07-21' },
];