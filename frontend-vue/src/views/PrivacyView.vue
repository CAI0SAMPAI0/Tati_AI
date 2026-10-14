<script setup lang="ts">
import { ArrowLeft, Shield, Lock, FileText, Mail } from 'lucide-vue-next';
</script>

<template>
  <div class="min-h-screen bg-bg text-text py-12 px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-3xl">
      <!-- Back Link -->
      <router-link
        to="/"
        class="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft :size="16" />
        <span>Voltar para a página inicial</span>
      </router-link>

      <div class="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-10">
        <!-- Header -->
        <div class="border-b border-line pb-6">
          <div class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primarySoft text-primary mb-4">
            <Shield :size="24" />
          </div>
          <h1 class="font-display text-2xl font-bold text-ink sm:text-3xl">
            Política de Privacidade & Termos de Uso
          </h1>
          <p class="mt-2 text-xs text-muted">
            Última atualização: Outubro de 2026 • Em total conformidade com a LGPD (Lei nº 13.709/2018).
          </p>
        </div>

        <!-- Content -->
        <div class="prose prose-sm max-w-none pt-6 text-xs leading-relaxed text-muted space-y-6">
          <section>
            <h2 class="font-display text-base font-bold text-ink mb-2">1. Visão Geral</h2>
            <p>
              A <strong>Teacher Tati AI</strong> é uma plataforma inteligente e humanizada de aprendizado de inglês criada para fornecer conversação, feedback gramatical, fonética e exames de nivelamento baseados no Quadro Comum Europeu de Referência para Línguas (CEFR). Valorizamos sua privacidade e tratamos seus dados pessoais com confidencialidade e segurança absoluta.
            </p>
          </section>

          <section>
            <h2 class="font-display text-base font-bold text-ink mb-2">2. Dados Pessoais Coletados</h2>
            <p>Para proporcionar uma experiência educacional personalizada, coletamos:</p>
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Dados de Identificação:</strong> Nome, endereço de e-mail e nome de usuário.</li>
              <li><strong>Dados de Aprendizado:</strong> Nível CEFR, histórico de conversas, transcrições de fala, resultados de avaliações e tempo de estudo.</li>
              <li><strong>Áudios e Gravações de Voz:</strong> Processados em tempo real exclusivamente para avaliação de pronúncia, fluência e geração de feedback pedagógico pela Teacher Tati.</li>
            </ul>
          </section>

          <section>
            <h2 class="font-display text-base font-bold text-ink mb-2">3. Finalidade do Tratamento</h2>
            <p>Seus dados são utilizados exclusivamente para:</p>
            <ul class="list-disc pl-5 mt-2 space-y-1">
              <li>Personalizar o nível de complexidade e os tópicos das aulas da Teacher Tati.</li>
              <li>Gerar relatórios de evolução acadêmica e emitir certificados ou diagnósticos de proficiência.</li>
              <li>Autenticar o acesso seguro e manter as preferências de sotaque selecionadas pelo estudante.</li>
            </ul>
          </section>

          <section>
            <h2 class="font-display text-base font-bold text-ink mb-2">4. Segurança e Armazenamento</h2>
            <p>
              Adotamos criptografia de ponta (TLS/HTTPS em trânsito e criptografia de chave forte em repouso), tokens JWT com tempo de expiração curto e arquitetura segura de banco de dados. Nunca compartilhamos nem vendemos seus dados para terceiros ou para fins publicitários.
            </p>
          </section>

          <section>
            <h2 class="font-display text-base font-bold text-ink mb-2">5. Seus Direitos (Art. 18 da LGPD)</h2>
            <p>
              Você pode, a qualquer momento, solicitar a confirmação, o acesso, a correção de dados incompletos ou a exclusão definitiva da sua conta e histórico de aprendizado através do painel de configurações ou por e-mail ao nosso encarregado de dados.
            </p>
          </section>

          <section class="border-t border-line pt-6">
            <h2 class="font-display text-base font-bold text-ink mb-2">6. Contato com o DPO</h2>
            <p>
              Dúvidas ou solicitações sobre o tratamento de dados podem ser encaminhadas para o e-mail de suporte oficial:
              <strong class="text-primary">contato@tati-ai.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
