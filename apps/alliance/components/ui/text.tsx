import { Text as RNText, type TextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      display: 'text-[32px] leading-[38px] tracking-tight',
      title1: 'text-[26px] leading-[32px] tracking-tight',
      title2: 'text-[20px] leading-[26px] tracking-tight',
      title3: 'text-[17px] leading-[23px] tracking-tight',
      body: 'text-[15px] leading-[22px]',
      callout: 'text-[14px] leading-[20px]',
      footnote: 'text-[13px] leading-[18px]',
      caption: 'text-[11px] leading-[15px]',
    },
    tone: {
      default: 'text-foreground',
      muted: 'text-foreground-muted',
      subtle: 'text-foreground-subtle',
      accent: 'text-accent',
      inverted: 'text-accent-foreground',
      danger: 'text-danger',
      warning: 'text-warning',
    },
    /** Font family + weight are one axis — RN needs the exact loaded font
     * file per weight, so "bold" text and "mono" text are both selected
     * here rather than composed from separate weight/family props. */
    weight: {
      regular: 'font-sans',
      medium: 'font-sans-medium',
      semibold: 'font-sans-semibold',
      bold: 'font-sans-bold',
      monoRegular: 'font-mono',
      monoMedium: 'font-mono-medium',
      monoSemibold: 'font-mono-semibold',
    },
  },
  defaultVariants: {
    variant: 'body',
    tone: 'default',
    weight: 'regular',
  },
});

export interface TextComponentProps extends TextProps, VariantProps<typeof textVariants> {
  className?: string;
}

export function Text({ variant, tone, weight, className, ...props }: TextComponentProps) {
  return <RNText className={cn(textVariants({ variant, tone, weight }), className)} {...props} />;
}
