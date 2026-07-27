import type { Lead, SalesRep } from '../types';

export const sendAssignmentEmail = async (lead: Lead, salesRep: SalesRep) => {
  // Email template body for assigned Sales Agent
  const subject = `🎯 New Lead Assigned to You: ${lead.customerName}`;
  
  const body = `
  Hello ${salesRep.name},

  A new lead has been assigned to you for follow up.

  Lead Details:
  - Name: ${lead.customerName}
  - Phone: ${lead.phone}
  - Email: ${lead.email || 'N/A'}
  - Platform: ${lead.platform}

  Quick Links:
  - Call: tel:${lead.phone}
  - WhatsApp: https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}

  Please log into the operations portal to update status after contacting the lead.
  `;

  // Option 1: Trigger via Email API (Resend / EmailJS / Supabase Webhook)
  console.log(`Sending assignment notification to: ${salesRep.email}`);
};