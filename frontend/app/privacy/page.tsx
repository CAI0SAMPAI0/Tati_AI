import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Shield,
  ArrowLeft,
  Lock,
  FileText,
  Eye,
  CheckCircle2,
  Mail,
  Globe,
  Server,
  Bell,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Teacher Tati AI',
  description:
    'Conheça como a Teacher Tati AI protege, coleta e trata seus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018). Contato: cmsampaio135@gmail.com.',
  openGraph: {
    title: 'Política de Privacidade | Teacher Tati AI',
    description:
      'Transparência e segurança no tratamento de seus dados na Teacher Tati AI. Em conformidade com a LGPD.',
    url: 'https://tati-ai.vercel.app/politica-de-privacidade',
    siteName: 'Teacher Tati AI',
    locale: 'pt_BR',
    type: 'website',
  },
};

const HUB_URL = 'https://tati-hub.vercel.app/materiais';
const CONTACT_EMAIL = 'cmsampaio135@gmail.com';

export default function PrivacyPolicyPage() {
  return (
    <div
      className="landing-bg landing-text"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9f8f6',
        color: '#1a1826',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ─── HEADER PÚBLICO (PADRÃO LANDING PAGE) ─── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'rgba(249, 248, 246, 0.94)',
          borderBottom: '1px solid #e8e5f0',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo Brand */}
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div
              className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
              style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}
            >
              <Image
                src="/images/tati_logo.jpg"
                alt="Teacher Tati AI logo"
                fill
                sizes="36px"
                className="object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none" style={{ color: '#1a1826' }}>
                Teacher Tati <span style={{ color: '#6d28d9' }}>AI</span>
              </p>
              <p className="text-xs leading-none mt-1" style={{ color: '#9d9ab0' }}>
                Tati&apos;s English Class
              </p>
            </div>
          </Link>

          {/* Ações do Topo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="landing-btn-outline text-xs px-3.5 py-1.5 rounded-xl font-medium inline-flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Voltar ao</span> Início
            </Link>
            <Link
              href="/teste-cefr"
              className="landing-btn-outline text-xs px-3.5 py-1.5 rounded-xl font-medium inline-flex items-center gap-1.5 transition-all"
            >
              <Sparkles size={13} />
              <span>Teste CEFR</span>
            </Link>
            <Link
              href="/login"
              className="landing-btn-primary text-xs px-4 py-1.5 rounded-xl font-medium transition-all"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ─── HERO DA POLÍTICA DE PRIVACIDADE ─── */}
      <section
        style={{
          borderBottom: '1px solid #e8e5f0',
          background: 'linear-gradient(180deg, rgba(109, 40, 217, 0.04) 0%, rgba(249, 248, 246, 1) 100%)',
          padding: '64px 0 56px',
        }}
      >
        <div className="max-w-4xl mx-auto px-6 text-center space-y-4">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: '#f5f3ff',
              border: '1px solid #ddd6fe',
              color: '#6d28d9',
            }}
          >
            <Shield size={14} />
            Privacidade & Proteção de Dados (LGPD)
          </div>

          <h1
            className="font-display-serif text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight"
            style={{ color: '#1a1826' }}
          >
            Política de Privacidade
          </h1>

          <p className="text-sm sm:text-base leading-relaxed max-w-2xl mx-auto" style={{ color: '#6b6880' }}>
            Seu aprendizado com segurança, respeito e total transparência. Saiba com clareza
            como tratamos suas informações, áudios e mensagens na plataforma Teacher Tati AI.
          </p>

          <div className="pt-2 text-xs" style={{ color: '#9d9ab0' }}>
            Última atualização: <strong style={{ color: '#1a1826' }}>Setembro de 2026</strong> • Versão 2.2 em conformidade com a LGPD
          </div>
        </div>
      </section>

      {/* ─── CONTEÚDO PRINCIPAL ─── */}
      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <div
          className="landing-card rounded-3xl p-6 sm:p-12 space-y-12"
          style={{
            background: '#ffffff',
            border: '1px solid #e8e5f0',
            boxShadow: '0 8px 32px rgba(26, 24, 38, 0.04)',
          }}
        >
          {/* Seção 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <FileText size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                1. Visão Geral e Compromisso
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Esta Política de Privacidade descreve de forma transparente e acessível como a{' '}
              <strong style={{ color: '#1a1826' }}>Teacher Tati AI</strong> (&quot;nós&quot;, &quot;nossa plataforma&quot;,
              gerida por <em>Tati&apos;s English Class</em>) coleta, utiliza, armazena e protege os dados pessoais dos
              nossos alunos, usuários do teste CEFR, compradores de materiais didáticos e visitantes (&quot;você&quot; ou
              &quot;titular&quot;).
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Atuamos em estrita observância à{' '}
              <strong style={{ color: '#1a1826' }}>
                Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)
              </strong>
              , garantindo respeito à sua privacidade, liberdade de expressão, autodeterminação informativa e sigilo de
              suas comunicações.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Globe size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                2. Controlador dos Dados Pessoais
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Para todos os efeitos da legislação de proteção de dados, a controladora responsável é:
            </p>
            <div
              className="rounded-2xl p-5 text-xs sm:text-sm leading-relaxed space-y-1.5"
              style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
            >
              <p>
                <strong style={{ color: '#1a1826' }}>Entidade Responsável:</strong> Teacher Tati AI / Tati&apos;s English Class
              </p>
              <p>
                <strong style={{ color: '#1a1826' }}>Domínio Oficial:</strong> https://tati-ai.vercel.app
              </p>
              <p>
                <strong style={{ color: '#1a1826' }}>E-mail de Contato & DPO:</strong>{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-semibold underline transition-colors hover:opacity-80"
                  style={{ color: '#6d28d9' }}
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p>
                <strong style={{ color: '#1a1826' }}>Jurisdição:</strong> República Federativa do Brasil
              </p>
            </div>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Eye size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                3. Dados Pessoais Coletados
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Coletamos exclusivamente as informações necessárias para a entrega dos nossos serviços educacionais e de
              prática inteligente de conversação:
            </p>
            <ul className="space-y-3 text-sm" style={{ color: '#6b6880' }}>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <span>
                  <strong style={{ color: '#1a1826' }}>Dados Cadastrais e de Identificação:</strong> Nome completo,
                  endereço de e-mail, nome de usuário e senha criptografada. Número de telefone/WhatsApp opcional para
                  recebimento de notificações de estudo autorizadas.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <span>
                  <strong style={{ color: '#1a1826' }}>Dados de Diagnóstico CEFR (A1–B2):</strong> Respostas fornecidas
                  nos testes de nivelamento, pontuações atingidas e emissão do relatório diagnóstico em formato PDF.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <span>
                  <strong style={{ color: '#1a1826' }}>Mensagens e Interações com a Teacher Tati AI:</strong> Diálogos
                  educacionais, transcrições de exercícios práticos, histórico de correções gramaticais e flashcards de
                  vocabulário criados pelo aluno.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <span>
                  <strong style={{ color: '#1a1826' }}>Áudio e Pronúncia:</strong> Áudios gravados voluntariamente para
                  treino de pronúncia e ritmo. O processamento ocorre exclusivamente para conversão de fala em texto e
                  devolução imediata do feedback pedagógico.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: '#059669' }} />
                <span>
                  <strong style={{ color: '#1a1826' }}>Dados Técnicos e Registros de Conexão:</strong> Endereço IP, tipo
                  de navegador, sistema operacional e registros de acesso, em cumprimento ao Artigo 15 do Marco Civil da
                  Internet (Lei nº 12.965/2014).
                </span>
              </li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Lock size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                4. Finalidades e Bases Legais (Art. 7º da LGPD)
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Todo tratamento de dados realizado pela Teacher Tati AI possui amparo em bases legais estipuladas pela LGPD:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div
                className="rounded-2xl p-4 space-y-1"
                style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
              >
                <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: '#6d28d9' }}>
                  Execução de Contrato (Art. 7º, V)
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b6880' }}>
                  Autenticar seu login, liberar salas de conversação, acompanhar ofensivas de estudo, permitir acesso a
                  materiais e gerar relatórios de evolução.
                </p>
              </div>

              <div
                className="rounded-2xl p-4 space-y-1"
                style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
              >
                <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: '#059669' }}>
                  Consentimento do Titular (Art. 7º, I)
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b6880' }}>
                  Realização espontânea do teste CEFR por visitantes externos e preenchimento voluntário de dados para
                  receber o PDF e eventuais comunicações.
                </p>
              </div>

              <div
                className="rounded-2xl p-4 space-y-1"
                style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
              >
                <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: '#d97706' }}>
                  Legítimo Interesse (Art. 7º, IX)
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b6880' }}>
                  Otimização contínua das respostas e correções didáticas da IA, prevenção contra abusos e garantia de
                  estabilidade da infraestrutura técnica.
                </p>
              </div>

              <div
                className="rounded-2xl p-4 space-y-1"
                style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
              >
                <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: '#0284c7' }}>
                  Obrigação Legal (Art. 7º, II)
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: '#6b6880' }}>
                  Armazenamento de registros de conexão e IPs de acesso para cumprimento das obrigações do Marco Civil da
                  Internet e emissão de notas quando aplicável.
                </p>
              </div>
            </div>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Server size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                5. Compartilhamento Seguro com Terceiros
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              <strong style={{ color: '#1a1826' }}>
                Nós nunca comercializamos, alugamos ou vendemos seus dados pessoais a terceiros sob nenhuma hipótese.
              </strong>{' '}
              O compartilhamento ocorre estritamente com parceiros tecnológicos indispensáveis para a operação:
            </p>
            <ul className="space-y-2 text-xs sm:text-sm leading-relaxed list-disc list-inside" style={{ color: '#6b6880' }}>
              <li>
                <strong style={{ color: '#1a1826' }}>Hospedagem & Nuvem:</strong> Servidores em nuvem de alta segurança
                com banco de dados PostgreSQL isolado e criptografia em repouso.
              </li>
              <li>
                <strong style={{ color: '#1a1826' }}>Modelos de Inteligência Artificial:</strong> Provedores homologados
                de IA para processamento em tempo real das mensagens e avaliação gramatical, sem que suas conversas
                pessoais sejam compartilhadas para treinamento de modelos públicos abertos.
              </li>
              <li>
                <strong style={{ color: '#1a1826' }}>Comunicação Transacional:</strong> Serviços de e-mail (Brevo /
                Sendinblue) para entrega de relatórios em PDF, links de recuperação e alertas essenciais de conta.
              </li>
              <li>
                <strong style={{ color: '#1a1826' }}>Processamento Financeiro:</strong> Mercado Pago para
                transações seguras no catálogo de materiais. Dados de cartões não são armazenados em nossos servidores.
              </li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Shield size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                6. Segurança da Informação
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Implementamos medidas técnicas e administrativas rigorosas para manter a integridade de seus dados:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {[
                'Criptografia HTTPS / TLS de ponta a ponta em todo o tráfego',
                'Senhas salvas com hash irreversível bcrypt e salteamento forte',
                'Autenticação moderna via JWT com expiração e controle de sessão',
                'Isolamento de privilégios de acesso e cópias regulares de segurança',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 rounded-xl p-3 text-xs"
                  style={{ background: '#fdfcfe', border: '1px solid #ede9fe' }}
                >
                  <CheckCircle2 size={15} style={{ color: '#059669', flexShrink: 0 }} />
                  <span style={{ color: '#3d3a52' }}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Seção 7 - Proteção de Menores */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Lock size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                7. Proteção de Dados de Menores de Idade (Artigo 14 da LGPD)
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              O tratamento de dados pessoais de crianças (até 12 anos incompletos) e adolescentes (entre 12 e 18 anos)
              é realizado em observância aos seus melhores interesses e às exigências expressas do Artigo 14 da Lei Geral
              de Proteção de Dados:
            </p>
            <div className="space-y-2.5 text-xs sm:text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              <p>
                • <strong style={{ color: '#1a1826' }}>Consentimento dos Pais ou Responsáveis:</strong> O cadastro e utilização
                da plataforma por menores de 18 anos pressupõe a ciência e autorização inequívoca de ao menos um dos pais ou
                responsável legal, confirmada expressamente no ato da criação da conta.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Finalidade Estritamente Educacional:</strong> Os dados coletados (nome,
                e-mail e histórico de aprendizado) destinam-se exclusivamente à personalização das aulas, acompanhamento
                didático e entrega de devolutivas pedagógicas de inglês.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Vedação à Transferência Comercial:</strong> Dados de menores jamais
                são comercializados, transferidos para fins publicitários ou submetidos a perfis de consumo abusivo.
              </p>
            </div>
          </section>

          {/* Seção 8 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <CheckCircle2 size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                8. Seus Direitos como Titular (Artigo 18 da LGPD)
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              A qualquer momento, mediante simples solicitação ao nosso canal de contato, você ou seu responsável legal
              pode exercer os direitos garantidos pela lei:
            </p>
            <div className="space-y-2 text-xs sm:text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              <p>
                • <strong style={{ color: '#1a1826' }}>Acesso e Confirmação:</strong> Saber se tratamos seus dados e obter
                cópia das informações cadastradas.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Correção de Dados:</strong> Atualizar informações incompletas,
                desatualizadas ou inexatas.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Exclusão ou Anonimização:</strong> Solicitar a eliminação dos seus
                dados pessoais dos nossos bancos ativos.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Portabilidade:</strong> Solicitar o envio dos seus dados didáticos e
                histórico de aprendizado.
              </p>
              <p>
                • <strong style={{ color: '#1a1826' }}>Revogação de Consentimento:</strong> Cancelar autorizações
                previamente concedidas a qualquer instante.
              </p>
            </div>
          </section>

          {/* Seção 9 */}
          <section className="space-y-3 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Bell size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                9. Cookies e Tecnologias de Navegação
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Utilizamos apenas cookies essenciais para autenticação de sessão e retenção das suas preferências durante o
              estudo. Não realizamos rastreamento intrusivo para fins de publicidade direcionada de terceiros.
            </p>
          </section>

          {/* Seção 10 - Contato */}
          <section className="space-y-4 pt-8" style={{ borderTop: '1px solid #f0edf8' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: '#f5f3ff', color: '#6d28d9' }}
              >
                <Mail size={18} />
              </div>
              <h2 className="font-display-serif text-xl sm:text-2xl font-bold" style={{ color: '#1a1826' }}>
                10. Canal de Atendimento e Encarregado (DPO)
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#6b6880' }}>
              Para exercer qualquer um dos seus direitos, tirar dúvidas sobre o tratamento das suas informações ou sugerir
              aprimoramentos, fale diretamente com nossa equipe através do e-mail oficial:
            </p>

            <div
              className="rounded-2xl p-6 space-y-2.5"
              style={{
                background: '#f5f3ff',
                border: '1.5px solid #ddd6fe',
              }}
            >
              <p className="font-semibold text-sm" style={{ color: '#1a1826' }}>
                Encarregado de Proteção de Dados (DPO): Tatiana / Equipe de Privacidade
              </p>
              <p className="text-sm flex items-center gap-2" style={{ color: '#3d3058' }}>
                <Mail size={16} style={{ color: '#6d28d9' }} />
                <span>E-mail direto para contato:</span>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-bold underline hover:opacity-80 transition-opacity"
                  style={{ color: '#6d28d9' }}
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-xs pt-1" style={{ color: '#6b6880' }}>
                Prazo de Resposta: Em até 15 (quinze) dias corridos, conforme preconiza a regulamentação da Autoridade
                Nacional de Proteção de Dados (ANPD).
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* ─── FOOTER (PADRÃO LANDING PAGE) ─── */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e8e5f0' }}>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-2.5">
              <div
                className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
                style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}
              >
                <Image
                  src="/images/tati_logo.jpg"
                  alt="Teacher Tati AI"
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <div>
                <p className="text-sm font-semibold leading-none" style={{ color: '#1a1826' }}>
                  Teacher Tati <span style={{ color: '#6d28d9' }}>AI</span>
                </p>
                <p className="text-xs leading-none mt-1" style={{ color: '#c4c1d4' }}>
                  Tati&apos;s English Class
                </p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-5">
              <Link href="/" className="landing-nav-link text-xs font-medium">
                Início
              </Link>
              <Link href="/teste-cefr" className="landing-nav-link text-xs font-medium">
                Teste CEFR
              </Link>
              <a
                href={HUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-nav-link text-xs font-medium inline-flex items-center gap-1"
              >
                Hub de Materiais
                <ExternalLink size={10} />
              </a>
              <Link href="/login" className="landing-nav-link text-xs font-medium">
                Entrar
              </Link>
              <Link href="/login?tab=register" className="landing-nav-link text-xs font-medium">
                Criar Conta
              </Link>
            </nav>
          </div>

          <div style={{ borderTop: '1px solid #f0edf8', paddingTop: '1.5rem' }}>
            <p className="text-xs text-center" style={{ color: '#c4c1d4' }}>
              © {new Date().getFullYear()} Teacher Tati AI. Todos os direitos reservados. Em conformidade com a LGPD e
              regulamentações educacionais.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
