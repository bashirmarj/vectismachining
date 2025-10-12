import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base64 encoded logo (the VM logo from user upload)
const LOGO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAYAAADL1t+KAAAACXBIWXMAAA7EAAAOxAGVKw4bAAADsmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+CiA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8P3hwYWNrZXQgZW5kPSJyIj8+Gkqr6gAAAYRpQ0NQc1JHQiBJRUM2MTk2Ni0yLjEAAHicjZDBTsMwDIYfqTcwjrK3M0TixKBDUm9IRzc2MDRK2rCBoFLVdYNuY1OIkzix8Q48AY/EE/C4XBCHJk3XqiDxyb\\/s77djO8BbAFzk1zWsVQBUWdUAeG8AACAA4Hq1paUwAQCAAMDT9Xw+lQEARMBhznmXVwEAJACwWABQN1cBQHsCAIDmAQAAzQMAAPUAAAD1AAAA1QAAAM0AAADNAAAAzQAAAPQAAAD0AAAA9AAAALQAAAC0AAAAtAAAALQAAAC0AAAAswAAALMAAABzAAAAcwAAAHEAAABxAAAAYQAAAGEAAABhAAAAYQAAAEEAAABBAAAAQQAAAEEAAAAxAAAAMQAAADAAAAAwAAAAIAAAACAAAAAgAAAAIAAAABAAAAAQAAAAEAAAABAAAAAAAAAAAAAAAPr6+gAQAAAAEAAAABAAAAAQAAAAAAAAAAAAAAAAAAAA+vr6ABAAAADw8PDw8PDw8PDw8PDwAPDw8PDw8PAA8PDw8PDw8ADw8PDw8PDwAPDw8PDw8PAA8PDw8PDw8ADw8PAAGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxsbGxv/AABEgH0AfQMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/3QAEABT/2gAMAwEAAhEDEQA/AP8Av+iiigAooooAKKKKACiiigAooooAKKKKACiiigAr//2Q==";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting logo upload to storage...');
    
    // Convert base64 to blob
    const base64Data = LOGO_BASE64.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('email-assets')
      .upload('logo.png', binaryData, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }

    console.log('Logo uploaded successfully:', data);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('email-assets')
      .getPublicUrl('logo.png');

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: urlData.publicUrl,
        path: data.path 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in upload-logo function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
