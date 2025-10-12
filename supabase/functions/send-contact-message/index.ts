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
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .logo { text-align: center; margin-bottom: 20px; }
            .logo img { height: 60px; width: auto; }
            .header { margin-bottom: 30px; }
            .company-name { font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 20px; }
            .intro { font-size: 14px; line-height: 1.6; color: #000000; margin-bottom: 30px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .info-table td { padding: 12px; border: 1px solid #cccccc; font-size: 14px; }
            .info-table td:first-child { background-color: #f9f9f9; font-weight: normal; color: #000000; width: 180px; }
            .info-table td:last-child { color: #000000; }
            .message-row td { vertical-align: top; white-space: pre-line; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #cccccc; font-size: 12px; color: #666666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">
              <img src="https://inqabwlmvrvqsdrgskju.supabase.co/storage/v1/object/public/public/logo-email.png" alt="Vectis Manufacturing" />
            </div>
            <div class="header">
              <div class="company-name">VECTIS MANUFACTURING</div>
            </div>
            
            <div class="intro">
              Hello, You have received a new contact message. Here is a summary of the submission:
            </div>
            
            <table class="info-table">
              <tr>
                <td>Name</td>
                <td>${name}</td>
              </tr>
              <tr>
                <td>Company</td>
                <td>${name}</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>${email}</td>
              </tr>
              ${phone ? `<tr>
                <td>Phone</td>
                <td>${phone}</td>
              </tr>` : ''}
              <tr class="message-row">
                <td>Message</td>
                <td>${message}</td>
              </tr>
            </table>
            
            <div class="footer">
              Thank you for choosing Vectis Manufacturing.
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
