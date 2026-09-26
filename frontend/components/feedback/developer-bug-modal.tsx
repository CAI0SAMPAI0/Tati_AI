'use client';

import React, { useState, useRef } from 'react';
import { DialogModal } from '@/components/ui/dialog-modal';
import { Button } from '@/components/ui/button';
import { apiPost, apiUpload } from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Bug, Upload, X, Loader2, Send, CheckCircle2 } from 'lucide-react';

interface DeveloperBugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DeveloperBugModal({ isOpen, onClose }: DeveloperBugModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 10MB.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiUpload<{ url: string }>('/flashcard-assets/upload-image', formData);

      if (res && res.ok && res.data?.url) {
        setImageUrls(prev => [...prev, res.data.url]);
        toast.success('Captura de tela anexada com sucesso!');
      } else {
        toast.error('Erro ao fazer upload da imagem.');
      }
    } catch {
      toast.error('Erro de conexão no upload.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImageUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error('Por favor, preencha o título e a descrição do problema.');
      return;
    }

    setIsSubmitting(true);
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const finalDescription = contactInfo.trim()
        ? `${description.trim()}\n\n---\nContato informado pelo usuário: ${contactInfo.trim()}`
        : description.trim();

      await apiPost('/activities/developer-bug-report', {
        title: title.trim(),
        description: finalDescription,
        image_urls: imageUrls,
        page_url: pageUrl,
        user_agent: userAgent,
      });

      toast.success('Relatório de bug enviado ao programador! Obrigado por reportar.', {
        duration: 5000,
        icon: '🛠️',
      });

      setTitle('');
      setDescription('');
      setContactInfo('');
      setImageUrls([]);
      onClose();
    } catch {
      toast.error('Erro ao enviar relatório de bug. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      onClose={onClose}
      title="Reportar Problema Técnico ao Programador"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3.5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bug size={18} />
          </div>
          <div className="text-xs text-text-subtle leading-relaxed">
            <p className="font-semibold text-text mb-0.5">Fale diretamente com a equipe de desenvolvimento</p>
            Encontrou algum bug, erro na tela ou botão que não responde? Descreva abaixo e anexe fotos se desejar para resolvermos o mais rápido possível.
          </div>
        </div>

        {/* Título do bug */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
            O que deu errado? (Título)
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Botão não avança no flashcard, áudio não toca..."
            className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-text text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            required
          />
        </div>

        {/* Descrição detalhada */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
            Detalhes do problema
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="O que você estava fazendo quando o erro ocorreu? Apareceu alguma mensagem?"
            className="w-full bg-bg border border-border rounded-2xl p-3.5 text-text text-sm placeholder:text-text-muted/40 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            required
          />
        </div>

        {/* Contato opcional (ideal para quem está na tela de login) */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
            Seu Email ou WhatsApp <span className="text-text-muted/60 font-normal lowercase">(opcional para retorno)</span>
          </label>
          <input
            type="text"
            value={contactInfo}
            onChange={e => setContactInfo(e.target.value)}
            placeholder="Ex: aluno@gmail.com ou (11) 99999-9999"
            className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-text text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Upload de Capturas de Tela / Fotos */}
        <div>
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
            Fotos / Capturas de tela (Opcional)
          </label>

          {/* Miniaturas de imagens anexadas */}
          {imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2.5 mb-2.5">
              {imageUrls.map((url, idx) => (
                <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                    title="Remover anexo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full text-xs gap-2 py-2.5 border-dashed border-2 hover:border-primary/50"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Fazendo upload da foto...
              </>
            ) : (
              <>
                <Upload size={16} /> Anexar print / foto da tela
              </>
            )}
          </Button>
        </div>

        {/* Contexto automático da página */}
        <div className="text-[11px] text-text-muted bg-surface/50 rounded-xl p-2.5 border border-border/50 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span>A URL da página e dados do navegador serão incluídos automaticamente no relatório.</span>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || !title.trim() || !description.trim()} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enviando ao programador...
              </>
            ) : (
              <>
                <Send size={16} /> Enviar ao Programador
              </>
            )}
          </Button>
        </div>
      </form>
    </DialogModal>
  );
}
