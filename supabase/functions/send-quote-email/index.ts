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
          <title>Your Quotation - ${quoteNumber}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <!-- Header -->
            <div style="background-color: #1f2937; color: #ffffff; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">Your Quotation</h1>
              <p style="margin: 8px 0 0 0; font-size: 18px; opacity: 0.9;">${quoteNumber}</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="margin: 0 0 24px 0; font-size: 16px;">Dear ${customerName},</p>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.5;">
                Thank you for your quotation request. We're pleased to provide you with the following quote for your custom manufacturing project.
              </p>

              <!-- Line Items Table -->
              <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Part</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; border-bottom: 2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>

              <!-- Totals -->
              <div style="margin: 24px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Subtotal:</span>
                  <span style="font-weight: 600;">$${Number(quote.subtotal).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Shipping:</span>
                  <span style="font-weight: 600;">$${Number(quote.shipping_cost).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Tax (${Number(quote.tax_rate).toFixed(2)}%):</span>
                  <span style="font-weight: 600;">$${Number(quote.tax_amount).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 2px solid #e5e7eb; margin-top: 12px;">
                  <span style="font-size: 18px; font-weight: 700;">Total:</span>
                  <span style="font-size: 18px; font-weight: 700; color: #1f2937;">$${Number(quote.total_amount).toFixed(2)} ${quote.currency}</span>
                </div>
              </div>

              ${quote.estimated_lead_time_days ? `
              <div style="margin: 24px 0; padding: 16px; background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600;">Estimated Lead Time: ${quote.estimated_lead_time_days} business days</p>
              </div>
              ` : ''}

              ${quote.notes ? `
              <div style="margin: 24px 0;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Additional Notes:</h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #4b5563; white-space: pre-line;">${quote.notes}</p>
              </div>
              ` : ''}

              <div style="margin: 32px 0 24px 0; padding: 16px; background-color: #fef3c7; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600;">This quote is valid until: ${new Date(quote.valid_until).toLocaleDateString()}</p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 16px; line-height: 1.5;">
                If you have any questions or would like to proceed with this order, please reply to this email or contact us directly.
              </p>

              <p style="margin: 24px 0 0 0; font-size: 16px;">
                Best regards,<br>
                <strong>Your Manufacturing Team</strong>
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 24px; text-align: center; font-size: 14px; color: #6b7280;">
              <p style="margin: 0;">Thank you for choosing our manufacturing services.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    console.log('Sending email to:', customerEmail);

    const emailResponse = await resend.emails.send({
      from: "Manufacturing Quote <onboarding@resend.dev>",
      to: [customerEmail],
      subject: `Your Quote ${quoteNumber} is Ready`,
      html: emailHtml,
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
