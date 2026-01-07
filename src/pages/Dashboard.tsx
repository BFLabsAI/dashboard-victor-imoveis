import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { StatusChart } from '../components/charts/StatusChart';

import { CadenceVolumeChart } from '../components/charts/CadenceVolumeChart';
import { Users, UserCheck, MessageCircle, Calendar, Download, Target, Leaf, BarChart2 } from 'lucide-react';
import type { Lead, RepassadoLead } from '../types';
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BF3', '#F472B6', '#6366F1', '#EC4899', '#10B981', '#F59E0B'];

// Status-specific colors for the Status Chart
const STATUS_COLORS: Record<string, string> = {
    'novo lead': '#3B82F6',      // Blue - new/fresh
    'repassado': '#10B981',       // Green - success/forwarded
    'agendamento futuro': '#F59E0B', // Amber - scheduled/pending
    'suporte': '#8B5CF6',         // Purple - support/help
    'indefinido': '#6B7280'       // Gray - undefined
};

// Maps procedure types to unified categories
function mapProcedureToCategory(tipo: string | null | undefined): string {
    if (!tipo || tipo.trim() === '') return 'Não Informado';

    const lower = tipo.toLowerCase().trim();

    // Facetas: lentes, resina, facetas
    if (lower.includes('faceta') || lower.includes('lente') || lower.includes('resina') && (lower.includes('lente') || lower.includes('faceta'))) {
        return 'Facetas';
    }

    // Aparelho Ortodôntico: aparelho, ortodont, manutenção aparelho
    if (lower.includes('aparelho') || lower.includes('ortodont')) {
        return 'Aparelho Ortodôntico';
    }

    // Extração: extração, siso
    if (lower.includes('extração') || lower.includes('extracao') || lower.includes('siso')) {
        return 'Extração';
    }

    // Prótese: prótese, protese
    if (lower.includes('prótese') || lower.includes('protese')) {
        return 'Prótese';
    }

    // Tratamento de Canal
    if (lower.includes('canal')) {
        return 'Tratamento de Canal';
    }

    // Clareamento
    if (lower.includes('clareamento') || lower.includes('branqueamento')) {
        return 'Clareamento';
    }

    // Avaliação: avaliação, consulta
    if (lower.includes('avaliação') || lower.includes('avaliacao') || lower.includes('consulta')) {
        return 'Avaliação';
    }

    // Procedimentos Gerais: limpeza, restauração, raspagem, obturação
    if (lower.includes('limpeza') || lower.includes('restauração') || lower.includes('restauracao') ||
        lower.includes('raspagem') || lower.includes('obturação') || lower.includes('obturacao')) {
        return 'Procedimentos Gerais';
    }

    return 'Outros';
}

// Helper to safely parse metadata (can be string or object)
function parseMetadata(meta: unknown): any {
    if (!meta) return null;
    if (typeof meta === 'string') {
        try {
            return JSON.parse(meta);
        } catch {
            return null;
        }
    }
    if (typeof meta === 'object') {
        return meta;
    }
    return null;
}

