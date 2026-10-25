import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { monthDate, monthLabel } from '../finance/model';
import { Button, Copy, Sheet } from './components';
import { useTheme, ui } from './theme';
export function MonthPicker({
  month,
  onSelect,
  onClose,
  title = 'Choose month',
  maxMonth,
  disabledMonth,
}: {
  month: string;
  onSelect: (month: string) => void;
  onClose: () => void;
  title?: string;
  maxMonth?: string;
  disabledMonth?: string;
}) {
  const { colors: c } = useTheme();
  const [year, setYear] = useState(monthDate(month).getFullYear());
  return (
    <Sheet title={title} onClose={onClose}>
      <View style={ui.spread}>
        <Button
          label="Previous year"
          secondary
          onPress={() => setYear(Math.max(2000, year - 1))}
        />
        <Copy bold size={22}>
          {year}
        </Copy>
        <Button
          label="Next year"
          secondary
          onPress={() => setYear(Math.min(2100, year + 1))}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {Array.from({ length: 12 }, (_, i) => {
          const m = `${year}-${String(i + 1).padStart(2, '0')}`,
            selected = m === month,
            disabled =
              (maxMonth !== undefined && m > maxMonth) || m === disabledMonth;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={monthLabel(m)}
              accessibilityState={{ selected }}
              disabled={disabled}
              onPress={() => onSelect(m)}
              style={{
                opacity: disabled ? 0.35 : 1,
                width: '30%',
                paddingVertical: 22,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: selected ? c.goldSoft : c.surface,
                borderColor: c.line,
                borderWidth: 1,
              }}
            >
              <Copy bold={selected} color={selected ? c.goldInk : c.ink}>
                {new Date(year, i, 1).toLocaleDateString('en-IN', {
                  month: 'short',
                })}
              </Copy>
            </Pressable>
          );
        })}
      </View>
      <Copy muted size={12}>
        Historical months keep their own records and budgets.
      </Copy>
    </Sheet>
  );
}
