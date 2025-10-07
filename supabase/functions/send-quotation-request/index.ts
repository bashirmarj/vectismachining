import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface QuotationRequest {
  fileName: string;
  filePath: string;
  userEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileName, filePath, userEmail }: QuotationRequest = await req.json();

    console.log("Processing quotation request:", { fileName, filePath, userEmail });

    // Download the file from Supabase Storage using service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const downloadUrl = `${supabaseUrl}/storage/v1/object/part-files/${filePath}`;
    
    const fileResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (!fileResponse.ok) {
      console.error("Error downloading file:", await fileResponse.text());
      throw new Error(`Failed to download file: ${fileResponse.statusText}`);
    }

    // Convert file to base64
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const base64File = btoa(String.fromCharCode(...buffer));

    // Send email with attachment
    const emailResponse = await resend.emails.send({
      from: "Vectis Manufacturing <onboarding@resend.dev>",
      to: ["bashirmarj@gmail.com"],
      subject: "New Part Quotation Request",
      html: `
        <h1>New Part Quotation Request</h1>
        <p><strong>Customer Email:</strong> ${userEmail}</p>
        <p><strong>File Name:</strong> ${fileName}</p>
        <p>Please review the attached STEP file and provide a quotation.</p>
        <br>
        <p>Best regards,<br>Vectis Manufacturing System</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: base64File,
        },
      ],
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
