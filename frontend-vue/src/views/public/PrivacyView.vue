<script setup lang="ts">
import { useRouter } from 'vue-router';
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
  Sparkles,
} from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const CONTACT_EMAIL = 'cmsampaio135@gmail.com';
</script>

<template>
  <div class="min-h-screen bg-bg text-text">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button
          type="button"
          @click="router.push('/')"
          class="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
        >
          <img
            src="/images/tati_logo.jpg"
            alt="Taty AI"
            class="w-9 h-9 rounded-full object-cover border-2 border-primary/20"
            @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
          />
          <span class="font-display font-extrabold text-base tracking-tight text-text">
            Teacher <span class="text-primary">Taty</span> AI
          </span>
        </button>

        <button
          type="button"
          @click="router.push('/')"
          class="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Voltar ao início</span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-6 py-12 space-y-10 animate-fade-in text-xs sm:text-sm leading-relaxed text-text-muted">
      <!-- Top Title -->
      <div class="space-y-3 text-center sm:text-left">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-xs font-bold uppercase tracking-widest">
          <Shield class="w-3.5 h-3.5" />
          <span>LGPD & Proteção de Dados</span>
        </div>
        <h1 class="font-display text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
          Política de Privacidade
        </h1>
        <p class="text-xs text-text-subtle">
          Última atualização: Outubro de 2026 · Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>
      </div>

      <!-- Section Cards -->
      <div class="space-y-6">
        <section class="p-6 sm:p-8 bg-surface border border-border rounded-2xl space-y-3">
          <h2 class="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Lock class="w-5 h-5 text-primary" />
            <span>1. Compromisso com a Privacidade</span>
          </h2>
          <p>
            A Teacher Tati AI valoriza a privacidade dos seus alunos e usuários. Esta política descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nossa plataforma de aprendizado de inglês, chat com inteligência artificial e materiais pedagógicos.
          </p>
        </section>

        <section class="p-6 sm:p-8 bg-surface border border-border rounded-2xl space-y-3">
          <h2 class="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Eye class="w-5 h-5 text-primary" />
            <span>2. Dados Coletados</span>
          </h2>
          <ul class="list-disc pl-5 space-y-2">
            <li><strong>Informações cadastrais:</strong> nome, username, e-mail e nível de proficiência em inglês (CEFR).</li>
            <li><strong>Interações de voz e texto:</strong> transcrições e áudios enviados para fins de avaliação pedagógica, correção fonética e personalização do ensino.</li>
            <li><strong>Métricas de uso:</strong> progresso de lições, histórico de exames, exercícios de vocabulário e tempo de estudo.</li>
            <li><strong>Informações de pagamento:</strong> processadas diretamente por gateways certificados (Asaas / Mercado Pago); não armazenamos dados de cartão em nossos servidores.</li>
          </ul>
        </section>

        <section class="p-6 sm:p-8 bg-surface border border-border rounded-2xl space-y-3">
          <h2 class="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Server class="w-5 h-5 text-primary" />
            <span>3. Finalidade do Tratamento</span>
          </h2>
          <p>
            Os dados coletados destinam-se exclusivamente a:
          </p>
          <ul class="list-disc pl-5 space-y-1.5">
            <li>Fornecer respostas e feedbacks pedagógicos em tempo real via IA;</li>
            <li>Calcular seu nível de inglês no padrão internacional CEFR;</li>
            <li>Proteger materiais digitais autorais com identificadores de segurança;</li>
            <li>Melhorar continuamente a precisão fonética e a qualidade dos modelos de ensino.</li>
          </ul>
        </section>

        <section class="p-6 sm:p-8 bg-surface border border-border rounded-2xl space-y-3">
          <h2 class="text-base sm:text-lg font-bold text-text flex items-center gap-2">
            <Mail class="w-5 h-5 text-primary" />
            <span>4. Contato com o Encarregado (DPO)</span>
          </h2>
          <p>
            Você pode exercer seus direitos de confirmação, acesso, correção ou eliminação de dados entrando em contato direto com nossa equipe pelo e-mail:
          </p>
          <div class="p-4 rounded-xl bg-bg border border-border font-mono text-xs text-primary font-bold">
            {{ CONTACT_EMAIL }}
          </div>
        </section>
      </div>

      <!-- Bottom Return -->
      <div class="pt-6 border-t border-border flex justify-center">
        <Button size="lg" @click="router.push('/')">
          <ArrowLeft class="w-4 h-4 mr-2" />
          <span>Voltar para a Página Principal</span>
        </Button>
      </div>
    </main>
  </div>
</template>
