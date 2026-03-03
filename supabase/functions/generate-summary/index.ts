import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  messages: string;
  model?: string;
}

const API_KEY = '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';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json();
    const { messages, model = 'openai/gpt-4o-mini' } = body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://iixeygzkgfwetchjvpvo.supabase.co',
        'X-Title': 'Dashboard Imobiliaria Rogaciano'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente que resume conversas de atendimento imobiliário. Crie um resumo conciso e estruturado em português, destacando: principais dúvidas do cliente, imóveis de interesse, informações coletadas, e próximos passos sugeridos.'
          },
          {
            role: 'user',
            content: `Resuma a seguinte conversa de atendimento:\n\n${messages}`
          }
        ]
      })
    });

    const responseText = await response.text();
    
    return new Response(responseText, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
