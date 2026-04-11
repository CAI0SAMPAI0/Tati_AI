const TRANSLATIONS = {
  'pt-BR': {
    // ── Global / Nav ──────────────────────────────────────────────
    'nav.chat':           'Chat',
    'nav.dashboard':      'Painel',
    'nav.settings':       'Configurações',
    'nav.profile':        'Perfil',
    'nav.logout':         'Sair',
    'nav.back_chat':      'Voltar ao Chat',
    'nav.new_chat':       'Nova conversa',
    'nav.delete_all':     'Deletar todas as conversas',
 
    // ── Auth ──────────────────────────────────────────────────────
    'auth.welcome':           'Bem-vindo',
    'auth.subtitle':          'Entre na sua conta ou crie uma nova',
    'auth.tab_login':         'Entrar',
    'auth.tab_register':      'Criar Conta',
    'auth.username_email':    'Username ou E-mail',
    'auth.password':          'Senha',
    'auth.name':              'Nome completo',
    'auth.email':             'E-mail',
    'auth.username':          'Username',
    'auth.level':             'Nível de inglês',
    'auth.btn_login':         'Entrar',
    'auth.btn_register':      'Criar Conta',
    'auth.btn_google':        'Continuar com Google',
    'auth.or':                'ou',
    'auth.logging_in':        'Entrando...',
    'auth.registering':       'Criando conta...',
    'auth.success_register':  'Conta criada! Faça login agora.',
    'auth.err_fields':        'Preencha todos os campos.',
    'auth.err_password':      'Senha deve ter pelo menos 6 caracteres.',
    'auth.err_connection':    'Erro de conexão. Verifique se o servidor está rodando.',
    'auth.err_email':         'E-mail já registrado. Faça login ou use outro e-mail.',
    'auth.err_username':      'Username já registrado. Escolha outro.',
    'auth.senha_esqueci':     'Esqueci minha senha',
    'auth.exp_img':           'Sua professora de inglês com inteligência artificial. Pratique quando quiser, no seu ritmo.',
    'auth.esq_senha':         '🔑 Esqueci minha senha',
    'auth.back_login':        '← Voltar ao login',
    'auth.informar_user':     'Informe seu username ou e-mail. Vamos gerar uma senha temporária e enviar para você.',
    'auth_send_temp':         'Enviar senha temporária',
 
    // ── Chat ──────────────────────────────────────────────────────
    'chat.title':           'Teacher Tati',
    'chat.welcome_title':   'Olá! Eu sou a Teacher Tati 👋',
    'chat.welcome_sub':     'Sua professora de inglês com IA. Vamos praticar juntos?',
    'chat.welcome_tip':     '💡 Clique em qualquer palavra inglesa para ver tradução e ouvir a pronúncia',
    'chat.sugg_1':          'How do I introduce myself?',
    'chat.sugg_2':          'Correct my English, please',
    'chat.sugg_3':          "Let's practice conversation",
    'chat.sugg_4':          'Explain past tense to me',
    'chat.placeholder':     'Digite sua mensagem em inglês...',
    'chat.hint':            'Teacher Tati pratica inglês com você · Enter para enviar · Shift+Enter para nova linha',
    'chat.voice_mode':      'Modo Voz',
    'chat.summary_mode':    'Modo Resumo',
    'chat.loading':         'Carregando...',
    'chat.no_convs':        'Nenhuma conversa ainda',
    'chat.today':           'Hoje',
    'chat.yesterday':       'Ontem',
    'chat.older':           'Anteriores',
    'chat.delete_conv':     'Deletar esta conversa?',
    'chat.delete_all_conv': '⚠️ Deletar TODAS as conversas?',
    'chat.confirm':         'Confirmar',
    'chat.cancel':          'Cancelar',
    'chat.err_connect':     'Não foi possível conectar ao servidor.',
    'chat.err_unknown':     'Erro desconhecido',
    'chat.attach':          'Anexar arquivo',
    'chat.record':          'Gravar áudio',
    'chat.send':            'Enviar',
    'chat.new_conv':        'Nova conversa',
    'chat.delete_all_title':'Deletar todas',
    'chat.sidebar_toggle':  'Menu',
 
    // ── Settings ──────────────────────────────────────────────────
    'settings.title':        'Configurações',
    'settings.appearance':   'Aparência',
    'settings.theme':        'Tema',
    'settings.theme_desc':   'Escolha entre modo claro e escuro',
    'settings.dark':         'Escuro',
    'settings.light':        'Claro',
    'settings.language':     'Idioma da interface',
    'settings.language_desc':'Idioma dos botões e textos do app',
    'settings.audio':        'Áudio',
    'settings.speed':        'Velocidade padrão',
    'settings.speed_desc':   'Velocidade de reprodução das respostas em áudio',
    'settings.chat':         'Chat',
    'settings.tooltip':      'Tooltip de palavras',
    'settings.tooltip_desc': 'Clique em palavras inglesas para ver tradução e pronúncia',
    'settings.enter_send':   'Enviar com Enter',
    'settings.enter_desc':   'Enter envia a mensagem (Shift+Enter para nova linha)',
    'settings.save':         'Salvar Alterações',
    'settings.saved':        '✅ Salvo!',
    'settings.auto_play':    'Reprodução automática',
    'settings.auto_play_desc':'Reproduzir áudio das respostas automaticamente',
    'settings.senha_nova': 'Preencha apenas se quiser alterar sua senha. Deixe em branco para manter a atual.',
 
    // ── Profile ───────────────────────────────────────────────────
    'profile.title':         'Meu Perfil',
    'profile.personal':      'Informações Pessoais',
    'profile.full_name':     'Nome completo',
    'profile.nickname':      'Apelido',
    'profile.nickname_ph':   'Como prefere ser chamado',
    'profile.email':         'E-mail',
    'profile.occupation':    'Profissão',
    'profile.occupation_ph': 'Ex: Desenvolvedor, Estudante...',
    'profile.study':         'Preferências de Estudo',
    'profile.level':         'Nível de inglês',
    'profile.focus':         'Foco de aprendizado',
    'profile.save':          'Salvar alterações',
    'profile.saving':        'Salvando...',
    'profile.saved':         'Perfil atualizado com sucesso! ✓',
    'profile.security':      'Segurança',
    'profile.current_pw':    'Senha atual',
    'profile.new_pw':        'Nova senha',
    'profile.new_pw_ph':     'mínimo 6 caracteres',
    'profile.update_pw':     'Atualizar senha',
    'profile.change_photo':  'Trocar foto',
    'profile.danger':        'Zona de Perigo',
    'profile.danger_desc':   'Estas ações são irreversíveis. Prossiga com cuidado.',
    'profile.msgs':          'Mensagens',
    'profile.convs':         'Conversas',
    'profile.days':          'Dias ativo',
    'profile.pw_hint':       'Preencha apenas se quiser alterar sua senha.',
    'profile.logout':        'Sair da conta',
 
    // ── Dashboard — geral ─────────────────────────────────────────
    'dash.overview':         'Visão Geral',
    'dash.overview_sub':     'Resumo da plataforma',
    'dash.students':         'Alunos',
    'dash.students_sub':     'Gerenciamento de alunos',
    'dash.reports':          'Relatórios',
    'dash.reports_sub':      'Visão geral e métricas da turma',
    'dash.go_chat':          'Ir ao Chat',
    'dash.total_students':   'Total de Alunos',
    'dash.total_msgs':       'Total de Mensagens',
    'dash.active_today':     'Ativos Hoje',
    'dash.recent':           'Alunos Recentes',
    'dash.see_all':          'Ver todos →',
    'dash.all_students':     'Todos os Alunos',
    'dash.search_ph':        'Pesquisar aluno...',
    'dash.no_students':      'Nenhum aluno encontrado.',
    'dash.active':           '↑ Ativo',
    'dash.hoje':             'Hoje',
    'dash.alertas':          'Alertas de Dificuldade da Turma',
    'dash.aluno_alertas':    '🧑‍🎓 Aluno',
    'dash.aten_alertas':     '⚠️ Foco de atenção',
    'dash.loading':          'Carregando...',
    'dash.no_alerts':        'Nenhum aluno com dificuldade registrada.',
 
    // ── Dashboard — tabela alunos ─────────────────────────────────
    'dash.col_student':      'Aluno',
    'dash.col_level':        'Nível',
    'dash.col_focus':        'Foco',
    'dash.col_last':         'Último acesso',
    'dash.col_msgs':         'Msgs',
    'dash.col_since':        'Cadastro',
 
    // ── Dashboard — modal aluno ───────────────────────────────────
    'dash.edit':             '✏️ Editar',
    'dash.prompt':           '🧩 Prompt',
    'dash.insight':          '🧠 Insight',
    'dash.interests':        '🎯 Interesses',
    'dash.save_level':       'Salvar nível',
    'dash.save_prompt':      'Salvar prompt',
    'dash.clear_prompt':     'Limpar prompt',
    'dash.generate_insight': '🧠 Gerar Insight',
    'dash.regenerate':       '🔄 Gerar Novamente',
    'dash.analyzing':        '⏳ Analisando...',
    'dash.delete_student':   'Excluir aluno',
    'dash.confirm_delete':   'Excluir',
    'dash.level_updated':    '✓ Nível atualizado com sucesso!',
    'dash.prompt_saved':     '✓ Prompt salvo! Entrará em vigor na próxima mensagem.',
    'dash.err_save':         '✗ Erro ao salvar. Tente novamente.',
    'dash.prompt_hint':      'Adicione instruções extras para a Tati seguir <strong>somente com este aluno</strong>.',
    'dash.grammar_errors':   'Erros Gramaticais',
    'dash.mapping_errors':   'Mapeando erros gramaticais recorrentes...',
    'dash.no_grammar_errors':'Sem erros detectados nas últimas mensagens analisadas.',
    'dash.exemples':         'Exemplo',
    'dash.click':            'Clique em 🧠 Gerar Insight para analisar o histórico ou em Erros Gramaticais para ver erros recorrentes.',
    'dash.interests_hint':   'A IA analisará o histórico para mapear hobbies e sugerir planos de estudo.',
    'dash.analyze_interests':'🎯 Analisar Interesses',
    'dash.redo_analysis':    '🎯 Refazer Análise',
    'dash.interests_focus':  'Interesses e Foco',
    'dash.click_to_load':    'Clique em analisar para carregar.',
    'dash.practical_rec':    'Recomendações Práticas',
    'dash.no_interests':     'Nenhum interesse mapeado ainda.',
    'dash.no_recs':          'Nenhuma recomendação disponível.',
    'dash.action':           '💡 Ação:',
 
    // ── Dashboard — reports ───────────────────────────────────────
    'dash.reports_title':    'Relatórios de Desempenho',
    'dash.reports_desc':     'Acompanhe a evolução e as métricas da turma.',
    'dash.reports_sem':      'Atividade semanal',
    'dash.total':            'Total',
    'dash.msgs':             'Mensagens trocadas',
    'dash.trocadas':         'Trocadas',
    'dash.ac_hj':            'Ativos hoje',
    'dash.niveis':           'Distribuição de níveis',
    'dash.level_st':         'Níveis de inglês dos alunos',
    'dash.al_dis':           'aluno',
    'dash.n_msg_day':        'Mensagens por dia — últimos 7 dias',
    'dash.n_msg':            'Intensidade por dia da semana — últimas 4 semanas',
    'dash.eng_less':         'Menos',
    'dash.eng_more':         'Mais',
    'dash.media':            'Média/dia',
    'dash.pico':             'Pico',
    'dash.tot_sem':          'Total semanal',
    'dash.val_students':     'Total de alunos',
    'dash.val_msgs':         'Mensagens',
    'dash.val_active':       'Ativos hoje',
 
    // ── Dashboard — dias da semana ────────────────────────────────
    'dash.day1': 'Seg',
    'dash.day2': 'Ter',
    'dash.day3': 'Qua',
    'dash.day4': 'Qui',
    'dash.day5': 'Sex',
    'dash.day6': 'Sáb',
    'dash.day7': 'Dom',
 
    // ── Dashboard — heatmap semanas ───────────────────────────────
    'dash.week_label': (n) => `Sem ${n}`,
 
    // ── Voice ─────────────────────────────────────────────────────
    'voice.online':       'Online',
    'voice.listening':    '🎙 Ouvindo…',
    'voice.processing':   '⏳ Processando…',
    'voice.speaking':     '🗣 Falando…',
    'voice.tap_speak':    'Toque para falar',
    'voice.tap_stop':     'Toque para parar',
    'voice.wait':         'Aguarde…',
    'voice.play':         '▶ Ouvir',
    'voice.stop':         '⏹ Parar',
    'voice.rewind':       '↩ 5s',
    'voice.vol':          'Vol',
    'voice.speed':        'Vel',
    'voice.transcribing': '🎙 Transcrevendo…',
    'voice.back_chat':    'Chat',
    'voice.settings':     'Configurações',
 
    // ── Níveis ────────────────────────────────────────────────────
    'level.beginner':     'Beginner',
    'level.pre_int':      'Pre-Intermediate',
    'level.intermediate': 'Intermediate',
    'level.business':     'Business English',
    'level.advanced':     'Advanced',
 
    // ── Foco ──────────────────────────────────────────────────────
    'focus.general':      'Conversação Geral',
    'focus.business':     'Inglês para Negócios',
    'focus.travel':       'Inglês para Viagens',
    'focus.academic':     'Inglês Acadêmico',
    'focus.interviews':   'Entrevistas de Emprego',
 
    // ── Genérico ──────────────────────────────────────────────────
    'gen.confirm':        'Confirmar',
    'gen.cancel':         'Cancelar',
    'gen.save':           'Salvar',
    'gen.delete':         'Excluir',
    'gen.edit':           'Editar',
    'gen.close':          'Fechar',
    'gen.loading':        'Carregando...',
    'gen.error':          'Erro. Tente novamente.',
    'gen.success':        'Salvo com sucesso!',
    'gen.back':           'Voltar',
    'gen.search':         'Pesquisar',
    'gen.no_data':        'Sem dados disponíveis.',
    'gen.see_all':        'Ver todos',
  },
 
  'en-US': {
    // ── Global / Nav ──────────────────────────────────────────────
    'nav.chat':           'Chat',
    'nav.dashboard':      'Dashboard',
    'nav.settings':       'Settings',
    'nav.profile':        'Profile',
    'nav.logout':         'Sign out',
    'nav.back_chat':      'Back to Chat',
    'nav.new_chat':       'New conversation',
    'nav.delete_all':     'Delete all conversations',
 
    // ── Auth ──────────────────────────────────────────────────────
    'auth.welcome':           'Welcome',
    'auth.subtitle':          'Sign in or create a new account',
    'auth.tab_login':         'Sign in',
    'auth.tab_register':      'Create Account',
    'auth.username_email':    'Username or Email',
    'auth.password':          'Password',
    'auth.name':              'Full name',
    'auth.email':             'Email',
    'auth.username':          'Username',
    'auth.level':             'English level',
    'auth.btn_login':         'Sign in',
    'auth.btn_register':      'Create Account',
    'auth.btn_google':        'Continue with Google',
    'auth.or':                'or',
    'auth.logging_in':        'Signing in...',
    'auth.registering':       'Creating account...',
    'auth.success_register':  'Account created! Sign in now.',
    'auth.err_fields':        'Please fill in all fields.',
    'auth.err_password':      'Password must be at least 6 characters.',
    'auth.err_connection':    'Connection error. Check if the server is running.',
    'auth.err_email':         'Email already registered. Please sign in or use another email.',
    'auth.err_username':      'Username already taken. Please choose another.',
    'auth.senha_esqueci':     'I forgot my password',
    'auth.exp_img':           'Your AI English teacher. Practice whenever you want, at your own pace.',
    'auth.esq_senha':         '🔑 Forgot my password',
    'auth.back_login':        '← Back to login',
    'auth.informar_user':     "Enter your username or email. We'll generate a temporary password and send it to you.",
    'auth_send_temp':         'Send temporary password',
 
    // ── Chat ──────────────────────────────────────────────────────
    'chat.title':           'Teacher Tati',
    'chat.welcome_title':   "Hi! I'm Teacher Tati 👋",
    'chat.welcome_sub':     "Your AI English teacher. Let's practice together?",
    'chat.welcome_tip':     '💡 Click any English word to see the translation and hear the pronunciation',
    'chat.sugg_1':          'How do I introduce myself?',
    'chat.sugg_2':          'Correct my English, please',
    'chat.sugg_3':          "Let's practice conversation",
    'chat.sugg_4':          'Explain past tense to me',
    'chat.placeholder':     'Type your message in English...',
    'chat.hint':            'Teacher Tati practices English with you · Enter to send · Shift+Enter for new line',
    'chat.voice_mode':      'Voice Mode',
    'chat.summary_mode':    'Summary Mode',
    'chat.loading':         'Loading...',
    'chat.no_convs':        'No conversations yet',
    'chat.today':           'Today',
    'chat.yesterday':       'Yesterday',
    'chat.older':           'Earlier',
    'chat.delete_conv':     'Delete this conversation?',
    'chat.delete_all_conv': '⚠️ Delete ALL conversations?',
    'chat.confirm':         'Confirm',
    'chat.cancel':          'Cancel',
    'chat.err_connect':     'Could not connect to the server.',
    'chat.err_unknown':     'Unknown error',
    'chat.attach':          'Attach file',
    'chat.record':          'Record audio',
    'chat.send':            'Send',
    'chat.new_conv':        'New conversation',
    'chat.delete_all_title':'Delete all',
    'chat.sidebar_toggle':  'Menu',
 
    // ── Settings ──────────────────────────────────────────────────
    'settings.title':        'Settings',
    'settings.appearance':   'Appearance',
    'settings.theme':        'Theme',
    'settings.theme_desc':   'Choose between light and dark mode',
    'settings.dark':         'Dark',
    'settings.light':        'Light',
    'settings.language':     'Interface language',
    'settings.language_desc':'Language for buttons and app text',
    'settings.audio':        'Audio',
    'settings.speed':        'Default speed',
    'settings.speed_desc':   'Playback speed for audio responses',
    'settings.chat':         'Chat',
    'settings.tooltip':      'Word tooltip',
    'settings.tooltip_desc': 'Click English words to see translation and pronunciation',
    'settings.enter_send':   'Send with Enter',
    'settings.enter_desc':   'Enter sends the message (Shift+Enter for new line)',
    'settings.save':         'Save Changes',
    'settings.saved':        '✅ Saved!',
    'settings.auto_play':    'Auto play audio',
    'settings.auto_play_desc':'Automatically play audio responses',
    'settings.senha_nova': 'Fill this in only if you want to change your password. Leave it blank to keep your current password.',
 
    // ── Profile ───────────────────────────────────────────────────
    'profile.title':         'My Profile',
    'profile.personal':      'Personal Information',
    'profile.full_name':     'Full name',
    'profile.nickname':      'Nickname',
    'profile.nickname_ph':   'What you prefer to be called',
    'profile.email':         'Email',
    'profile.occupation':    'Occupation',
    'profile.occupation_ph': 'E.g.: Developer, Student...',
    'profile.study':         'Study Preferences',
    'profile.level':         'English level',
    'profile.focus':         'Learning focus',
    'profile.save':          'Save changes',
    'profile.saving':        'Saving...',
    'profile.saved':         'Profile updated successfully! ✓',
    'profile.security':      'Security',
    'profile.current_pw':    'Current password',
    'profile.new_pw':        'New password',
    'profile.new_pw_ph':     'at least 6 characters',
    'profile.update_pw':     'Update password',
    'profile.change_photo':  'Change photo',
    'profile.danger':        'Danger Zone',
    'profile.danger_desc':   'These actions are irreversible. Proceed with care.',
    'profile.msgs':          'Messages',
    'profile.convs':         'Conversations',
    'profile.days':          'Days active',
    'profile.pw_hint':       'Fill in only if you want to change your password.',
    'profile.logout':        'Sign out',
 
    // ── Dashboard — geral ─────────────────────────────────────────
    'dash.overview':         'Overview',
    'dash.overview_sub':     'Platform summary',
    'dash.students':         'Students',
    'dash.students_sub':     'Student management',
    'dash.reports':          'Reports',
    'dash.reports_sub':      'Overview and class metrics',
    'dash.go_chat':          'Go to Chat',
    'dash.total_students':   'Total Students',
    'dash.total_msgs':       'Total Messages',
    'dash.active_today':     'Active Today',
    'dash.recent':           'Recent Students',
    'dash.see_all':          'See all →',
    'dash.all_students':     'All Students',
    'dash.search_ph':        'Search student...',
    'dash.no_students':      'No students found.',
    'dash.active':           '↑ Active',
    'dash.hoje':             'Today',
    'dash.alertas':          'Class Difficulty Alerts',
    'dash.aluno_alertas':    '🧑‍🎓 Student',
    'dash.aten_alertas':     '⚠️ Spotlight',
    'dash.loading':          'Loading...',
    'dash.no_alerts':        'No students with registered difficulties.',
 
    // ── Dashboard — tabela alunos ─────────────────────────────────
    'dash.col_student':      'Student',
    'dash.col_level':        'Level',
    'dash.col_focus':        'Focus',
    'dash.col_last':         'Last active',
    'dash.col_msgs':         'Msgs',
    'dash.col_since':        'Joined',
 
    // ── Dashboard — modal aluno ───────────────────────────────────
    'dash.edit':             '✏️ Edit',
    'dash.prompt':           '🧩 Prompt',
    'dash.insight':          '🧠 Insight',
    'dash.interests':        '🎯 Interests',
    'dash.save_level':       'Save level',
    'dash.save_prompt':      'Save prompt',
    'dash.clear_prompt':     'Clear prompt',
    'dash.generate_insight': '🧠 Generate Insight',
    'dash.regenerate':       '🔄 Regenerate',
    'dash.analyzing':        '⏳ Analyzing...',
    'dash.delete_student':   'Delete student',
    'dash.confirm_delete':   'Delete',
    'dash.level_updated':    '✓ Level updated successfully!',
    'dash.prompt_saved':     '✓ Prompt saved! Takes effect on next message.',
    'dash.err_save':         '✗ Error saving. Please try again.',
    'dash.prompt_hint':      'Add extra instructions for Tati to follow <strong>only with this student</strong>.',
    'dash.grammar_errors':   'Grammar Errors',
    'dash.mapping_errors':   'Mapping recurring grammar mistakes...',
    'dash.no_grammar_errors':'No grammar errors detected in the latest messages.',
    'dash.exemples':         'Example',
    'dash.click':            "Click 🧠 Generate Insight to analyze this student's history or Grammar Errors to see recurring mistakes.",
    'dash.interests_hint':   'The AI will analyze the history to map hobbies and suggest study plans.',
    'dash.analyze_interests':'🎯 Analyze Interests',
    'dash.redo_analysis':    '🎯 Redo Analysis',
    'dash.interests_focus':  'Interests and Focus',
    'dash.click_to_load':    'Click analyze to load.',
    'dash.practical_rec':    'Practical Recommendations',
    'dash.no_interests':     'No interests mapped yet.',
    'dash.no_recs':          'No recommendations available.',
    'dash.action':           '💡 Action:',
 
    // ── Dashboard — reports ───────────────────────────────────────
    'dash.reports_title':    'Performance Reports',
    'dash.reports_desc':     'Track the evolution and metrics of the class.',
    'dash.reports_sem':      'Weekly activity',
    'dash.total':            'Total',
    'dash.msgs':             'Messages exchanged',
    'dash.trocadas':         'Exchanged',
    'dash.ac_hj':            'Active today',
    'dash.niveis':           'Level distribution',
    'dash.level_st':         'English proficiency levels',
    'dash.al_dis':           'student',
    'dash.n_msg_day':        'Messages per day — last 7 days',
    'dash.n_msg':            'Message intensity by day of week — last 4 weeks',
    'dash.eng_less':         'Less',
    'dash.eng_more':         'More',
    'dash.media':            'Avg/day',
    'dash.pico':             'Peak',
    'dash.tot_sem':          'Weekly total',
    'dash.val_students':     'Total students',
    'dash.val_msgs':         'Messages',
    'dash.val_active':       'Active today',
 
    // ── Dashboard — dias da semana ────────────────────────────────
    'dash.day1': 'Mon',
    'dash.day2': 'Tue',
    'dash.day3': 'Wed',
    'dash.day4': 'Thu',
    'dash.day5': 'Fri',
    'dash.day6': 'Sat',
    'dash.day7': 'Sun',
 
    // ── Dashboard — heatmap semanas ───────────────────────────────
    'dash.week_label': (n) => `Week ${n}`,
 
    // ── Voice ─────────────────────────────────────────────────────
    'voice.online':       'Online',
    'voice.listening':    '🎙 Listening…',
    'voice.processing':   '⏳ Processing…',
    'voice.speaking':     '🗣 Speaking…',
    'voice.tap_speak':    'Tap to speak',
    'voice.tap_stop':     'Tap to stop',
    'voice.wait':         'Please wait…',
    'voice.play':         '▶ Play',
    'voice.stop':         '⏹ Stop',
    'voice.rewind':       '↩ 5s',
    'voice.vol':          'Vol',
    'voice.speed':        'Spd',
    'voice.transcribing': '🎙 Transcribing…',
    'voice.back_chat':    'Chat',
    'voice.settings':     'Settings',
 
    // ── Níveis ────────────────────────────────────────────────────
    'level.beginner':     'Beginner',
    'level.pre_int':      'Pre-Intermediate',
    'level.intermediate': 'Intermediate',
    'level.business':     'Business English',
    'level.advanced':     'Advanced',
 
    // ── Foco ──────────────────────────────────────────────────────
    'focus.general':      'General Conversation',
    'focus.business':     'Business English',
    'focus.travel':       'Travel English',
    'focus.academic':     'Academic English',
    'focus.interviews':   'Job Interviews',
 
    // ── Genérico ──────────────────────────────────────────────────
    'gen.confirm':        'Confirm',
    'gen.cancel':         'Cancel',
    'gen.save':           'Save',
    'gen.delete':         'Delete',
    'gen.edit':           'Edit',
    'gen.close':          'Close',
    'gen.loading':        'Loading...',
    'gen.error':          'Error. Please try again.',
    'gen.success':        'Saved successfully!',
    'gen.back':           'Back',
    'gen.search':         'Search',
    'gen.no_data':        'No data available.',
    'gen.see_all':        'See all',
  },
};
 
