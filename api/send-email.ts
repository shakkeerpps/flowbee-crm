// api/send-email.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventType, leadName, leadPhone, assignedTo, agentEmail, status } = req.body;

    // SMTP Credentials environment variables-il ninnum mathram load cheyya
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'server242.web-hosting.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER, // Set in Vercel Env
        pass: process.env.SMTP_PASS, // Set in Vercel Env
      },
    });

    const recipient = agentEmail || 'crm@connectgbc.com';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #2563eb;">Flowbee CRM Notification</h2>
        <p><b>Event:</b> ${eventType}</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px;">
          <p><b>Customer Name:</b> ${leadName || 'N/A'}</p>
          <p><b>Phone:</b> ${leadPhone || 'N/A'}</p>
          <p><b>Assigned To:</b> ${assignedTo || 'Sales Agent'}</p>
          ${status ? `<p><b>New Status:</b> ${status}</p>` : ''}
        </div>
      </div>
    `;

    // FIXED: From Address exact SMTP Authenticated user email (flowbee.io) tanne use cheyya
    await transporter.sendMail({
      from: '"Flowbee CRM" <crm@flowbee.io>', 
      to: recipient,
      subject: `🎯 Flowbee CRM: ${eventType} - ${leadName || 'Lead Alert'}`,
      html: htmlContent,
    });

    return res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
}