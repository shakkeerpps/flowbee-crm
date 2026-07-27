import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer";

serve(async (req) => {
  try {
    const { type, data, smtpConfig } = await req.json();

    // Frontend-ൽ നിന്ന് വരുന്ന SMTP వివరങ്ങൾ അല്ലെങ്കിൽ Default ഡാറ്റ ഉപയോഗിക്കുന്നു
    const transporter = nodemailer.createTransport({
      host: smtpConfig?.host || "server242.web-hosting.com",
      port: smtpConfig?.port || 465,
      secure: true,
      auth: {
        user: smtpConfig?.user || "crm@connectgbc.com",
        pass: smtpConfig?.pass || "Newpassword@123",
      },
    });

    const recipient = data.agentEmail || "crm@connectgbc.com";
    const leadName = data.leadName || "N/A";
    const leadPhone = data.leadPhone || data.phone || "N/A";
    const assignedTo = data.assignedTo || data.repName || "Sales Agent";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
        <h2 style="color: #2563eb; margin-bottom: 10px;">Flowbee CRM Alert</h2>
        <p style="font-size: 14px; color: #475569;"><b>Event:</b> ${type}</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 5px 0;"><b>Customer Name:</b> ${leadName}</p>
          <p style="margin: 5px 0;"><b>Phone Number:</b> ${leadPhone}</p>
          <p style="margin: 5px 0;"><b>Sales Representative:</b> ${assignedTo}</p>
          ${data.status ? `<p style="margin: 5px 0;"><b>Updated Status:</b> <b style="color: #16a34a;">${data.status}</b></p>` : ''}
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Flowbee CRM" <${smtpConfig?.user || 'crm@connectgbc.com'}>`,
      to: recipient,
      subject: `🎯 CRM Notification: ${type} - ${leadName}`,
      html: htmlContent,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});