export function Dashboard() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [repassados, setRepassados] = useState<RepassadoLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const exportToCSV = () => {
        if (filteredLeads.length === 0) {
            alert('Nenhum dado para exportar.');
            return;
        }

        // Define headers
        const headers = [
            'ID', 'Nome', 'Telefone', 'Status', 'Etapa Follow', 'Tipo Procedimento',
            'Urgência', 'Horário Pref.', 'Data de Criação',
            'Data Última Interação', 'Dia Cadência', 'Atendimento Humano'
        ].join(',');

        // Format data rows
        const rows = filteredLeads.map(lead => {
            const data = [
                lead.id,
                `"${lead.lead_name || ''}"`, // Enclose specific string fields in quotes to handle commas
                `"${lead.telefone || ''}"`,
                lead.status_lead || '',
                lead.etapa_follow || '',
                lead.tipo_procedimento || '',
                lead.urgencia_caso || '',
                lead.horario_preferencia || '',
                lead.created_at ? format(parseISO(lead.created_at), 'dd/MM/yyyy HH:mm:ss') : '',
                lead.data_ultima_interacao ? format(parseISO(lead.data_ultima_interacao), 'dd/MM/yyyy HH:mm:ss') : '',
                lead.dia_cadencia || '',
                lead.atendimento_humano ? 'Sim' : 'Não'
            ];
            return data.join(',');
        });

        // Combine
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');

        // Create download link
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `leads_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    // Reset pagination when date filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [dateRange]);

    async function fetchData() {
        setLoading(true);
        try {
            await Promise.all([fetchLeads(), fetchRepassados()]);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchLeads() {
        try {
            let query = supabase
                .from('leads_odonto_solluti')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, 4999);

            if (dateRange.start) {
                query = query.gte('created_at', `${dateRange.start}T00:00:00`);
            }
            if (dateRange.end) {
                query = query.lte('created_at', `${dateRange.end}T23:59:59`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setLeads(data || []);
        } catch (error) {
            console.error('Error fetching leads:', error);
        }
    }

    async function fetchRepassados() {
        try {
            let query = supabase
                .from('repassado_odonto_solluti')
                .select('*')
                .order('created_at', { ascending: false })
                .range(0, 4999);

            if (dateRange.start) {
                query = query.gte('created_at', `${dateRange.start}T00:00:00`);
            }
            if (dateRange.end) {
                query = query.lte('created_at', `${dateRange.end}T23:59:59`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setRepassados(data || []);
        } catch (error) {
            console.error('Error fetching repassados:', error);
        }
    }

    // Filter leads by date
    const filteredLeads = leads.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = parseISO(lead.created_at);
        const start = startOfDay(parseISO(dateRange.start));
        const end = endOfDay(parseISO(dateRange.end));
        return isWithinInterval(leadDate, { start, end });
    });

    // Filter repassados by date (same logic)
    const filteredRepassados = repassados.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = parseISO(lead.created_at);
        const start = startOfDay(parseISO(dateRange.start));
        const end = endOfDay(parseISO(dateRange.end));
        return isWithinInterval(leadDate, { start, end });
    });

    // Calculate KPIs based on filtered leads
    const totalLeads = filteredLeads.length;
    const repassedLeads = filteredLeads.filter(l => l.status_lead === 'repassado').length;
    const engagementRate = totalLeads > 0 ? Math.round((repassedLeads / totalLeads) * 100) : 0;

    // Calculate average leads per day based on the selected date range duration
    const startDate = parseISO(dateRange.start);
    const endDate = parseISO(dateRange.end);
    // Add 1 to include both start and end dates inclusive
    const daysInPeriod = Math.max(1, differenceInDays(endDate, startDate) + 1);

    // Average with decimals
    const avgLeadsPerDay = daysInPeriod > 0
        ? (filteredLeads.length / daysInPeriod).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        : '0,0';

    // Calculate Trends (Compare vs Previous Period)
    const previousStartDate = subDays(startDate, daysInPeriod);
    const previousEndDate = subDays(endDate, daysInPeriod);

    const previousPeriodLeads = leads.filter(lead => {
        if (!lead.created_at) return false;
        return isWithinInterval(parseISO(lead.created_at), {
            start: startOfDay(previousStartDate),
            end: endOfDay(previousEndDate)
        });
    });

    const previousTotalLeads = previousPeriodLeads.length;
    const previousRepassedLeads = previousPeriodLeads.filter(l => l.status_lead === 'repassado').length;
    const previousEngagementRate = previousTotalLeads > 0 ? Math.round((previousRepassedLeads / previousTotalLeads) * 100) : 0;

    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) {
            return current > 0 ? { trend: '+100%', trendUp: true } : { trend: '0%', trendUp: true };
        }
        const diff = current - previous;
        const percentage = Math.round((diff / previous) * 100);
        const sign = percentage >= 0 ? '+' : '';
        return {
            trend: `${sign}${percentage}%`,
            trendUp: percentage >= 0
        };
    };

    const totalLeadsTrend = calculateTrend(totalLeads, previousTotalLeads);
    const repassedLeadsTrend = calculateTrend(repassedLeads, previousRepassedLeads);
    const engagementRateTrend = calculateTrend(engagementRate, previousEngagementRate);

    // Prepare Chart Data
    // Requirement: Status Chart must use leads_odonto_solluti AND repassado_odonto_solluti
    // We will count 'repassado' from the repassados table, and other statuses from the leads table.

    // 1. Get non-repassed status counts from leads table
    const leadStatusCounts = filteredLeads.reduce((acc, lead) => {
        const status = (lead.status_lead || 'Indefinido').toLowerCase();
        if (status !== 'repassado') {
            acc[status] = (acc[status] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // 2. Add repassed count from repassados table
    // The user explicitly said: "leads that were repassed is in the repasse table"
    const repassedCount = filteredRepassados.length;
    if (repassedCount > 0) {
        leadStatusCounts['repassado'] = repassedCount;
    }

    const statusData = Object.entries(leadStatusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
    }));





    const cadenceData = Object.entries(filteredLeads.reduce((acc, lead) => {
        const day = lead.dia_cadencia || 'N/A';
        acc[day] = (acc[day] || 0) + 1;
        return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));

    // Metadata Analytics
    const creativeStats = filteredLeads.reduce((acc, lead) => {
        const meta = parseMetadata(lead.metadata);
        if (meta?.mediaUrl) {
            const url = meta.mediaUrl;
            const sourceUrl = meta.sourceUrl || ''; // Link to the post
            if (!acc[url]) acc[url] = { count: 0, repassed: 0, url, sourceUrl };
            acc[url].count++;
            // Keep the first non-empty sourceUrl we find
            if (sourceUrl && !acc[url].sourceUrl) {
                acc[url].sourceUrl = sourceUrl;
            }
            if (lead.status_lead === 'repassado') acc[url].repassed++;
        } else {
            // Handle organic leads (no mediaUrl)
            const key = 'organic';
            if (!acc[key]) acc[key] = { count: 0, repassed: 0, url: '', sourceUrl: '' };
            acc[key].count++;
            if (lead.status_lead === 'repassado') acc[key].repassed++;
        }
        return acc;
    }, {} as Record<string, { count: number, repassed: number, url: string, sourceUrl: string }>);

    const sourceStats = filteredLeads.reduce((acc, lead) => {
        const meta = parseMetadata(lead.metadata);

        // Check if lead came from paid traffic (ads)
        // Traffic indicators: sourceType='ad', conversionSource contains 'Ads', 
        // ctwaClid has value, clickToWhatsappCall='true', or entryPointConversionSource contains 'ad'
        const isPaid =
            meta?.sourceType === 'ad' ||
            (meta?.conversionSource && meta.conversionSource.toLowerCase().includes('ads')) ||
            (meta?.ctwaClid && meta.ctwaClid.trim() !== '') ||
            meta?.clickToWhatsappCall === 'true' ||
            (meta?.entryPointConversionSource && meta.entryPointConversionSource.toLowerCase().includes('ad'));

        let key: string;

        if (isPaid) {
            // For paid traffic, show the source app (Instagram/Facebook)
            const app = meta?.sourceApp || meta?.entryPointConversionApp || 'Ads';
            const appName = app.charAt(0).toUpperCase() + app.slice(1).toLowerCase();
            key = `Pago - ${appName}`;
        } else {
            // Organic traffic
            key = 'Orgânico';
        }

        if (!acc[key]) acc[key] = 0;
        acc[key]++;
        return acc;
    }, {} as Record<string, number>);

    // Convert to arrays for rendering
    const topCreatives = Object.values(creativeStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(c => ({
            name: c.url.split('/').pop() || 'Criativo',
            mediaUrl: c.url,
            sourceUrl: c.sourceUrl, // Link to Instagram/Facebook post
            count: c.count
        }));

    const leadsBySource = Object.entries(sourceStats).map(([name, value]) => ({ name, value }));

    if (loading) {
        return (
            <Layout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-8">
                {/* Header & Date Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">Visão Geral</h2>
                        <p className="text-slate-400 text-sm">Bem-vindo ao Dashboard Odonto Solluti</p>
                    </div>
                    <div className="flex items-center gap-3 bg-navy-900 p-2 rounded-xl border border-navy-700">
                        <Calendar size={18} className="text-neon-blue ml-2" />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="bg-transparent text-white text-sm focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="bg-transparent text-white text-sm focus:outline-none [&::-webkit-calendar-picker-indicator]:invert"
                        />
                    </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <KPICard title="Total de Leads" value={totalLeads} icon={Users} color="indigo" trend={totalLeadsTrend.trend} trendUp={totalLeadsTrend.trendUp} />
                    <KPICard title="Leads Repassados" value={repassedLeads} icon={UserCheck} color="green" trend={repassedLeadsTrend.trend} trendUp={repassedLeadsTrend.trendUp} />
                    <KPICard title="Taxa de Engajamento" value={`${engagementRate}%`} icon={MessageCircle} color="violet" trend={engagementRateTrend.trend} trendUp={engagementRateTrend.trendUp} />
                    <KPICard title="Média de Leads/Dia" value={avgLeadsPerDay} icon={BarChart2} color="orange" />
                </div>

                {/* Metadata Analytics Row - Equal Size Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Creatives */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <MessageCircle className="text-pink-400" size={20} />
                            Top Criativos (Ads)
                        </h3>
                        <div className="space-y-4">
                            {topCreatives.map((creative, index) => {
                                const isOrganic = !creative.mediaUrl;

                                const borderColor = isOrganic ? 'hover:border-emerald-400/30' : 'hover:border-pink-400/30';
                                const progressColor = isOrganic ? 'bg-emerald-500' : 'bg-pink-500';

                                return (
                                    <div key={index} className={`flex items-center gap-4 p-3 rounded-xl bg-navy-900/50 border border-navy-700 ${borderColor} transition-all group`}>
                                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-navy-800 relative flex-shrink-0">
                                            {creative.mediaUrl ? (
                                                creative.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                                                    <video
                                                        src={creative.mediaUrl}
                                                        className="w-full h-full object-cover"
                                                        muted
                                                        loop
                                                        playsInline
                                                        onMouseOver={e => e.currentTarget.play().catch(() => { })}
                                                        onMouseOut={e => e.currentTarget.pause()}
                                                    />
                                                ) : (
                                                    <img
                                                        src={creative.mediaUrl}
                                                        alt="Creative"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const parent = e.currentTarget.parentElement;
                                                            if (parent) {
                                                                parent.classList.add('flex', 'items-center', 'justify-center', 'bg-navy-700');
                                                                parent.innerHTML = `
                                                                    <div class="flex flex-col items-center justify-center">
                                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-pink-400">
                                                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                                                                            <circle cx="9" cy="9" r="2"/>
                                                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                                                                        </svg>
                                                                        <span class="text-[10px] font-bold mt-1 text-pink-400">Criativo Ads</span>
                                                                    </div>
                                                                `;
                                                            }
                                                        }}
                                                    />
                                                )
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-navy-700">
                                                    <span className="text-xs font-bold text-emerald-400">Orgânico</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {isOrganic ? (
                                                <p className="text-sm font-medium text-white truncate">Sem Criativo</p>
                                            ) : creative.sourceUrl ? (
                                                <a
                                                    href={creative.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm font-medium text-pink-400 hover:text-pink-300 truncate block underline"
                                                    title={`Ver anúncio: ${creative.sourceUrl}`}
                                                >
                                                    🔗 Ver Anúncio
                                                </a>
                                            ) : (
                                                <p className="text-sm font-medium text-white truncate" title={creative.name}>
                                                    {creative.name || 'Anúncio sem nome'}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-slate-400">
                                                    {creative.count} leads
                                                </span>
                                                <div className="h-1 flex-1 bg-navy-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${progressColor}`}
                                                        style={{ width: `${(creative.count / (topCreatives[0]?.count || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {topCreatives.length === 0 && (
                                <div className="col-span-full text-center py-10 text-slate-500">
                                    Nenhum dado de criativo encontrado para o período.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Leads by Source - Visual List */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Users className="text-cyan-400" size={20} />
                            Origem dos Leads
                        </h3>
                        <div className="space-y-4">
                            {leadsBySource
                                .sort((a, b) => b.value - a.value)
                                .slice(0, 5)
                                .map((source, index) => {
                                    const isPaid = source.name.toLowerCase().includes('pago');
                                    const IconComponent = isPaid ? Target : Leaf;
                                    const bgColor = isPaid ? 'bg-cyan-500' : 'bg-emerald-500';

                                    return (
                                        <div key={index} className="flex items-center gap-4 p-3 rounded-xl bg-navy-900/50 border border-navy-700 hover:border-cyan-400/30 transition-all group">
                                            <div className={`w-12 h-12 rounded-lg ${bgColor} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                                <IconComponent size={20} className="text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-white truncate" title={source.name}>
                                                    {source.name}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-slate-400">
                                                        {source.value} leads
                                                    </span>
                                                    <div className="h-1 flex-1 bg-navy-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${bgColor}`}
                                                            style={{ width: `${(source.value / (leadsBySource[0]?.value || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            {leadsBySource.length === 0 && (
                                <div className="col-span-full text-center py-10 text-slate-500">
                                    Nenhum dado de origem encontrado.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Charts Grid: Status & Procedures */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Status dos Leads */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <UserCheck className="text-neon-blue" size={20} />
                            Status dos Leads
                        </h3>
                        <div className="h-64">
                            <StatusChart data={statusData} colorMap={STATUS_COLORS} />
                        </div>
                    </div>

                    {/* Tipos de Procedimento (Repassados) */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Calendar className="text-pink-400" size={20} />
                            Tipos de Procedimento (Repassados)
                        </h3>
                        <div className="flex items-center justify-center h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={(() => {
                                            // Group procedure types by CATEGORY and get counts
                                            const procedureCounts = filteredRepassados.reduce((acc, lead) => {
                                                const category = mapProcedureToCategory(lead.tipo_procedimento);
                                                acc[category] = (acc[category] || 0) + 1;
                                                return acc;
                                            }, {} as Record<string, number>);

                                            // Sort by count descending
                                            const sortedEntries = Object.entries(procedureCounts)
                                                .sort(([, a], [, b]) => b - a);

                                            return sortedEntries.map(([name, value]) => ({ name, value }));
                                        })()}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {(() => {
                                            const procedureCounts = filteredRepassados.reduce((acc, lead) => {
                                                const category = mapProcedureToCategory(lead.tipo_procedimento);
                                                acc[category] = (acc[category] || 0) + 1;
                                                return acc;
                                            }, {} as Record<string, number>);

                                            const sortedEntries = Object.entries(procedureCounts)
                                                .sort(([, a], [, b]) => b - a);

                                            return sortedEntries.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                            ));
                                        })()}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Cadence Volume and Repassed Leads Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {/* Volume por Dia da Cadência */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                            <span className="w-1 h-6 bg-emerald-500 rounded-full mr-3"></span>
                            Volume por Dia da Cadência
                        </h3>
                        <CadenceVolumeChart data={cadenceData} />
                    </div>

                    {/* Últimos Leads Repassados */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl overflow-hidden flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <UserCheck className="text-emerald-400" size={20} />
                            Últimos Leads Repassados
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4 max-h-[300px]">
                            {repassados.slice(0, 10).map((lead) => (
                                <div key={lead.id} className="p-4 bg-navy-900/50 rounded-2xl border border-navy-700 hover:border-emerald-500/30 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-navy-900 transition-colors">
                                            {lead.lead_name ? lead.lead_name.charAt(0).toUpperCase() : 'L'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{lead.lead_name || 'Sem nome'}</p>
                                            <p className="text-xs text-slate-400">{lead.telefone}</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-navy-800 rounded-lg text-xs text-slate-300 border border-navy-600">
                                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            ))}
                            {repassados.length === 0 && (
                                <div className="text-center py-10 text-slate-500">
                                    Nenhum lead repassado encontrado.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Leads Table */}
                <div className="bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-navy-700 flex justify-between items-center bg-navy-800/50">
                        <h3 className="text-lg font-bold text-white">Leads Recentes</h3>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-slate-300 rounded-lg hover:bg-navy-700 hover:text-white transition-colors text-sm font-medium border border-navy-700"
                        >
                            <Download size={16} /> Exportar CSV
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-navy-700">
                            <thead className="bg-navy-900">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Produto de Interesse</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Última Interação</th>
                                    <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-navy-800 divide-y divide-navy-700">
                                {filteredLeads
                                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                                    .map((lead) => (
                                        <tr key={lead.id} className="hover:bg-navy-700/50 transition-colors duration-150">
                                            <td className="px-8 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-10 w-10 rounded-xl bg-navy-700 flex items-center justify-center text-neon-blue font-bold text-sm mr-4 border border-navy-600">
                                                        {lead.lead_name ? lead.lead_name.charAt(0).toUpperCase() : 'L'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">{lead.lead_name || lead.telefone || 'Sem Identificação'}</div>
                                                        <div className="text-sm text-slate-500">{lead.telefone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 whitespace-nowrap text-sm text-slate-400 font-medium">
                                                {lead.tipo_procedimento || 'Sem interesse'}
                                            </td>
                                            <td className="px-8 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-md border ${lead.status_lead === 'repassado'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : lead.status_lead === 'novo' || lead.status_lead === 'novo lead'
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        : 'bg-slate-700/50 text-slate-400 border-slate-600'
                                                    }`}>
                                                    {lead.status_lead}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {lead.data_ultima_interacao ? new Date(lead.data_ultima_interacao).toLocaleDateString() : 'Nunca'}
                                            </td>
                                            <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <a href={`/chat?lead=${lead.id}`} className="text-neon-blue hover:text-white font-semibold transition-colors">Abrir Chat</a>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="px-8 py-4 border-t border-navy-700 bg-navy-800/50 flex items-center justify-between">
                        <span className="text-sm text-slate-400">
                            Mostrando <span className="text-white font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> de <span className="text-white font-medium">{filteredLeads.length}</span> leads
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-navy-700 text-slate-300 rounded-lg hover:bg-navy-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-slate-400 px-2">
                                Página {currentPage} de {Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLeads.length / itemsPerPage)))}
                                disabled={currentPage >= Math.ceil(filteredLeads.length / itemsPerPage)}
                                className="px-3 py-1 bg-navy-700 text-slate-300 rounded-lg hover:bg-navy-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                            >
                                Próximo
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
