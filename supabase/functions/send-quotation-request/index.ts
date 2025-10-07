import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FileInfo {
  name: string;
  path: string;
  size: number;
}

interface QuotationRequest {
  name: string;
  company?: string;
  email: string;
  phone: string;
  shippingAddress: string;
  quantity: number;
  message?: string;
  files: FileInfo[];
  drawingFiles?: FileInfo[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      name, 
      company, 
      email, 
      phone, 
      shippingAddress,
      quantity,
      message,
      files,
      drawingFiles
    }: QuotationRequest = await req.json();

    console.log("Processing quotation request:", { 
      name, 
      company, 
      email, 
      phone, 
      quantity,
      filesCount: files.length,
      drawingFilesCount: drawingFiles?.length || 0
    });

    // Download the files from Supabase Storage using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const attachments: Array<{ filename: string; content: string }> = [];

    // Download all CAD files
    for (const file of files) {
      const downloadUrl = `${supabaseUrl}/storage/v1/object/part-files/${file.path}`;
      
      const fileResponse = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
      });

      if (!fileResponse.ok) {
        console.error(`Error downloading file ${file.name}:`, await fileResponse.text());
        throw new Error(`Failed to download file ${file.name}: ${fileResponse.statusText}`);
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const base64File = btoa(String.fromCharCode(...buffer));
      
      attachments.push({
        filename: file.name,
        content: base64File,
      });
    }

    // Download all drawing files if provided
    if (drawingFiles && drawingFiles.length > 0) {
      for (const drawingFile of drawingFiles) {
        const drawingDownloadUrl = `${supabaseUrl}/storage/v1/object/part-files/${drawingFile.path}`;
        
        const drawingResponse = await fetch(drawingDownloadUrl, {
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        });

        if (drawingResponse.ok) {
          const drawingArrayBuffer = await drawingResponse.arrayBuffer();
          const drawingBuffer = new Uint8Array(drawingArrayBuffer);
          const base64Drawing = btoa(String.fromCharCode(...drawingBuffer));
          
          attachments.push({
            filename: drawingFile.name,
            content: base64Drawing,
          });
        }
      }
    }

    // Build file lists for email
    const cadFilesList = files.map((f, i) => 
      `<li>${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`
    ).join('');

    const drawingFilesList = drawingFiles && drawingFiles.length > 0
      ? drawingFiles.map((f, i) => 
          `<li>${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</li>`
        ).join('')
      : null;

    // Send email with attachments
    const emailResponse = await resend.emails.send({
      from: "Vectis Manufacturing <onboarding@resend.dev>",
      to: ["bashirmarj@gmail.com"],
      subject: "New Part Quotation Request",
      html: `
        <h1>New Part Quotation Request</h1>
        <h2>Customer Information</h2>
        <p><strong>Name:</strong> ${name}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Shipping Address:</strong></p>
        <p style="white-space: pre-line;">${shippingAddress}</p>
        
        <h2>Order Details</h2>
        <p><strong>Quantity:</strong> ${quantity}</p>
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

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
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
