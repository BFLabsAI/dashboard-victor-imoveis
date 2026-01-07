export interface Lead {
    id: string;
    lead_name: string | null;
    telefone: string | null;
    status_lead: string | null;

    // New fields from DB
    tipo_procedimento: string | null;
    urgencia_caso: string | null;
    horario_preferencia: string | null;
    tem_convenio: boolean | null;
    observacoes_clinicas: string | null;
    endereco: string | null;
    cpf: string | null;

    // Existing fields present in DB or managed by app
    etapa_follow: string | null;
    dia_cadencia?: string | null;
    data_ultima_interacao: string | null;
    created_at: string;
    metadata?: any;
    atendimento_humano?: boolean | null;

    // Removed/Mapped fields (kept temporary for compatibility if needed, but removing based on plan)
    // produtos_interesse removed -> use tipo_procedimento
    // setor_principal removed
    // faixa_etaria removed
    // observacoes removed -> use observacoes_clinicas
}

export interface ChatMessage {
    type: 'human' | 'ai';
    content: string;
}

export interface ChatHistory {
    id: number;
    session_id: string;
    message: ChatMessage;
    created_at?: string;
}
export interface RepassadoLead {
    id: string;
    lead_name: string | null;
    telefone: string | null;
    status_lead: string | null;
    etapa_follow: string | null;
    tipo_procedimento: string | null;
    urgencia_caso: string | null;
    horario_preferencia: string | null;
    tem_convenio: boolean | null;
    observacoes_clinicas: string | null;
    data_ultima_interacao: string | null;
    created_at: string;
    dia_cadencia?: string | null;
    metadata?: any;
    endereco?: string | null;
    cpf?: string | null;
}
