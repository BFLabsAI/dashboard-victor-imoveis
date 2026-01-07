import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout';
import { supabase } from '../lib/supabase';
import type { Lead, ChatHistory } from '../types';
import { Search, Send, User, Clock, AlertCircle, FileText, Phone, MoreVertical, Paperclip, Smile, MessageSquare, Sparkles, ChevronRight, PanelRight, Calendar } from 'lucide-react';
import clsx from 'clsx';

export function Chat() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
    const [filter] = useState<'all' | 'repassado' | 'urgente'>('all');
    const [newMessage, setNewMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [chatHistorySessions, setChatHistorySessions] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [summary, setSummary] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [showMobileInfo, setShowMobileInfo] = useState(false);

    async function generateSummary() {
        if (!chatHistory.length || !selectedLead) return;
        setLoadingSummary(true);
        setSummary('');

        try {
            const conversationText = chatHistory.map(msg =>
                `${msg.message.type === 'human' ? 'Cliente' : 'Atendente'}: ${msg.message.content}`
            ).join('\n');

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iixeygzkgfwetchjvpvo.supabase.co';
            const edgeFunctionUrl = `${supabaseUrl}/functions/v1/generate-summary`;
            const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY || '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';

            const response = await fetch(edgeFunctionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    messages: conversationText,
                    apiKey: apiKey // Passing key from client to edge function
                })
            });

            const data = await response.json();
            if (data.choices && data.choices.length > 0) {
                setSummary(data.choices[0].message.content);
            } else {
                setSummary('Não foi possível gerar o resumo.');
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            setSummary('Erro ao gerar resumo.');
        } finally {
            setLoadingSummary(false);
        }
    }

    const renderFormattedText = (text: string) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            // Handle headers (#, ##, ###)
            if (line.startsWith('# ')) {
                return <h1 key={i} className="text-white font-bold text-lg mb-3 pb-1 border-b border-navy-700">{line.slice(2)}</h1>;
            } else if (line.startsWith('## ')) {
                return <h2 key={i} className="text-neon-blue font-semibold text-base mb-2 mt-4">{line.slice(3)}</h2>;
            } else if (line.startsWith('### ')) {
                return <h3 key={i} className="text-pink-400 font-medium text-sm mb-2 mt-3">{line.slice(4)}</h3>;
            }

            // Handle bold text (**text**)
            const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={j} className="text-white font-bold">{part.slice(2, -2)}</strong>;
                }
                return part;
            });

            // Empty line creates spacing
            if (line.trim() === '') {
                return <br key={i} />;
            }

            // Regular line
            return (
                <div key={i} className="mb-2 leading-relaxed">
                    {parts}
                </div>
            );
        });
    };

    useEffect(() => {
        fetchLeads();
    }, []);

    useEffect(() => {
        if (selectedLead) {
            fetchChatHistory((selectedLead.telefone || '').trim());
            setSummary('');
        } else {
            setChatHistory([]);
            setSummary('');
        }
    }, [selectedLead]);

    async function fetchLeads() {
        try {
            const { data: leadsData, error: leadsError } = await supabase
                .from('leads_odonto_solluti')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, 4999);

            if (leadsError) throw leadsError;

            // Fetch chat sessions to filter leads
            const { data: chatData, error: chatError } = await supabase
                .rpc('get_active_chat_sessions');

            if (chatError) throw chatError;

            // Create a Set of session_ids for efficient lookup
            // Normalize session_ids to ensure matching (trim and lowercase)
            const sessions = (chatData as { session_id: string }[] | null)?.map(c => (c.session_id || '').trim().toLowerCase()) || [];
            const chatSessions = new Set<string>(sessions);

            // Filter leads that have chat history
            // We store the set of chat sessions to use in the render filter
            // This allows us to show ALL leads when searching, but only active ones by default
            setChatHistorySessions(chatSessions);
            setLeads(leadsData || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    }

    async function fetchChatHistory(sessionId: string | null) {
        if (!sessionId) return;
        console.log('[Chat] Fetching chat history for session ID:', sessionId);
        try {
            // Assuming session_id in chat history matches telefone in leads
            const { data, error } = await supabase
                .from('n8n_chat_histories_odonto_solutti')
                .select('*')
                .eq('session_id', sessionId)
                .order('id', { ascending: true });

            if (error) throw error;
            console.log('[Chat] Fetched messages:', data?.length || 0);
            setChatHistory(data || []);
        } catch (error) {
            console.error('Error fetching chat history:', error);
        }
    }

    const filteredLeads = leads.filter(lead => {
        // Apply filter
        if (filter === 'repassado' && lead.status_lead !== 'repassado') return false;
        // if (filter === 'urgente') return false; // lead.urgencia_caso logic if needed

        // Apply search term
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase().trim();
            const name = (lead.lead_name || '').toLowerCase();
            const phone = (lead.telefone || '').toLowerCase();

            // Extract only digits for phone number comparison
            const searchDigits = search.replace(/\D/g, ''); // Remove non-digits from search
            const phoneDigits = phone.replace(/\D/g, ''); // Remove non-digits from phone

            // Match by name OR by phone (either full phone string or just digits)
            return name.includes(search) ||
                phone.includes(search) ||
                (searchDigits && phoneDigits.includes(searchDigits));
        }

        // If no search term, ONLY show leads with chat history
        if (lead.telefone) {
            const normalizedPhone = lead.telefone.trim().toLowerCase();
            return chatHistorySessions.has(normalizedPhone);
        }

        return false;
    });

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedLead) return;

        // Here we would implement the logic to send the message via API/Supabase
        console.log('Sending message to', selectedLead.telefone, ':', newMessage);

        // Optimistic update (optional, for demo)
        // setChatHistory([...chatHistory, { 
        //   id: Date.now(), 
        //   session_id: selectedLead.telefone!, 
        //   message: { role: 'human', content: newMessage }, 
        //   created_at: new Date().toISOString() 
        // }]);

        setNewMessage('');
        alert('Funcionalidade de envio ainda não conectada ao backend.');
    };

    return (
        <Layout>
            <div className="flex h-[calc(100vh-8rem)] gap-6 overflow-hidden relative">
                {/* Conversations List */}
                <div className={clsx(
                    "w-full md:w-80 flex flex-col bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden absolute md:static inset-0 z-10 transition-transform duration-300",
                    selectedLead ? "-translate-x-full md:translate-x-0" : "translate-x-0"
                )}>
                    <div className="p-4 border-b border-navy-700 bg-navy-800/50 backdrop-blur-sm">
                        <h2 className="text-lg font-bold text-white mb-4">Mensagens</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar conversa..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-navy-900 border border-navy-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {filteredLeads.map((lead) => (
                            <button
                                key={lead.id}
                                onClick={() => setSelectedLead(lead)}
                                className={clsx(
                                    "w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-left",
                                    selectedLead?.id === lead.id
                                        ? "bg-navy-700 border border-neon-blue/30 shadow-lg shadow-neon-blue/5"
                                        : "hover:bg-navy-700/50 border border-transparent"
                                )}
                            >
                                <div className="relative">
                                    <div className={clsx(
                                        "h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors",
                                        selectedLead?.id === lead.id ? "bg-navy-800 text-neon-blue border-neon-blue" : "bg-navy-900 text-slate-400 border-navy-700 group-hover:border-slate-500"
                                    )}>
                                        {lead.lead_name ? lead.lead_name.charAt(0).toUpperCase() : 'L'}
                                    </div>
                                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-navy-800 rounded-full"></span>
                                </div>
                                <div className="ml-3 flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className={clsx(
                                            "font-bold truncate text-sm",
                                            selectedLead?.id === lead.id ? "text-white" : "text-slate-300"
                                        )}>
                                            {lead.lead_name || lead.telefone || 'Sem Nome'}
                                        </span>
                                        <span className="text-xs text-slate-500">10:42</span>
                                    </div>
                                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                                        {(lead.status_lead === 'novo' || lead.status_lead === 'novo lead') && <span className="w-1.5 h-1.5 rounded-full bg-neon-blue"></span>}
                                        {lead.tipo_procedimento || 'Sem interesse'}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={clsx(
                    "flex-1 flex flex-col bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden relative absolute md:static inset-0 z-20 transition-transform duration-300 bg-navy-900",
                    selectedLead ? "translate-x-0" : "translate-x-full md:translate-x-0"
                )}>
                    {selectedLead ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-20 px-4 md:px-6 border-b border-navy-700 flex items-center justify-between bg-navy-800/90 backdrop-blur-md z-10">
                                <div className="flex items-center gap-3 md:gap-4">
                                    {/* Mobile Back Button */}
                                    <button
                                        onClick={() => setSelectedLead(null)}
                                        className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"
                                    >
                                        <ChevronRight size={24} className="rotate-180" />
                                    </button>

                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-neon-blue to-blue-500 flex items-center justify-center text-navy-900 font-bold shadow-lg shadow-neon-blue/20">
                                        {selectedLead.lead_name ? selectedLead.lead_name.charAt(0).toUpperCase() : 'L'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{selectedLead.lead_name || 'Sem Nome'}</h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <span className="flex items-center gap-1"><Phone size={12} /> {selectedLead.telefone}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                            <span className="text-emerald-400">Online agora</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowMobileInfo(true)}
                                        className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-full transition-colors"
                                    >
                                        <PanelRight size={24} />
                                    </button>
                                    <button className="hidden md:block p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-full transition-colors">
                                        <Phone size={20} />
                                    </button>
                                    <button className="hidden md:block p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-full transition-colors">
                                        <Search size={20} />
                                    </button>
                                    <button className="hidden md:block p-2 text-slate-400 hover:text-white hover:bg-navy-700 rounded-full transition-colors">
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-navy-900/50 relative">
                                {/* Background Pattern */}
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
                                    style={{ backgroundImage: 'radial-gradient(#64ffda 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                                </div>

                                {chatHistory.length > 0 ? chatHistory.map((msg) => {
                                    // Logic Fix: 
                                    // 'human' = Client -> Left Side (White/Gray)
                                    // 'ai' = Agent -> Right Side (Neon/Color)
                                    const isClient = msg.message.type === 'human';

                                    return (
                                        <div
                                            key={msg.id}
                                            className={clsx(
                                                "flex w-full",
                                                isClient ? "justify-start" : "justify-end"
                                            )}
                                        >
                                            <div className={clsx(
                                                "flex max-w-[70%] gap-3",
                                                isClient ? "flex-row" : "flex-row-reverse"
                                            )}>
                                                {/* Avatar */}
                                                <div className={clsx(
                                                    "h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm mt-auto",
                                                    isClient
                                                        ? "bg-navy-700 text-slate-300 border border-navy-600"
                                                        : "bg-neon-blue text-navy-900 shadow-neon-blue/20"
                                                )}>
                                                    {isClient ? 'C' : 'A'}
                                                </div>

                                                {/* Bubble */}
                                                <div className={clsx(
                                                    "p-4 rounded-2xl shadow-md text-sm leading-relaxed relative group",
                                                    isClient
                                                        ? "bg-navy-700 text-slate-200 rounded-bl-none border border-navy-600"
                                                        : "bg-gradient-to-br from-neon-blue to-blue-500 text-navy-900 font-medium rounded-br-none shadow-neon-blue/10"
                                                )}>
                                                    {msg.message.content}
                                                    <span className={clsx(
                                                        "text-[10px] absolute bottom-1",
                                                        isClient ? "right-3 text-slate-400" : "left-3 text-navy-800/60"
                                                    )}>
                                                        10:42
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }) : (
                                    <div className="flex items-center justify-center h-full text-slate-500">
                                        <p className="text-sm">Nenhuma mensagem encontrada para esta conversa.</p>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-navy-800 border-t border-navy-700">
                                <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-navy-900 p-2 rounded-2xl border border-navy-700 focus-within:border-neon-blue/50 focus-within:ring-1 focus-within:ring-neon-blue/50 transition-all shadow-inner">
                                    <button type="button" className="p-2 text-slate-400 hover:text-neon-blue transition-colors">
                                        <Paperclip size={20} />
                                    </button>
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Digite sua mensagem..."
                                        className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-slate-500"
                                    />
                                    <button type="button" className="p-2 text-slate-400 hover:text-neon-blue transition-colors">
                                        <Smile size={20} />
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="p-3 bg-neon-blue text-navy-900 rounded-xl hover:bg-white hover:shadow-neon transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                                    >
                                        <Send size={18} />
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <div className="w-20 h-20 bg-navy-900 rounded-full flex items-center justify-center mb-4 border border-navy-700">
                                <MessageSquare size={40} className="text-navy-600" />
                            </div>
                            <p className="text-lg font-medium text-slate-400">Selecione uma conversa para iniciar</p>
                        </div>
                    )}
                </div>

                {/* Patient Context Sidebar */}
                {selectedLead && (
                    <>
                        {/* Mobile Backdrop */}
                        {showMobileInfo && (
                            <div
                                className="fixed inset-0 bg-navy-900/80 backdrop-blur-sm z-40 lg:hidden"
                                onClick={() => setShowMobileInfo(false)}
                            />
                        )}

                        <div className={clsx(
                            "fixed inset-y-0 right-0 z-50 w-80 bg-navy-800 shadow-2xl transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto lg:block lg:rounded-3xl lg:border lg:border-navy-700 lg:shadow-xl overflow-y-auto custom-scrollbar p-6 space-y-6",
                            showMobileInfo ? "translate-x-0" : "translate-x-full lg:translate-x-0"
                        )}>
                            <div className="text-center relative">
                                {/* Mobile Close Button */}
                                <button
                                    onClick={() => setShowMobileInfo(false)}
                                    className="absolute top-0 right-0 p-2 text-slate-400 hover:text-white lg:hidden"
                                >
                                    <ChevronRight size={20} />
                                </button>

                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-neon-blue to-blue-600 rounded-full flex items-center justify-center text-3xl font-bold text-navy-900 shadow-lg shadow-neon-blue/20 mb-4 border-4 border-navy-800 ring-2 ring-navy-700">
                                    {selectedLead.lead_name ? selectedLead.lead_name.charAt(0).toUpperCase() : 'L'}
                                </div>
                                <h2 className="text-xl font-bold text-white">Atendimentos</h2>
                                <p className="text-slate-400 text-sm">Gerencie suas conversas do Odonto Solluti</p>
                            </div>        <div className="flex justify-center gap-2 mt-4">
                                <button className="p-2 bg-navy-700 rounded-lg text-neon-blue hover:bg-neon-blue hover:text-navy-900 transition-colors border border-navy-600">
                                    <Phone size={18} />
                                </button>
                                <button className="p-2 bg-navy-700 rounded-lg text-neon-blue hover:bg-neon-blue hover:text-navy-900 transition-colors border border-navy-600">
                                    <User size={18} />
                                </button>
                                <button className="p-2 bg-navy-700 rounded-lg text-neon-blue hover:bg-neon-blue hover:text-navy-900 transition-colors border border-navy-600">
                                    <FileText size={18} />
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Human Attendance Toggle Section */}
                                <div className="p-4 bg-navy-900 rounded-2xl border border-navy-700 hover:border-emerald-500/30 transition-colors group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-navy-800 rounded-lg text-emerald-400 group-hover:bg-emerald-400 group-hover:text-navy-900 transition-colors">
                                                <User size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-white">Atendimento Humano</span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!selectedLead) return;
                                                const newValue = !selectedLead.atendimento_humano;
                                                try {
                                                    const { error } = await supabase
                                                        .from('leads_odonto_solluti')
                                                        .update({ atendimento_humano: newValue })
                                                        .eq('id', selectedLead.id);

                                                    if (error) throw error;

                                                    // Update local state
                                                    setSelectedLead({ ...selectedLead, atendimento_humano: newValue });
                                                    setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, atendimento_humano: newValue } : l));
                                                } catch (error) {
                                                    console.error('Error updating atendimento_humano:', error);
                                                    alert('Erro ao atualizar atendimento humano');
                                                }
                                            }}
                                            className={clsx(
                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-2",
                                                selectedLead.atendimento_humano
                                                    ? "bg-emerald-500 border-emerald-400"
                                                    : "bg-navy-700 border-navy-600"
                                            )}
                                        >
                                            <span
                                                className={clsx(
                                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                                    selectedLead.atendimento_humano ? "translate-x-6" : "translate-x-1"
                                                )}
                                            />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">
                                        {selectedLead.atendimento_humano ? 'Atendimento humano ativado' : 'Atendimento automático'}
                                    </p>
                                </div>

                                {/* Summary Section */}
                                <div className="p-4 bg-navy-900 rounded-2xl border border-navy-700 hover:border-neon-blue/30 transition-colors group">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-navy-800 rounded-lg text-neon-blue group-hover:bg-neon-blue group-hover:text-navy-900 transition-colors">
                                                <Sparkles size={16} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumo IA</span>
                                        </div>
                                        {!summary && !loadingSummary && (
                                            <button
                                                onClick={generateSummary}
                                                className="text-xs font-bold text-neon-blue hover:text-white transition-colors bg-navy-800 px-2 py-1 rounded-lg border border-navy-700 hover:bg-navy-700"
                                            >
                                                Gerar Resumo
                                            </button>
                                        )}
                                    </div>

                                    {loadingSummary ? (
                                        <div className="flex items-center justify-center py-4 text-slate-500 gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neon-blue"></div>
                                            <span className="text-xs">Gerando resumo...</span>
                                        </div>
                                    ) : summary ? (
                                        <div className="space-y-3">
                                            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                                {renderFormattedText(summary)}
                                            </div>
                                            <button
                                                onClick={generateSummary}
                                                className="text-[10px] text-slate-500 hover:text-neon-blue transition-colors flex items-center gap-1 mt-2"
                                            >
                                                <Sparkles size={10} /> Regenerar
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">
                                            Clique em gerar para obter um resumo inteligente desta conversa.
                                        </p>
                                    )}
                                </div>

                                <div className="p-3 bg-navy-900 rounded-2xl border border-navy-700 hover:border-neon-blue/30 transition-colors group">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-1.5 bg-navy-800 rounded-lg text-neon-blue group-hover:bg-neon-blue group-hover:text-navy-900 transition-colors">
                                            <AlertCircle size={16} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</span>
                                    </div>
                                    <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold border mt-1 ${selectedLead.status_lead === 'novo' || selectedLead.status_lead === 'novo lead' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        selectedLead.status_lead === 'repassado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            'bg-slate-700 text-slate-300 border-slate-600'
                                        }`}>
                                        {selectedLead.status_lead?.toUpperCase()}
                                    </span>
                                </div>

                                <div className="p-3 bg-navy-900 rounded-2xl border border-navy-700 hover:border-neon-blue/30 transition-colors group">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-1.5 bg-navy-800 rounded-lg text-cyan-400 group-hover:bg-cyan-400 group-hover:text-navy-900 transition-colors">
                                            <Calendar size={16} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dia da Cadência</span>
                                    </div>
                                    <p className="text-sm font-medium text-white pl-1">{selectedLead.dia_cadencia || 'Não informado'}</p>
                                </div>

                                <div className="p-3 bg-navy-900 rounded-2xl border border-navy-700 hover:border-neon-blue/30 transition-colors group">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-1.5 bg-navy-800 rounded-lg text-purple-400 group-hover:bg-purple-400 group-hover:text-navy-900 transition-colors">
                                            <FileText size={16} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Procedimento</span>
                                    </div>
                                    <p className="text-sm font-medium text-white pl-1">{selectedLead.tipo_procedimento || 'Não informado'}</p>
                                </div>

                                <div className="p-3 bg-navy-900 rounded-2xl border border-navy-700 hover:border-neon-blue/30 transition-colors group">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="p-1.5 bg-navy-800 rounded-lg text-amber-400 group-hover:bg-amber-400 group-hover:text-navy-900 transition-colors">
                                            <Clock size={16} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Follow</span>
                                    </div>
                                    <p className="text-sm font-medium text-white pl-1">{selectedLead.etapa_follow || 'Não informado'}</p>
                                </div>


                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout >
    );
}
