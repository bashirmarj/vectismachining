import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, price_per_lb } = await req.json();
    
    if (!image) {
      throw new Error('No image provided');
    }

    console.log('Processing material table image with AI...');

    // Call Lovable AI to analyze the table
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this material specification table and extract all cross-section data. 
                
For each row, extract:
- thickness (convert fractions to decimal, e.g., "1/16" = 0.0625)
- width (convert fractions to decimal)
- weight_per_foot (numeric value in lbs/ft)
- weight_per_bar (numeric value for 12-ft bar)

Return ONLY a valid JSON array with this structure:
[
  {
    "thickness": 0.0625,
    "width": 0.25,
    "weight_per_foot": 0.0532,
    "weight_per_bar": 0.6381
  }
]

Important:
- Convert ALL fractions to decimals
- Extract ALL rows from the table
- Ensure numeric precision (4 decimal places for thickness/width, 4 for weights)
- Return ONLY the JSON array, no other text`
              },
              {
                type: 'image_url',
                image_url: {
                  url: image
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    console.log('AI response received');

    const content = aiResult.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Extract JSON from the response (handle markdown code blocks)
    let jsonText = content.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
    }

    const extractedData = JSON.parse(jsonText);
    
    if (!Array.isArray(extractedData)) {
      throw new Error('AI did not return an array');
    }

    // Calculate cost_per_inch for each cross-section
    const crossSections = extractedData.map((item: any) => ({
      thickness: parseFloat(item.thickness),
      width: parseFloat(item.width),
      weight_per_foot: parseFloat(item.weight_per_foot),
      weight_per_bar: parseFloat(item.weight_per_bar),
      cost_per_inch: (parseFloat(item.weight_per_foot) / 12) * (price_per_lb || 1.0)
    }));

    console.log(`Successfully extracted ${crossSections.length} cross-sections`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        cross_sections: crossSections,
        count: crossSections.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing table:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        cross_sections: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  }
});
