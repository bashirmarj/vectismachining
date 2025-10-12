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
              <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAYAAADL1t+KAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGYktHRAD/AP8A/6C9p5MAAAAJcEhZcwAACxMAAAsTAQCanBgAABmKSURBVHja7J15nBxVnf+/1dVzZHJPDiAQQCAQ7gjhviGgKAqoIMjlgSwi6q7ruuKP/a24+1t3VVBXUVwFFBFQDgFFBBJCQi4CCSEJJJCEJJPMZDIzPT3d1b8/qqt7prt6umemu6e7+/N+verVPd31uqpfdU19+1XVeygREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREZE+JzTQCSjUSik1oiXauKg52rgoGs0OmJwumBwDCkBloOtAREpbCGgF0g3RaKYhmsl+3hZtS9dHo5nmSPT5zKDIY4PH1s3JAdPMQN4AEXSRU6i7Yfu4FTUjL2iJRi9oj0QvaI+0J0KqPQLEgTiQHuh0EpHSZYAoUB+NRldGI9ElbZH2p2PtrYumNS5+AuDe3z5w0kAns7cU6FLWlg/edCHgAlOAScAkIAJUAwOBKDA40HZBRPqGVqAJaAZqgUZgK7AJ2BqNtD6wfMhlu/+0+upLBjqR+VKgS0lbPnjTsD+NvfTqSCQyNRKJTGmLRCZGovElQBWgBjrpItKvRYFGh9XAKqAeWBmNtNb/afSFD99z4vc+MdDpBwW6DBArP3Lj1aMiI8+IRqPTIpHIjGg0OjUajU5VSnk+LiLSy4wlG/SrooRePemyz9wBsPRXf3/+QCarTy4KEQn0ErcF+HBHe/tx7dHoxEgkMiUaTbz/nUg0Ov3Rqe//BsAlv/zzP1U78C8ikifoSh0OdLKi0eiUSHtk4sTDlj35+sSxc9957K8+vtRgmw100koj0L9+98uffuzXn/wS0ApcC1wGjFFKzQLKcV8LRURKVcTh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" alt="Vectis Manufacturing" />
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

    // Read logo file
    const logoPath = '/var/task/public/logo-email.png';
    let logoContent: Uint8Array;
    
    try {
      logoContent = await Deno.readFile(logoPath);
    } catch (error) {
      console.error('Could not read logo file:', error);
      // Use placeholder if logo not found
      logoContent = new Uint8Array(0);
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Vectis Manufacturing <belmarj@vectismanufacturing.com>',
      to: ['belmarj@vectismanufacturing.com'],
      subject: `New Contact Message from ${name}`,
      html: emailHtml,
      replyTo: email,
      attachments: logoContent.length > 0 ? [{
        filename: 'logo.png',
        content: logoContent,
        content_id: 'logo'
      }] : undefined
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
