import { cn } from '@/lib/utils';
import { Text, type TextComponentProps } from './text';

/**
 * The small uppercase mono label used across the brand for status text,
 * timestamps, and section eyebrows — e.g. "4 AGENTS LIVE", "12:04 PM".
 */
export function Label({ className, tone = 'subtle', weight = 'monoMedium', ...props }: TextComponentProps) {
  return (
    <Text
      variant="caption"
      tone={tone}
      weight={weight}
      className={cn('uppercase tracking-widest', className)}
      {...props}
    />
  );
}
