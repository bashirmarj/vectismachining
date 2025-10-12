import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuoteEmailRequest {
  quotationId: string;
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quotationId, customerEmail, customerName, quoteNumber }: QuoteEmailRequest = await req.json();

    console.log('Fetching quote data for:', quoteNumber);

    // Fetch quote details
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('quotation_id', quotationId)
      .single();

    if (quoteError || !quote) {
      console.error('Error fetching quote:', quoteError);
      throw new Error('Quote not found');
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('quote_line_items')
      .select('*')
      .eq('quotation_id', quotationId)
      .order('created_at', { ascending: true });

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      throw lineItemsError;
    }

    // Build email HTML
    const lineItemsHtml = (lineItems || []).map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.file_name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(Number(item.unit_price || 0) * item.quantity).toFixed(2)}</td>
      </tr>
      ${item.notes ? `
      <tr>
        <td colspan="4" style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;">
          <em>${item.notes}</em>
        </td>
      </tr>
      ` : ''}
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #ffffff;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <img src="cid:logo" alt="Vectis Manufacturing" style="height: 60px; width: auto;" />
            </div>
            <div style="margin-bottom: 30px;">
              <div style="font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 20px;">VECTIS MANUFACTURING</div>
            </div>

            <div style="font-size: 14px; line-height: 1.6; color: #000000; margin-bottom: 30px;">
              Hello ${customerName}, Thank you for your quotation request. We're pleased to provide you with the following quote for your custom manufacturing project.
            </div>

            <!-- Quote Summary -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px; width: 180px;">Quote Number</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; color: #000000;">${quoteNumber}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px;">Date</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; color: #000000;">${new Date().toLocaleDateString()}</td>
              </tr>
              ${quote.estimated_lead_time_days ? `
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px;">Estimated Lead Time</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; color: #000000;">${quote.estimated_lead_time_days} business days</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px;">Valid Until</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; color: #000000;">${new Date(quote.valid_until).toLocaleDateString()}</td>
              </tr>
            </table>

            <!-- Line Items Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr>
                  <th style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; text-align: left; font-size: 14px; font-weight: normal;">Part</th>
                  <th style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; text-align: center; font-size: 14px; font-weight: normal;">Qty</th>
                  <th style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; text-align: right; font-size: 14px; font-weight: normal;">Unit Price</th>
                  <th style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; text-align: right; font-size: 14px; font-weight: normal;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>

            <!-- Totals -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px; width: 180px;">Subtotal</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; text-align: right; color: #000000;">$${Number(quote.subtotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px;">Shipping</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; text-align: right; color: #000000;">$${Number(quote.shipping_cost).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px;">Tax (${Number(quote.tax_rate).toFixed(2)}%)</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; text-align: right; color: #000000;">$${Number(quote.tax_amount).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px; font-weight: bold;">Total</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; text-align: right; font-weight: bold; color: #000000;">$${Number(quote.total_amount).toFixed(2)} ${quote.currency}</td>
              </tr>
            </table>

            ${quote.notes ? `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <tr>
                <td style="padding: 12px; border: 1px solid #cccccc; background-color: #f9f9f9; font-size: 14px; vertical-align: top; width: 180px;">Additional Notes</td>
                <td style="padding: 12px; border: 1px solid #cccccc; font-size: 14px; color: #000000; white-space: pre-line;">${quote.notes}</td>
              </tr>
            </table>
            ` : ''}

            <div style="font-size: 14px; line-height: 1.6; color: #000000; margin-bottom: 30px;">
              If you have any questions or would like to proceed with this order, please reply to this email or contact us directly.
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #cccccc; font-size: 12px; color: #666666;">
              Thank you for choosing Vectis Manufacturing.
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Sending email to:', customerEmail);

    // Read logo file
    const logoPath = '/var/task/public/logo-email.png';
    let logoContent: Uint8Array;
    
    try {
      logoContent = await Deno.readFile(logoPath);
    } catch (error) {
      console.error('Could not read logo file:', error);
      logoContent = new Uint8Array(0);
    }

    const emailResponse = await resend.emails.send({
      from: "Manufacturing Quote <belmarj@vectismanufacturing.com>",
      to: [customerEmail],
      subject: `Your Quote ${quoteNumber} is Ready`,
      html: emailHtml,
      attachments: logoContent.length > 0 ? [{
        filename: 'logo.png',
        content: logoContent,
        content_id: 'logo'
      }] : undefined
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending quote email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
