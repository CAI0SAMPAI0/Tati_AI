-- ═══════════════════════════════════════════════════════════════
-- Migração 005 - Tabela de Simulações (Cenários de Conversação)
-- ═══════════════════════════════════════════════════════════════

-- Tabela de cenários de simulação para prática de inglês
CREATE TABLE IF NOT EXISTS simulations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE, -- identificador amigável para saudações específicas
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '💬',
    difficulty TEXT NOT NULL DEFAULT 'beginner', -- beginner, intermediate, advanced
    system_prompt TEXT NOT NULL, -- prompt que define o comportamento do bot
    greeting TEXT, -- saudação inicial personalizada (opcional)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_simulations_active ON simulations(is_active);
CREATE INDEX IF NOT EXISTS idx_simulations_difficulty ON simulations(difficulty);
CREATE INDEX IF NOT EXISTS idx_simulations_slug ON simulations(slug);

-- RLS Policies
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

-- Todos podem ler cenários ativos (para alunos)
CREATE POLICY "Cenários ativos são públicos para leitura" ON simulations
    FOR SELECT USING (is_active = TRUE);

-- Apenas usuários autenticados podem ver todos (professores/admins)
CREATE POLICY "Usuários autenticados podem ver todos os cenários" ON simulations
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Apenas admins/instrutores podem inserir/editar
CREATE POLICY "Instrutores podem gerenciar cenários" ON simulations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.username = auth.uid()::text
            AND users.is_admin = TRUE
        )
    );

-- Comentários
COMMENT ON TABLE simulations IS 'Cenários de simulação para prática de conversação em inglês';
COMMENT ON COLUMN simulations.slug IS 'Identificador amigável usado para mapear saudações específicas no frontend';
COMMENT ON COLUMN simulations.system_prompt IS 'Prompt que define o comportamento e personalidade do bot na simulação';
COMMENT ON COLUMN simulations.greeting IS 'Saudação inicial personalizada exibida ao iniciar a simulação';

-- ── Inserir cenários padrão ────────────────────────────────────────────────────
INSERT INTO simulations (name, slug, description, icon, difficulty, system_prompt, greeting)
SELECT name, slug, description, icon, difficulty, system_prompt, greeting FROM (
    VALUES
    (
        'No Aeroporto',
        'airport',
        'Pratique check-in, segurança e embarque',
        '✈️',
        'beginner',
        'You are a friendly airport check-in agent at JFK Airport. Help the student check in for their flight. Ask for their passport and ticket. Ask if they have bags to check. Keep sentences simple and natural. Be patient and encouraging.',
        'Good morning! Welcome to JFK Airport. May I see your passport and ticket, please?'
    ),
    (
        'No Restaurante',
        'restaurant',
        'Faça pedidos e interaja com garçons',
        '🍽️',
        'beginner',
        'You are a friendly waiter at Mario''s Italian Restaurant. Greet the student and ask if they want to see the menu. Take their order for drinks and food. Suggest specials. Keep conversation natural and simple.',
        'Good evening! Welcome to Mario''s Restaurant. Can I get you started with something to drink?'
    ),
    (
        'Consulta Médica',
        'doctor',
        'Descreva sintomas e receba orientações',
        '🏥',
        'intermediate',
        'You are Dr. Smith, a general practitioner. Ask the student about their symptoms. Ask follow-up questions about duration, severity, and other health factors. Provide reassurance and advice. Use clear, simple medical terms.',
        'Hi, I''m Dr. Smith. What brings you in today?'
    ),
    (
        'Entrevista de Emprego',
        'job_interview',
        'Simule uma entrevista profissional',
        '💼',
        'advanced',
        'You are a hiring manager conducting a job interview. Ask the student about their background, strengths, weaknesses, and why they want this position. Challenge them with follow-up questions. Be professional but friendly.',
        'Good morning! Thanks for coming in. Tell me a bit about yourself.'
    ),
    (
        'Compras na Loja',
        'shopping',
        'Interaja com vendedores em lojas',
        '🛍️',
        'beginner',
        'You are a helpful sales assistant at a clothing store. Greet the student and ask if they need help finding anything. Suggest items on sale. Offer to help with sizes. Keep conversation light and friendly.',
        'Hi! Welcome to our store. Looking for anything specific?'
    ),
    (
        'Check-in no Hotel',
        'hotel',
        'Pratique check-in e solicite serviços',
        '🏨',
        'beginner',
        'You are a receptionist at the Oceanview Hotel. Help the student check in. Ask for their reservation name. Offer breakfast options. Provide information about hotel amenities. Be welcoming and professional.',
        'Good afternoon! Welcome to the Oceanview Hotel. Checking in?'
    )
) AS t(name, slug, description, icon, difficulty, system_prompt, greeting)
WHERE NOT EXISTS (SELECT 1 FROM simulations WHERE simulations.name = t.name);
