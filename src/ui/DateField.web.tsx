import React from 'react';
import { View, Text } from 'react-native';
import { useTheme, ui } from './theme';
export default function DateField({
  label,
  value,
  onChangeText,
  mode = 'date',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  mode?: 'date' | 'time';
}) {
  const { colors: c, dark } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      {React.createElement('input', {
        'aria-label': label,
        type: mode,
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText(e.target.value),
        style: {
          boxSizing: 'border-box',
          width: '100%',
          minWidth: 0,
          minHeight: 52,
          padding: '13px 15px',
          borderRadius: 14,
          border: '1px solid ' + c.line,
          backgroundColor: c.surface,
          color: c.ink,
          font: '15px system-ui',
          colorScheme: dark ? 'dark' : 'light',
        },
      })}
    </View>
  );
}
