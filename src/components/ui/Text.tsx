import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme, type ColorTokens, type TypographyVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[theme.typography[variant], { color: theme.colors[color], textAlign: align }, style]}
      {...rest}
    />
  );
}
