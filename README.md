# Dashboard Imobiliária Rogaciano / Victor Imóveis 🏠

Dashboard exclusivo focado na gestão eficiente de leads imobiliários e análise de contatos.

## 🚀 Visão Geral

Este sistema foi customizado para atender às necessidades específicas da imobiliária, permitindo o acompanhamento de:
- **Leads por Imóvel/Interesse**: Monitoramento de interesses em locação e venda.
- **Eficiência do Atendimento**: Métricas de leads repassados e tempo de resposta.
- **Performance de Marketing**: Análise de campanhas (Ads vs Orgânico) e criativos.

## 🛠️ Tecnologias Principais

- **Frontend**: React 19, TypeScript, Vite
- **Estilização**: Tailwind CSS (Navy Theme customizado)
- **Gráficos**: Recharts
- **Ícones**: Lucide React
- **Backend / Dados**: Supabase

## 📊 Funcionalidades Chave

### 1. Dashboard de Gestão
- **KPIs Estratégicos**: Total de leads, leads repassados, taxa de engajamento e média diária.
- **Filtros Avançados**: Seleção por período, permitindo análises históricas precisas.
- **Gráficos de Turno e Cadência**: Entenda os melhores horários e dias de contato.
- **Top Criativos**: Visualize os anúncios com melhor performance e links diretos para o post.
- **Origem dos Leads**: Diferenciação entre Pago (Instagram/Facebook) e Orgânico.

### 2. Tabela de Leads Recentes
- **Paginação**: Navegação fluida entre centenas de leads.
- **Detalhes do Procedimento**: Visualização rápida do tipo de procedimento de interesse.
- **Status Coloridos**: Identificação visual rápida (Novo, Repassado, etc.).
- **Atendimento Humano**: Filtro e visualização dedicada para leads em tratamento manual.

### 3. Chat e Histórico
- **Histórico de Conversas**: Visualização completa das mensagens de cada lead.
- **Resumo IA**: Geração automática de resumos usando inteligência artificial.
- **Integração WhatsApp**: Acesso rápido para iniciar atendimentos.

### 4. Relatórios Automatizados
- **Relatório Diário**: Envio automático de métricas via WhatsApp.
- **Timezone Fortaleza**: Cálculos precisos de data/hora para o fuso local.

## 🚦 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/BFLabsAI/dashboard-victor-imoveis.git

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev
```

## 🔒 Variáveis de Ambiente

O projeto requer configuração das chaves no arquivo `.env`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OPENROUTER_API_KEY=...
```

## 📱 Suporte

Desenvolvido e mantido por **BFLabs AI**.
Em caso de dúvidas ou problemas, entre em contato com o suporte técnico.

---
© 2025 Dashboard Victor Imóveis / Rogaciano. Todos os direitos reservados.
