// Conversão de px para rem usando base 16px
export function pxToRem(px: number): string {
  return `${px / 16}rem`;
}

// Gera objeto de espaçamento em rem a partir de valores em px
export function spacingRem(px: number): string {
  return pxToRem(px);
}

// Gera um objeto de breakpoints em rem
export const breakpoints = {
  sm: pxToRem(480),
  md: pxToRem(768),
  lg: pxToRem(1024),
  xl: pxToRem(1280),
  '2xl': pxToRem(1536),
} as const;
