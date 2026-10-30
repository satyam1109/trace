import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  expenseCategories,
  expenseCategoryLabel,
  type ExpenseCategory,
} from '../categories';
import { isBrowser, ledger } from '../services/ledger';
import { colors as baseColors } from '../theme';
import { useTheme } from '../ui/theme';
import type { Transaction, TransactionCategory } from '../types';
import { Icon } from './Icon';
import './popupGlass';

export type PopupDetails = {
  categorySelected: boolean;
  recipient: string;
  remarks: string;
  category: TransactionCategory;
  expenseCategory: ExpenseCategory;
};

/** Sample counterpart to the native Android compact, expandable payment sheet. */
export function IncomingPaymentPrompt({
  payment,
  onSaved,
  onEdit,
  customCategories = [],
}: {
  payment: Transaction;
  customCategories?: { value: ExpenseCategory; label: string }[];
  onSaved: (discarded?: boolean) => void;
  onEdit: (details: PopupDetails) => void;
}) {
  const { colors: palette } = useTheme();
  const colors = useMemo(
    () => ({
      ...baseColors,
      primary: palette.bg,
      primaryRaised: palette.surface,
      accent: palette.ink,
      onPrimary: palette.ink,
      onPrimaryMuted: palette.muted,
    }),
    [palette],
  );
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { height } = useWindowDimensions();
  const [remarks, setRemarks] = useState(payment.remarks);
  const [category, setCategory] = useState(payment.category);
  const [categorySelected, setCategorySelected] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState(
    payment.expenseCategory,
  );
  const [expanded, setExpanded] = useState(false);
  const [detailsHeight, setDetailsHeight] = useState(360);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [deadline, setDeadline] = useState(() => Date.now() + 5000);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const offset = useRef(new Animated.Value(360)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (alive) {
          setReduceMotion(value);
          setMotionReady(true);
        }
      })
      .catch(() => {
        if (alive) setMotionReady(true);
      });
    const listener = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (!motionReady) return;
    Animated.parallel([
      reduceMotion
        ? Animated.timing(offset, {
            toValue: 0,
            duration: 0,
            useNativeDriver: !isBrowser,
          })
        : Animated.spring(offset, {
            toValue: 0,
            damping: 23,
            stiffness: 245,
            mass: 0.85,
            overshootClamping: false,
            useNativeDriver: !isBrowser,
          }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 180,
        useNativeDriver: !isBrowser,
      }),
    ]).start();
    return () => {
      offset.stopAnimation();
      opacity.stopAnimation();
    };
  }, [offset, opacity, reduceMotion, motionReady]);
  const interact = useCallback(() => {
    const tick = Date.now();
    setNow(tick);
    setDeadline(tick + 10000);
  }, []);
  const expand = useCallback(
    (value: boolean) => {
      if (working.current) return;
      interact();
      setExpanded(value);
      Animated.timing(reveal, {
        toValue: value ? 1 : 0,
        duration: reduceMotion ? 0 : 260,
        useNativeDriver: false,
      }).start();
    },
    [interact, reveal, reduceMotion],
  );
  const dismiss = useCallback(
    (discarded = false) =>
      new Promise<void>(resolve => {
        Animated.parallel([
          Animated.timing(offset, {
            toValue: height,
            duration: reduceMotion ? 0 : 180,
            useNativeDriver: !isBrowser,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: reduceMotion ? 0 : 180,
            useNativeDriver: !isBrowser,
          }),
        ]).start(() => {
          onSaved(discarded);
          resolve();
        });
      }),
    [height, offset, opacity, onSaved, reduceMotion],
  );
  const save = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await ledger.updateTransaction(
        payment.id,
        payment.recipient,
        category,
        expenseCategory,
        remarks,
        categorySelected,
      );
      await dismiss();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not save your changes. Please retry.',
      );
      working.current = false;
      expand(true);
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, [
    payment.id,
    payment.recipient,
    category,
    expenseCategory,
    remarks,
    categorySelected,
    dismiss,
    expand,
  ]);
  useEffect(() => {
    if (busy || categoryOpen || confirmDiscard || gestureActive || error)
      return;
    const timer = setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= deadline) save();
    }, 100);
    return () => clearInterval(timer);
  }, [
    deadline,
    busy,
    categoryOpen,
    confirmDiscard,
    gestureActive,
    error,
    save,
  ]);
  async function discard() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await ledger.discardTransaction(payment.id);
      await dismiss(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not discard this entry.',
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  const close = useCallback(() => {
    if (working.current) return;
    if (confirmDiscard) {
      setConfirmDiscard(false);
      interact();
    } else if (categoryOpen) {
      setCategoryOpen(false);
      interact();
    } else save();
  }, [confirmDiscard, categoryOpen, interact, save]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !working.current &&
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onMoveShouldSetPanResponder: (_, gesture) =>
          !working.current &&
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => setGestureActive(true),
        onPanResponderMove: (_, gesture) => {
          if (!reduceMotion)
            offset.setValue(Math.max(-24, Math.min(56, gesture.dy)) * 0.3);
        },
        onPanResponderRelease: (_, gesture) => {
          setGestureActive(false);
          Animated.timing(offset, {
            toValue: 0,
            duration: reduceMotion ? 0 : 150,
            useNativeDriver: !isBrowser,
          }).start();
          if (gesture.dy < -32) expand(true);
          else if (gesture.dy > 48) {
            if (expanded) expand(false);
            else close();
          } else interact();
        },
        onPanResponderTerminate: () => {
          setGestureActive(false);
          offset.setValue(0);
          interact();
        },
      }),
    [expanded, expand, close, interact, offset, reduceMotion],
  );
  const amount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(payment.amountPaise / 100);
  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={[styles.backdrop, expanded && styles.expandedBackdrop]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss payment popup"
          style={StyleSheet.absoluteFill}
          onPress={close}
          disabled={busy}
        />
        <Animated.View
          testID="incoming-payment-popup"
          style={[
            styles.sheet,
            {
              maxHeight: height * 0.84,
              opacity,
              transform: [
                { translateY: offset },
                {
                  scale: offset.interpolate({
                    inputRange: [0, 360],
                    outputRange: [1, 0.96],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View {...pan.panHandlers}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? 'Collapse payment details' : 'Show payment details'
                }
                accessibilityState={{ expanded }}
                disabled={busy}
                onPress={() => expand(!expanded)}
                style={styles.summary}
              >
                <View style={styles.handleArea}>
                  <View style={styles.handle} />
                </View>
                <Text style={styles.eyebrow}>trace. / PAYMENT DETECTED</Text>
                <Text style={styles.amount}>{amount}</Text>
                <Text style={styles.recipient} numberOfLines={2}>
                  To {payment.recipient || 'Unknown recipient'}
                </Text>
                <Text style={styles.source}>
                  {payment.method} · {payment.bank}
                  {payment.account ? ` · ••${payment.account}` : ''}
                </Text>
                {category === 'expense' &&
                expenseCategory !== 'uncategorised' ? (
                  <Text
                    accessibilityLabel="Payment category"
                    style={styles.source}
                  >
                    {customCategories.find(
                      option => option.value === expenseCategory,
                    )?.label || expenseCategoryLabel(expenseCategory)}
                    {payment.categorySource === 'vendor' && !categorySelected
                      ? ' · Remembered'
                      : ''}
                  </Text>
                ) : null}
              </Pressable>
            </View>
            <Animated.View
              pointerEvents={expanded ? 'auto' : 'none'}
              aria-hidden={!expanded}
              accessibilityElementsHidden={!expanded}
              importantForAccessibility={
                expanded ? 'auto' : 'no-hide-descendants'
              }
              style={[
                styles.reveal,
                {
                  height: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, detailsHeight],
                  }),
                  opacity: reveal,
                },
              ]}
            >
              <View
                style={styles.details}
                onLayout={event =>
                  setDetailsHeight(event.nativeEvent.layout.height)
                }
              >
                {confirmDiscard ? (
                  <View accessibilityRole="alert">
                    <Text style={styles.title}>Discard this entry?</Text>
                    <Text style={styles.helper}>
                      Remove {amount} from your history? Your bank payment and
                      SMS stay unchanged.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Keep entry"
                      disabled={busy || !expanded}
                      style={styles.secondary}
                      onPress={() => {
                        setConfirmDiscard(false);
                        interact();
                      }}
                    >
                      <Text style={styles.buttonText}>Keep entry</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Discard entry"
                      disabled={busy || !expanded}
                      style={styles.secondary}
                      onPress={discard}
                    >
                      <Text style={styles.danger}>Discard entry</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.countdown}>
                      {categoryOpen
                        ? 'Choosing a category · payment already saved'
                        : `Already saved · closes in ${Math.max(
                            0,
                            Math.ceil((deadline - now) / 1000),
                          )}s`}
                    </Text>
                    <Text style={styles.label}>Remarks (optional)</Text>
                    <TextInput
                      accessibilityLabel="Popup remarks"
                      value={remarks}
                      tabIndex={expanded ? 0 : -1}
                      onFocus={() => {
                        if (expanded) interact();
                      }}
                      onChangeText={value => {
                        interact();
                        setRemarks(value);
                      }}
                      maxLength={500}
                      multiline
                      editable={!busy && expanded}
                      placeholder="Add a note"
                      placeholderTextColor={colors.onPrimaryMuted}
                      style={styles.input}
                    />
                    <Text style={styles.label}>Category (optional)</Text>
                    <Text style={styles.helper}>
                      Choosing a category remembers it for this vendor.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Choose popup category"
                      accessibilityState={{ expanded: categoryOpen }}
                      disabled={busy || !expanded}
                      style={styles.category}
                      onPress={() => {
                        interact();
                        setCategoryOpen(!categoryOpen);
                      }}
                    >
                      <Text style={styles.buttonText}>
                        {category === 'lent'
                          ? 'Lent money'
                          : customCategories.find(
                              option => option.value === expenseCategory,
                            )?.label || expenseCategoryLabel(expenseCategory)}
                      </Text>
                      <Icon
                        name="down"
                        color={colors.onPrimaryMuted}
                        size={18}
                      />
                    </Pressable>
                    {categoryOpen && (
                      <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        style={styles.menu}
                      >
                        {[
                          ...expenseCategories,
                          ...customCategories,
                          { value: 'lent', label: 'Lent money' } as const,
                        ].map(option => (
                          <Pressable
                            key={option.value}
                            accessibilityRole="radio"
                            accessibilityLabel={option.label}
                            accessibilityState={{
                              checked:
                                option.value === 'lent'
                                  ? category === 'lent'
                                  : category === 'expense' &&
                                    expenseCategory === option.value,
                            }}
                            style={styles.menuItem}
                            onPress={() => {
                              setCategorySelected(true);
                              setCategory(
                                option.value === 'lent' ? 'lent' : 'expense',
                              );
                              setExpenseCategory(
                                option.value === 'lent'
                                  ? 'uncategorised'
                                  : option.value,
                              );
                              setCategoryOpen(false);
                              interact();
                            }}
                          >
                            <Text style={styles.buttonText}>
                              {option.label}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Save now"
                      disabled={busy || !expanded}
                      style={[styles.save, busy && styles.disabled]}
                      onPress={save}
                    >
                      <Icon name="check" size={18} color={colors.primary} />
                      <Text style={styles.saveText}>
                        {busy ? 'Saving…' : 'Save'}
                      </Text>
                    </Pressable>
                    <View style={styles.links}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Edit details"
                        disabled={busy || !expanded}
                        style={styles.link}
                        onPress={() =>
                          onEdit({
                            recipient: payment.recipient,
                            remarks,
                            category,
                            expenseCategory,
                            categorySelected,
                          })
                        }
                      >
                        <Text style={styles.buttonText}>Edit details</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Discard payment"
                        disabled={busy || !expanded}
                        style={styles.link}
                        onPress={() => {
                          interact();
                          setConfirmDiscard(true);
                        }}
                      >
                        <Text style={styles.danger}>Discard</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.privacy}>
                      {isBrowser
                        ? 'Sample data · saved in this browser'
                        : 'Sample data · saved on this phone'}
                    </Text>
                  </>
                )}
                {!!error && (
                  <Text accessibilityRole="alert" style={styles.danger}>
                    {error}
                  </Text>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: typeof baseColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 24,
    },
    expandedBackdrop: { backgroundColor: '#111B3029' },
    sheet: {
      width: '100%',
      maxWidth: 440,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.line,
      boxShadow: '0 16px 48px #08102033',
    },
    summary: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
    handleArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 3,
      backgroundColor: '#BBC5D588',
    },
    eyebrow: {
      fontSize: 11,
      color: colors.onPrimaryMuted,
      fontWeight: '600',
      letterSpacing: 0.5,
      marginTop: 4,
      marginBottom: 9,
    },
    amount: {
      fontSize: 34,
      fontWeight: '400',
      letterSpacing: -1,
      color: colors.accent,
      marginBottom: 7,
    },
    source: { fontSize: 12, color: colors.onPrimaryMuted, marginTop: 5 },
    recipient: { fontSize: 14, fontWeight: '500', color: colors.onPrimary },
    reveal: { overflow: 'hidden' },
    details: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 22,
      paddingBottom: 18,
      gap: 10,
    },
    countdown: { fontSize: 12, color: colors.onPrimaryMuted, marginBottom: 4 },
    label: { fontSize: 13, color: colors.onPrimaryMuted },
    input: {
      minHeight: 62,
      maxHeight: 110,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.primaryRaised,
      color: colors.onPrimary,
      fontSize: 16,
      padding: 12,
      textAlignVertical: 'top',
    },
    category: {
      minHeight: 48,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.primaryRaised,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    menu: {
      maxHeight: 200,
      borderRadius: 12,
      backgroundColor: colors.primaryRaised,
    },
    menuItem: { minHeight: 44, padding: 12 },
    buttonText: { color: colors.onPrimary, fontSize: 14 },
    save: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    saveText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
    secondary: {
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: colors.primaryRaised,
      padding: 14,
      marginTop: 12,
      alignItems: 'center',
    },
    links: { flexDirection: 'row', justifyContent: 'space-between' },
    link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
    danger: { color: colors.danger, fontSize: 14 },
    privacy: { color: colors.onPrimaryMuted, fontSize: 11, lineHeight: 17 },
    title: {
      fontSize: 22,
      color: colors.onPrimary,
      fontWeight: '600',
      marginBottom: 12,
    },
    helper: { fontSize: 14, color: colors.onPrimaryMuted, lineHeight: 21 },
    disabled: { opacity: 0.5 },
  });
