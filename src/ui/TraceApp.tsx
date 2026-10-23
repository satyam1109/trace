import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from '../components/SafeArea';
import { Icon } from '../components/Icon';
import { IncomingPaymentPrompt } from '../components/IncomingPaymentPrompt';
import { samples } from '../demo';
import { isBrowser, ledger } from '../services/ledger';
import type { Transaction, TransactionCategory } from '../types';
import { monthDate, monthKey, monthLabel } from '../finance/model';
import { FinanceProvider, useFinance } from './store';
import { Theme, ui, useTheme } from './theme';
import { Button, Chip, Copy, Empty, ErrorNotice, Sheet } from './components';
import { Home } from './Home';
import {
  History,
  TransactionDetails,
  TransactionEditor,
  type HistoryFilter,
} from './Transactions';
import { Analytics } from './Analytics';
import {
  Budgets,
  GoalDetails,
  Lending,
  LoanDetails,
  Savings,
} from './Planning';
import { Settings } from './Settings';
type Route = { screen: string; id?: string; filter?: HistoryFilter };
const settingsScreens = [
  'settings',
  'appearance',
  'profile',
  'categories',
  'alerts',
  'security',
  'detection',
  'location',
  'data',
];
const titles: Record<string, string> = {
  home: 'trace.',
  history: 'History',
  analytics: 'Analytics',
  settings: 'Settings',
  budgets: 'Monthly budget',
  savings: 'Savings',
  goal: 'Savings goal',
  lent: 'Money owed to you',
  loan: 'Lending details',
  appearance: 'Appearance',
  profile: 'Your profile',
  categories: 'Categories',
  alerts: 'Budget alerts',
  security: 'App lock',
  detection: 'Payment detection',
  location: 'Payment location',
  data: 'Data & storage',
};
function Workspace() {
  const store = useFinance(),
    system = useColorScheme(),
    dark =
      store.preferences.theme === 'system'
        ? system === 'dark'
        : store.preferences.theme === 'dark';
  return (
    <Theme dark={dark}>
      <WorkspaceContent />
    </Theme>
  );
}
function WorkspaceContent() {
  const store = useFinance(),
    { colors: c, dark } = useTheme();
  const [month, setMonth] = useState(monthKey()),
    [routes, setRoutes] = useState<Route[]>([{ screen: 'home' }]),
    [monthPicker, setMonthPicker] = useState(false),
    [hidden, setHidden] = useState(false),
    [editor, setEditor] = useState<{
      item?: Transaction;
      type?: TransactionCategory;
    } | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [popup, setPopup] = useState<Transaction | null>(null),
    [reduceMotion, setReduceMotion] = useState(true),
    [unlocking, setUnlocking] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    opacity = useRef(new Animated.Value(1)).current,
    route = routes[routes.length - 1];
  const push = (screen: string, id?: string, filter?: HistoryFilter) => {
    if (screen === 'income') {
      setRoutes(v => [...v, { screen: 'history', filter: { type: 'income' } }]);
      return;
    }
    if (screen === 'category') {
      setRoutes(v => [
        ...v,
        { screen: 'history', filter: { category: id, type: 'expense' } },
      ]);
      return;
    }
    setRoutes(v => [...v, { screen, id, filter }]);
  };
  const root = (screen: string) => {
    setRoutes([{ screen }]);
    store.setError('');
  };
  const back = () => {
    if (routes.length > 1) setRoutes(v => v.slice(0, -1));
    else if (route.screen !== 'home') root('home');
  };
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const l = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => l.remove();
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: !isBrowser,
    }).start();
  }, [route, month, reduceMotion, opacity]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (routes.length > 1 || route.screen !== 'home') {
        setRoutes(previous =>
          previous.length > 1 ? previous.slice(0, -1) : [{ screen: 'home' }],
        );
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [routes.length, route.screen]);
  const launchRoute = store.snapshot?.launchRoute;
  const launchHandlers = useRef({
    savePreferences: store.savePreferences,
    setError: store.setError,
  });
  launchHandlers.current = {
    savePreferences: store.savePreferences,
    setError: store.setError,
  };
  useEffect(() => {
    if (!launchRoute) return;
    setMonth(launchRoute.month);
    setRoutes([{ screen: 'home' }, { screen: 'budgets' }]);
    if (launchRoute.currency)
      launchHandlers.current
        .savePreferences({ currency: launchRoute.currency })
        .catch(e => launchHandlers.current.setError(String(e)));
  }, [launchRoute]);
  const record = store.transactions.find(t => t.id === selected),
    goal = store.finance.goals.find(g => g.id === route.id),
    loan = store.transactions.find(
      t => t.id === route.id && t.category === 'lent',
    );
  const active =
    route.screen === 'history'
      ? 'History'
      : route.screen === 'analytics'
      ? 'Analytics'
      : settingsScreens.includes(route.screen)
      ? 'Settings'
      : 'Home';
  async function preview() {
    try {
      const result = await ledger.ingestDemo(
        samples[0].sender,
        samples[0].message,
      );
      if (!result.transaction) throw Error(result.reason);
      store.setDemo(true);
      await store.refresh();
      setPopup(result.transaction);
    } catch (e) {
      store.setError(
        e instanceof Error ? e.message : 'Could not preview the popup.',
      );
    }
  }
  async function unlock() {
    if (unlocking) return;
    setUnlocking(true);
    store.setError('');
    try {
      await store.authenticate();
    } catch (e) {
      store.setError(
        e instanceof Error ? e.message : 'Could not unlock Trace.',
      );
    } finally {
      setUnlocking(false);
    }
  }
  if (store.loading)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: c.bg,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <ActivityIndicator color={c.gold} />
        <Copy muted>Opening your local ledger…</Copy>
      </SafeAreaView>
    );
  if (!store.snapshot)
    return (
      <SafeAreaView style={[ui.body, { flex: 1, backgroundColor: c.bg }]}>
        <Empty
          title="Your records could not be loaded"
          copy={store.error || 'Try opening your local database again.'}
          action="Retry"
          onPress={() => store.refresh().catch(e => store.setError(String(e)))}
        />
      </SafeAreaView>
    );
  if (store.locked)
    return (
      <SafeAreaView
        style={[
          ui.body,
          { flex: 1, backgroundColor: c.bg, justifyContent: 'center' },
        ]}
      >
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
        <View
          style={{ maxWidth: 420, width: '100%', alignSelf: 'center', gap: 22 }}
        >
          <Icon name="lock" size={40} color={c.goldInk} />
          <Text style={[ui.amount, { color: c.ink }]}>trace.</Text>
          <Copy muted>
            Your money stays private. Unlock to open your ledger.
          </Copy>
          <ErrorNotice message={store.error} />
          <Button
            label={unlocking ? 'Unlocking…' : 'Unlock Trace'}
            disabled={unlocking}
            onPress={unlock}
          />
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View
        style={{ flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center' }}
      >
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 68,
          }}
        >
          {routes.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={back}
              style={{
                width: 40,
                height: 44,
                justifyContent: 'center',
                transform: [{ rotate: '180deg' }],
              }}
            >
              <Icon name="arrow" color={c.ink} />
            </Pressable>
          ) : null}
          <Text
            style={{
              fontSize: route.screen === 'home' ? 32 : 25,
              lineHeight: 38,
              fontWeight: '700',
              letterSpacing: -0.7,
              color: c.ink,
              flex: 1,
            }}
          >
            {route.screen === 'goal'
              ? goal?.name || 'Savings goal'
              : route.screen === 'loan'
              ? loan?.recipient || 'Lending details'
              : titles[route.screen] || 'Trace'}
          </Text>
          {['home', 'history', 'analytics', 'budgets', 'savings'].includes(
            route.screen,
          ) ? (
            <Chip
              label={monthLabel(month, true)}
              onPress={() => setMonthPicker(true)}
            />
          ) : null}
          {route.screen === 'home' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
              accessibilityState={{ selected: hidden }}
              onPress={() => setHidden(!hidden)}
              style={{
                width: 40,
                height: 44,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon name="eye" color={c.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.body}
        >
          <Animated.View style={{ gap: 18, opacity }}>
            {isBrowser ? (
              <Copy muted size={11}>
                Browser preview · Sample data · {store.preferences.currency}
              </Copy>
            ) : store.demo ? (
              <View style={ui.spread}>
                <Copy muted size={11}>
                  Sample workspace
                </Copy>
                <Chip
                  label="Back to my records"
                  onPress={() => store.setDemo(false)}
                />
              </View>
            ) : null}
            <ErrorNotice message={store.error} />
            {route.screen === 'home' ? (
              <Home
                month={month}
                hidden={hidden}
                onNavigate={push}
                onAdd={income =>
                  setEditor({ type: income ? 'income' : 'expense' })
                }
                onOpen={t => setSelected(t.id)}
              />
            ) : null}
            {route.screen === 'history' ? (
              <History
                key={JSON.stringify(route.filter) || 'history'}
                month={month}
                items={store.transactions}
                initial={route.filter}
                onOpen={t => setSelected(t.id)}
              />
            ) : null}
            {route.screen === 'analytics' ? (
              <Analytics
                key={month}
                month={month}
                onHistory={filter => push('history', undefined, filter)}
              />
            ) : null}
            {route.screen === 'budgets' ? (
              <Budgets month={month} onAlerts={() => push('alerts')} />
            ) : null}
            {route.screen === 'savings' ? (
              <Savings month={month} onGoal={g => push('goal', g.id)} />
            ) : null}
            {route.screen === 'goal' ? (
              goal ? (
                <GoalDetails goal={goal} onDeleted={back} />
              ) : (
                <Empty
                  title="Goal no longer exists"
                  copy="Return to your savings goals."
                  action="Back"
                  onPress={back}
                />
              )
            ) : null}
            {route.screen === 'lent' ? (
              <Lending
                onOpen={t => push('loan', t.id)}
                onHistory={() => push('history')}
              />
            ) : null}
            {route.screen === 'loan' ? (
              loan ? (
                <LoanDetails
                  loan={loan}
                  onEdit={() => setEditor({ item: loan })}
                />
              ) : (
                <Empty
                  title="Lending entry no longer exists"
                  copy="Return to your history."
                  action="Back"
                  onPress={back}
                />
              )
            ) : null}
            {settingsScreens.includes(route.screen) ? (
              <Settings
                key={route.screen}
                section={route.screen}
                onNavigate={push}
                onPreview={preview}
                onReset={() => {
                  store.setDemo(isBrowser);
                  root('home');
                }}
              />
            ) : null}
          </Animated.View>
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 12,
            backgroundColor: c.bg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              height: 74,
              padding: 6,
              borderRadius: 25,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              elevation: 4,
            }}
          >
            {[
              { name: 'Home', icon: 'overview', screen: 'home' },
              { name: 'History', icon: 'activity', screen: 'history' },
              { name: 'Add', icon: 'plus', screen: 'add' },
              { name: 'Analytics', icon: 'arrowUp', screen: 'analytics' },
              { name: 'Settings', icon: 'shield', screen: 'settings' },
            ].map(tab => (
              <Pressable
                key={tab.name}
                accessibilityRole="button"
                accessibilityLabel={tab.name}
                accessibilityState={{ selected: active === tab.name }}
                onPress={() =>
                  tab.screen === 'add'
                    ? setEditor({ type: 'expense' })
                    : root(tab.screen)
                }
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <View
                  style={{
                    width: tab.screen === 'add' ? 38 : 24,
                    height: tab.screen === 'add' ? 36 : 24,
                    borderRadius: 13,
                    backgroundColor:
                      tab.screen === 'add' ? c.gold : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={tab.icon}
                    size={tab.screen === 'add' ? 23 : 21}
                    color={
                      tab.screen === 'add'
                        ? c.navy
                        : active === tab.name
                        ? c.goldInk
                        : c.muted
                    }
                  />
                </View>
                <Copy
                  size={10}
                  bold
                  color={active === tab.name ? c.goldInk : c.muted}
                >
                  {tab.name}
                </Copy>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      {monthPicker ? (
        <MonthPicker
          month={month}
          onSelect={m => {
            setMonth(m);
            setMonthPicker(false);
          }}
          onClose={() => setMonthPicker(false)}
        />
      ) : null}
      {editor ? (
        <TransactionEditor
          key={editor.item?.id || editor.type}
          item={editor.item}
          type={editor.type}
          onClose={() => setEditor(null)}
          onSaved={() => {
            if (!editor.item) root('history');
          }}
        />
      ) : null}
      {record && !editor ? (
        <TransactionDetails
          item={record}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditor({ item: record });
            setSelected(null);
          }}
          onLending={() => {
            setSelected(null);
            push('loan', record.id);
          }}
        />
      ) : null}
      {popup ? (
        <IncomingPaymentPrompt
          key={popup.id}
          payment={popup}
          customCategories={store.finance.categories.map(cat => ({
            value: cat.id as import('../categories').ExpenseCategory,
            label: cat.name,
          }))}
          onSaved={() => {
            setPopup(null);
            store.refresh().catch(e => store.setError(String(e)));
          }}
          onEdit={details => {
            setEditor({ item: { ...popup, ...details } });
            setPopup(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
function MonthPicker({
  month,
  onSelect,
  onClose,
}: {
  month: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const { colors: c } = useTheme();
  const [year, setYear] = useState(monthDate(month).getFullYear());
  return (
    <Sheet title="Choose month" onClose={onClose}>
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
            selected = m === month;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={monthLabel(m)}
              accessibilityState={{ selected }}
              onPress={() => onSelect(m)}
              style={{
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
export default function TraceApp() {
  return (
    <SafeAreaProvider>
      <FinanceProvider>
        <Workspace />
      </FinanceProvider>
    </SafeAreaProvider>
  );
}
