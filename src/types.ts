export type PlatformName = 'Meta (FB/IG)' | 'Google Ads' | 'TikTok' | 'LinkedIn' | 'Snapchat';

export interface SalesRep {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status?: 'Active' | 'Inactive'; // 🌟 Added status field
}

export interface Lead {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  platform: PlatformName;
  assignedSalesId: string;
  assignedSalesName: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Closed Won' | 'Closed Lost';
  dateAdded: string;
}

export interface DailySpendLog {
  id: string;
  date: string;
  platform: PlatformName;
  spendAmount: number;
  clicks: number;
  cpc?: number;
}

export interface CampaignTarget {
  id?: string;
  platform: PlatformName;
  targetBudget: number;
  fromDate?: string;
  toDate?: string;
}