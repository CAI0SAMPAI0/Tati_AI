import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft, Lock, FileText, Eye, CheckCircle2, Mail, Globe, Server, Bell } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Teacher Tati AI',
  description: 'Conheça como a Teacher Tati AI protege, coleta e trata seus dados pessoais em conformidade com a LGPD e GDPR.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bg text-text antialiased selection:bg-primary/20 selection:text-primary">
      {/* Header público */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-black shadow-md shadow-primary/20">
              T
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold text-text">Teacher Tati AI</span>
              <span className="text-[10px] text-text-subtle">Taty's English Class</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <ArrowLeft size={14} />
              Voltar ao Início
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-primary/90"
            >
              Acessar Sistema
            </Link>
          </div>
        </div>
      </header>

      {/* Hero da Política */}
      <div className="border-b border-border bg-gradient-to-b from-primary/5 via-surface/30 to-transparent py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Shield size={14} />
            Privacidade & Segurança de Dados (LGPD)
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl md:text-5xl">
            Política de Privacidade
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-muted sm:text-base">
            Seu aprendizado com segurança e transparência. Saiba com clareza como tratamos suas informações e conteúdos de voz e texto na plataforma Teacher Tati AI.
          </p>
          <div className="mt-4 text-xs text-text-subtle">
            Última atualização: <span className="font-semibold text-text">12 de Setembro de 2026</span> • Versão 2.2
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="space-y-10 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-10">
          {/* Seção 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2.5 text-primary">
              <FileText size={20} />
              <h2 className="font-display text-xl font-bold text-text">1. Visão Geral e Compromisso</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Esta Política de Privacidade descreve de forma transparente como a <strong>Teacher Tati AI</strong> ("nós", "nossa plataforma", gerida por <em>Taty's English Class</em>) coleta, utiliza, armazena, compartilha e protege os dados pessoais dos nossos alunos, compradores de materiais didáticos e visitantes ("você" ou "titular").
            </p>
            <p className="text-sm leading-relaxed text-text-muted">
              Atuamos em estrita observância à <strong>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong> e, subsidiariamente, ao Regulamento Geral sobre a Proteção de Dados da União Europeia (GDPR), garantindo respeito à sua privacidade, autodeterminação informativa e sigilo de suas comunicações.
            </p>
          </section>

          {/* Seção 2 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Globe size={20} />
              <h2 className="font-display text-xl font-bold text-text">2. Controlador dos Dados Pessoais</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Para fins da legislação aplicável, a controladora dos dados é:
            </p>
            <div className="rounded-xl border border-border bg-bg p-4 text-xs text-text-muted leading-relaxed">
              <p><strong>Entidade:</strong> Teacher Tati AI / Taty's English Class</p>
              <p><strong>Domínio Oficial:</strong> https://tati-ai.vercel.app</p>
              <p><strong>Canal do Encarregado (DPO) / Suporte:</strong> dpo@tati-ai.com.br / suporte@tati-ai.com.br</p>
              <p><strong>Jurisdição:</strong> República Federativa do Brasil</p>
            </div>
          </section>

          {/* Seção 3 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Eye size={20} />
              <h2 className="font-display text-xl font-bold text-text">3. Dados Pessoais que Coletamos</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Coletamos apenas as informações estritamente necessárias para a prestação dos nossos serviços educacionais e de inteligência artificial:
            </p>
            <ul className="space-y-2 text-sm text-text-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 text-primary shrink-0" />
                <span><strong>Dados Cadastrais e de Identificação:</strong> Nome completo, endereço de e-mail, nome de usuário (username) e senha criptografada. Opcionalmente: número de telefone/WhatsApp para notificações e avisos de estudo autorizados.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 text-primary shrink-0" />
                <span><strong>Dados de Diagnóstico e Nivelamento (CEFR):</strong> Respostas fornecidas em desafios de nivelamento (A1, A2, B1, B2), pontuações, análise de competência comunicativa e emissão de certificados/relatórios de nível em formato PDF.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 text-primary shrink-0" />
                <span><strong>Mensagens e Interações com a IA:</strong> Transcrição de mensagens de texto trocadas nas salas de conversa, correções gramaticais solicitadas e flashcards de vocabulário criados pelo aluno.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 text-primary shrink-0" />
                <span><strong>Áudio e Voz:</strong> Gravações de áudio enviadas voluntariamente pelo aluno para análise de pronúncia e conversação. Tais áudios são processados em tempo real exclusivamente para conversão fala-texto (STT) e avaliação didática.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 text-primary shrink-0" />
                <span><strong>Dados Técnicos e Registros de Acesso:</strong> Endereço IP, tipo de navegador, sistema operacional, horários de acesso e cookies essenciais de sessão, em cumprimento ao Artigo 15 do Marco Civil da Internet (Lei nº 12.965/2014).</span>
              </li>
            </ul>
          </section>

          {/* Seção 4 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Lock size={20} />
              <h2 className="font-display text-xl font-bold text-text">4. Finalidades e Bases Legais do Tratamento</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Todo tratamento de dados realizado pela plataforma possui respaldo nas bases legais da LGPD (Art. 7º):
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-bg/50 p-3.5">
                <h3 className="font-semibold text-xs text-text">Execução de Contrato (Art. 7º, V)</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Autenticar seu acesso, liberar exercícios, disponibilizar relatórios de progresso, e-books e acompanhar sua evolução no idioma.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg/50 p-3.5">
                <h3 className="font-semibold text-xs text-text">Consentimento (Art. 7º, I)</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Envio voluntário de testes CEFR por visitantes externos para recebimento de relatório em PDF e comunicações personalizadas.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg/50 p-3.5">
                <h3 className="font-semibold text-xs text-text">Legítimo Interesse (Art. 7º, IX)</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Aprimoramento contínuo dos prompts didáticos, personalização de dificuldades e garantia de estabilidade e segurança do sistema.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg/50 p-3.5">
                <h3 className="font-semibold text-xs text-text">Cumprimento de Obrigação Legal (Art. 7º, II)</h3>
                <p className="mt-1 text-xs text-text-muted">
                  Guarda de logs de acesso conforme exigido pelo Marco Civil da Internet e emissão de notas ou comprovantes financeiros quando aplicável.
                </p>
              </div>
            </div>
          </section>

          {/* Seção 5 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Server size={20} />
              <h2 className="font-display text-xl font-bold text-text">5. Compartilhamento de Dados com Terceiros</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              <strong>Nós não vendemos nem comercializamos seus dados pessoais sob nenhuma hipótese.</strong> O compartilhamento ocorre única e exclusivamente com operadores técnicos qualificados, contratualmente vinculados a obrigações de sigilo e segurança:
            </p>
            <ul className="space-y-1.5 text-xs text-text-muted list-disc list-inside">
              <li><strong>Provedores de Nuvem e Banco de Dados:</strong> Hospedagem segura e banco PostgreSQL gerenciado com criptografia em repouso.</li>
              <li><strong>Serviços de Inferência e IA (LLMs):</strong> Provedores homologados de inteligência artificial (ex: Groq, HuggingFace Inference) para processamento em tempo real de mensagens de conversação e avaliação gramatical didática, sem que suas conversas sejam utilizadas para treinamento de modelos públicos de terceiros.</li>
              <li><strong>Serviço de Comunicação Transacional:</strong> Brevo / Sendinblue para envio seguro de e-mails transacionais (relatórios CEFR em PDF e links de recuperação de senha).</li>
              <li><strong>Processadores de Pagamento:</strong> Asaas e Mercado Pago para liquidação de assinaturas e compras no Hub de Materiais. Dados de cartão de crédito não trafegam nem são gravados em nossos servidores.</li>
            </ul>
          </section>

          {/* Seção 6 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Shield size={20} />
              <h2 className="font-display text-xl font-bold text-text">6. Segurança da Informação</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Adotamos padrões elevados de governança e segurança técnica para proteger suas informações:
            </p>
            <ul className="grid grid-cols-1 gap-2 text-xs text-text-muted sm:grid-cols-2">
              <li className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 p-2.5">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span>Criptografia HTTPS / TLS em todas as comunicações</span>
              </li>
              <li className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 p-2.5">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span>Senhas criptografadas com hash irreversível bcrypt</span>
              </li>
              <li className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 p-2.5">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span>Autenticação segura baseada em JWT com expiração controlada</span>
              </li>
              <li className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 p-2.5">
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <span>Backups regulares e isolamento de privilégios de acesso</span>
              </li>
            </ul>
          </section>

          {/* Seção 7 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <CheckCircle2 size={20} />
              <h2 className="font-display text-xl font-bold text-text">7. Seus Direitos como Titular (Art. 18 LGPD)</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              A qualquer momento e de forma gratuita, você pode exercer os seguintes direitos garantidos pela LGPD:
            </p>
            <div className="space-y-1.5 text-xs text-text-muted">
              <p>• <strong>Confirmação e Acesso:</strong> Saber se tratamos dados seus e solicitar cópia completa de suas informações.</p>
              <p>• <strong>Correção:</strong> Atualizar dados incompletos, inexatos ou desatualizados diretamente em seu perfil ou via suporte.</p>
              <p>• <strong>Anonimização ou Eliminação:</strong> Solicitar a exclusão ou anonimização de dados desnecessários ou tratados em desconformidade com a lei.</p>
              <p>• <strong>Portabilidade:</strong> Solicitar seus relatórios e histórico didático em formato estruturado.</p>
              <p>• <strong>Revogação do Consentimento:</strong> Revogar autorizações concedidas a qualquer tempo, com encerramento de comunicações não essenciais.</p>
            </div>
          </section>

          {/* Seção 8 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Bell size={20} />
              <h2 className="font-display text-xl font-bold text-text">8. Cookies e Tecnologias de Sessão</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Utilizamos cookies exclusivamente técnicos e funcionais (`auth_token` e preferências de tema) para manter sua sessão conectada enquanto você navega e estuda. Não realizamos rastreamento invasivo para publicidade de terceiros.
            </p>
          </section>

          {/* Seção 9 */}
          <section className="space-y-3 border-t border-border pt-8">
            <div className="flex items-center gap-2.5 text-primary">
              <Mail size={20} />
              <h2 className="font-display text-xl font-bold text-text">9. Canal de Atendimento e DPO</h2>
            </div>
            <p className="text-sm leading-relaxed text-text-muted">
              Para exercer qualquer dos seus direitos previstos na LGPD, tirar dúvidas sobre o tratamento de seus dados ou enviar sugestões, entre em contato diretamente com nossa equipe de privacidade:
            </p>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-text-muted">
              <p className="font-semibold text-text">Encarregado de Proteção de Dados (DPO): Tatiana / Equipe de Privacidade</p>
              <p className="mt-1">E-mail: <a href="mailto:privacidade@tati-ai.com.br" className="text-primary hover:underline">privacidade@tati-ai.com.br</a></p>
              <p>Prazo de resposta: Em até 15 (quinze) dias conforme estabelece a regulamentação da ANPD.</p>
            </div>
          </section>
        </div>

        {/* Rodapé da página */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-text-subtle sm:flex-row">
          <p>© 2026 Teacher Tati AI — Taty's English Class. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-text transition-colors">Início</Link>
            <Link href="/login" className="hover:text-text transition-colors">Login</Link>
            <Link href="/teste-cefr" className="hover:text-text transition-colors">Teste CEFR</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
