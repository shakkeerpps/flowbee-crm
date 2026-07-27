import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { type = 'daily' } = req.query; // 'daily' | 'weekly' | 'monthly'

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
      reportTitle = `Daily Executive Performance Brief (${startDateStr})`;
    } else if (type === 'weekly') {
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - 6);
      startDateStr = lastSunday.toISOString().split('T')[0];
      endDateStr = today.toISOString().split('T')[0];
      reportTitle = `Weekly Performance & Conversion Report (${startDateStr} to ${endDateStr})`;
    } else if (type === 'monthly') {
      const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      startDateStr = firstDayPrevMonth.toISOString().split('T')[0];
      endDateStr = lastDayPrevMonth.toISOString().split('T')[0];
      reportTitle = `Monthly Executive Growth Audit (${firstDayPrevMonth.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
    }

    // 1. DATA FETCHING
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .gte('date_added', startDateStr)
      .lte('date_added', endDateStr);

    const { data: spendData } = await supabase
      .from('daily_spend_logs')
      .select('*')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    const { data: salesReps } = await supabase.from('sales_reps').select('*');

    const leads = leadsData || [];
    const spendLogs = spendData || [];
    const reps = salesReps || [];

    // 2. CORE METRICS
    const totalLeads = leads.length;
    const totalWon = leads.filter(l => l.status === 'Closed Won').length;
    const totalLost = leads.filter(l => l.status === 'Closed Lost').length;
    const inPipeline = totalLeads - (totalWon + totalLost);

    const totalSpend = spendLogs.reduce((acc, curr) => acc + Number(curr.spend_amount || 0), 0);
    const totalClicks = spendLogs.reduce((acc, curr) => acc + Number(curr.clicks || 0), 0);

    const winRate = totalLeads > 0 ? ((totalWon / totalLeads) * 100).toFixed(1) : '0.0';
    const avgCPL = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : '0.00';
    const cpa = totalWon > 0 ? (totalSpend / totalWon).toFixed(2) : '0.00';
    const avgCPC = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0.00';

    // 3. STAGE PIPELINE BREAKDOWN
    const stages = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Closed Won', 'Closed Lost'];
    const stageCounts: Record<string, number> = {};
    stages.forEach(s => stageCounts[s] = leads.filter(l => l.status === s).length);

    // 4. CAMPAIGN & ADSET PERFORMANCE AGGREGATION
    const campaignMap: Record<string, { total: number; won: number; adSets: Record<string, { total: number; won: number }> }> = {};
    leads.forEach(l => {
      const camp = l.campaign_name || l.campaignName || 'Direct / Organic';
      const adSet = l.ad_set || l.adSet || 'Default AdSet';

      if (!campaignMap[camp]) campaignMap[camp] = { total: 0, won: 0, adSets: {} };
      campaignMap[camp].total += 1;
      if (l.status === 'Closed Won') campaignMap[camp].won += 1;

      if (!campaignMap[camp].adSets[adSet]) campaignMap[camp].adSets[adSet] = { total: 0, won: 0 };
      campaignMap[camp].adSets[adSet].total += 1;
      if (l.status === 'Closed Won') campaignMap[camp].adSets[adSet].won += 1;
    });

    // 5. SALES EXEC PERFORMANCE AGGREGATION
    const agentPerformance = reps.map(rep => {
      const repLeads = leads.filter(l => l.assigned_sales_id === rep.id || l.assigned_sales_name === rep.name);
      const repWon = repLeads.filter(l => l.status === 'Closed Won').length;
      const repConversion = repLeads.length > 0 ? ((repWon / repLeads.length) * 100).toFixed(1) : '0.0';
      return {
        name: rep.name,
        total: repLeads.length,
        won: repWon,
        conversion: repConversion
      };
    }).sort((a, b) => b.won - a.won);

    // ✉️ HTML EMAIL TEMPLATE GENERATION
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #334155; }
          .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
          .header { background: #0f172a; padding: 28px 32px; color: #ffffff; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; tracking-tight: -0.02em; }
          .header p { margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500; }
          .section { padding: 24px 32px; border-bottom: 1px solid #f1f5f9; }
          .section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 16px; display: flex; align-items: center; }
          .kpi-grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 8px; }
          .kpi-card { display: table-cell; background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; }
          .kpi-value { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px; }
          .kpi-label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
          .pipeline-bar { display: table; width: 100%; table-layout: fixed; background: #f1f5f9; border-radius: 8px; overflow: hidden; margin-top: 8px; }
          .pipeline-stage { display: table-cell; padding: 10px 4px; text-align: center; font-size: 11px; font-weight: bold; border-right: 1px solid #ffffff; }
          .data-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
          .data-table th { background: #f8fafc; text-align: left; padding: 10px; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
          .data-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; color: #334155; font-weight: 500; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 800; }
          .badge-green { background: #dcfce7; color: #15803d; }
          .badge-purple { background: #f3e8ff; color: #7e22ce; }
          .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>

        <div class="container">
          <!-- HEADER -->
          <div class="header">
            <h1>📢 Flowbee CRM Executive Analytics</h1>
            <p>${reportTitle} • Period: <b>${startDateStr}</b> to <b>${endDateStr}</b></p>
          </div>

          <!-- EXECUTIVE KPIS -->
          <div class="section">
            <div class="section-title">📊 Executive Financial & Conversion Overview</div>
            
            <table style="width:100%; border-spacing: 8px; border-collapse: separate;">
              <tr>
                <td class="kpi-card" style="border-left: 4px solid #10b981;">
                  <div class="kpi-label">Total Spend</div>
                  <div class="kpi-value" style="color:#059669;">₹${totalSpend.toLocaleString('en-IN')}</div>
                </td>
                <td class="kpi-card" style="border-left: 4px solid #3b82f6;">
                  <div class="kpi-label">Total Leads</div>
                  <div class="kpi-value" style="color:#2563eb;">${totalLeads}</div>
                </td>
                <td class="kpi-card" style="border-left: 4px solid #059669;">
                  <div class="kpi-label">Closed Won</div>
                  <div class="kpi-value" style="color:#059669;">${totalWon}</div>
                </td>
                <td class="kpi-card" style="border-left: 4px solid #8b5cf6;">
                  <div class="kpi-label">Win Rate</div>
                  <div class="kpi-value" style="color:#7c3aed;">${winRate}%</div>
                </td>
              </tr>
              <tr>
                <td class="kpi-card">
                  <div class="kpi-label">Avg CPL</div>
                  <div class="kpi-value">₹${avgCPL}</div>
                </td>
                <td class="kpi-card">
                  <div class="kpi-label">Cost Per Deal (CPA)</div>
                  <div class="kpi-value">₹${cpa}</div>
                </td>
                <td class="kpi-card">
                  <div class="kpi-label">Total Clicks</div>
                  <div class="kpi-value">${totalClicks}</div>
                </td>
                <td class="kpi-card">
                  <div class="kpi-label">Avg CPC</div>
                  <div class="kpi-value">₹${avgCPC}</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- PIPELINE BREAKDOWN -->
          <div class="section">
            <div class="section-title">🎯 Pipeline Stages Distribution</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Leads Count</th>
                  <th>Share (%)</th>
                </tr>
              </thead>
              <tbody>
                ${stages.map(stage => {
                  const count = stageCounts[stage] || 0;
                  const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : '0.0';
                  return `
                    <tr>
                      <td><b>${stage}</b></td>
                      <td><b>${count}</b></td>
                      <td>${pct}%</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- CAMPAIGN & ADSET EFFICIENCY -->
          <div class="section">
            <div class="section-title">📢 Campaign & AdSet Performance Audit</div>
            
            ${Object.entries(campaignMap).length === 0 ? '<p style="font-size:12px; color:#94a3b8;">No campaign data logged for this period.</p>' : ''}

            ${Object.entries(campaignMap).map(([campName, campData]) => {
              const campConv = campData.total > 0 ? ((campData.won / campData.total) * 100).toFixed(1) : '0.0';
              return `
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;">
                    <span style="font-weight: 800; font-size: 13px; color: #6b21a8;">📢 ${campName}</span>
                    <span class="badge badge-purple">Leads: ${campData.total} | Won: ${campData.won} (${campConv}%)</span>
                  </div>

                  <div style="padding-left: 8px;">
                    <span style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">AdSet Breakdown:</span>
                    <table class="data-table" style="margin-top: 4px;">
                      ${Object.entries(campData.adSets).map(([adSetName, adData]) => `
                        <tr>
                          <td style="padding: 4px 8px; font-size: 11px;">📂 ${adSetName}</td>
                          <td style="padding: 4px 8px; font-size: 11px; text-align: right;"><b>${adData.total}</b> Leads | <b style="color:#059669;">${adData.won} Won</b></td>
                        </tr>
                      `).join('')}
                    </table>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- SALES EXEC LEADERBOARD -->
          <div class="section">
            <div class="section-title">🏆 Sales Executive Performance Leaderboard</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Sales Rep</th>
                  <th>Assigned</th>
                  <th>Closed Won</th>
                  <th>Conversion Rate</th>
                </tr>
              </thead>
              <tbody>
                ${agentPerformance.map(agent => `
                  <tr>
                    <td><b>${agent.name}</b></td>
                    <td>${agent.total}</td>
                    <td><b style="color: #059669;">${agent.won}</b></td>
                    <td><span class="badge badge-green">${agent.conversion}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- FOOTER -->
          <div class="footer">
            Flowbee CRM Automated Business Intelligence • Realtime Enterprise Audit<br>
            Connected Workspace Domain: <b>flowbee.io</b>
          </div>

        </div>

      </body>
      </html>
    `;

    // 6. DIRECT NODEMAILER DISPATCH
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
      from: '"Flowbee CRM Intelligence" <crm@flowbee.io>',
      to: recipientList.join(', '),
      subject: `📊 Executive Analytics Report: ${reportTitle}`,
      html: htmlEmail,
    });

    return res.status(200).json({
      success: true,
      message: `Comprehensive ${type} report dispatched to ${recipientList.length} executive emails!`
    });

  } catch (error: any) {
    console.error('Cron Execution Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}