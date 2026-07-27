// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      eventType, // 'ASSIGNED', 'STATUS_CHANGE', 'FOLLOW_UP'
      leadName, 
      leadPhone, 
      assignedTo, 
      agentEmail, 
      status, 
      followUpDate,
      followUpNote,
      appUrl = 'https://flowbee-crm.vercel.app' // Ningalude app URL
    } = req.body;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'server242.web-hosting.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'crm@flowbee.io',
        pass: process.env.SMTP_PASS,
      },
    });

    const recipient = agentEmail || 'crm@flowbee.io';
    const cleanPhone = leadPhone ? leadPhone.replace(/[^0-9+]/g, '') : '';
    const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : '#';
    const telUrl = cleanPhone ? `tel:${cleanPhone}` : '#';

    // 🎨 Dynamic Styling & Content based on eventType & status
    let headerBg = '#2563eb'; // Default Blue
    let statusBadgeColor = '#64748b';
    let emailSubject = `🎯 Flowbee CRM: ${eventType} - ${leadName || 'Lead Alert'}`;

    // Status Colors (Won -> Green, Lost -> Red)
    if (status) {
      const lowerStatus = status.toLowerCase();
      if (lowerStatus.includes('won') || lowerStatus.includes('deal')) {
        headerBg = '#16a34a'; // Green
        statusBadgeColor = '#15803d';
      } else if (lowerStatus.includes('loss') || lowerStatus.includes('lost')) {
        headerBg = '#dc2626'; // Red
        statusBadgeColor = '#b91c1c';
      }
    }

    if (eventType === 'FOLLOW_UP') {
      headerBg = '#d97706'; // Amber for reminders
      emailSubject = `⏰ Follow-up Reminder: ${leadName} (${followUpDate || 'Today'})`;
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          
          <!-- Header -->
          <div style="background-color: ${headerBg}; padding: 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Flowbee CRM</h1>
            <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">${eventType.replace('_', ' ')} NOTIFICATION</p>
          </div>

          <!-- Body -->
          <div style="padding: 24px;">
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">👤 ${leadName || 'N/A'}</h3>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>📞 Phone:</b> ${leadPhone || 'N/A'}</p>
              <p style="margin: 6px 0; color: #475569; font-size: 14px;"><b>👤 Assigned Rep:</b> ${assignedTo || 'Sales Exec'}</p>
              
              ${status ? `
                <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                  <span style="font-size: 13px; color: #64748b; display: block; margin-bottom: 4px;">Lead Status:</span>
                  <span style="display: inline-block; background-color: ${statusBadgeColor}; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 13px;">
                    ${status.toUpperCase()}
                  </span>
                </div>
              ` : ''}

              ${eventType === 'FOLLOW_UP' ? `
                <div style="margin-top: 12px; padding: 12px; background-color: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px;">
                  <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: bold;">⏰ Scheduled Follow-up:</p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; color: #78350f;">${followUpDate || 'Today'} - ${followUpNote || 'No notes added'}</p>
                </div>
              ` : ''}
            </div>

            <!-- Action Buttons for Lead Assignment / Quick Actions -->
            <div style="text-align: center; margin-top: 24px;">
              <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Quick Actions:</p>
              
              <a href="${telUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; margin: 4px;">
                📞 Call Customer
              </a>

              <a href="${whatsappUrl}" target="_blank" style="display: inline-block; background-color: #25d366; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; margin: 4px;">
                💬 WhatsApp
              </a>

              <a href="${appUrl}/#/leads" target="_blank" style="display: inline-block; background-color: #475569; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 13px; font-weight: 600; margin: 4px;">
                🔄 Reassign / View
              </a>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
            Flowbee CRM Automated Notification • All rights reserved.
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: '"Flowbee CRM" <crm@flowbee.io>',
      to: recipient,
      subject: emailSubject,
      html: htmlContent,
    });

    return res.status(200).json({ success: true, message: 'Formatted email sent successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}