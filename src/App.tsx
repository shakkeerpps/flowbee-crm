import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import type { Lead, DailySpendLog, SalesRep, PlatformName } from './types';
import { ChartsDashboard } from './components/ChartsDashboard';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Menu,
  ChevronLeft,
  Users,
  DollarSign,
  BarChart3,
  UserCheck,
  PlusCircle,
  Search,
  LayoutDashboard,
  Mail,
  Phone,
  X,
  MessageCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  Download,
  FileSpreadsheet,
  Edit2,
  Trash2,
  MousePointerClick,
  Target,
  Calculator,
  Lock,
  LogOut,
  KeyRound,
  Trophy,
  Flame,
  TrendingUp,
  Megaphone,
  Layers
} from 'lucide-react';

const PLATFORMS: PlatformName[] = [
  'Meta (FB/IG)',
  'Google Ads',
  'TikTok',
  'LinkedIn',
  'Snapchat',
];

const STAGES = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won', 'Closed Lost'];

export interface Activity {
  id: string;
  lead_id: string;
  activity_type: 'Call' | 'Email' | 'WhatsApp' | 'Meeting' | 'Note';
  description: string;
  follow_up_date?: string;
  follow_up_time?: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
  completion_notes?: string;
  created_at: string;
}

// 🗓️ CURRENT MONTH DATES HELPER FUNCTIONS
const getCurrentMonthFirstDate = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
};

const getCurrentMonthLastDate = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
};

const getLeadFollowupBadge = (leadActs: Activity[]) => {
  const pendingActs = leadActs.filter(a => a.status === 'Pending' && a.follow_up_date);
  if (pendingActs.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);

  let overdueCount = 0;
  let todayCount = 0;
  let tomorrowCount = 0;
  let thisWeekCount = 0;

  pendingActs.forEach(act => {
    const actDateStr = act.follow_up_date!;
    if (actDateStr < todayStr) {
      overdueCount++;
    } else if (actDateStr === todayStr) {
      todayCount++;
    } else if (actDateStr === tomorrowStr) {
      tomorrowCount++;
    } else {
      const actDate = new Date(actDateStr);
      if (actDate <= endOfWeek) {
        thisWeekCount++;
      }
    }
  });

  if (overdueCount > 0) {
    return <span className="bg-rose-100 text-rose-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-200">⚠️ Overdue ({overdueCount})</span>;
  }
  if (todayCount > 0) {
    return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-amber-200">📌 Today ({todayCount})</span>;
  }
  if (tomorrowCount > 0) {
    return <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-blue-200">⏳ Tomorrow ({tomorrowCount})</span>;
  }
  if (thisWeekCount > 0) {
    return <span className="bg-purple-100 text-purple-700 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-purple-200">🗓️ This Week ({thisWeekCount})</span>;
  }

  return null;
};

