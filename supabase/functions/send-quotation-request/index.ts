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

interface FileInfo {
  name: string;
  content: string;
  size: number;
  quantity: number;
}

interface QuotationRequest {
  name: string;
  company?: string;
  email: string;
  phone: string;
  shippingAddress: string;
  message?: string;
  files: FileInfo[];
  drawingFiles?: FileInfo[];
}

interface StorageFileInfo {
  name: string;
  path: string;
  size: number;
  quantity: number;
}

// Helper function to hash IP address for privacy
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract IP address from request for logging (rate limiting disabled)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const ipHash = await hashIP(clientIP);

    const { 
      name, 
      company, 
      email, 
      phone, 
      shippingAddress,
      message,
      files,
      drawingFiles
    }: QuotationRequest = await req.json();

    console.log("Processing quotation request:", { 
      name, 
      company, 
      email, 
      phone, 
      filesCount: files.length,
      drawingFilesCount: drawingFiles?.length || 0
    });

    // Check total attachment size (Resend limit is 40MB)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0) + 
                     (drawingFiles?.reduce((sum, f) => sum + f.size, 0) || 0);
    const totalSizeMB = totalSize / 1024 / 1024;
    
    console.log(`Total attachment size: ${totalSizeMB.toFixed(2)} MB`);
    
    if (totalSizeMB > 35) {
      console.error('Total attachment size exceeds limit:', totalSizeMB);
      return new Response(
        JSON.stringify({
          error: 'file_size_exceeded',
          message: 'Total file size exceeds 35MB limit',
          totalSizeMB
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Files are already base64 encoded from the client
    const attachments: Array<{ filename: string; content: string }> = [];

    // Add CAD files to attachments
    for (const file of files) {
      attachments.push({
        filename: file.name,
        content: file.content,
      });
    }

    // Add drawing files if provided
    if (drawingFiles && drawingFiles.length > 0) {
      for (const drawingFile of drawingFiles) {
        attachments.push({
          filename: drawingFile.name,
          content: drawingFile.content,
        });
      }
    }

    // Build file lists for email
    const cadFilesList = files.map((f, i) => 
      `<li>${f.name} - Quantity: ${f.quantity} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`
    ).join('');

    const totalQuantity = files.reduce((sum, f) => sum + f.quantity, 0);

    const drawingFilesList = drawingFiles && drawingFiles.length > 0
      ? drawingFiles.map((f, i) => 
          `<li>${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`
        ).join('')
      : null;

    // Record the submission with full customer details FIRST
    const { data: submission, error: insertError } = await supabase
      .from('quotation_submissions')
      .insert({
        email: email,
        customer_name: name,
        customer_company: company || null,
        customer_phone: phone,
        shipping_address: shippingAddress,
        customer_message: message || null,
        ip_hash: ipHash,
      })
      .select()
      .single();

    if (insertError || !submission) {
      console.error('Error recording submission:', insertError);
      throw new Error('Failed to create quotation record');
    }

    // Store file metadata in quote_line_items
    const lineItems = [
      ...files.map(file => ({
        quotation_id: submission.id,
        file_name: file.name,
        file_path: `${submission.id}/cad/${file.name}`,
        quantity: file.quantity,
      })),
      ...(drawingFiles || []).map(file => ({
        quotation_id: submission.id,
        file_name: file.name,
        file_path: `${submission.id}/drawings/${file.name}`,
        quantity: 1,
      }))
    ];

    if (lineItems.length > 0) {
      const { error: lineItemsError } = await supabase
        .from('quote_line_items')
        .insert(lineItems);

      if (lineItemsError) {
        console.error('Error storing line items:', lineItemsError);
        // Don't throw - this is not critical for the submission
      }
    }

    // Send emails in the background to not block the response
    const sendEmails = async () => {
      try {
        const [emailResponse, customerEmailResponse] = await Promise.all([
          // Admin email with attachments
          resend.emails.send({
            from: "Vectis Manufacturing <belmarj@vectismanufacturing.com>",
            to: ["belmarj@vectismanufacturing.com"],
            subject: `New Part Quotation Request - ${submission.quote_number}`,
            html: `
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
                  .quote-badge { background-color: #0f3460; color: #ffffff; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-top: 15px; }
                  .content { padding: 40px 30px; }
                  .section { margin-bottom: 30px; }
                  .section-title { color: #1a1a2e; font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #0f3460; }
                  .info-row { margin: 12px 0; line-height: 1.6; color: #333333; }
                  .label { font-weight: 600; color: #1a1a2e; display: inline-block; min-width: 140px; }
                  .value { color: #555555; }
                  .file-list { list-style: none; padding: 0; margin: 15px 0; }
                  .file-item { background-color: #f8f9fa; padding: 12px 15px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #0f3460; }
                  .file-name { font-weight: 600; color: #1a1a2e; }
                  .file-details { color: #666666; font-size: 13px; margin-top: 4px; }
                  .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; }
                  .footer-text { color: #666666; font-size: 14px; margin: 5px 0; }
                  .address-box { background-color: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-line; color: #555555; line-height: 1.6; margin-top: 10px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🔧 New Quotation Request</h1>
                    <div class="quote-badge">Quote #${submission.quote_number}</div>
                  </div>
                  
                  <div class="content">
                    <div class="section">
                      <div class="section-title">Customer Information</div>
                      <div class="info-row"><span class="label">Name:</span> <span class="value">${name}</span></div>
                      ${company ? `<div class="info-row"><span class="label">Company:</span> <span class="value">${company}</span></div>` : ''}
                      <div class="info-row"><span class="label">Email:</span> <span class="value">${email}</span></div>
                      <div class="info-row"><span class="label">Phone:</span> <span class="value">${phone}</span></div>
                      <div class="info-row"><span class="label">Shipping Address:</span></div>
                      <div class="address-box">${shippingAddress}</div>
                    </div>
                    
                    <div class="section">
                      <div class="section-title">Order Details</div>
                      <div class="info-row"><span class="label">Total Parts Quantity:</span> <span class="value">${totalQuantity}</span></div>
                      ${message ? `<div class="info-row"><span class="label">Additional Instructions:</span></div><div class="address-box">${message}</div>` : ''}
                    </div>
                    
                    <div class="section">
                      <div class="section-title">Attached Files</div>
                      <div style="margin-bottom: 15px;"><strong>CAD Files (${files.length}):</strong></div>
                      <ul class="file-list">
                        ${files.map(f => `<li class="file-item"><div class="file-name">${f.name}</div><div class="file-details">Quantity: ${f.quantity} • Size: ${(f.size / 1024 / 1024).toFixed(2)} MB</div></li>`).join('')}
                      </ul>
                      ${drawingFilesList ? `<div style="margin-top: 20px; margin-bottom: 15px;"><strong>Drawing Files (${drawingFiles?.length || 0}):</strong></div><ul class="file-list">${(drawingFiles || []).map(f => `<li class="file-item"><div class="file-name">${f.name}</div><div class="file-details">Size: ${(f.size / 1024 / 1024).toFixed(2)} MB</div></li>`).join('')}</ul>` : ''}
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div class="footer-text"><strong>Vectis Manufacturing</strong></div>
                    <div class="footer-text">Your Partner in Precision Manufacturing</div>
                  </div>
                </div>
              </body>
              </html>
            `,
            attachments,
          }),
          // Customer confirmation email (without attachments)
          resend.emails.send({
            from: "Vectis Manufacturing <belmarj@vectismanufacturing.com>",
            to: [email],
            subject: `Quotation Request Received - ${submission.quote_number}`,
            html: `
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
                  .header p { color: #e0e0e0; margin: 15px 0 0 0; font-size: 16px; }
                  .quote-badge { background-color: #4caf50; color: #ffffff; display: inline-block; padding: 10px 24px; border-radius: 25px; font-size: 16px; font-weight: 600; margin-top: 20px; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3); }
                  .content { padding: 40px 30px; }
                  .welcome-text { color: #333333; font-size: 16px; line-height: 1.6; margin-bottom: 25px; }
                  .section { margin-bottom: 30px; }
                  .section-title { color: #1a1a2e; font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #0f3460; }
                  .info-row { margin: 12px 0; line-height: 1.6; color: #333333; }
                  .label { font-weight: 600; color: #1a1a2e; display: inline-block; min-width: 140px; }
                  .value { color: #555555; }
                  .file-list { list-style: none; padding: 0; margin: 15px 0; }
                  .file-item { background-color: #f8f9fa; padding: 12px 15px; margin: 8px 0; border-radius: 6px; border-left: 3px solid #4caf50; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
                  .file-name { font-weight: 600; color: #1a1a2e; flex: 1; text-align: left; }
                  .file-quantity { background-color: #4caf50; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: auto; flex-shrink: 0; }
                  .highlight-box { background: linear-gradient(135deg, #f8f9fa 0%, #e8f5e9 100%); padding: 20px; border-radius: 8px; border: 1px solid #4caf50; margin: 20px 0; }
                  .footer { background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; }
                  .footer-text { color: #666666; font-size: 14px; margin: 5px 0; }
                  .footer-brand { color: #1a1a2e; font-weight: 600; font-size: 16px; margin-bottom: 5px; }
                  .address-box { background-color: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-line; color: #555555; line-height: 1.6; margin-top: 10px; }
                  .cta-text { background-color: #fff3cd; padding: 15px; border-radius: 6px; border-left: 4px solid #ffc107; color: #856404; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>✅ Request Received!</h1>
                    <p>Thank you for choosing Vectis Manufacturing</p>
                    <div class="quote-badge">Quote #${submission.quote_number}</div>
                  </div>
                  
                  <div class="content">
                    <div class="welcome-text">
                      Dear <strong>${name}</strong>,<br><br>
                      We have successfully received your quotation request and our engineering team is already reviewing your requirements. We will provide you with a detailed quote within 24-48 hours.
                    </div>
                    
                    <div class="highlight-box">
                      <div style="font-size: 16px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px;">📋 Your Reference Number</div>
                      <div style="font-size: 24px; font-weight: 700; color: #4caf50;">${submission.quote_number}</div>
                      <div style="font-size: 13px; color: #666666; margin-top: 8px;">Please save this number for your records and reference it in all communications.</div>
                    </div>
                    
                    <div class="section">
                      <div class="section-title">Order Summary</div>
                      ${company ? `<div class="info-row"><span class="label">Company:</span> <span class="value">${company}</span></div>` : ''}
                      <div class="info-row"><span class="label">Phone:</span> <span class="value">${phone}</span></div>
                      <div class="info-row"><span class="label">Total Parts Quantity:</span> <span class="value">${totalQuantity}</span></div>
                      <div class="info-row"><span class="label">Shipping Address:</span></div>
                      <div class="address-box">${shippingAddress}</div>
                      ${message ? `<div class="info-row" style="margin-top: 15px;"><span class="label">Your Message:</span></div><div class="address-box">${message}</div>` : ''}
                    </div>
                    
                    <div class="section">
                      <div class="section-title">Submitted Files</div>
                      <div style="margin-bottom: 10px; color: #666666;"><strong>CAD Files (${files.length}):</strong></div>
                      <ul class="file-list">
                        ${files.map(f => `<li class="file-item"><div class="file-name">${f.name}</div><div class="file-quantity">Qty: ${f.quantity}</div></li>`).join('')}
                      </ul>
                      ${drawingFiles && drawingFiles.length > 0 ? `<div style="margin-top: 20px; margin-bottom: 10px; color: #666666;"><strong>Drawing Files (${drawingFiles.length}):</strong></div><ul class="file-list">${drawingFiles.map(f => `<li class="file-item"><span class="file-name">${f.name}</span></li>`).join('')}</ul>` : ''}
                    </div>
                    
                    <div class="cta-text">
                      <strong>⏱️ What happens next?</strong><br>
                      Our team will review your files and provide a detailed quotation within 24-48 hours. If we need any clarification, we will reach out to you directly.
                    </div>
                    
                    <div style="color: #666666; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                      If you have any questions or need to make changes to your request, please don't hesitate to contact us and reference your quote number.
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div class="footer-brand">Vectis Manufacturing</div>
                    <div class="footer-text">Your Partner in Precision Manufacturing</div>
                    <div class="footer-text" style="margin-top: 15px; font-size: 12px;">This is an automated confirmation email.</div>
                  </div>
                </div>
              </body>
              </html>
            `,
          })
        ]);

        console.log("Admin email sent:", emailResponse);
        console.log("Customer email sent:", customerEmailResponse);
      } catch (emailError) {
        console.error("Error sending emails in background:", emailError);
      }
    };

    // Start background email task (non-blocking)
    (globalThis as any).EdgeRuntime?.waitUntil(sendEmails());

    // Return immediate response without waiting for emails

    return new Response(JSON.stringify({ 
      success: true, 
      quoteNumber: submission.quote_number
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-quotation-request function:", error);
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
