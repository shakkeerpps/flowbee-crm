import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

// Supabase Client Setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { type } = req.query; // 'daily' | 'weekly' | 'monthly'

    const today = new Date();
    let startDateStr = '';
    let endDateStr = '';
    let reportTitle = '';

    // 🗓️ DATE RANGE CALCULATOR
    if (type === 'daily') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      startDateStr = yesterday.toISOString().split('T')[0];
      endDateStr = startDateStr;
      reportTitle = `Daily Executive Summary (${startDateStr})`;
    } else if (type === 'weekly') {
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - 6);
      startDateStr = lastSunday.toISOString().split('T')[0];
      endDateStr = today.toISOString().split('T')[0];
      reportTitle = `Weekly Executive Performance Report (${startDateStr} to ${endDateStr})`;
    } else if (type === 'monthly') {
      const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      startDateStr = firstDayPrevMonth.toISOString().split('T')[0];
      endDateStr = lastDayPrevMonth.toISOString().split('T')[0];
      reportTitle = `Monthly Executive Report (${firstDayPrevMonth.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }

    // 1. Fetch Leads
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .gte('date_added', startDateStr)
      .lte('date_added', endDateStr);

    // 2. Fetch Spend Logs
    const { data: spendLogs } = await supabase
      .from('daily_spend_logs')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    const allLeads = leads || [];
    const allSpend = spendLogs || [];

    // 📊 CALCULATE METRICS
    const totalLeads = allLeads.length;
    const totalWon = allLeads.filter(l => l.status === 'Closed Won').length;
    const totalSpend = allSpend.reduce((acc, curr) => acc + Number(curr.spend_amount || 0), 0);
    const avgCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';

    // Best Campaign Calculation
    const campMap: Record<string, number> = {};
    allLeads.forEach(l => {
      const name = l.campaign_name || 'Direct / Organic';
      if (l.status === 'Closed Won') campMap[name] = (campMap[name] || 0) + 1;
    });
    let bestCampaign = 'N/A';
    let maxCampWon = 0;
    Object.entries(campMap).forEach(([name, count]) => {
      if (count > maxCampWon) { maxCampWon = count; bestCampaign = name; }
    });

    // Best Sales Exec Calculation
    const agentMap: Record<string, number> = {};
    allLeads.forEach(l => {
      const agent = l.assigned_sales_name || 'Unassigned';
      if (l.status === 'Closed Won') agentMap[agent] = (agentMap[agent] || 0) + 1;
    });
    let bestAgent = 'N/A';
    let maxAgentWon = 0;
    Object.entries(agentMap).forEach(([name, count]) => {
      if (count > maxAgentWon) { maxAgentWon = count; bestAgent = name; }
    });

    // ✉️ HTML EMAIL TEMPLATE
    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; background: #ffffff;">
        <h2 style="color: #0f172a; margin-top: 0;">📢 Flowbee CRM - ${reportTitle}</h2>
        <p style="color: #64748b; font-size: 14px;">Automated Executive Report generated for period: <b>${startDateStr}</b> to <b>${endDateStr}</b></p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Total Spend:</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; color: #059669; font-weight: bold;">₹${totalSpend.toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Total Leads:</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: bold;">${totalLeads}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Closed Won Deals:</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; color: #16a34a; font-weight: bold;">${totalWon} Deals</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Avg Cost Per Lead (CPL):</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; font-weight: bold;">₹${avgCPL}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Top Performing Campaign:</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; color: #7c3aed; font-weight: bold;">${bestCampaign} (${maxCampWon} Won)</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #cbd5e1;"><b>Top Sales Agent:</b></td>
            <td style="padding: 12px; border: 1px solid #cbd5e1; color: #2563eb; font-weight: bold;">${bestAgent} (${maxAgentWon} Won)</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
          Flowbee CRM Executive Automation • Direct Workspace Dispatch
        </div>
      </div>
    `;

    // 🚀 DIRECT NODEMAILER DISPATCH (NO FETCH INTERNALS)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'server242.web-hosting.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'crm@flowbee.io',
        pass: process.env.SMTP_PASS,
      },
    });

    const recipientList = [
      'vertexsolutionsptb@gmail.com',
      'rafeekfazili@gmail.com',
      'salesgbc2026@gmail.com',
      'crm@flowbee.io'
    ];

    await transporter.sendMail({
      from: '"Flowbee CRM" <crm@flowbee.io>',
      to: recipientList.join(', '),
      subject: `📊 Executive Summary: ${reportTitle}`,
      html: htmlEmail,
    });

    return res.status(200).json({ success: true, message: `Report dispatched directly to ${recipientList.length} emails!` });

  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}