// en-UK herda do en-US
TRANSLATIONS['en-UK'] = {
  ...TRANSLATIONS['en-US'],
  'auth.btn_login':     'Sign in',
  'settings.dark':      'Dark',
  'settings.light':     'Light',
  'dash.day1': 'Mon',
  'dash.day2': 'Tue',
  'dash.day3': 'Wed',
  'dash.day4': 'Thu',
  'dash.day5': 'Fri',
  'dash.day6': 'Sat',
  'dash.day7': 'Sun',
  'dash.week_label': (n) => `Week ${n}`,
  'focus.general':    'General Conversation',
  'focus.business':   'Business English',
};

// ── i18n Engine ───────────────────────────────────────────────────────────────

const I18n = (() => {
  const STORAGE_KEY = 'tati_lang';
  const DEFAULT = 'pt-BR';
  const SUPPORTED = ['pt-BR', 'en-US', 'en-UK'];

  let _lang = localStorage.getItem(STORAGE_KEY) || DEFAULT;
  if (!SUPPORTED.includes(_lang)) _lang = DEFAULT;

  function t(key, fallback) {
    const dict = TRANSLATIONS[_lang] || TRANSLATIONS[DEFAULT];
    return dict[key] || TRANSLATIONS[DEFAULT][key] || fallback || key;
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    _lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyToDOM();
    // Dispatch event so individual pages can react
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function getLang() { return _lang; }

  // ── DOM auto-translate via data-i18n attributes ───────────────────
  // Usage: <span data-i18n="chat.title"></span>
  //        <input data-i18n-placeholder="chat.placeholder">
  //        <button data-i18n="auth.btn_login"></button>
  function applyToDOM(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyToDOM());
  } else {
    applyToDOM();
  }

  return { t, setLang, getLang, applyToDOM, SUPPORTED };
})();

// Shorthand global
window.t = I18n.t;