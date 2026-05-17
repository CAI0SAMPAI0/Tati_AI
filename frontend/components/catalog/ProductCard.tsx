import type { ElementType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CheckoutFlow from '@/components/CheckoutFlow';
import {
  BookOpen,
  MessageCircle,
  Plane,
  Briefcase,
  PenLine,
  Library,
  Sparkles,
} from 'lucide-react';
import {
  CatalogMaterial,
  MaterialCategory,
  categoryLabel,
  categoryStyles,
  normalizeCategory,
} from '@/lib/catalog';

const categoryIcons: Record<MaterialCategory, ElementType> = {
  grammar: BookOpen,
  speaking: MessageCircle,
  travel: Plane,
  business: Briefcase,
  vocabulary: Library,
  writing: PenLine,
  other: Sparkles,
};

type ProductCardProps = {
  item: CatalogMaterial;
  showOwned?: boolean;
  onAccessGranted?: () => void;
};

export default function ProductCard({ item, showOwned, onAccessGranted }: ProductCardProps) {
  const category = normalizeCategory(item.category);
  const styles = categoryStyles(category);
  const Icon = categoryIcons[category];
  const priceLabel = `R$ ${item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  // Pega o valor original que vem do banco
  const rawPreview = item.preview_url || item.thumbnail_url;

  // Pega a URL da variável de ambiente (caso falte por algum motivo, deixa uma string vazia)
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL || '';

  // Valida e monta o preview de forma limpa
  const preview = rawPreview
    ? (rawPreview.startsWith('http') ? rawPreview : `${storageUrl}/${rawPreview}`)
    : null;

  return (
    <article className="card-surface flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-glow">
      <div className={`flex items-center justify-between px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${styles.header}`}>
        <span>{categoryLabel(category)}</span>
        <span>{priceLabel}</span>
      </div>

      {showOwned ? (
        <Link href={`/activities/hub/${item.id}/ler`} className="block">
          <div className="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-primarySoft">
            {preview ? (
              <Image
                src={preview}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className={`flex h-full items-center justify-center ${styles.icon}`}>
                <Icon size={40} strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="px-4 pb-4 pt-3">
            <h3 className="font-display text-lg font-bold text-ink line-clamp-2">{item.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
              {item.description || 'Material exclusivo curado pela Teacher Tati.'}
            </p>
          </div>
        </Link>
      ) : (
        <div className="block cursor-default">
          <div className="relative mx-4 mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-primarySoft">
            {preview ? (
              <Image
                src={preview}
                alt={item.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className={`flex h-full items-center justify-center ${styles.icon}`}>
                <Icon size={40} strokeWidth={1.5} />
              </div>
            )}
          </div>
          <div className="px-4 pb-4 pt-3">
            <h3 className="font-display text-lg font-bold text-ink line-clamp-2">{item.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
              {item.description || 'Material exclusivo curado pela Teacher Tati.'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-line px-4 py-3">
        <span className="text-sm font-bold text-ink">{priceLabel}</span>
        {showOwned ? (
          <Link
            href={`/activities/hub/${item.id}/ler`}
            className="rounded-hub bg-success/10 px-3 py-1.5 text-xs font-bold text-success transition hover:bg-success/20"
          >
            Ler agora
          </Link>
        ) : (
          <div className="flex-shrink-0">
            <CheckoutFlow
              item={{ id: item.id, title: item.title, price: item.price }}
              onAccessGranted={onAccessGranted}
            />
          </div>
        )}
      </div>
    </article>
  );
}