export default function App() {
  // 🔒 AUTHENTICATION STATES
  const [currentUser, setCurrentUser] = useState<SalesRep | null>(() => {
    const savedUser = localStorage.getItem('crm_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // 🔗 TAB ROUTING STATE
  const getTabFromHash = (): 'dashboard' | 'leads' | 'followups' | 'spend' | 'agents' | 'reports' => {
    const hash = window.location.hash.replace('#/', '');
    if (['dashboard', 'leads', 'followups', 'spend', 'agents', 'reports'].includes(hash)) {
      return hash as any;
    }
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'followups' | 'spend' | 'agents' | 'reports'>(getTabFromHash);

  const changeTab = (tab: 'dashboard' | 'leads' | 'followups' | 'spend' | 'agents' | 'reports') => {
    setActiveTab(tab);
    window.location.hash = `/${tab}`;
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // UI STATES
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Core App Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [spendLogs, setSpendLogs] = useState<DailySpendLog[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // DASHBOARD DATE FILTER
  const [dashFromDate, setDashFromDate] = useState<string>(getCurrentMonthFirstDate());
  const [dashToDate, setDashToDate] = useState<string>(getCurrentMonthLastDate());

  // Leads Filters State
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAgentId, setFilterAgentId] = useState<string>('ALL');
  const [filterCampaign, setFilterCampaign] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [leadFromDate, setLeadFromDate] = useState<string>('');
  const [leadToDate, setLeadToDate] = useState<string>('');

  // Follow-ups Filters
  const [followupFromDate, setFollowupFromDate] = useState<string>(getCurrentMonthFirstDate());
  const [followupToDate, setFollowupToDate] = useState<string>(getCurrentMonthLastDate());
  const [followupTypeFilter, setFollowupTypeFilter] = useState<string>('ALL');
  const [followupStatusFilter, setFollowupStatusFilter] = useState<string>('ALL');
  const [followupAgentFilter, setFollowupAgentFilter] = useState<string>('ALL');

  // Daily Spend Filters State
  const [spendFromDate, setSpendFromDate] = useState<string>(getCurrentMonthFirstDate());
  const [spendToDate, setSpendToDate] = useState<string>(getCurrentMonthLastDate());
  const [spendPlatformFilter, setSpendPlatformFilter] = useState<string>('ALL');

  // Modals
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [isAddSpendModalOpen, setIsAddSpendModalOpen] = useState(false);
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);

  // Follow-up & Edit Modals
  const [activeActivityLead, setActiveActivityLead] = useState<Lead | null>(null);
  const [completingActivity, setCompletingActivity] = useState<Activity | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [editingSpend, setEditingSpend] = useState<DailySpendLog | null>(null);
  const [editingAgent, setEditingAgent] = useState<SalesRep | null>(null);

  // Forms
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPlatform, setLeadPlatform] = useState<PlatformName>('Meta (FB/IG)');
  const [leadAgentId, setLeadAgentId] = useState('');
  const [leadRemark, setLeadRemark] = useState('');
  const [leadCustomDate, setLeadCustomDate] = useState(todayStr);
  const [leadCampaignName, setLeadCampaignName] = useState('');
  const [leadAdSet, setLeadAdSet] = useState('');

  const [spendDate, setSpendDate] = useState(todayStr);
  const [spendPlatform, setSpendPlatform] = useState<PlatformName>('Meta (FB/IG)');
  const [spendAmount, setSpendAmount] = useState('');
  const [spendClicks, setSpendClicks] = useState('');

  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPhone, setAgentPhone] = useState('');

  // Schedule Activity Form
  const [activityType, setActivityType] = useState<'Call' | 'Email' | 'WhatsApp' | 'Meeting' | 'Note'>('Call');
  const [activityDesc, setActivityDesc] = useState('');
  const [activityFollowUpDate, setActivityFollowUpDate] = useState(todayStr);
  const [activityFollowUpTime, setActivityFollowUpTime] = useState('20:00');

  // Completion Form
  const [completionNotes, setCompletionNotes] = useState('');

  // 🎯 DYNAMIC AUTOCOMPLETE MEMO FOR CAMPAIGNS & ADSETS
  const existingCampaigns = useMemo(() => {
    const list = leads
      .map(l => l.campaignName)
      .filter((c): c is string => Boolean(c && c.trim() !== ''));
    return Array.from(new Set(list));
  }, [leads]);

  const existingAdSets = useMemo(() => {
    const list = leads
      .map(l => l.adSet)
      .filter((a): a is string => Boolean(a && a.trim() !== ''));
    return Array.from(new Set(list));
  }, [leads]);

  // ✉️ DIRECT UNLIMITED HOSTING SMTP DISPATCH
  const sendEmailNotification = async (eventType: 'ASSIGN' | 'WON' | 'LOST' | 'DAILY_REPORT' | 'STATUS_CHANGE', payload: any) => {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          leadName: payload.leadName || 'N/A',
          leadPhone: payload.leadPhone || payload.phone || 'N/A',
          assignedTo: payload.assignedTo || payload.repName || 'Sales Agent',
          agentEmail: payload.agentEmail || 'crm@flowbee.io',
          status: payload.status,
          campaignName: payload.campaignName,
        }),
      });

      const result = await response.json();
      if (result.success) {
        console.log(`✅ Email sent via API!`);
      } else {
        console.error('❌ Email failed:', result.error);
      }
    } catch (err) {
      console.error('❌ Network error:', err);
    }
  };

  // ⏰ 8:00 PM DAILY REPORT SCHEDULER
  useEffect(() => {
    const checkScheduledReport = () => {
      const now = new Date();
      if (now.getHours() === 20 && now.getMinutes() === 0 && currentUser?.role === 'admin') {
        sendEmailNotification('DAILY_REPORT', {
          date: todayStr,
          totalLeads: leads.length,
          wonCount: leads.filter(l => l.status === 'Closed Won').length,
          totalSpend: spendLogs.reduce((acc, curr) => acc + curr.spendAmount, 0)
        });
      }
    };

    const interval = setInterval(checkScheduledReport, 60000);
    return () => clearInterval(interval);
  }, [leads, spendLogs, currentUser]);

  // 🔐 HANDLE LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('email', loginEmail.trim())
      .eq('password', loginPassword.trim())
      .single();

    if (error || !data) {
      alert('❌ Invalid Email or Password!');
    } else if (data.status === 'Inactive') {
      alert('🔴 Your account is inactive. Please contact Administrator.');
    } else {
      setCurrentUser(data);
      localStorage.setItem('crm_user', JSON.stringify(data));
      alert(`👋 Welcome back, ${data.name}!`);
    }
    setLoading(false);
  };

  // 🚪 HANDLE LOGOUT
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('crm_user');
  };

  // 🔑 HANDLE PASSWORD CHANGE
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newPassword) return;

    const { error } = await supabase
      .from('sales_reps')
      .update({ password: newPassword })
      .eq('id', currentUser.id);

    if (!error) {
      alert('✅ Password changed successfully!');
      setIsChangePasswordModalOpen(false);
      setNewPassword('');
    }
  };

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: reps } = await supabase.from('sales_reps').select('*');
      if (reps) {
        setSalesReps(reps.map(r => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone,
          role: r.role || 'sales_executive',
          status: r.status || 'Active'
        })));
      }

      const { data: leadsData } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (leadsData) {
        setLeads(leadsData.map(l => ({
          id: l.id,
          customerName: l.customer_name,
          email: l.email || '',
          phone: l.phone,
          platform: l.platform,
          assignedSalesId: l.assigned_sales_id,
          assignedSalesName: l.assigned_sales_name,
          status: l.status,
          dateAdded: l.date_added,
          remark: l.remark,
          campaignName: l.campaign_name || l.campaignName || '',
          adSet: l.ad_set || l.adSet || ''
        })));
      }

      const { data: spendData } = await supabase.from('daily_spend_logs').select('*').order('date', { ascending: false });
      if (spendData) {
        setSpendLogs(spendData.map(s => ({
          id: s.id,
          date: s.date,
          platform: s.platform,
          spendAmount: Number(s.spend_amount),
          clicks: Number(s.clicks),
          cpc: Number(s.cpc)
        })));
      }

      const { data: actData } = await supabase.from('lead_activities').select('*').order('created_at', { ascending: false });
      if (actData) setActivities(actData);

    } catch (err) {
      console.error('Data Fetching Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ⚡ REALTIME WEBSOCKET SUBSCRIPTION
  useEffect(() => {
    if (currentUser) {
      fetchData();

      const channel = supabase
        .channel('realtime_crm_socket')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_spend_logs' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_activities' }, () => fetchData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_reps' }, () => fetchData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  // Delete Sales Agent Logic
  const handleDeleteAgent = async (agentId: string, agentName: string) => {
    const assignedLeads = leads.filter(l => l.assignedSalesId === agentId);
    if (assignedLeads.length > 0) {
      alert(`⚠️ Cannot delete "${agentName}"! There are ${assignedLeads.length} active leads assigned to this agent. Please reassign them first.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete sales agent "${agentName}"?`)) return;

    const { error } = await supabase.from('sales_reps').delete().eq('id', agentId);
    if (!error) {
      alert('✅ Sales Agent deleted successfully!');
      fetchData();
    }
  };

  // Toggle Sales Agent Status
  const handleToggleAgentStatus = async (agent: SalesRep) => {
    const newStatus = agent.status === 'Inactive' ? 'Active' : 'Inactive';
    const { error } = await supabase.from('sales_reps').update({ status: newStatus }).eq('id', agent.id);
    if (!error) fetchData();
  };

  // Update Sales Agent
  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent) return;

    const { error } = await supabase.from('sales_reps').update({
      name: editingAgent.name,
      email: editingAgent.email,
      phone: editingAgent.phone,
      role: editingAgent.role || 'sales_executive',
      status: editingAgent.status || 'Active'
    }).eq('id', editingAgent.id);

    if (!error) {
      alert('✅ Agent details updated successfully!');
      setEditingAgent(null);
      fetchData();
    }
  };

  // Delete Follow-up Activity
  const handleDeleteActivity = async (id: string) => {
    if (!confirm('ഈ Follow-up Task ഡിലീറ്റ് ചെയ്യണോ?')) return;
    const { error } = await supabase.from('lead_activities').delete().eq('id', id);
    if (!error) {
      alert('✅ Activity Deleted!');
      fetchData();
    }
  };

  // Update Follow-up Activity
  const handleUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;

    const { error } = await supabase.from('lead_activities').update({
      activity_type: editingActivity.activity_type,
      description: editingActivity.description,
      follow_up_date: editingActivity.follow_up_date,
      follow_up_time: editingActivity.follow_up_time
    }).eq('id', editingActivity.id);

    if (!error) {
      alert('✅ Follow-up Updated!');
      setEditingActivity(null);
      fetchData();
    }
  };

  // Delete Spend Log
  const handleDeleteSpend = async (id: string) => {
    if (!confirm('ഈ Ad Spend entry ഡിലീറ്റ് ചെയ്യണോ?')) return;
    const { error } = await supabase.from('daily_spend_logs').delete().eq('id', id);
    if (!error) {
      alert('✅ Log Deleted!');
      fetchData();
    }
  };

  // Update Spend Log
  const handleUpdateSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpend) return;

    const amount = Number(editingSpend.spendAmount);
    const clicks = Number(editingSpend.clicks);
    const cpc = clicks > 0 ? Number((amount / clicks).toFixed(2)) : 0;

    const { error } = await supabase.from('daily_spend_logs').update({
      date: editingSpend.date,
      platform: editingSpend.platform,
      spend_amount: amount,
      clicks: clicks,
      cpc: cpc
    }).eq('id', editingSpend.id);

    if (!error) {
      alert('✅ Ad Spend Log Updated!');
      setEditingSpend(null);
      fetchData();
    }
  };

  // Reassign Lead
  const handleReassignLead = async (leadId: string, newAgentId: string) => {
    const selectedAgent = salesReps.find(r => r.id === newAgentId);
    const agentName = selectedAgent ? selectedAgent.name : 'Unassigned';
    const targetLead = leads.find(l => l.id === leadId);

    const { error } = await supabase.from('leads').update({
      assigned_sales_id: newAgentId || null,
      assigned_sales_name: agentName
    }).eq('id', leadId);

    if (!error) {
      alert(`🔄 Lead Reassigned to ${agentName} successfully!`);
      
      sendEmailNotification('ASSIGN', {
        leadName: targetLead?.customerName,
        leadPhone: targetLead?.phone,
        assignedTo: agentName,
        agentEmail: selectedAgent?.email || 'crm@flowbee.io',
        campaignName: targetLead?.campaignName
      });

      fetchData();
    }
  };

  // Delete Lead
  const handleDeleteLead = async (id: string) => {
    if (!confirm('ഈ ലീഡ് ഡിലീറ്റ് ചെയ്യണോ?')) return;
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (!error) {
      alert('✅ Lead Deleted!');
      fetchData();
    }
  };

  // Update/Edit Lead
  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    const { error } = await supabase.from('leads').update({
      customer_name: editingLead.customerName,
      phone: editingLead.phone,
      email: editingLead.email,
      platform: editingLead.platform,
      remark: editingLead.remark,
      date_added: editingLead.dateAdded,
      campaign_name: editingLead.campaignName || null,
      ad_set: editingLead.adSet || null
    }).eq('id', editingLead.id);

    if (!error) {
      alert('✅ Lead Updated!');
      setEditingLead(null);
      fetchData();
    }
  };

  // Round Robin Assignment
  const getNextRoundRobinAgent = () => {
    const activeReps = salesReps.filter(r => r.status !== 'Inactive');
    if (activeReps.length === 0) return null;
    const sortedReps = [...activeReps].sort((a, b) => {
      const countA = leads.filter(l => l.assignedSalesId === a.id).length;
      const countB = leads.filter(l => l.assignedSalesId === b.id).length;
      return countA - countB;
    });
    return sortedReps[0];
  };

  // Save Lead
  const handleSaveLead = async (shouldAssignRoundRobin = false) => {
    if (!leadName || !leadPhone) return;

    let assignedRep = salesReps.find(r => r.id === leadAgentId);
    if (currentUser?.role === 'sales_executive') {
      assignedRep = currentUser;
    } else if (shouldAssignRoundRobin) {
      assignedRep = getNextRoundRobinAgent() || undefined;
    }

    const { error } = await supabase.from('leads').insert([{
      customer_name: leadName,
      email: leadEmail,
      phone: leadPhone,
      platform: leadPlatform,
      assigned_sales_id: assignedRep ? assignedRep.id : null,
      assigned_sales_name: assignedRep ? assignedRep.name : 'Unassigned',
      status: 'New',
      date_added: leadCustomDate || todayStr,
      remark: leadRemark,
      campaign_name: leadCampaignName || null,
      ad_set: leadAdSet || null
    }]);

    if (!error) {
      alert(shouldAssignRoundRobin && assignedRep ? `🎯 Auto-Assigned to ${assignedRep.name}!` : '✅ Lead Saved!');
      if (assignedRep) {
        sendEmailNotification('ASSIGN', {
          leadName,
          leadPhone,
          assignedTo: assignedRep.name,
          agentEmail: assignedRep.email || 'crm@flowbee.io',
          campaignName: leadCampaignName
        });
      }
      setLeadName('');
      setLeadPhone('');
      setLeadEmail('');
      setLeadRemark('');
      setLeadCampaignName('');
      setLeadAdSet('');
      setLeadCustomDate(todayStr);
      setIsAddLeadModalOpen(false);
      fetchData();
    }
  };

  // HANDLE STAGE CHANGE WITH DIRECT EMAIL TRIGGERS
  const handleStageChange = async (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', leadId);

    if (!error) {
      const agentObj = salesReps.find(r => r.id === lead?.assignedSalesId);
      
      if (newStatus === 'Closed Won') {
        alert(`🎉 CONGRATULATIONS! Deal Closed Won for ${lead?.customerName}!`);
        sendEmailNotification('WON', {
          leadName: lead?.customerName,
          repName: lead?.assignedSalesName,
          phone: lead?.phone,
          agentEmail: agentObj?.email || 'crm@flowbee.io',
          campaignName: lead?.campaignName
        });
      } else if (newStatus === 'Closed Lost') {
        sendEmailNotification('LOST', {
          leadName: lead?.customerName,
          repName: lead?.assignedSalesName,
          agentEmail: agentObj?.email || 'crm@flowbee.io',
          campaignName: lead?.campaignName
        });
      } else {
        sendEmailNotification('STATUS_CHANGE', {
          leadName: lead?.customerName,
          leadPhone: lead?.phone,
          repName: lead?.assignedSalesName,
          status: newStatus,
          agentEmail: agentObj?.email || 'crm@flowbee.io',
          campaignName: lead?.campaignName
        });
      }
      fetchData();
    }
  };

  // Schedule Activity
  const handleScheduleActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeActivityLead || !activityDesc) return;

    let formattedTime = activityFollowUpTime;
    if (activityFollowUpTime.includes('AM') || activityFollowUpTime.includes('PM')) {
      const dateObj = new Date(`1970-01-01 ${activityFollowUpTime}`);
      formattedTime = dateObj.toTimeString().split(' ')[0].substring(0, 5);
    }

    const { error } = await supabase.from('lead_activities').insert([{
      lead_id: activeActivityLead.id,
      activity_type: activityType,
      description: activityDesc,
      follow_up_date: activityFollowUpDate,
      follow_up_time: formattedTime,
      status: 'Pending'
    }]);

    if (error) {
      alert(`Error saving activity: ${error.message}`);
    } else {
      alert('📅 Follow-up scheduled successfully!');
      setActivityDesc('');
      setActiveActivityLead(null);
      fetchData();
    }
  };

  const handleCompleteWorkflow = async (actionType: 'Done' | 'DoneAndNext' | 'CancelAndNext') => {
    if (!completingActivity) return;

    let targetStatus: 'Completed' | 'Cancelled' = 'Completed';
    if (actionType === 'CancelAndNext') {
      targetStatus = 'Cancelled';
    }

    const { error } = await supabase.from('lead_activities').update({
      status: targetStatus,
      completion_notes: completionNotes || (actionType === 'CancelAndNext' ? 'Follow-up Cancelled/Rescheduled' : 'Completed')
    }).eq('id', completingActivity.id);

    if (!error) {
      const parentLead = leads.find(l => l.id === completingActivity.lead_id);
      setCompletionNotes('');
      setCompletingActivity(null);

      if (actionType === 'DoneAndNext' || actionType === 'CancelAndNext') {
        if (parentLead) {
          setActiveActivityLead(parentLead);
        }
      } else {
        alert('✅ Activity Marked as Done!');
      }

      fetchData();
    }
  };

  // Add Spend & Agent
  const handleAddSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(spendAmount);
    const clicks = parseInt(spendClicks, 10);
    if (!spendDate || isNaN(amount) || isNaN(clicks)) return;

    const cpc = Number((amount / clicks).toFixed(2));
    const { error } = await supabase.from('daily_spend_logs').insert([{
      date: spendDate,
      platform: spendPlatform,
      spend_amount: amount,
      clicks: clicks,
      cpc: cpc
    }]);

    if (!error) {
      fetchData();
      setSpendAmount('');
      setSpendClicks('');
      setIsAddSpendModalOpen(false);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName) return;
    const { error } = await supabase.from('sales_reps').insert([{
      name: agentName,
      email: agentEmail,
      phone: agentPhone,
      status: 'Active',
      role: 'sales_executive'
    }]);

    if (!error) {
      fetchData();
      setAgentName('');
      setAgentEmail('');
      setAgentPhone('');
      setIsAddAgentModalOpen(false);
    }
  };

  // 🔒 VISIBILITY FILTER
  const visibleLeads = leads.filter(l => {
    if (currentUser?.role === 'sales_executive') {
      return l.assignedSalesId === currentUser.id;
    }
    return true;
  });

  // 🌟 LEADS PIPELINE FILTER LOGIC (Supports CAMPAIGNS)
  const filteredLeads = visibleLeads.filter(l => {
    const matchesSearch = l.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery);
    const matchesPlatform = filterPlatform === 'ALL' || l.platform === filterPlatform;
    const matchesStatus = filterStatus === 'ALL' || l.status === filterStatus;
    const matchesCampaign = filterCampaign === 'ALL' || l.campaignName === filterCampaign;

    let matchesAgent = true;
    if (filterAgentId === 'UNASSIGNED') {
      matchesAgent = !l.assignedSalesId;
    } else if (filterAgentId !== 'ALL') {
      matchesAgent = l.assignedSalesId === filterAgentId;
    }

    const matchesFromDate = !leadFromDate || (l.dateAdded && l.dateAdded >= leadFromDate);
    const matchesToDate = !leadToDate || (l.dateAdded && l.dateAdded <= leadToDate);

    return matchesSearch && matchesPlatform && matchesStatus && matchesAgent && matchesCampaign && matchesFromDate && matchesToDate;
  });

  const visibleActivities = activities.filter(a => {
    const parentLead = leads.find(l => l.id === a.lead_id);
    if (currentUser?.role === 'sales_executive') {
      return parentLead?.assignedSalesId === currentUser.id;
    }
    return true;
  });

  const filteredFollowups = visibleActivities.filter(a => {
    const parentLead = leads.find(l => l.id === a.lead_id);
    const matchesFrom = !followupFromDate || (a.follow_up_date && a.follow_up_date >= followupFromDate);
    const matchesTo = !followupToDate || (a.follow_up_date && a.follow_up_date <= followupToDate);
    const matchesType = followupTypeFilter === 'ALL' || a.activity_type === followupTypeFilter;
    const matchesStatus = followupStatusFilter === 'ALL' || a.status === followupStatusFilter;
    const matchesAgent = followupAgentFilter === 'ALL' || parentLead?.assignedSalesId === followupAgentFilter;

    return matchesFrom && matchesTo && matchesType && matchesStatus && matchesAgent;
  });

  const filteredSpendLogs = spendLogs.filter(s => {
    const matchesFrom = !spendFromDate || s.date >= spendFromDate;
    const matchesTo = !spendToDate || s.date <= spendToDate;
    const matchesPlatform = spendPlatformFilter === 'ALL' || s.platform === spendPlatformFilter;
    return matchesFrom && matchesTo && matchesPlatform;
  });

  // 🏆 CAMPAIGN & ADSET PERFORMANCE CALCULATOR FOR ANALYTICS
  const campaignPerformance = useMemo(() => {
    const stats: Record<string, { totalLeads: number; wonLeads: number; adSets: Record<string, { total: number; won: number }> }> = {};

    leads.forEach(l => {
      const camp = l.campaignName || 'Direct / Organic';
      const adSet = l.adSet || 'Default AdSet';

      if (!stats[camp]) {
        stats[camp] = { totalLeads: 0, wonLeads: 0, adSets: {} };
      }
      stats[camp].totalLeads += 1;
      if (l.status === 'Closed Won') stats[camp].wonLeads += 1;

      if (!stats[camp].adSets[adSet]) {
        stats[camp].adSets[adSet] = { total: 0, won: 0 };
      }
      stats[camp].adSets[adSet].total += 1;
      if (l.status === 'Closed Won') stats[camp].adSets[adSet].won += 1;
    });

    return stats;
  }, [leads]);

  // EXPORT EXCEL (CSV) FUNCTION
  const exportToExcel = () => {
    if (filteredLeads.length === 0) {
      alert("No data available to export!");
      return;
    }

    const headers = ["Customer Name", "Phone", "Email", "Platform", "Campaign", "AdSet", "Assigned Sales Rep", "Stage/Status", "Date Added", "Remark"];
    const rows = filteredLeads.map(l => [
      `"${l.customerName}"`,
      `"${l.phone}"`,
      `"${l.email || 'N/A'}"`,
      `"${l.platform}"`,
      `"${l.campaignName || 'N/A'}"`,
      `"${l.adSet || 'N/A'}"`,
      `"${l.assignedSalesName || 'Unassigned'}"`,
      `"${l.status}"`,
      `"${l.dateAdded}"`,
      `"${l.remark || 'N/A'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Leads_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // EXPORT PDF FUNCTION
  const exportToPDF = () => {
    if (filteredLeads.length === 0) {
      alert("No data available to export!");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Flowbee CRM - Filtered Leads Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} | Total Leads: ${filteredLeads.length}`, 14, 22);

    const tableColumn = ["Customer Name", "Phone", "Campaign", "AdSet", "Sales Rep", "Stage", "Created"];
    const tableRows = filteredLeads.map(l => [
      l.customerName,
      l.phone,
      l.campaignName || 'N/A',
      l.adSet || 'N/A',
      l.assignedSalesName || 'Unassigned',
      l.status,
      l.dateAdded
    ]);

    autoTable(doc, {
      startY: 28,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 8 }
    });

    doc.save(`Leads_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getStageBadgeStyle = (status: string) => {
    switch (status) {
      case 'Closed Won': return 'bg-emerald-600 text-white font-bold';
      case 'Closed Lost': return 'bg-rose-600 text-white font-bold';
      case 'Qualified': return 'bg-indigo-600 text-white font-semibold';
      case 'Proposal Sent': return 'bg-amber-500 text-white font-semibold';
      case 'Contacted': return 'bg-blue-600 text-white font-semibold';
      default: return 'bg-slate-200 text-slate-700 font-semibold';
    }
  };

  // 🔑 LOGIN SCREEN IF NOT AUTHENTICATED
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-900">Flowbee CRM</h1>
            <p className="text-xs text-slate-500 font-semibold">Enter your login credentials to access workspace</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
              <div className="flex items-center space-x-2 border rounded-xl p-3 bg-slate-50">
                <Mail size={16} className="text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="admin@flowbee.io"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
              <div className="flex items-center space-x-2 border rounded-xl p-3 bg-slate-50">
                <Lock size={16} className="text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full font-semibold"
                />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md">
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-400">Flowbee CRM v5.0 • Multi-Role Enterprise Suite</p>
          </div>
        </div>
      </div>
    );
  }

  // 📱 MAIN CRM INTERFACE
  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-100 text-slate-800 overflow-hidden">

      {/* MOBILE TOP BAR */}
      <header className="md:hidden bg-slate-900 text-white flex items-center justify-between px-4 py-3 shrink-0 z-30 shadow-md">
        <div>
          <h1 className="font-bold text-base">Flowbee CRM</h1>
          <p className="text-[9px] text-blue-400 font-bold uppercase">{currentUser.role}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={() => setIsChangePasswordModalOpen(true)} className="p-2 bg-slate-800 rounded-lg text-slate-300">
            <KeyRound size={16} />
          </button>
          <button onClick={handleLogout} className="p-2 bg-slate-800 rounded-lg text-rose-400">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* SIDEBAR & MOBILE DRAWER */}
      <aside className={`bg-slate-900 text-slate-300 transition-all duration-300 flex flex-col justify-between h-full z-50 shrink-0
        ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 w-72 shadow-2xl flex' : 'hidden md:flex'} 
        ${isSidebarExpanded ? 'md:w-64' : 'md:w-20'}
      `}>
        <div>
          <div className="p-4 flex items-center justify-between border-b border-slate-800">
            <div>
              <h1 className="font-bold text-white text-lg">Flowbee CRM</h1>
              <p className="text-[10px] text-blue-400 font-bold uppercase">{currentUser.role} MODE</p>
            </div>

            <button onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} className="hidden md:block p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              {isSidebarExpanded ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>

            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400">
              <X size={20} />
            </button>
          </div>

          <nav className="p-3 space-y-2">
            <button onClick={() => changeTab('dashboard')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
              <LayoutDashboard size={20} className="shrink-0" />
              <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Dashboard Summary</span>
            </button>

            <button onClick={() => changeTab('leads')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'leads' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Users size={20} className="shrink-0" />
              <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Leads Pipeline</span>
            </button>

            <button onClick={() => changeTab('followups')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'followups' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Calendar size={20} className="shrink-0" />
              <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Follow-ups Calendar</span>
            </button>

            {currentUser.role === 'admin' && (
              <>
                <button onClick={() => changeTab('spend')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'spend' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
                  <DollarSign size={20} className="shrink-0" />
                  <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Daily Ad Spend</span>
                </button>

                <button onClick={() => changeTab('agents')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'agents' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
                  <UserCheck size={20} className="shrink-0" />
                  <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Sales Team</span>
                </button>

                <button onClick={() => changeTab('reports')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition ${activeTab === 'reports' ? 'bg-blue-600 text-white font-semibold' : 'hover:bg-slate-800 text-slate-400'}`}>
                  <BarChart3 size={20} className="shrink-0" />
                  <span className={`${!isSidebarExpanded && 'md:hidden'} whitespace-nowrap`}>Reports & Analytics</span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* LOGOUT & CHANGE PASSWORD */}
        <div className="p-4 border-t border-slate-800 space-y-2 mb-12 md:mb-0">
          <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs transition">
            <KeyRound size={14} />
            <span className={`${!isSidebarExpanded && 'md:hidden'}`}>Change Password</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center justify-center space-x-2 bg-rose-950/60 hover:bg-rose-900 text-rose-300 py-2 rounded-xl text-xs transition">
            <LogOut size={14} />
            <span className={`${!isSidebarExpanded && 'md:hidden'}`}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BACKDROP FOR DRAWER */}
      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/50 z-30 md:hidden" />
      )}

      {/* MAIN SCROLLABLE CONTENT */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">

        {/* 📊 DASHBOARD TAB */}
        {activeTab === 'dashboard' && (() => {
          const scopedSpendLogs = spendLogs.filter(s => {
            const matchesFrom = !dashFromDate || s.date >= dashFromDate;
            const matchesTo = !dashToDate || s.date <= dashToDate;
            return matchesFrom && matchesTo;
          });

          const scopedLeads = visibleLeads.filter(l => {
            const matchesFrom = !dashFromDate || (l.dateAdded && l.dateAdded >= dashFromDate);
            const matchesTo = !dashToDate || (l.dateAdded && l.dateAdded <= dashToDate);
            return matchesFrom && matchesTo;
          });

          const totalSpendSum = scopedSpendLogs.reduce((acc, curr) => acc + curr.spendAmount, 0);
          const totalClicksSum = scopedSpendLogs.reduce((acc, curr) => acc + curr.clicks, 0);
          const totalLeadsCount = scopedLeads.length;

          const avgCPCOverall = totalClicksSum > 0 ? (totalSpendSum / totalClicksSum).toFixed(2) : '0.00';
          const avgCPLOverall = totalLeadsCount > 0 ? (totalSpendSum / totalLeadsCount).toFixed(2) : '0.00';
          const wonLeadsCount = scopedLeads.filter(l => l.status === 'Closed Won').length;

          const pendingActs = visibleActivities.filter(a => a.status === 'Pending' && a.follow_up_date);
          const overdueActsCount = pendingActs.filter(a => a.follow_up_date! < todayStr).length;
          const todayActsCount = pendingActs.filter(a => a.follow_up_date! === todayStr).length;

          let topPerformer = { name: 'N/A', count: 0 };
          if (salesReps.length > 0) {
            const performerMap: Record<string, number> = {};
            scopedLeads.forEach(l => {
              if (l.status === 'Closed Won' && l.assignedSalesName) {
                performerMap[l.assignedSalesName] = (performerMap[l.assignedSalesName] || 0) + 1;
              }
            });

            let maxWon = 0;
            let bestRep = 'N/A';
            Object.entries(performerMap).forEach(([repName, count]) => {
              if (count > maxWon) {
                maxWon = count;
                bestRep = repName;
              }
            });
            topPerformer = { name: bestRep, count: maxWon };
          }

          return (
            <div className="space-y-6">
              {/* HEADER WITH DATE FILTER */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                    {currentUser.role === 'sales_executive' ? `Welcome back, ${currentUser.name}` : 'Executive Performance Insights'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {currentUser.role === 'sales_executive' ? 'Personal performance metrics & task overview' : 'Realtime lead stats, CPL, ad cost & top performer leaderboard'}
                  </p>
                </div>

                <div className="flex items-center space-x-2 text-xs bg-slate-50 p-2 rounded-xl border w-full md:w-auto justify-between md:justify-start">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-slate-500 text-[10px]">From:</span>
                    <input
                      type="date"
                      value={dashFromDate}
                      onChange={e => setDashFromDate(e.target.value)}
                      className="bg-transparent font-bold text-blue-600 outline-none text-xs"
                    />
                  </div>
                  <span className="text-slate-300">•</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-slate-500 text-[10px]">To:</span>
                    <input
                      type="date"
                      value={dashToDate}
                      onChange={e => setDashToDate(e.target.value)}
                      className="bg-transparent font-bold text-blue-600 outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* CORE KPIS GRID */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                {currentUser.role === 'admin' && (
                  <>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                        <DollarSign size={12} className="text-emerald-600" /> <span>Total Spend</span>
                      </p>
                      <h3 className="text-lg md:text-2xl font-black text-slate-800">₹{totalSpendSum.toLocaleString('en-IN')}</h3>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                        <MousePointerClick size={12} className="text-blue-600" /> <span>Total Clicks</span>
                      </p>
                      <h3 className="text-lg md:text-2xl font-black text-blue-600">{totalClicksSum.toLocaleString('en-IN')}</h3>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                        <Calculator size={12} className="text-purple-600" /> <span>Avg CPC</span>
                      </p>
                      <h3 className="text-lg md:text-2xl font-black text-purple-600">₹{avgCPCOverall}</h3>
                    </div>
                  </>
                )}

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                    <Target size={12} className="text-indigo-600" /> <span>Leads</span>
                  </p>
                  <h3 className="text-lg md:text-2xl font-black text-indigo-600">{totalLeadsCount}</h3>
                </div>

                {currentUser.role === 'admin' && (
                  <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-4 rounded-2xl shadow-md space-y-1 col-span-2 lg:col-span-1">
                    <p className="text-[10px] font-bold uppercase text-emerald-100 flex items-center space-x-1">
                      <TrendingUp size={12} /> <span>Avg CPL</span>
                    </p>
                    <h3 className="text-lg md:text-2xl font-black">₹{avgCPLOverall}</h3>
                  </div>
                )}
              </div>

              {/* FOLLOWUPS, OVERDUE & TOP PERFORMER BAR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <Clock size={13} className="text-amber-500" />
                      <span>Pending Follow-ups</span>
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-slate-800">{pendingActs.length} Tasks</h3>
                  </div>
                  <div className="flex flex-col items-end space-y-1 text-xs">
                    <span className="bg-rose-100 text-rose-700 font-bold px-2.5 py-0.5 rounded-lg border border-rose-200 text-[10px]">
                      ⚠️ Overdue: {overdueActsCount}
                    </span>
                    <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-lg border border-amber-200 text-[10px]">
                      📌 Today: {todayActsCount}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <Flame size={13} className="text-emerald-600" />
                      <span>Closed Deals (Won)</span>
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-emerald-600">{wonLeadsCount} Deals</h3>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 p-2.5 rounded-2xl border border-emerald-100">
                    <CheckCircle2 size={22} />
                  </span>
                </div>

                {currentUser.role === 'admin' ? (
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-amber-100 flex items-center space-x-1">
                        <Trophy size={13} />
                        <span>Top Sales Performer</span>
                      </span>
                      <h3 className="text-lg md:text-xl font-black">{topPerformer.name}</h3>
                      <p className="text-[11px] font-semibold text-amber-100">{topPerformer.count} Deals Closed Won</p>
                    </div>
                    <div className="p-2.5 bg-amber-400/40 rounded-2xl border border-amber-300/40">
                      <Trophy size={28} className="text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-blue-100">Your Sales Role</span>
                      <h3 className="text-lg md:text-xl font-black">{currentUser.name}</h3>
                      <p className="text-[11px] font-semibold text-blue-100">{wonLeadsCount} Closed Won Deals</p>
                    </div>
                    <ShieldCheck size={28} className="text-blue-200" />
                  </div>
                )}
              </div>

              {/* CHARTS DASHBOARD */}
              <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base md:text-lg font-bold text-slate-800 border-b pb-2">Visual Performance Analytics</h3>
                <ChartsDashboard
                  spendLogs={scopedSpendLogs}
                  leads={scopedLeads}
                  salesReps={salesReps}
                  activities={visibleActivities}
                />
              </div>

            </div>
          );
        })()}

        {/* LEADS PIPELINE TAB */}
        {activeTab === 'leads' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Leads Pipeline</h2>

                  <div className="flex items-center space-x-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm">
                    <span>Filtered: <strong className="text-blue-600 text-sm">{filteredLeads.length}</strong></span>
                    <span className="text-slate-300">/</span>
                    <span>Total: <strong className="text-slate-700">{visibleLeads.length}</strong></span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing {filteredLeads.length} of {visibleLeads.length} records based on applied filters
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button onClick={exportToPDF} className="flex-1 sm:flex-none flex items-center justify-center space-x-1 bg-rose-600 text-white font-semibold px-3 py-2 rounded-xl text-xs hover:bg-rose-700 transition shadow-sm">
                  <Download size={14} /> <span>PDF Report</span>
                </button>
                <button onClick={exportToExcel} className="flex-1 sm:flex-none flex items-center justify-center space-x-1 bg-emerald-600 text-white font-semibold px-3 py-2 rounded-xl text-xs hover:bg-emerald-700 transition shadow-sm">
                  <FileSpreadsheet size={14} /> <span>Excel CSV</span>
                </button>
                <button onClick={() => setIsAddLeadModalOpen(true)} className="w-full sm:w-auto flex items-center justify-center space-x-1.5 bg-blue-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs hover:bg-blue-700 shadow-md transition">
                  <PlusCircle size={16} /> <span>+ Add Lead</span>
                </button>
              </div>
            </div>

            {/* SEARCH & DETAILED FILTERS */}
            <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center space-x-2 border rounded-xl px-3 py-2 bg-slate-50">
                <Search size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search Lead Name or Phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                {currentUser.role === 'admin' && (
                  <select value={filterAgentId} onChange={e => setFilterAgentId(e.target.value)} className="border rounded-xl p-2 text-xs bg-slate-50 outline-none font-semibold text-blue-700">
                    <option value="ALL">👤 All Sales Execs</option>
                    <option value="UNASSIGNED">⚠️ Unassigned Leads</option>
                    {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}

                <select value={filterCampaign} onChange={e => setFilterCampaign(e.target.value)} className="border rounded-xl p-2 text-xs bg-slate-50 outline-none font-semibold text-purple-700">
                  <option value="ALL">📢 All Campaigns</option>
                  {existingCampaigns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="border rounded-xl p-2 text-xs bg-slate-50 outline-none">
                  <option value="ALL">All Platforms</option>
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-xl p-2 text-xs bg-slate-50 outline-none">
                  <option value="ALL">All Stages</option>
                  {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <div className="flex flex-col bg-slate-50 p-1.5 px-2 rounded-xl border">
                  <span className="font-bold text-slate-500 text-[9px]">Added From:</span>
                  <input
                    type="date"
                    value={leadFromDate}
                    onChange={e => setLeadFromDate(e.target.value)}
                    className="bg-transparent outline-none font-semibold text-blue-600 text-xs"
                  />
                </div>

                <div className="flex flex-col bg-slate-50 p-1.5 px-2 rounded-xl border">
                  <span className="font-bold text-slate-500 text-[9px]">Added To:</span>
                  <input
                    type="date"
                    value={leadToDate}
                    onChange={e => setLeadToDate(e.target.value)}
                    className="bg-transparent outline-none font-semibold text-blue-600 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* LEADS LIST */}
            <div className="grid grid-cols-1 gap-3">
              {filteredLeads.map(l => {
                const leadActs = visibleActivities.filter(a => a.lead_id === l.id);
                const isExpanded = expandedLeadId === l.id;

                return (
                  <div key={l.id} className="bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 transition hover:border-blue-300">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b pb-3">
                      <div>
                        <div className="flex items-center justify-between sm:justify-start space-x-2">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="font-bold text-slate-900 text-sm md:text-base">{l.customerName}</h3>
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-semibold">{l.platform}</span>

                            {/* 📢 CAMPAIGN BADGE */}
                            {l.campaignName && (
                              <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded font-bold border border-purple-200 flex items-center space-x-1">
                                <Megaphone size={10} /> <span>{l.campaignName}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 ml-auto sm:ml-2">
                            <button onClick={() => setEditingLead(l)} title="Edit Lead" className="p-1 hover:bg-blue-50 text-blue-600 rounded-lg transition">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => handleDeleteLead(l.id)} title="Delete Lead" className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] md:text-xs text-slate-500">
                          <p>Phone: <strong className="text-slate-700">{l.phone}</strong></p>
                          <span>•</span>
                          <p>Email: <strong className="text-slate-700">{l.email || 'N/A'}</strong></p>
                          <span>•</span>
                          <p>AdSet: <strong className="text-indigo-600 font-bold">{l.adSet || 'Default'}</strong></p>
                          <span>•</span>
                          <p>Created: <strong className="text-blue-600 font-bold">{l.dateAdded}</strong></p>
                          <span>•</span>
                          <div className="flex items-center space-x-1">
                            <span>Rep:</span>
                            {currentUser.role === 'admin' ? (
                              <select
                                value={l.assignedSalesId || ''}
                                onChange={(e) => handleReassignLead(l.id, e.target.value)}
                                className={`font-bold p-0.5 px-1 rounded-lg border outline-none text-[11px] ${!l.assignedSalesId ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}
                              >
                                <option value="">⚠️ Unassigned</option>
                                {salesReps.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            ) : (
                              <strong className="text-slate-700">{l.assignedSalesName || 'Unassigned'}</strong>
                            )}
                          </div>
                        </div>

                        {l.remark && (
                          <p className="text-xs text-slate-600 bg-amber-50 p-2 rounded-lg border border-amber-100 mt-2 max-w-xl">
                            <strong>Remark:</strong> {l.remark}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-1.5 overflow-x-auto py-1 max-w-full">
                        {STAGES.map(s => {
                          const isCurrent = l.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => handleStageChange(l.id, s)}
                              className={`text-[11px] md:text-xs px-2.5 py-1 rounded-xl transition shrink-0 ${isCurrent ? getStageBadgeStyle(s) : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`tel:${l.phone}`} className="flex items-center space-x-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-blue-100">
                          <Phone size={13} /> <span>Call</span>
                        </a>
                        <a href={`https://wa.me/${l.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center space-x-1 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-emerald-100">
                          <MessageCircle size={13} /> <span>WhatsApp</span>
                        </a>
                        <button onClick={() => setActiveActivityLead(l)} className="flex items-center space-x-1 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-purple-100">
                          <Calendar size={13} /> <span>+ Schedule</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end space-x-2 border-t sm:border-t-0 pt-2 sm:pt-0">
                        {getLeadFollowupBadge(leadActs)}

                        <button
                          onClick={() => setExpandedLeadId(isExpanded ? null : l.id)}
                          className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                        >
                          <FileText size={13} />
                          <span>{isExpanded ? 'Hide Logs ▲' : `View Logs (${leadActs.length}) ▼`}</span>
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2 mt-2">
                        <div className="flex items-center space-x-1 text-slate-700 font-bold border-b pb-1">
                          <FileText size={14} className="text-blue-600" />
                          <span>Activity History ({leadActs.length}):</span>
                        </div>

                        {leadActs.length === 0 ? (
                          <p className="text-slate-400 italic py-1">No notes or activities logged for this lead yet.</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {leadActs.map(act => (
                              <div key={act.id} className="bg-white p-2.5 rounded-lg border text-slate-700 space-y-1">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between font-semibold gap-1">
                                  <span className="text-blue-600">[{act.activity_type}] Purpose: {act.description}</span>
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold w-fit ${act.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : act.status === 'Cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                                    {act.status} ({act.follow_up_date} {act.follow_up_time})
                                  </span>
                                </div>
                                {act.completion_notes && (
                                  <p className="text-emerald-800 bg-emerald-50 p-1.5 rounded font-medium border border-emerald-100">
                                    💬 <strong>Outcome Note:</strong> {act.completion_notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🗓️ FOLLOW-UPS CALENDAR TAB */}
        {activeTab === 'followups' && (
          <div className="space-y-4 md:space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">Follow-ups Calendar</h2>
              <p className="text-xs text-slate-500">Filter and manage scheduled activities (Defaulting to Current Month)</p>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col bg-slate-50 p-2 rounded-xl border">
                  <span className="font-bold text-slate-500 text-[10px]">From:</span>
                  <input
                    type="date"
                    value={followupFromDate}
                    onChange={e => setFollowupFromDate(e.target.value)}
                    className="bg-transparent outline-none font-semibold text-blue-600 text-xs mt-0.5"
                  />
                </div>

                <div className="flex flex-col bg-slate-50 p-2 rounded-xl border">
                  <span className="font-bold text-slate-500 text-[10px]">To:</span>
                  <input
                    type="date"
                    value={followupToDate}
                    onChange={e => setFollowupToDate(e.target.value)}
                    className="bg-transparent outline-none font-semibold text-blue-600 text-xs mt-0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {currentUser.role === 'admin' && (
                  <select
                    value={followupAgentFilter}
                    onChange={e => setFollowupAgentFilter(e.target.value)}
                    className="border rounded-xl p-2 font-semibold bg-slate-50 text-xs outline-none text-blue-700"
                  >
                    <option value="ALL">👤 All Sales Execs</option>
                    {salesReps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}

                <select
                  value={followupTypeFilter}
                  onChange={e => setFollowupTypeFilter(e.target.value)}
                  className="border rounded-xl p-2 font-semibold bg-slate-50 text-xs outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="Call">📞 Call</option>
                  <option value="Email">✉️ Email</option>
                  <option value="WhatsApp">💬 WhatsApp</option>
                  <option value="Meeting">🤝 Meeting</option>
                  <option value="Note">📝 Note</option>
                </select>

                <select
                  value={followupStatusFilter}
                  onChange={e => setFollowupStatusFilter(e.target.value)}
                  className="border rounded-xl p-2 font-semibold bg-slate-50 text-xs outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {filteredFollowups.map(act => {
                const lead = leads.find(l => l.id === act.lead_id);
                const isCompleted = act.status === 'Completed';
                const isCancelled = act.status === 'Cancelled';

                return (
                  <div key={act.id} className={`p-4 rounded-2xl border shadow-sm space-y-3 ${isCompleted ? 'bg-emerald-50/50 border-emerald-200' : isCancelled ? 'bg-rose-50/50 border-rose-200' : 'bg-white border-slate-200'
                    }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">{act.activity_type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isCompleted ? 'bg-emerald-600 text-white' : isCancelled ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                            }`}>
                            {act.status}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm md:text-base mt-2">{lead?.customerName || 'Customer'}</h4>
                        <p className="text-[11px] text-blue-600 font-semibold">Rep: {lead?.assignedSalesName || 'Unassigned'}</p>
                        <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                          <Clock size={12} />
                          <span>Date: <strong>{act.follow_up_date}</strong> at <strong>{act.follow_up_time || 'N/A'}</strong></span>
                        </p>
                      </div>

                      <div className="flex items-center space-x-1">
                        {lead && (
                          <>
                            <a href={`tel:${lead.phone}`} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                              <Phone size={14} />
                            </a>
                            <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">
                              <MessageCircle size={14} />
                            </a>
                          </>
                        )}
                        <button onClick={() => setEditingActivity(act)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition" title="Edit Task">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteActivity(act.id)} className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition" title="Delete Task">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs bg-white p-2.5 rounded-xl border text-slate-700"><strong>Purpose:</strong> {act.description}</p>

                    {isCompleted ? (
                      <div className="bg-emerald-100/70 p-2 rounded-xl text-xs text-emerald-900 border border-emerald-200 font-medium">
                        <strong>Outcome:</strong> {act.completion_notes}
                      </div>
                    ) : isCancelled ? (
                      <div className="bg-rose-100/70 p-2 rounded-xl text-xs text-rose-900 border border-rose-200 font-medium">
                        <strong>Status:</strong> Cancelled / Rescheduled
                      </div>
                    ) : (
                      <button
                        onClick={() => setCompletingActivity(act)}
                        className="w-full bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center space-x-1 shadow-sm"
                      >
                        <CheckCircle2 size={14} />
                        <span>Update Status & Next Step</span>
                      </button>
                    )}

                  </div>
                );
              })}

              {filteredFollowups.length === 0 && (
                <div className="col-span-full bg-white p-8 rounded-2xl border text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <p className="font-semibold text-xs md:text-sm">No follow-ups found for selected filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 💸 DAILY AD SPEND TAB */}
        {activeTab === 'spend' && currentUser.role === 'admin' && (() => {
          const totalSpendFiltered = filteredSpendLogs.reduce((acc, curr) => acc + curr.spendAmount, 0);
          const totalClicksFiltered = filteredSpendLogs.reduce((acc, curr) => acc + curr.clicks, 0);

          const leadsInFilterScope = leads.filter(l => {
            const matchesFrom = !spendFromDate || (l.dateAdded && l.dateAdded >= spendFromDate);
            const matchesTo = !spendToDate || (l.dateAdded && l.dateAdded <= spendToDate);
            const matchesPlatform = spendPlatformFilter === 'ALL' || l.platform === spendPlatformFilter;
            return matchesFrom && matchesTo && matchesPlatform;
          });

          const totalLeadsInScope = leadsInFilterScope.length;
          const avgCPLInScope = totalLeadsInScope > 0 ? (totalSpendFiltered / totalLeadsInScope).toFixed(2) : '0.00';

          return (
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900">Daily Ad Spend & CPL Tracker</h2>
                  <p className="text-xs text-slate-500">Track expenditures, clicks, and average cost per lead in ₹ INR (Current Month)</p>
                </div>
                <button onClick={() => setIsAddSpendModalOpen(true)} className="flex items-center space-x-1.5 bg-emerald-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs md:text-sm hover:bg-emerald-700 shadow-sm transition">
                  <PlusCircle size={16} /> <span>+ Log Spend</span>
                </button>
              </div>

              {/* SUMMARY CARDS BAR */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase flex items-center space-x-1">
                    <DollarSign size={13} className="text-emerald-600" />
                    <span>Total Spend</span>
                  </p>
                  <h3 className="text-lg md:text-2xl font-bold text-slate-800">₹{totalSpendFiltered.toLocaleString('en-IN')}</h3>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase flex items-center space-x-1">
                    <MousePointerClick size={13} className="text-blue-600" />
                    <span>Total Clicks</span>
                  </p>
                  <h3 className="text-lg md:text-2xl font-bold text-blue-600">{totalClicksFiltered.toLocaleString('en-IN')}</h3>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase flex items-center space-x-1">
                    <Target size={13} className="text-indigo-600" />
                    <span>Leads Acquired</span>
                  </p>
                  <h3 className="text-lg md:text-2xl font-bold text-indigo-600">{totalLeadsInScope} Leads</h3>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-4 rounded-2xl text-white shadow-md space-y-1">
                  <p className="text-[10px] md:text-xs font-bold uppercase text-emerald-100 flex items-center space-x-1">
                    <Calculator size={13} />
                    <span>Avg Cost Per Lead (CPL)</span>
                  </p>
                  <h3 className="text-xl md:text-2xl font-black">₹{avgCPLInScope}</h3>
                </div>
              </div>

              {/* FILTER BAR FOR AD SPEND */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 flex-1">
                  <div className="flex flex-col bg-slate-50 p-2 rounded-xl border">
                    <span className="font-bold text-slate-500 text-[10px]">Spend From:</span>
                    <input
                      type="date"
                      value={spendFromDate}
                      onChange={e => setSpendFromDate(e.target.value)}
                      className="bg-transparent outline-none font-semibold text-blue-600 text-xs mt-0.5"
                    />
                  </div>

                  <div className="flex flex-col bg-slate-50 p-2 rounded-xl border">
                    <span className="font-bold text-slate-500 text-[10px]">Spend To:</span>
                    <input
                      type="date"
                      value={spendToDate}
                      onChange={e => setSpendToDate(e.target.value)}
                      className="bg-transparent outline-none font-semibold text-blue-600 text-xs mt-0.5"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1 flex flex-col justify-center">
                    <select
                      value={spendPlatformFilter}
                      onChange={e => setSpendPlatformFilter(e.target.value)}
                      className="w-full border rounded-xl p-2.5 font-semibold bg-slate-50 text-xs outline-none text-slate-700"
                    >
                      <option value="ALL">🌐 All Platforms</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {(spendFromDate || spendToDate || spendPlatformFilter !== 'ALL') && (
                  <button
                    onClick={() => { setSpendFromDate(''); setSpendToDate(''); setSpendPlatformFilter('ALL'); }}
                    className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 p-2.5 rounded-xl border border-rose-200 transition text-center"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* TABLE */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs md:text-sm">
                  <thead className="bg-slate-50 border-b text-slate-500 font-semibold">
                    <tr>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Platform</th>
                      <th className="p-3.5">Amount (₹)</th>
                      <th className="p-3.5">Clicks</th>
                      <th className="p-3.5">CPC (₹)</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSpendLogs.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-medium whitespace-nowrap text-slate-700">{s.date}</td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-700 text-[11px] px-2.5 py-1 rounded-lg font-bold">
                            {s.platform}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">₹{s.spendAmount.toLocaleString('en-IN')}</td>
                        <td className="p-3.5 font-semibold text-slate-600">{s.clicks}</td>
                        <td className="p-3.5 font-bold text-emerald-600">₹{s.cpc}</td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            <button onClick={() => setEditingSpend(s)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition" title="Edit Log">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => handleDeleteSpend(s.id)} className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition" title="Delete Log">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredSpendLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-400 italic">No spend logs match the selected filter criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* SALES TEAM TAB */}
        {activeTab === 'agents' && currentUser.role === 'admin' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">Sales Representatives</h2>
                <p className="text-xs text-slate-500">Manage agent profiles, status & contact details</p>
              </div>
              <button onClick={() => setIsAddAgentModalOpen(true)} className="flex items-center space-x-1.5 bg-blue-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs md:text-sm hover:bg-blue-700 shadow-sm transition">
                <PlusCircle size={16} /> <span>+ Add Agent</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {salesReps.map(agent => {
                const assignedCount = leads.filter(l => l.assignedSalesId === agent.id).length;
                const isActive = agent.status !== 'Inactive';

                return (
                  <div key={agent.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover:border-blue-300 transition">
                    <div className="flex justify-between items-start border-b pb-2.5">
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{agent.name}</h4>
                        <p className="text-[11px] font-semibold text-blue-600">Assigned Leads: <strong>{assignedCount}</strong></p>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button onClick={() => setEditingAgent(agent)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition" title="Edit Agent">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDeleteAgent(agent.id, agent.name)} className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition" title="Delete Agent">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <p className="flex items-center space-x-1.5"><Mail size={13} className="text-slate-400" /> <span>{agent.email || 'No Email'}</span></p>
                      <p className="flex items-center space-x-1.5"><Phone size={13} className="text-slate-400" /> <span>{agent.phone || 'No Phone'}</span></p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t text-xs">
                      <span className="font-semibold text-slate-500">Account Status:</span>
                      <button
                        onClick={() => handleToggleAgentStatus(agent)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition flex items-center space-x-1 ${isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                      >
                        <span>{isActive ? '🟢 Active' : '🔴 Inactive'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🏆 REPORTS & CAMPAIGN ANALYTICS TAB */}
        {activeTab === 'reports' && currentUser.role === 'admin' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">Campaign & AdSet Analytics</h2>
              <p className="text-xs text-slate-500">Track best performing marketing campaigns, ad sets, and conversion efficiency</p>
            </div>

            {/* CAMPAIGN METRICS BREAKDOWN GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(campaignPerformance).map(([campaignName, data]) => {
                const conversionRate = data.totalLeads > 0 ? ((data.wonLeads / data.totalLeads) * 100).toFixed(1) : '0';

                return (
                  <div key={campaignName} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div>
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center space-x-1">
                          <Megaphone size={12} /> <span>Campaign Name</span>
                        </span>
                        <h3 className="text-lg font-black text-slate-900">{campaignName}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Conversion Rate</span>
                        <p className="text-lg font-black text-emerald-600">{conversionRate}%</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border">
                        <p className="text-[10px] font-bold text-slate-500">Total Leads</p>
                        <h4 className="text-xl font-bold text-blue-600">{data.totalLeads}</h4>
                      </div>
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-700">Closed Won Deals</p>
                        <h4 className="text-xl font-bold text-emerald-700">{data.wonLeads}</h4>
                      </div>
                    </div>

                    {/* ADSET BREAKDOWN */}
                    <div className="space-y-2 pt-2 border-t">
                      <h5 className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                        <Layers size={13} className="text-indigo-600" />
                        <span>AdSet Breakdown</span>
                      </h5>
                      <div className="space-y-1.5">
                        {Object.entries(data.adSets).map(([adSetName, adData]) => (
                          <div key={adSetName} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border">
                            <span className="font-semibold text-slate-700">{adSetName}</span>
                            <div className="space-x-2">
                              <span className="text-slate-500">Leads: <strong>{adData.total}</strong></span>
                              <span className="text-emerald-600 font-bold">Won: {adData.won}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            <ChartsDashboard spendLogs={spendLogs} leads={leads} salesReps={salesReps} activities={activities} />
          </div>
        )}

        {/* MODAL: EDIT SALES AGENT */}
        {editingAgent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Edit Sales Agent Details</h3>
                <button onClick={() => setEditingAgent(null)}><X size={20} /></button>
              </div>

              <form onSubmit={handleUpdateAgent} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Agent Name *</label>
                  <input
                    type="text"
                    required
                    value={editingAgent.name}
                    onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingAgent.email || ''}
                    onChange={e => setEditingAgent({ ...editingAgent, email: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editingAgent.phone || ''}
                    onChange={e => setEditingAgent({ ...editingAgent, phone: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                  <select
                    value={editingAgent.status || 'Active'}
                    onChange={e => setEditingAgent({ ...editingAgent, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-blue-700"
                  >
                    <option value="Active">🟢 Active</option>
                    <option value="Inactive">🔴 Inactive</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition">Save Changes</button>
                  <button type="button" onClick={() => setEditingAgent(null)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT SPEND */}
        {editingSpend && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Edit Daily Spend Log</h3>
                <button onClick={() => setEditingSpend(null)}><X size={20} /></button>
              </div>

              <form onSubmit={handleUpdateSpend} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date</label>
                  <input type="date" required value={editingSpend.date} onChange={e => setEditingSpend({ ...editingSpend, date: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-blue-600" />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Platform</label>
                  <select value={editingSpend.platform} onChange={e => setEditingSpend({ ...editingSpend, platform: e.target.value as PlatformName })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Amount Spent (₹ INR)</label>
                  <input type="number" required value={editingSpend.spendAmount} onChange={e => setEditingSpend({ ...editingSpend, spendAmount: Number(e.target.value) })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Clicks Received</label>
                  <input type="number" required value={editingSpend.clicks} onChange={e => setEditingSpend({ ...editingSpend, clicks: Number(e.target.value) })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition">Save Changes</button>
                  <button type="button" onClick={() => setEditingSpend(null)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDIT FOLLOW-UP ACTIVITY */}
        {editingActivity && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Edit Follow-up Task</h3>
                <button onClick={() => setEditingActivity(null)}><X size={20} /></button>
              </div>

              <form onSubmit={handleUpdateActivity} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Activity Type</label>
                  <select
                    value={editingActivity.activity_type}
                    onChange={e => setEditingActivity({ ...editingActivity, activity_type: e.target.value as any })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none"
                  >
                    <option value="Call">📞 Call Log</option>
                    <option value="Email">✉️ Email Sent</option>
                    <option value="WhatsApp">💬 WhatsApp Chat</option>
                    <option value="Meeting">🤝 Meeting Scheduled</option>
                    <option value="Note">📝 Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose / Remark</label>
                  <textarea
                    required
                    value={editingActivity.description}
                    onChange={e => setEditingActivity({ ...editingActivity, description: e.target.value })}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm h-20 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      required
                      value={editingActivity.follow_up_date || ''}
                      onChange={e => setEditingActivity({ ...editingActivity, follow_up_date: e.target.value })}
                      className="w-full border rounded-xl p-2 text-xs outline-none font-semibold text-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Time</label>
                    <input
                      type="time"
                      required
                      value={editingActivity.follow_up_time || ''}
                      onChange={e => setEditingActivity({ ...editingActivity, follow_up_time: e.target.value })}
                      className="w-full border rounded-xl p-2 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition">Save Changes</button>
                  <button type="button" onClick={() => setEditingActivity(null)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SCHEDULE FOLLOW-UP */}
        {activeActivityLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm md:text-base">Schedule Follow-up Task</h3>
                  <p className="text-xs text-blue-600 font-semibold">{activeActivityLead.customerName}</p>
                </div>
                <button onClick={() => setActiveActivityLead(null)}><X size={20} /></button>
              </div>

              <form onSubmit={handleScheduleActivity} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Activity Type</label>
                  <select value={activityType} onChange={e => setActivityType(e.target.value as any)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                    <option value="Call">📞 Call Log</option>
                    <option value="Email">✉️ Email Sent</option>
                    <option value="WhatsApp">💬 WhatsApp Chat</option>
                    <option value="Meeting">🤝 Meeting Scheduled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Purpose / Remark</label>
                  <textarea placeholder="Reason for follow-up..." required value={activityDesc} onChange={e => setActivityDesc(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm h-20 outline-none" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date</label>
                    <input type="date" required value={activityFollowUpDate} onChange={e => setActivityFollowUpDate(e.target.value)} className="w-full border rounded-xl p-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Time</label>
                    <input
                      type="time"
                      required
                      value={activityFollowUpTime}
                      onChange={e => setActivityFollowUpTime(e.target.value)}
                      className="w-full border rounded-xl p-2 text-xs outline-none"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition">
                  Schedule Follow-up Task
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: UPDATE OUTCOME */}
        {completingActivity && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Update Follow-up Outcome</h3>
                <button onClick={() => setCompletingActivity(null)}><X size={20} /></button>
              </div>

              <div className="space-y-3">
                <div className="bg-slate-50 p-2.5 rounded-xl border text-xs">
                  <strong>Current:</strong> {completingActivity.activity_type} - {completingActivity.description}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discussion Outcome / Notes</label>
                  <textarea
                    placeholder="Enter discussion outcome..."
                    value={completionNotes}
                    onChange={e => setCompletionNotes(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm h-20 outline-none"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => handleCompleteWorkflow('Done')}
                    className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition"
                  >
                    Done (Close Task)
                  </button>

                  <button
                    onClick={() => handleCompleteWorkflow('DoneAndNext')}
                    className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition"
                  >
                    Done & Next Activity
                  </button>

                  <button
                    onClick={() => handleCompleteWorkflow('CancelAndNext')}
                    className="w-full bg-rose-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-rose-700 transition"
                  >
                    Cancel & Next Activity
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD LEAD (WITH DATALIST FOR CAMPAIGN & ADSET) */}
        {isAddLeadModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Create New Lead</h3>
                <button onClick={() => setIsAddLeadModalOpen(false)}><X size={20} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lead Date *</label>
                  <input
                    type="date"
                    required
                    value={leadCustomDate}
                    onChange={e => setLeadCustomDate(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-blue-600"
                  />
                </div>

                <input type="text" placeholder="Customer Name *" required value={leadName} onChange={e => setLeadName(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                <input type="text" placeholder="Phone Number *" required value={leadPhone} onChange={e => setLeadPhone(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                <input type="email" placeholder="Email Address" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />

                {/* 🎯 CAMPAIGN & ADSET AUTOCOMPLETE SELECTION */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Campaign Name</label>
                    <input
                      type="text"
                      list="add-campaign-suggestions"
                      placeholder="Type or select..."
                      value={leadCampaignName}
                      onChange={e => setLeadCampaignName(e.target.value)}
                      className="w-full border rounded-xl p-2 text-xs outline-none font-semibold text-purple-700"
                    />
                    <datalist id="add-campaign-suggestions">
                      {existingCampaigns.map((c, i) => <option key={i} value={c} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ad Set</label>
                    <input
                      type="text"
                      list="add-adset-suggestions"
                      placeholder="Type or select..."
                      value={leadAdSet}
                      onChange={e => setLeadAdSet(e.target.value)}
                      className="w-full border rounded-xl p-2 text-xs outline-none font-semibold text-indigo-700"
                    />
                    <datalist id="add-adset-suggestions">
                      {existingAdSets.map((a, i) => <option key={i} value={a} />)}
                    </datalist>
                  </div>
                </div>

                <select value={leadPlatform} onChange={e => setLeadPlatform(e.target.value as PlatformName)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                {currentUser.role === 'admin' ? (
                  <select value={leadAgentId} onChange={e => setLeadAgentId(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                    <option value="">-- Manual Agent Assign --</option>
                    {salesReps.filter(r => r.status !== 'Inactive').map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                ) : (
                  <input type="text" disabled value={`Assigned To: ${currentUser.name}`} className="w-full border rounded-xl p-2.5 text-xs md:text-sm bg-slate-100 font-semibold text-slate-600" />
                )}

                <textarea
                  placeholder="Initial Remark / Requirement Details (Optional)"
                  value={leadRemark}
                  onChange={e => setLeadRemark(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none h-20"
                />
              </div>

              <div className="pt-2 border-t flex flex-col gap-2">
                <button onClick={() => handleSaveLead(false)} className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition">
                  Save Lead
                </button>
                {currentUser.role === 'admin' && (
                  <button onClick={() => handleSaveLead(true)} className="w-full bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition">
                    Save & Assign (Round-Robin)
                  </button>
                )}
                <button onClick={() => setIsAddLeadModalOpen(false)} className="w-full bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDIT LEAD */}
        {editingLead && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Edit Lead Details</h3>
                <button onClick={() => setEditingLead(null)}><X size={20} /></button>
              </div>
              <form onSubmit={handleUpdateLead} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Created Date</label>
                  <input type="date" required value={editingLead.dateAdded} onChange={e => setEditingLead({ ...editingLead, dateAdded: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-blue-600" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer Name</label>
                  <input type="text" required value={editingLead.customerName} onChange={e => setEditingLead({ ...editingLead, customerName: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Phone Number</label>
                  <input type="text" required value={editingLead.phone} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Email Address</label>
                  <input type="email" value={editingLead.email || ''} onChange={e => setEditingLead({ ...editingLead, email: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                </div>

                {/* EDIT CAMPAIGN & ADSET FIELDS */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Campaign Name</label>
                    <input
                      type="text"
                      list="edit-campaign-suggestions"
                      value={editingLead.campaignName || ''}
                      onChange={e => setEditingLead({ ...editingLead, campaignName: e.target.value })}
                      className="w-full border rounded-xl p-2 text-xs outline-none font-semibold text-purple-700"
                    />
                    <datalist id="edit-campaign-suggestions">
                      {existingCampaigns.map((c, i) => <option key={i} value={c} />)}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Ad Set</label>
                    <input
                      type="text"
                      list="edit-adset-suggestions"
                      value={editingLead.adSet || ''}
                      onChange={e => setEditingLead({ ...editingLead, adSet: e.target.value })}
                      className="w-full border rounded-xl p-2 text-xs outline-none font-semibold text-indigo-700"
                    />
                    <datalist id="edit-adset-suggestions">
                      {existingAdSets.map((a, i) => <option key={i} value={a} />)}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Platform</label>
                  <select value={editingLead.platform} onChange={e => setEditingLead({ ...editingLead, platform: e.target.value as PlatformName })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Remark / Notes</label>
                  <textarea value={editingLead.remark || ''} onChange={e => setEditingLead({ ...editingLead, remark: e.target.value })} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none h-20" />
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition">Save Changes</button>
                  <button type="button" onClick={() => setEditingLead(null)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD SPEND */}
        {isAddSpendModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Log Daily Spend</h3>
                <button onClick={() => setIsAddSpendModalOpen(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddSpend} className="space-y-3">
                <input type="date" required value={spendDate} onChange={e => setSpendDate(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none font-semibold text-blue-600" />
                <select value={spendPlatform} onChange={e => setSpendPlatform(e.target.value as PlatformName)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none">
                  {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input type="number" placeholder="Spend Amount (₹ INR) *" required value={spendAmount} onChange={e => setSpendAmount(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                <input type="number" placeholder="Clicks Received *" required value={spendClicks} onChange={e => setSpendClicks(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-emerald-700 transition">Save Log</button>
                  <button type="button" onClick={() => setIsAddSpendModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD AGENT */}
        {isAddAgentModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-slate-800 text-sm md:text-base">Add Sales Agent</h3>
                <button onClick={() => setIsAddAgentModalOpen(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleAddAgent} className="space-y-3">
                <input type="text" placeholder="Agent Name *" required value={agentName} onChange={e => setAgentName(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                <input type="email" placeholder="Email Address" value={agentEmail} onChange={e => setAgentEmail(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />
                <input type="text" placeholder="Phone Number" value={agentPhone} onChange={e => setAgentPhone(e.target.value)} className="w-full border rounded-xl p-2.5 text-xs md:text-sm outline-none" />

                <div className="flex gap-2 pt-2 border-t">
                  <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-xl text-xs hover:bg-blue-700 transition">Save Agent</button>
                  <button type="button" onClick={() => setIsAddAgentModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-slate-200 transition">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* 🔑 MODAL: CHANGE PASSWORD */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Change Security Password</h3>
              <button onClick={() => setIsChangePasswordModalOpen(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border rounded-xl p-2.5 text-xs outline-none font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold py-2 rounded-xl text-xs hover:bg-blue-700">Update Password</button>
                <button type="button" onClick={() => setIsChangePasswordModalOpen(false)} className="flex-1 bg-slate-100 py-2 rounded-xl text-xs">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 flex items-center justify-around p-2 z-30 text-slate-400">
        <button onClick={() => changeTab('dashboard')} className={`flex flex-col items-center space-y-0.5 p-1 ${activeTab === 'dashboard' ? 'text-blue-400 font-bold' : ''}`}>
          <LayoutDashboard size={18} />
          <span className="text-[10px]">Dashboard</span>
        </button>

        <button onClick={() => changeTab('leads')} className={`flex flex-col items-center space-y-0.5 p-1 ${activeTab === 'leads' ? 'text-blue-400 font-bold' : ''}`}>
          <Users size={18} />
          <span className="text-[10px]">Leads</span>
        </button>

        <button onClick={() => changeTab('followups')} className={`flex flex-col items-center space-y-0.5 p-1 ${activeTab === 'followups' ? 'text-blue-400 font-bold' : ''}`}>
          <Calendar size={18} />
          <span className="text-[10px]">Tasks</span>
        </button>

        {currentUser.role === 'admin' && (
          <button onClick={() => changeTab('spend')} className={`flex flex-col items-center space-y-0.5 p-1 ${activeTab === 'spend' ? 'text-blue-400 font-bold' : ''}`}>
            <DollarSign size={18} />
            <span className="text-[10px]">Spend</span>
          </button>
        )}
      </div>

    </div>
  );
}