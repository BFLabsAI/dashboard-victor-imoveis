import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { Save, Bell, Smartphone, Key, Server, FileText, Clock, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Settings() {
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        id: '',
        instance_name: '',
        uazapi_instance: '',
        uazapi_api_key: '',
        notification_number: '',
        server_url: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            const { data, error } = await supabase
                .from('instancias_imobiliaria_rogaciano')
                .select('*')
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const record = data[0];
                setSettings({
                    id: record.id,
                    instance_name: record.instancia || '',
                    uazapi_instance: record.instancia || '',
                    uazapi_api_key: record.api_key || '',
                    notification_number: record.notification_number || '',
                    server_url: record.server_url || 'https://api.bflabs.com.br'
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                instancia: settings.instance_name,
                api_key: settings.uazapi_api_key,
                notification_number: settings.notification_number
            };

            let error;
            if (settings.id) {
                const { error: updateError } = await supabase
                    .from('instancias_imobiliaria_rogaciano')
                    .update(payload)
                    .eq('id', settings.id);
                error = updateError;
            } else {
                // For insert, we need all required fields
                const insertPayload = {
                    ...payload,
                    server_url: 'https://api2.bflabs.com.br',
                    status: 'ativo'
                };
                const { error: insertError } = await supabase
                    .from('instancias_imobiliaria_rogaciano')
                    .insert([insertPayload]);
                error = insertError;
            }

            if (error) throw error;
            alert('Configurações salvas com sucesso!');
            fetchSettings(); // Refresh to get ID if new
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Erro ao salvar configurações.');
        } finally {
            setSaving(false);
        }
    }

    async function sendTestReport(type: 'Diário' | 'Semanal') {
        if (!settings.uazapi_instance || !settings.uazapi_api_key || !settings.notification_number) {
            alert('Por favor, configure a instância, chave API e número de notificação primeiro.');
            return;
        }

        try {
            // Fortaleza timezone is UTC-3 (no daylight saving)
            // We'll calculate dates directly and format them correctly

            const now = new Date();
            let dateRangeStr: string;

            if (type === 'Diário') {
                // YESTERDAY in Fortaleza timezone: 00:00 to 23:59
                // Report is sent at 6AM, so we want the previous day's complete data

                // Get yesterday's date in Fortaleza
                const yesterdayFortaleza = new Date(now.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
                yesterdayFortaleza.setDate(yesterdayFortaleza.getDate() - 1);

                // Format the display date (DD/MM/YYYY)
                const day = String(yesterdayFortaleza.getDate()).padStart(2, '0');
                const month = String(yesterdayFortaleza.getMonth() + 1).padStart(2, '0');
                const year = yesterdayFortaleza.getFullYear();
                dateRangeStr = `${day}/${month}/${year}`;


            } else {
                // Last Week (Monday to Sunday) in Fortaleza timezone
                const nowFortaleza = new Date(now.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
                const dayOfWeek = nowFortaleza.getDay(); // 0 = Sunday, 1 = Monday

                const lastSunday = new Date(nowFortaleza);
                lastSunday.setDate(nowFortaleza.getDate() - (dayOfWeek === 0 ? 7 : dayOfWeek));

                const lastMonday = new Date(lastSunday);
                lastMonday.setDate(lastSunday.getDate() - 6);

                // Format display dates
                const startDay = String(lastMonday.getDate()).padStart(2, '0');
                const startMonth = String(lastMonday.getMonth() + 1).padStart(2, '0');
                const endDay = String(lastSunday.getDate()).padStart(2, '0');
                const endMonth = String(lastSunday.getMonth() + 1).padStart(2, '0');
                const year = lastMonday.getFullYear();
                dateRangeStr = `${startDay}/${startMonth}/${year} a ${endDay}/${endMonth}/${year}`;

            }

            // Calculate date parameters for RPC function (YYYY-MM-DD format)
            let startDateStr: string;
            let endDateStr: string;

            if (type === 'Diário') {
                // Single day - yesterday
                startDateStr = dateRangeStr.split('/').reverse().join('-'); // DD/MM/YYYY -> YYYY-MM-DD
                endDateStr = startDateStr;
            } else {
                // Week range
                startDateStr = dateRangeStr.split(' a ')[0].split('/').reverse().join('-');
                endDateStr = dateRangeStr.split(' a ')[1].split('/').reverse().join('-');
            }

            // Call RPC function that handles timezone conversion properly in SQL
            const { data: reportData, error: reportError } = await supabase
                .rpc('get_report_stats', {
                    p_start_date: startDateStr,
                    p_end_date: endDateStr
                });

            if (reportError) throw reportError;

            const stats = reportData?.[0] || { new_leads: 0, contacted: 0, repassado: 0, cadence_breakdown: {} };

            // Format Cadence String from JSONB
            let cadenceString = '';
            const cadenceBreakdown = stats.cadence_breakdown || {};
            Object.entries(cadenceBreakdown)
                .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
                .forEach(([day, count]) => {
                    cadenceString += `- ${day}: ${count}\n`;
                });

            // Construct Message
            const message = `📊 *Relatório ${type}*\n` +
                `📅 Período: ${dateRangeStr}\n\n` +
                `🆕 *Novos Leads:* ${stats.new_leads}\n` +
                `💬 *Total Contactados:* ${stats.contacted}\n` +
                `🔄 *Total Repasse:* ${stats.repassado}\n\n` +
                `📉 *Por Dia da Cadência:*\n${cadenceString || 'Nenhum dado'}`;

            // Send API Request via Supabase Edge Function (CORS proxy)
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iixeygzkgfwetchjvpvo.supabase.co';
            const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-whatsapp`;

            console.log('Sending report via Edge Function:', edgeFunctionUrl);
            console.log('Report Content:', message);

            const response = await fetch(edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    serverUrl: settings.server_url,
                    instanceName: settings.instance_name,
                    number: settings.notification_number,
                    text: message,
                    apiKey: settings.uazapi_api_key
                })
            });

            const responseText = await response.text();
            console.log('API Response Status:', response.status);
            console.log('API Response Body:', responseText);

            if (!response.ok) {
                throw new Error(`API Error ${response.status}: ${responseText}`);
            }

            const data = JSON.parse(responseText);
            if (data.error) throw new Error(data.error);

            alert(`Relatório ${type} enviado com sucesso!`);
        } catch (error) {
            console.error('Error sending report:', error);
            alert(`Erro ao enviar relatório: ${(error as Error).message}`);
        }
    }

    return (
        <Layout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Configurações</h1>
                    <p className="mt-2 text-slate-400">Gerencie as preferências do sistema e notificações.</p>
                </div>

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Notifications Section */}
                    <div className="bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-navy-700 bg-navy-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-navy-700 rounded-lg text-neon-blue">
                                    <Bell size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Notificações Automáticas</h3>
                                    <p className="text-sm text-slate-400">Configure o número para recebimento dos relatórios.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                                    <Smartphone size={16} className="text-neon-blue" />
                                    Número WhatsApp (com DDI)
                                </label>
                                <input
                                    type="text"
                                    value={settings.notification_number}
                                    onChange={(e) => setSettings({ ...settings, notification_number: e.target.value })}
                                    placeholder="Ex: 5511999999999"
                                    className="w-full px-4 py-3 bg-navy-900 border border-navy-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Uazapi Integration Section */}
                    <div className="bg-navy-800 rounded-3xl border border-navy-700 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-navy-700 bg-navy-800/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-navy-700 rounded-lg text-purple-400">
                                    <Server size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Integração Uazapi</h3>
                                    <p className="text-sm text-slate-400">Credenciais para envio de mensagens via WhatsApp.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Instance Name */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">
                                        Nome da Instância
                                    </label>
                                    <div className="relative">
                                        <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            value={settings.instance_name || ''}
                                            onChange={(e) => setSettings({ ...settings, instance_name: e.target.value })}
                                            placeholder="ex: dra-aline-instance"
                                            className="w-full pl-12 pr-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Uazapi API Key */}
                                <div>
                                    <label className="block text-sm font-bold text-white mb-2">
                                        Chave API Uazapi
                                    </label>
                                    <div className="relative">
                                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                        <input
                                            type="password"
                                            value={settings.uazapi_api_key || ''}
                                            onChange={(e) => setSettings({ ...settings, uazapi_api_key: e.target.value })}
                                            placeholder="Sua chave API"
                                            className="w-full pl-12 pr-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-neon-blue transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-8 py-3 bg-neon-blue text-navy-900 rounded-xl font-bold hover:bg-white hover:shadow-neon transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={20} />
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Test Reports Section */}
            <div className="bg-navy-800 rounded-3xl p-8 border border-navy-700 shadow-xl mt-8">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-navy-700 rounded-xl">
                        <FileText className="text-neon-purple" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Teste de Relatórios</h2>
                        <p className="text-slate-400 text-sm">Dispare manualmente os relatórios para testar o envio via WhatsApp.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button
                        onClick={() => sendTestReport('Diário')}
                        className="flex items-center justify-center gap-3 p-4 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-xl transition-all group"
                    >
                        <div className="p-2 bg-navy-800 rounded-lg group-hover:bg-navy-700 transition-colors">
                            <Clock className="text-neon-blue" size={20} />
                        </div>
                        <span className="font-medium text-slate-200 group-hover:text-white">Testar Relatório Diário</span>
                    </button>

                    <button
                        onClick={() => sendTestReport('Semanal')}
                        className="flex items-center justify-center gap-3 p-4 bg-navy-700 hover:bg-navy-600 border border-navy-600 rounded-xl transition-all group"
                    >
                        <div className="p-2 bg-navy-800 rounded-lg group-hover:bg-navy-700 transition-colors">
                            <Calendar className="text-neon-purple" size={20} />
                        </div>
                        <span className="font-medium text-slate-200 group-hover:text-white">Testar Relatório Semanal</span>
                    </button>
                </div>
            </div>
        </Layout>
    );
}
