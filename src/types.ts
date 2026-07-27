export type PlatformName = 'Meta (FB/IG)' | 'Google Ads' | 'TikTok' | 'LinkedIn' | 'Snapchat' | 'Organic / Direct';

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

  // 🎯 Campaign Tracking Attributes
  campaignName?: string;     // e.g. "Dubai_Summer_Promo_2026"
  campaignId?: string;       // Dynamic ID from Meta / Google Webhooks
  source?: string;           // e.g. "cpc", "social", "whatsapp_ad"
  adSet?: string;            // e.g. "UAE_Business_Owners_30-50"
  adId?: string;             // Specific Ad creative identifier
  landingPageUrl?: string;   // URL where lead was captured
}

export interface DailySpendLog {
  id: string;
  date: string;
  platform: PlatformName;
  campaignName?: string;     // 🎯 Optional: Track spend per specific campaign
  spendAmount: number;
  clicks: number;
  cpc?: number;
}

export interface CampaignTarget {
  id?: string;
  platform: PlatformName;
  campaignName?: string;     // 🎯 Optional: Target budget per campaign
  targetBudget: number;
  fromDate?: string;
  toDate?: string;
}