import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  expenseCategories,
  expenseCategoryLabel,
  type ExpenseCategory,
} from '../categories';
import { ledger } from '../services/ledger';
import { localPaymentTime, validateManual } from '../services/manualExpense';
import { colors, s } from '../styles';
import type { PaymentMethod } from '../types';
import { Icon } from './Icon';

export function ManualExpenseForm({
  demo,
  onClose,
  onSaved,
}: {
  demo: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [initial] = useState(() => new Date());
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [remarks, setRemarks] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [category, setCategory] = useState<ExpenseCategory | 'lent'>(
    'uncategorised',
  );
  const [expanded, setExpanded] = useState(false);
  const pad = (value: number) => String(value).padStart(2, '0');
  const [date, setDate] = useState(
    `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(
      initial.getDate(),
    )}`,
  );
  const [time, setTime] = useState(
    `${pad(initial.getHours())}:${pad(initial.getMinutes())}`,
  );
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const input = {
        amount,
        recipient,
        remarks,
        method,
        category:
          category === 'lent' ? ('lent' as const) : ('expense' as const),
        expenseCategory:
          category === 'lent' ? ('uncategorised' as const) : category,
        occurredAt: localPaymentTime(date, time),
        demo,
      };
      validateManual(input);
      await ledger.createManual(input);
      // Keep this surface mounted briefly so a second tap cannot hit history behind it.
      await new Promise<void>(resolve => setTimeout(resolve, 300));
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this expense.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!saving.current) onClose();
      }}
    >
      <View style={s.modalBackdrop}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={s.modalScroll}
          contentContainerStyle={s.modalScrollContent}
        >
          <View style={[s.modalCard, s.manualCard]}>
            <View style={s.modalHeading}>
              <Text style={s.manualTitle}>Create expense</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel manual expense"
                disabled={busy}
                onPress={onClose}
                style={s.manualClose}
              >
                <Icon name="close" size={22} />
              </Pressable>
            </View>
            <Text style={s.smallMuted}>
              {demo
                ? 'Saved in your sample workspace.'
                : 'Saved privately on this phone.'}{' '}
              Add cash or a missed payment.
            </Text>
            <Text style={s.inputLabel}>AMOUNT (₹)</Text>
            <TextInput
              accessibilityLabel="Expense amount"
              style={s.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              maxLength={12}
              editable={!busy}
            />
            <Text style={s.inputLabel}>PAYMENT METHOD</Text>
            <View style={s.filterRow}>
              {(['CASH', 'UPI', 'CARD', 'BANK'] as const).map(value => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`Pay by ${value}`}
                  accessibilityState={{ checked: method === value }}
                  disabled={busy}
                  onPress={() => setMethod(value)}
                  style={[s.filter, method === value && s.filterActive]}
                >
                  <Text style={[s.filterText, method === value && s.whiteText]}>
                    {value === 'CASH'
                      ? 'Cash'
                      : value === 'CARD'
                      ? 'Card'
                      : value === 'BANK'
                      ? 'Bank'
                      : 'UPI'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.inputLabel}>RECIPIENT (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Manual recipient"
              style={s.input}
              value={recipient}
              onChangeText={setRecipient}
              maxLength={100}
              placeholder="Who did you pay?"
              editable={!busy}
            />
            <Text style={s.inputLabel}>REMARKS (OPTIONAL)</Text>
            <TextInput
              accessibilityLabel="Manual remarks"
              style={[s.input, s.remarksInput]}
              value={remarks}
              onChangeText={setRemarks}
              maxLength={500}
              multiline
              placeholder="Add a note"
              editable={!busy}
            />
            <Text style={s.inputLabel}>CATEGORY</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose manual category"
              accessibilityState={{ expanded }}
              disabled={busy}
              style={s.categoryDropdown}
              onPress={() => setExpanded(!expanded)}
            >
              <Text style={s.categoryTitle}>
                {category === 'lent'
                  ? 'Lent money'
                  : expenseCategoryLabel(category)}
              </Text>
              <Icon name="down" size={16} />
            </Pressable>
            {expanded && (
              <View style={s.categoryMenu}>
                <ScrollView nestedScrollEnabled style={s.categoryMenuScroll}>
                  {[
                    ...expenseCategories,
                    { value: 'lent', label: 'Lent money' } as const,
                  ].map(option => (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label}
                      accessibilityState={{
                        checked: category === option.value,
                      }}
                      onPress={() => {
                        setCategory(option.value);
                        setExpanded(false);
                      }}
                      style={s.categoryMenuItem}
                    >
                      <Text style={s.categoryTitle}>{option.label}</Text>
                      {category === option.value && (
                        <Icon name="check" size={16} />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <Text style={s.inputLabel}>PAYMENT DATE · YYYY-MM-DD</Text>
            <TextInput
              accessibilityLabel="Payment date"
              style={s.input}
              value={date}
              onChangeText={setDate}
              maxLength={10}
              placeholder="YYYY-MM-DD"
              editable={!busy}
            />
            <Text style={s.inputLabel}>PAYMENT TIME · HH:mm (24-HOUR)</Text>
            <TextInput
              accessibilityLabel="Payment time"
              style={s.input}
              value={time}
              onChangeText={setTime}
              maxLength={5}
              placeholder="14:30"
              editable={!busy}
            />
            <Text style={s.smallMuted}>
              Location is not inferred for manual entries. Check history first
              to avoid recording a payment twice.
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" style={s.manualError}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save expense"
              disabled={busy}
              onPress={save}
              style={[s.button, busy && s.disabled]}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Icon name="check" size={18} color={colors.white} />
                  <Text style={s.buttonText}>Save expense</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
