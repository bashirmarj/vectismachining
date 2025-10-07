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
    // Extract IP address from request
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    const ipHash = await hashIP(clientIP);
    
    console.log("Checking rate limit for IP:", { ipHash });

    // Check for recent submissions from this IP (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentSubmissions, error: checkError } = await supabase
      .from('quotation_submissions')
      .select('submitted_at')
      .eq('ip_hash', ipHash)
      .gte('submitted_at', fiveMinutesAgo)
      .order('submitted_at', { ascending: false })
      .limit(1);

    if (checkError) {
      console.error("Error checking rate limit:", checkError);
    }

    if (recentSubmissions && recentSubmissions.length > 0) {
      const lastSubmission = new Date(recentSubmissions[0].submitted_at);
      const nextAvailable = new Date(lastSubmission.getTime() + 5 * 60 * 1000);
      const remainingMs = nextAvailable.getTime() - Date.now();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const remainingSecondsDisplay = remainingSeconds % 60;

      console.log("Rate limit exceeded:", { 
        lastSubmission, 
        nextAvailable, 
        remainingSeconds 
      });

      return new Response(
        JSON.stringify({
          error: 'rate_limit_exceeded',
          message: 'Please wait before submitting another request',
          remainingSeconds,
          remainingMinutes,
          remainingSecondsDisplay,
          nextAvailableTime: nextAvailable.toISOString()
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

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

    // Send email to admin with attachments
    const emailResponse = await resend.emails.send({
      from: "Vectis Manufacturing <onboarding@resend.dev>",
      to: ["bashirmarj@gmail.com"],
      subject: `New Part Quotation Request - ${submission.quote_number}`,
      html: `
        <h1>New Part Quotation Request</h1>
        <h2>Quote Number: ${submission.quote_number}</h2>
        <h2>Customer Information</h2>
        <p><strong>Name:</strong> ${name}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Shipping Address:</strong></p>
        <p style="white-space: pre-line;">${shippingAddress}</p>
        
        <h2>Order Details</h2>
        <p><strong>Total Parts Quantity:</strong> ${totalQuantity}</p>
        ${message ? `<p><strong>Additional Instructions:</strong></p><p style="white-space: pre-line;">${message}</p>` : ''}
        
        <h2>Files Attached</h2>
        <p><strong>CAD Files (${files.length}):</strong></p>
        <ul>${cadFilesList}</ul>
        ${drawingFilesList ? `<p><strong>Drawing Files (${drawingFiles?.length || 0}):</strong></p><ul>${drawingFilesList}</ul>` : ''}
        
        <p>Please review the attached files and provide a quotation.</p>
        <br>
        <p>Best regards,<br>Vectis Manufacturing System</p>
      `,
      attachments,
    });

    console.log("Admin email sent successfully:", emailResponse);

    // Send confirmation email to customer (without attachments)
    const customerEmailResponse = await resend.emails.send({
      from: "Vectis Manufacturing <onboarding@resend.dev>",
      to: [email],
      subject: `Quotation Request Received - ${submission.quote_number}`,
      html: `
        <h1>Thank you for your quotation request!</h1>
        <p>Dear ${name},</p>
        <p>We have successfully received your quotation request. Our team will review your requirements and get back to you as soon as possible.</p>
        
        <h2>Your Quote Number: ${submission.quote_number}</h2>
        <p>Please save this number for your records. You can reference it when contacting us about your quote.</p>
        
        <h2>Order Summary</h2>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Shipping Address:</strong></p>
        <p style="white-space: pre-line;">${shippingAddress}</p>
        <p><strong>Total Parts Quantity:</strong> ${totalQuantity}</p>
        ${message ? `<p><strong>Your Message:</strong></p><p style="white-space: pre-line;">${message}</p>` : ''}
        
        <h2>Submitted Files</h2>
        <p><strong>CAD Files (${files.length}):</strong></p>
        <ul>${files.map(f => `<li>${f.name} - Quantity: ${f.quantity}</li>`).join('')}</ul>
        ${drawingFiles && drawingFiles.length > 0 ? `<p><strong>Drawing Files (${drawingFiles.length}):</strong></p><ul>${drawingFiles.map(f => `<li>${f.name}</li>`).join('')}</ul>` : ''}
        
        <p>We will contact you within 24-48 hours with a detailed quotation.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
        <br>
        <p>Best regards,<br><strong>Vectis Manufacturing</strong><br>Your Partner in Precision Manufacturing</p>
      `,
    });

    console.log("Customer confirmation email sent successfully:", customerEmailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      quoteNumber: submission.quote_number,
      emailResponse 
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
