import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  messages: string;
  apiKey?: string;
  model?: string;
}

// API Key do OpenRouter - atualizada
const DEFAULT_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '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';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: RequestBody = await req.json();
    const { messages, model = 'openai/gpt-4o-mini' } = body;

    console.log('[Edge Function] Gerando resumo com modelo:', model);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEFAULT_API_KEY}`,
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
    console.log('[Edge Function] Resposta:', responseText.substring(0, 200));
    
    return new Response(responseText, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Edge Function] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
