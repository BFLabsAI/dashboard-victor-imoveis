import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { KPICard } from '../components/KPICard';
import { StatusChart } from '../components/charts/StatusChart';

import { CadenceVolumeChart } from '../components/charts/CadenceVolumeChart';
import { Users, UserCheck, MessageCircle, Calendar, Download, BarChart2, Filter, X } from 'lucide-react';
import type { Lead } from '../types';
import { format, subDays, isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BF3', '#F472B6', '#6366F1', '#EC4899', '#10B981', '#F59E0B'];

// Helper to normalize property names
function normalizeProperty(name: string | null): string {
    if (!name) return 'Não Informado';

    const lower = name.toLowerCase().trim();

    // Aura
    if (lower.includes('aura')) return 'Aura';

    // Beach Class
    if (lower.includes('cumbuco')) return 'Beach Class Cumbuco';
    if (lower.includes('porto das dunas') || lower.includes('pdd')) return 'Beach Class Porto das Dunas';
    if (lower.includes('unique') || lower.includes('meireles') && lower.includes('beach')) return 'Beach Class Unique';

    // Biosphere
    if (lower.includes('biosphere')) return 'Biosphere';

    // Bosque da Cidade
    if (lower.includes('bosque')) return 'Bosque da Cidade';

    // Casa Macedo / Manção Macedo
    if (lower.includes('macedo') || lower.includes('macêdo')) return 'Casa Macedo';

    // Casa Mauá
    if (lower.includes('maua') || lower.includes('mauá')) return 'Casa Mauá';

    // Infinity
    if (lower.includes('infinity')) return 'Infinity';

    // Mood
    if (lower.includes('mood')) return 'Mood Club';

    // Signa
    if (lower.includes('signa')) return 'Signa';

    // Tribeca
    if (lower.includes('tribeca')) return 'Tribeca';

    // Ihome
    if (lower.includes('ihome')) return 'Ihome';

    // J.Smart
    if (lower.includes('j.smart') || lower.includes('praça da imprensa')) return 'J.Smart';

    // Clean up basic formatting issues for others
    return name.trim().replace(/^[0-9]\s*-\s*/, '').replace(/-copy$/, '');
}

// Status-specific colors for the Status Chart
const STATUS_COLORS: Record<string, string> = {
    'novo lead': '#3B82F6',      // Blue - new/fresh
    'repassado': '#10B981',       // Green - success/forwarded
    'agendamento futuro': '#F59E0B', // Amber - scheduled/pending
    'suporte': '#8B5CF6',         // Purple - support/help
    'indefinido': '#6B7280'       // Gray - undefined
};



export function Dashboard() {
    const [leads, setLeads] = useState<Lead[]>([]);
    // Repassados are now derived from leads, not a separate state from DB
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Table Filter States
    const [showFilters, setShowFilters] = useState(false);
    const [tableSearchName, setTableSearchName] = useState('');
    const [tableSearchPhone, setTableSearchPhone] = useState('');
    const [tableFilterCadencia, setTableFilterCadencia] = useState('');

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
            await fetchLeads();
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchLeads() {
        try {
            let query = supabase
                .from('leads_imobiliaria_rogaciano')
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



    // Filter leads by date
    const filteredLeads = leads.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = parseISO(lead.created_at);
        const start = startOfDay(parseISO(dateRange.start));
        const end = endOfDay(parseISO(dateRange.end));
        return isWithinInterval(leadDate, { start, end });
    });

    // Filtered leads for table (with additional search filters)
    const tableFilteredLeads = filteredLeads.filter(lead => {
        const name = (lead.lead_name || '').toLowerCase();
        const phone = (lead.telefone || '').replace(/\D/g, '');
        const cadencia = (lead.dia_cadencia || '').toString().toLowerCase();
        // Extrai apenas o número da cadência (ex: "dia 1" -> "1", "1" -> "1")
        const cadenciaNum = cadencia.replace(/\D/g, '');

        if (tableSearchName && !name.includes(tableSearchName.toLowerCase())) return false;
        if (tableSearchPhone && !phone.includes(tableSearchPhone.replace(/\D/g, ''))) return false;
        if (tableFilterCadencia && cadenciaNum !== tableFilterCadencia) return false;

        return true;
    });

    // Filter repassados by date (same logic)
    // We now derive repassados from the filtered leads
    const filteredRepassados = filteredLeads.filter(lead => lead.status_lead === 'repassado');

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
    // Requirement: Status Chart must use leads_imobiliaria_rogaciano and derived repassados
    // We will count 'repassado' from the repassados table, and other statuses from the leads table.

    // 1. Get non-repassed status counts from leads table
    const leadStatusCounts = filteredLeads.reduce((acc, lead) => {
        const status = (lead.status_lead || 'Indefinido').toLowerCase();
        if (status !== 'repassado') {
            acc[status] = (acc[status] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    // 2. Add repassed count logic is no longer needed separate as they are in leads
    // But we ensure 'repassado' key exists if there are repassed leads
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
                        <p className="text-slate-400 text-sm">Bem-vindo ao Dashboard Vitor Barros Imoveis</p>
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


                    {/* Top Imóveis de Interesse */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Calendar className="text-pink-400" size={20} />
                            Top 3 Imóveis de Interesse
                        </h3>
                        <div className="flex items-center justify-center h-[300px]">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={(() => {
                                            // Helper to normalize property names
                                            function normalizeProperty(name: string | null): string {
                                                if (!name) return 'Indefinido';

                                                const lower = name.toLowerCase().trim();

                                                // Aura
                                                if (lower.includes('aura')) return 'Aura';

                                                // Beach Class
                                                if (lower.includes('cumbuco')) return 'BC Cumbuco';
                                                if (lower.includes('porto das dunas') || lower.includes('pdd')) return 'BC Porto das Dunas';
                                                if (lower.includes('unique') || (lower.includes('meireles') && lower.includes('beach'))) return 'BC Unique';

                                                // Biosphere
                                                if (lower.includes('biosphere')) return 'Biosphere';

                                                // Bosque da Cidade
                                                if (lower.includes('bosque')) return 'Bosque da Cidade';

                                                // Casa Macedo / Manção Macedo
                                                if (lower.includes('macedo') || lower.includes('macêdo')) return 'Casa Macedo';

                                                // Casa Mauá
                                                if (lower.includes('maua') || lower.includes('mauá')) return 'Casa Mauá';

                                                // Infinity
                                                if (lower.includes('infinity')) return 'Infinity';

                                                // Mood
                                                if (lower.includes('mood')) return 'Mood Club';

                                                // Signa
                                                if (lower.includes('signa')) return 'Signa';

                                                // Tribeca
                                                if (lower.includes('tribeca')) return 'Tribeca';

                                                // Ihome
                                                if (lower.includes('ihome')) return 'Ihome';

                                                // J.Smart
                                                if (lower.includes('j.smart') || lower.includes('praça da imprensa')) return 'J.Smart';

                                                // Clean up basic formatting issues for others
                                                return name.trim().replace(/^[0-9]\s*-\s*/, '').replace(/-copy$/, '');
                                            }
                                            const propertyCounts = filteredLeads.reduce((acc, lead) => {
                                                const property = normalizeProperty(lead.imovel_interesse);
                                                acc[property] = (acc[property] || 0) + 1;
                                                return acc;
                                            }, {} as Record<string, number>);

                                            // Sort by count descending, filter out 'Indefinido', and take top 3
                                            const sortedEntries = Object.entries(propertyCounts)
                                                .filter(([name]) => name !== 'Indefinido')
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 3);

                                            return sortedEntries.map(([name, value]) => ({ name, value }));
                                        })()}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => {
                                            const nameStr = name || '';
                                            // Increased limit to 20 chars to fit "BC Porto das Dunas"
                                            return `${nameStr.length > 20 ? nameStr.substring(0, 18) + '...' : nameStr} ${((percent || 0) * 100).toFixed(0)}%`;
                                        }}
                                    >
                                        {(() => {
                                            const propertyCounts = filteredLeads.reduce((acc, lead) => {
                                                const property = normalizeProperty(lead.imovel_interesse);
                                                acc[property] = (acc[property] || 0) + 1;
                                                return acc;
                                            }, {} as Record<string, number>);

                                            const sortedEntries = Object.entries(propertyCounts)
                                                .sort(([, a], [, b]) => b - a)
                                                .slice(0, 3);

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

                    {/* Volume por Etapa de Follow-up */}
                    <div className="bg-navy-800 p-6 rounded-3xl border border-navy-700 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                            <span className="w-1 h-6 bg-purple-500 rounded-full mr-3"></span>
                            Volume por Etapa de Follow-up
                        </h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <BarChart
                                    data={[
                                        {
                                            name: 'Follow 1',
                                            value: filteredLeads.filter(l => l.etapa_follow?.toLowerCase() === 'follow 1').length,
                                            fill: '#3B82F6' // Blue
                                        },
                                        {
                                            name: 'Follow 2',
                                            value: filteredLeads.filter(l => l.etapa_follow?.toLowerCase() === 'follow 2').length,
                                            fill: '#8B5CF6' // Purple
                                        },
                                        {
                                            name: 'Repassado',
                                            value: filteredRepassados.length,
                                            fill: '#10B981' // Green
                                        }
                                    ]}
                                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                                    <XAxis dataKey="name" stroke="#9CA3AF" />
                                    <YAxis stroke="#9CA3AF" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px' }}
                                        itemStyle={{ color: '#f8fafc' }}
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                                        {
                                            [
                                                { name: 'Follow 1', fill: '#3B82F6' },
                                                { name: 'Follow 2', fill: '#8B5CF6' },
                                                { name: 'Repassado', fill: '#10B981' }
                                            ].map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))
                                        }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Recent Leads Table */}
                <div className="bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden">
                    <div className="px-8 py-6 border-b border-navy-700 flex flex-col gap-4 bg-navy-800/50">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-lg font-bold text-white">Leads Recentes</h3>
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${showFilters ? 'bg-neon-blue/20 text-neon-blue border-neon-blue/30' : 'bg-navy-800 text-slate-300 border-navy-700 hover:bg-navy-700 hover:text-white'}`}
                                >
                                    <Filter size={16} /> Filtrar
                                </button>
                            </div>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-slate-300 rounded-lg hover:bg-navy-700 hover:text-white transition-colors text-sm font-medium border border-navy-700"
                            >
                                <Download size={16} /> Exportar CSV
                            </button>
                        </div>
                        {/* Filtros */}
                        {showFilters && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-navy-900/50 rounded-xl border border-navy-700">
                                <input
                                    type="text"
                                    placeholder="Buscar por nome..."
                                    value={tableSearchName}
                                    onChange={(e) => { setTableSearchName(e.target.value); setCurrentPage(1); }}
                                    className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue"
                                />
                                <input
                                    type="text"
                                    placeholder="Buscar por telefone..."
                                    value={tableSearchPhone}
                                    onChange={(e) => { setTableSearchPhone(e.target.value); setCurrentPage(1); }}
                                    className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue"
                                />
                                <select
                                    value={tableFilterCadencia}
                                    onChange={(e) => { setTableFilterCadencia(e.target.value); setCurrentPage(1); }}
                                    className="px-4 py-2 bg-navy-900 border border-navy-700 rounded-lg text-sm text-white focus:outline-none focus:border-neon-blue"
                                >
                                    <option value="">Todos os dias</option>
                                    <option value="1">Dia 1</option>
                                    <option value="2">Dia 2</option>
                                    <option value="3">Dia 3</option>
                                    <option value="4">Dia 4</option>
                                    <option value="5">Dia 5</option>
                                    <option value="6">Dia 6</option>
                                    <option value="7">Dia 7</option>
                                </select>
                                <button
                                    onClick={() => { setTableSearchName(''); setTableSearchPhone(''); setTableFilterCadencia(''); setCurrentPage(1); }}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-navy-700 text-slate-300 rounded-lg hover:bg-red-600 hover:text-white text-sm transition-colors"
                                >
                                    <X size={16} /> Limpar
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-navy-700">
                            <thead className="bg-navy-900">
                                <tr>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Imóvel de Interesse</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Dia Cadência</th>
                                    <th className="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Última Interação</th>
                                    <th className="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-navy-800 divide-y divide-navy-700">
                                {tableFilteredLeads
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
                                                {lead.imovel_interesse || 'Sem interesse'}
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
                                            <td className="px-8 py-4 whitespace-nowrap text-sm text-slate-400">
                                                {lead.dia_cadencia || '-'}
                                            </td>
                                            <td className="px-8 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {lead.data_ultima_interacao ? new Date(lead.data_ultima_interacao).toLocaleDateString('pt-BR') : 'Nunca'}
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
                            Mostrando <span className="text-white font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a <span className="text-white font-medium">{Math.min(currentPage * itemsPerPage, tableFilteredLeads.length)}</span> de <span className="text-white font-medium">{tableFilteredLeads.length}</span> leads
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
                                Página {currentPage} de {Math.max(1, Math.ceil(tableFilteredLeads.length / itemsPerPage))}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(tableFilteredLeads.length / itemsPerPage)))}
                                disabled={currentPage >= Math.ceil(tableFilteredLeads.length / itemsPerPage)}
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
