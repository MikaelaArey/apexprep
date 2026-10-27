import { Text, type TextProps } from 'react-native';
import { type as typeScale, useColors, type Palette, type TypeVariant } from './theme';

export interface TProps extends TextProps {
  variant?: TypeVariant;
  color?: keyof Palette;
  weight?: '400' | '500' | '600' | '700';
  align?: 'left' | 'center' | 'right';
  serif?: boolean;
}

/** Text in the app's type scale. */
export function T({ variant = 'body', color = 'text', weight, align, serif, style, ...rest }: TProps) {
  const c = useColors();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        typeScale[variant],
        { color: c[color] },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        serif && { fontFamily: 'ui-serif' },
        style,
      ]}
    />
  );
}
