import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to hash IP addresses for privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract client IP address (rate limiting disabled for now)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    console.log('Contact form submission from IP:', clientIp);
    
    // Hash the IP for privacy
    const ipHash = await hashIP(clientIp);

    // Parse request body
    const { name, email, phone, message }: ContactRequest = await req.json();

    console.log('Processing contact form from:', email);

    // Send email using Resend with improved design
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 30px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; }
            .content { padding: 40px 30px; }
            .section { margin-bottom: 30px; }
            .section-title { color: #1a1a2e; font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #0f3460; }
            .info-row { margin: 12px 0; line-height: 1.6; color: #333333; }
            .label { font-weight: 600; color: #1a1a2e; display: inline-block; min-width: 100px; }
            .value { color: #555555; }
            .message-box { background-color: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-line; color: #555555; line-height: 1.6; margin-top: 10px; }
            .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; }
            .footer-text { color: #666666; font-size: 14px; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 New Contact Message</h1>
            </div>
            
            <div class="content">
              <div class="section">
                <div class="section-title">Contact Information</div>
                <div class="info-row"><span class="label">Name:</span> <span class="value">${name}</span></div>
                <div class="info-row"><span class="label">Email:</span> <span class="value">${email}</span></div>
                ${phone ? `<div class="info-row"><span class="label">Phone:</span> <span class="value">${phone}</span></div>` : ''}
              </div>
              
              <div class="section">
                <div class="section-title">Message</div>
                <div class="message-box">${message}</div>
              </div>
            </div>
            
            <div class="footer">
              <div class="footer-text"><strong>Vectis Manufacturing</strong></div>
              <div class="footer-text">Your Partner in Precision Manufacturing</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: sendError } = await resend.emails.send({
      from: 'Vectis Manufacturing <belmarj@vectismanufacturing.com>',
      to: ['belmarj@vectismanufacturing.com'],
      subject: `New Contact Message from ${name}`,
      html: emailHtml,
      replyTo: email,
    });

    if (sendError) {
      console.error('Error sending email:', sendError);
      throw new Error('Failed to send email');
    }

    console.log('Email sent successfully');

    // Record the submission for rate limiting
    const { error: insertError } = await supabase
      .from('contact_submissions')
      .insert({
        ip_hash: ipHash,
        email: email,
        submitted_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error recording submission:', insertError);
      // Don't fail the request if we can't record the submission
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Message sent successfully' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in send-contact-message function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
