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
    'auth.welcome':       'Bem-vindo',
    'auth.subtitle':      'Entre na sua conta ou crie uma nova',
    'auth.tab_login':     'Entrar',
    'auth.tab_register':  'Criar Conta',
    'auth.username_email':'Username ou E-mail',
    'auth.password':      'Senha',
    'auth.name':          'Nome completo',
    'auth.email':         'E-mail',
    'auth.username':      'Username',
    'auth.level':         'Nível de inglês',
    'auth.btn_login':     'Entrar',
    'auth.btn_register':  'Criar Conta',
    'auth.btn_google':    'Continuar com Google',
    'auth.or':            'ou',
    'auth.logging_in':    'Entrando...',
    'auth.registering':   'Criando conta...',
    'auth.success_register': 'Conta criada! Faça login agora.',
    'auth.err_fields':    'Preencha todos os campos.',
    'auth.err_password':  'Senha deve ter pelo menos 6 caracteres.',
    'auth.err_connection':'Erro de conexão. Verifique se o servidor está rodando.',

    // ── Chat ──────────────────────────────────────────────────────
    'chat.title':           'Teacher Tati',
    'chat.welcome_title':   'Olá! Eu sou a Teacher Tati 👋',
    'chat.welcome_sub':     'Sua professora de inglês com IA. Vamos praticar juntos?',
    'chat.welcome_tip':     '💡 Clique em qualquer palavra inglesa para ver tradução e ouvir a pronúncia',
    'chat.sugg_1':          'How do I introduce myself?',
    'chat.sugg_2':          'Correct my English, please',
    'chat.sugg_3':          'Let\'s practice conversation',
    'chat.sugg_4':          'Explain past tense to me',
    'chat.placeholder':     'Digite sua mensagem em inglês...',
    'chat.hint':            'Teacher Tati pratica inglês com você · Enter para enviar · Shift+Enter para nova linha',
    'chat.voice_mode':      'Modo Voz',
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
    'settings.save':         '💾 Salvar Alterações',
    'settings.saved':        '✅ Salvo!',

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

    // ── Dashboard ─────────────────────────────────────────────────
    'dash.overview':         'Visão Geral',
    'dash.overview_sub':     'Resumo da plataforma',
    'dash.students':         'Alunos',
    'dash.students_sub':     'Gerenciamento de alunos',
    'dash.go_chat':          'Ir ao Chat',
    'dash.total_students':   'Total de Alunos',
    'dash.total_msgs':       'Total de Mensagens',
    'dash.active_today':     'Ativos Hoje',
    'dash.recent':           'Alunos Recentes',
    'dash.see_all':          'Ver todos →',
    'dash.all_students':     'Todos os Alunos',
    'dash.search_ph':        'Pesquisar aluno...',
    'dash.col_student':      'Aluno',
    'dash.col_level':        'Nível',
    'dash.col_focus':        'Foco',
    'dash.col_last':         'Último acesso',
    'dash.col_msgs':         'Msgs',
    'dash.col_since':        'Cadastro',
    'dash.no_students':      'Nenhum aluno encontrado.',
    'dash.edit':             '✏️ Editar',
    'dash.prompt':           '🧩 Prompt',
    'dash.insight':          '🧠 Insight',
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

    // ── Voice ─────────────────────────────────────────────────────
    'voice.online':          'Online',
    'voice.listening':       '🎙 Ouvindo…',
    'voice.processing':      '⏳ Processando…',
    'voice.speaking':        '🗣 Falando…',
    'voice.tap_speak':       'Toque para falar',
    'voice.tap_stop':        'Toque para parar',
    'voice.wait':            'Aguarde…',
    'voice.play':            '▶ Ouvir',
    'voice.stop':            '⏹ Parar',
    'voice.rewind':          '↩ 5s',
    'voice.vol':             'Vol',
    'voice.speed':           'Vel',

    // ── Levels ────────────────────────────────────────────────────
    'level.beginner':        'Beginner',
    'level.pre_int':         'Pre-Intermediate',
    'level.intermediate':    'Intermediate',
    'level.business':        'Business English',
    'level.advanced':        'Advanced',

    // ── Focus ─────────────────────────────────────────────────────
    'focus.general':         'General Conversation',
    'focus.business':        'Business English',
    'focus.travel':          'Travel English',
    'focus.academic':        'Academic English',
    'focus.interviews':      'Job Interviews',
  },

  'en-US': {
    'nav.chat':           'Chat',
    'nav.dashboard':      'Dashboard',
    'nav.settings':       'Settings',
    'nav.profile':        'Profile',
    'nav.logout':         'Sign out',
    'nav.back_chat':      'Back to Chat',
    'nav.new_chat':       'New conversation',
    'nav.delete_all':     'Delete all conversations',

    'auth.welcome':       'Welcome',
    'auth.subtitle':      'Sign in or create a new account',
    'auth.tab_login':     'Sign in',
    'auth.tab_register':  'Create Account',
    'auth.username_email':'Username or Email',
    'auth.password':      'Password',
    'auth.name':          'Full name',
    'auth.email':         'Email',
    'auth.username':      'Username',
    'auth.level':         'English level',
    'auth.btn_login':     'Sign in',
    'auth.btn_register':  'Create Account',
    'auth.btn_google':    'Continue with Google',
    'auth.or':            'or',
    'auth.logging_in':    'Signing in...',
    'auth.registering':   'Creating account...',
    'auth.success_register': 'Account created! Sign in now.',
    'auth.err_fields':    'Please fill in all fields.',
    'auth.err_password':  'Password must be at least 6 characters.',
    'auth.err_connection':'Connection error. Check if the server is running.',

    'chat.title':           'Teacher Tati',
    'chat.welcome_title':   'Hi! I\'m Teacher Tati 👋',
    'chat.welcome_sub':     'Your AI English teacher. Let\'s practice together?',
    'chat.welcome_tip':     '💡 Click any English word to see the translation and hear the pronunciation',
    'chat.sugg_1':          'How do I introduce myself?',
    'chat.sugg_2':          'Correct my English, please',
    'chat.sugg_3':          'Let\'s practice conversation',
    'chat.sugg_4':          'Explain past tense to me',
    'chat.placeholder':     'Type your message in English...',
    'chat.hint':            'Teacher Tati practices English with you · Enter to send · Shift+Enter for new line',
    'chat.voice_mode':      'Voice Mode',
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
    'settings.save':         '💾 Save Changes',
    'settings.saved':        '✅ Saved!',

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

    'dash.overview':         'Overview',
    'dash.overview_sub':     'Platform summary',
    'dash.students':         'Students',
    'dash.students_sub':     'Student management',
    'dash.go_chat':          'Go to Chat',
    'dash.total_students':   'Total Students',
    'dash.total_msgs':       'Total Messages',
    'dash.active_today':     'Active Today',
    'dash.recent':           'Recent Students',
    'dash.see_all':          'See all →',
    'dash.all_students':     'All Students',
    'dash.search_ph':        'Search student...',
    'dash.col_student':      'Student',
    'dash.col_level':        'Level',
    'dash.col_focus':        'Focus',
    'dash.col_last':         'Last active',
    'dash.col_msgs':         'Msgs',
    'dash.col_since':        'Joined',
    'dash.no_students':      'No students found.',
    'dash.edit':             '✏️ Edit',
    'dash.prompt':           '🧩 Prompt',
    'dash.insight':          '🧠 Insight',
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

    'voice.online':          'Online',
    'voice.listening':       '🎙 Listening…',
    'voice.processing':      '⏳ Processing…',
    'voice.speaking':        '🗣 Speaking…',
    'voice.tap_speak':       'Tap to speak',
    'voice.tap_stop':        'Tap to stop',
    'voice.wait':            'Please wait…',
    'voice.play':            '▶ Play',
    'voice.stop':            '⏹ Stop',
    'voice.rewind':          '↩ 5s',
    'voice.vol':             'Vol',
    'voice.speed':           'Spd',

    'level.beginner':        'Beginner',
    'level.pre_int':         'Pre-Intermediate',
    'level.intermediate':    'Intermediate',
    'level.business':        'Business English',
    'level.advanced':        'Advanced',

    'focus.general':         'General Conversation',
    'focus.business':        'Business English',
    'focus.travel':          'Travel English',
    'focus.academic':        'Academic English',
    'focus.interviews':      'Job Interviews',
  },
};

// en-UK inherits from en-US with minor differences
TRANSLATIONS['en-UK'] = {
  ...TRANSLATIONS['en-US'],
  'auth.btn_login':     'Sign in',
  'settings.language':  'Interface language',
  'settings.dark':      'Dark',
  'settings.light':     'Light',
};

// ── i18n Engine ───────────────────────────────────────────────────────────────

const I18n = (() => {
  const STORAGE_KEY = 'tati_lang';
  const DEFAULT     = 'pt-BR';
  const SUPPORTED   = ['pt-BR', 'en-US', 'en-UK'];

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