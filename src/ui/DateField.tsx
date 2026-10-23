import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import NativeLedger from '../native/NativeMoneyLedger';
import { Icon } from '../components/Icon';
import { Copy, ErrorNotice } from './components';
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
  const { colors: c } = useTheme();
  const [error, setError] = useState('');
  return (
    <View style={{ gap: 7 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={async () => {
          try {
            if (!NativeLedger) throw Error('Date picker unavailable.');
            const result =
              mode === 'time'
                ? await NativeLedger.pickTime(value)
                : await NativeLedger.pickDate(value);
            if (result) onChangeText(result);
            setError('');
          } catch (e) {
            setError(String(e));
          }
        }}
        style={[
          ui.field,
          ui.spread,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <Copy>{value || 'Choose date'}</Copy>
        <Icon name="down" size={17} color={c.muted} />
      </Pressable>
      <ErrorNotice message={error} />
    </View>
  );
}
