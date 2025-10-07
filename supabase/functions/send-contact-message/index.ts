import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

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
    // Extract client IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    console.log('Contact form submission from IP:', clientIp);
    
    // Hash the IP for privacy
    const ipHash = await hashIP(clientIp);

    // Check rate limit (5 minutes for contact form)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentSubmissions, error: checkError } = await supabase
      .from('contact_submissions')
      .select('submitted_at')
      .eq('ip_hash', ipHash)
      .gte('submitted_at', fiveMinutesAgo)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error('Error checking rate limit:', checkError);
      throw new Error('Failed to check rate limit');
    }

    if (recentSubmissions && recentSubmissions.length > 0) {
      const lastSubmission = new Date(recentSubmissions[0].submitted_at);
      const now = new Date();
      const timeDiff = 5 * 60 * 1000 - (now.getTime() - lastSubmission.getTime());
      const remainingSeconds = Math.ceil(timeDiff / 1000);
      const remainingMinutes = Math.floor(remainingSeconds / 60);

      console.log('Rate limit exceeded. Remaining time:', remainingSeconds, 'seconds');

      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: 'Please wait before submitting another message',
          remainingSeconds,
          remainingMinutes,
          nextAvailableTime: new Date(lastSubmission.getTime() + 5 * 60 * 1000).toISOString()
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Parse request body
    const { name, email, phone, message }: ContactRequest = await req.json();

    console.log('Processing contact form from:', email);

    // Send email using Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f4f4f4; padding: 20px; border-radius: 5px; }
            .content { padding: 20px 0; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-top: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Contact Form Submission</h2>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${name}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${email}</div>
              </div>
              ${phone ? `
              <div class="field">
                <div class="label">Phone:</div>
                <div class="value">${phone}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="label">Message:</div>
                <div class="value">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const { error: sendError } = await resend.emails.send({
      from: 'Contact Form <onboarding@resend.dev>',
      to: ['your-email@example.com'], // Replace with your business email
      subject: `New Contact Form Submission from ${name}`,
      html: emailHtml,
      reply_to: email,
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
