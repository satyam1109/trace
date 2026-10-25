import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon } from '../components/Icon';
import { useTheme, ui } from './theme';
import { formatMoney, type Currency } from '../finance/model';
export function Copy({
  children,
  muted = false,
  bold = false,
  size = 15,
  color,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  size?: number;
  color?: string;
  style?: StyleProp<import('react-native').TextStyle>;
}) {
  const { colors: c } = useTheme();
  return (
    <Text
      style={[
        ui.text,
        {
          fontSize: size,
          lineHeight: Math.ceil(size * 1.4),
          color: color || (muted ? c.muted : c.ink),
          fontWeight: bold ? '700' : '400',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Amount({
  value,
  currency = 'INR',
  size = 30,
  color,
  hidden = false,
  label,
  fit = false,
}: {
  value: number;
  currency?: Currency;
  size?: number;
  color?: string;
  hidden?: boolean;
  label?: string;
  fit?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Text
      accessibilityLabel={label}
      numberOfLines={fit ? 1 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={0.5}
      style={{
        fontSize: size,
        lineHeight: Math.ceil(size * 1.25),
        fontWeight: '700',
        color: color || c.ink,
        letterSpacing: size >= 30 ? -1 : 0,
        fontVariant: ['tabular-nums'],
        flexShrink: 1,
      }}
    >
      {formatMoney(value, currency, hidden)}
    </Text>
  );
}
export function Card({
  children,
  style,
  navy = false,
  onPress,
  label,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  navy?: boolean;
  onPress?: () => void;
  label?: string;
}) {
  const { colors: c } = useTheme();
  const styles = [
    ui.card,
    {
      backgroundColor: navy ? c.navy : c.surface,
      borderColor: navy ? c.navy : c.line,
    },
    style,
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={styles}>{children}</View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors: c } = useTheme();
  const color = danger ? c.danger : secondary ? c.ink : c.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        {
          backgroundColor: danger
            ? c.dangerSoft
            : secondary
            ? c.subtle
            : c.gold,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={19} color={color} /> : null}
      <Text style={[ui.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder = '',
  numeric = false,
  multiline = false,
  maxLength = 100,
  secure = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  maxLength?: number;
  secure?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        selectionColor={c.gold}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
        maxLength={maxLength}
        secureTextEntry={secure}
        style={[
          ui.field,
          {
            backgroundColor: c.surface,
            borderColor: c.line,
            color: c.ink,
            minHeight: multiline ? 84 : 52,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={[ui.label, { color: c.muted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[
          ui.field,
          ui.spread,
          { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <Copy>{options.find(o => o.value === value)?.label || value}</Copy>
        <Icon name="down" color={c.muted} size={18} />
      </Pressable>
      {open ? (
        <View
          style={{
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            nestedScrollEnabled
            style={{ maxHeight: 260 }}
            keyboardShouldPersistTaps="handled"
          >
            {options.map(o => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={o.label}
                accessibilityState={{ checked: o.value === value }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[
                  ui.spread,
                  {
                    padding: 15,
                    backgroundColor: o.value === value ? c.goldSoft : undefined,
                  },
                ]}
              >
                <Copy color={o.value === value ? c.goldInk : c.ink}>
                  {o.label}
                </Copy>
                {o.value === value ? (
                  <Icon name="check" color={c.goldInk} size={18} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
export function Chip({
  label,
  onPress,
  selected = false,
  style,
  color,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={!onPress}
      style={[
        ui.chip,
        { backgroundColor: selected ? c.navy : c.subtle },
        style,
      ]}
    >
      <Copy size={12} bold color={color || (selected ? c.onNavy : c.muted)}>
        {label}
      </Copy>
    </Pressable>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={ui.section}>
      <Text style={[ui.heading, { color: c.ink, flexShrink: 1 }]}>{title}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Copy size={12} bold color={c.goldInk}>
            {action}
          </Copy>
        </Pressable>
      ) : null}
    </View>
  );
}
export function Progress({
  value,
  color,
  label,
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const { colors: c } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)),
      }}
      style={{
        height: 7,
        borderRadius: 12,
        backgroundColor: c.subtle,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: 7,
          width: `${Math.max(
            0,
            Math.min(100, Number.isFinite(value) ? value : 0),
          )}%`,
          borderRadius: 12,
          backgroundColor: color || c.gold,
        }}
      />
    </View>
  );
}
export function Setting({
  title,
  subtitle,
  icon,
  onPress,
  value,
  toggle,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  value?: string;
  toggle?: boolean;
}) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      accessibilityRole={
        toggle !== undefined ? 'none' : onPress ? 'button' : 'text'
      }
      accessibilityLabel={title}
      accessibilityState={
        toggle === undefined ? undefined : { checked: toggle }
      }
      onPress={toggle === undefined ? onPress : undefined}
      disabled={!onPress}
      style={[ui.setting, { borderColor: c.line }]}
    >
      {icon ? (
        <View style={[ui.iconBox, { backgroundColor: c.subtle }]}>
          <Icon name={icon} color={c.muted} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Copy bold>{title}</Copy>
        {subtitle ? (
          <Copy muted size={12}>
            {subtitle}
          </Copy>
        ) : null}
      </View>
      {toggle !== undefined ? (
        <Switch
          accessibilityLabel={title}
          value={toggle}
          onValueChange={onPress}
          thumbColor="#FFFFFF"
          trackColor={{ false: c.line, true: c.gold }}
        />
      ) : (
        <>
          {value ? (
            <Copy muted size={12}>
              {value}
            </Copy>
          ) : null}
          {onPress ? <Icon name="arrow" color={c.muted} size={17} /> : null}
        </>
      )}
    </Pressable>
  );
}
export function Empty({
  title,
  copy,
  action,
  onPress,
  icon = 'wallet',
}: {
  title: string;
  copy: string;
  action?: string;
  onPress?: () => void;
  icon?: string;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={{ paddingVertical: 30, gap: 15, alignItems: 'flex-start' }}>
      <View style={[ui.iconBox, { backgroundColor: c.goldSoft }]}>
        <Icon name={icon} size={25} color={c.goldInk} />
      </View>
      <Text style={[ui.title, { color: c.ink }]}>{title}</Text>
      <Copy muted>{copy}</Copy>
      {action && onPress ? <Button label={action} onPress={onPress} /> : null}
    </View>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  const { colors: c } = useTheme();
  return message ? (
    <View
      accessibilityRole="alert"
      style={[ui.error, { backgroundColor: c.dangerSoft }]}
    >
      <Copy size={13} color={c.danger}>
        {message}
      </Copy>
    </View>
  ) : null;
}
export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[ui.modalScrim, { backgroundColor: c.scrim }]}
      >
        <View
          accessibilityViewIsModal
          style={[ui.sheet, { backgroundColor: c.bg }]}
        >
          <View style={ui.sheetHeader}>
            <Text style={[ui.title, { color: c.ink, flex: 1 }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              style={[ui.close, { backgroundColor: c.subtle }]}
            >
              <Icon name="close" color={c.ink} size={22} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={ui.formBody}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                padding: 20,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: c.line,
                backgroundColor: c.bg,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function FormSheet({
  title,
  onClose,
  onSave,
  saveLabel = 'Save',
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  saveLabel?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  const { colors: c } = useTheme();
  async function save() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={title}
      onClose={() => {
        if (!pending.current) onClose();
      }}
      footer={
        <Button
          label={busy ? 'Saving…' : saveLabel}
          disabled={busy}
          onPress={save}
        />
      }
    >
      <ErrorNotice message={error} />
      {children}
      {busy ? <ActivityIndicator color={c.gold} /> : null}
    </Sheet>
  );
}
export function Confirm({
  title,
  copy,
  label,
  onConfirm,
  onClose,
}: {
  title: string;
  copy: string;
  label: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  return (
    <FormSheet
      title={title}
      onClose={onClose}
      saveLabel={label}
      onSave={onConfirm}
    >
      <Copy>{copy}</Copy>
      <Button
        label={label === 'Discard entry' ? 'Keep entry' : 'Cancel'}
        secondary
        onPress={onClose}
      />
    </FormSheet>
  );
}
