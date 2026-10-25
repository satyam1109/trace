import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Icon } from '../components/Icon';
import { transactionTime, type Transaction } from '../types';
import {
  allocated,
  allCategories,
  budgetWarnings,
  currencyOf,
  dailySummary,
  formatMoney,
  localDate,
  monthLabel,
  monthPlan,
  outstanding,
  summary,
} from '../finance/model';
import { Amount, Copy, Empty, Progress } from './components';
import { useToday } from './useToday';
import { GlassPressable } from './GlassPressable';
import { TransactionRow, type HistoryFilter } from './Transactions';
import { useFinance } from './store';
import { ThemeContext, ui, useTheme } from './theme';
import { activityPalette, dashboardColors as c } from './dashboardTheme';

export function Home({
  month,
  hidden,
  onNavigate,
  onAdd,
  onOpen,
}: {
  month: string;
  hidden: boolean;
  onNavigate: (screen: string, id?: string, filter?: HistoryFilter) => void;
  onAdd: (income?: boolean) => void;
  onOpen: (item: Transaction) => void;
}) {
  const { finance, preferences, transactions, snapshot, demo } = useFinance();
  const { dark } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const today = useToday(),
    currency = preferences.currency;
  const data = summary(transactions, month, currency),
    daily = dailySummary(transactions, currency, today),
    plan = monthPlan(finance, month, currency),
    remaining = plan.budget === null ? null : plan.budget - data.spent,
    utilisation = plan.budget
      ? Math.round((data.spent / plan.budget) * 100)
      : data.spent > 0 && plan.budget === 0
      ? 100
      : 0,
    warnings = budgetWarnings(
      data.expenses,
      plan,
      allCategories(finance),
      preferences.thresholds,
    ),
    goal = finance.goals.find(g => g.currency === currency),
    goalProgress = goal
      ? Math.round((allocated(finance, goal.id) / goal.target) * 100)
      : null,
    recent = data.rows
      .slice()
      .sort((a, b) => transactionTime(b) - transactionTime(a))
      .slice(0, 4),
    outstandingTotal = transactions
      .filter(t => t.category === 'lent' && currencyOf(t) === currency)
      .reduce((total, t) => total + outstanding(finance, t), 0),
    activity = activityPalette(dark);
  const longAmount =
    Math.max(
      formatMoney(data.spent, currency).length,
      formatMoney(data.earned, currency).length,
    ) > 11;
  const stackMetrics = fontScale > 1.35 || (width < 360 && longAmount);
  const metricSpace = stackMetrics
    ? Math.min(width, 680) - 84
    : (Math.min(width, 680) - 52) / 2 - 36;
  const metricSize = (value: number) =>
    Math.min(
      27,
      metricSpace / (formatMoney(value, currency, hidden).length * 0.6),
    );
  const heroSize = Math.min(
    68,
    (Math.min(width, 680) - 48) /
      (formatMoney(daily.spent, currency, hidden).length * 0.6),
  );
  const showBudget = () => onNavigate('budgets');
  return (
    <ThemeContext.Provider value={{ colors: c, dark: true }}>
      <View testID="home-dashboard" style={styles.dashboard}>
        <GlassPressable
          label="View today's expenses"
          testID="today-spend-card"
          radius={24}
          onPress={() =>
            onNavigate('history', undefined, {
              type: 'expense',
              from: localDate(today),
              to: localDate(today),
            })
          }
          contentStyle={styles.hero}
        >
          <Copy size={11} bold color={c.gold} style={styles.eyebrow}>
            SPENT TODAY
          </Copy>
          <Amount
            label="Today's expenses"
            value={daily.spent}
            currency={currency}
            size={heroSize}
            hidden={hidden}
            fit
          />
          <Copy muted size={14}>
            {today.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Copy>
        </GlassPressable>

        <View style={[styles.metrics, stackMetrics && styles.metricsStack]}>
          <GlassPressable
            label="View monthly income"
            testID="monthly-income-card"
            style={ui.fill}
            contentStyle={styles.metricCard}
            onPress={() =>
              data.incomeRecorded ? onNavigate('income') : onAdd(true)
            }
          >
            <View style={styles.metricHeading}>
              <View style={styles.smallIcon}>
                <View style={styles.incomeArrow}>
                  <Icon name="arrowUp" size={17} color={c.gold} />
                </View>
              </View>
              <Copy size={13}>Income</Copy>
            </View>
            {data.incomeRecorded ? (
              <Amount
                label="Monthly income"
                value={data.earned}
                currency={currency}
                size={metricSize(data.earned)}
                hidden={hidden}
                fit
              />
            ) : (
              <Copy size={19} bold>
                Add income +
              </Copy>
            )}
            <Copy muted size={11}>
              {data.incomeRecorded
                ? monthLabel(month, true)
                : 'Income not recorded'}
            </Copy>
          </GlassPressable>
          <GlassPressable
            label="View monthly expenses"
            testID="monthly-expense-card"
            style={ui.fill}
            contentStyle={styles.metricCard}
            onPress={() =>
              onNavigate('history', undefined, { type: 'expense' })
            }
          >
            <View style={styles.metricHeading}>
              <View style={styles.smallIcon}>
                <Icon name="arrowUp" size={17} color={c.gold} />
              </View>
              <Copy size={13}>Expense</Copy>
            </View>
            <Amount
              label="Monthly expenses"
              value={data.spent}
              currency={currency}
              size={metricSize(data.spent)}
              hidden={hidden}
              fit
            />
            <Copy muted size={11}>
              {monthLabel(month, true)}
            </Copy>
          </GlassPressable>
        </View>

        {!demo && (!snapshot?.detectionEnabled || !snapshot.smsGranted) ? (
          <GlassPressable
            label="Enable payment capture"
            onPress={() => onNavigate('detection')}
            contentStyle={styles.detection}
            radius={20}
          >
            <Icon name="shield" size={18} color={c.gold} />
            <Copy size={13} style={ui.fill}>
              Enable payment capture
            </Copy>
            <Icon name="arrow" size={17} color={c.gold} />
          </GlassPressable>
        ) : null}

        <View testID="monthly-budget-card" style={styles.budgetCard}>
          <GlassPressable
            label="Manage budgets"
            testID="budget-summary"
            onPress={showBudget}
            contentStyle={styles.budgetSummary}
            radius={18}
          >
            <View style={styles.budgetHeader}>
              <Copy size={17} bold>
                Monthly budget
              </Copy>
              <View style={styles.manage}>
                <Copy size={12} color={c.gold}>
                  {plan.budget === null ? 'Set budget' : 'Manage'}
                </Copy>
                <Icon name="arrow" size={16} color={c.gold} />
              </View>
            </View>
            {remaining !== null ? (
              <>
                <View style={styles.budgetFigures}>
                  <View style={styles.budgetAmount}>
                    <Amount
                      value={Math.abs(remaining)}
                      currency={currency}
                      size={31}
                      hidden={hidden}
                      fit
                      color={remaining < 0 ? c.danger : c.ink}
                    />
                    <Copy muted size={12}>
                      {remaining < 0 ? 'over budget' : 'left this month'}
                    </Copy>
                  </View>
                  <Copy muted size={12}>
                    {hidden
                      ? '••••'
                      : remaining < 0 && plan.budget === 0
                      ? 'Over limit'
                      : `${utilisation}% used`}
                  </Copy>
                </View>
                <Progress
                  value={utilisation}
                  color={remaining < 0 ? c.danger : c.gold}
                />
              </>
            ) : (
              <Copy muted size={13}>
                Set an overall limit and category budgets for{' '}
                {monthLabel(month, true)}.
              </Copy>
            )}
            {preferences.alerts && warnings[0] ? (
              <Copy
                size={12}
                color={warnings[0].level >= 100 ? c.danger : c.gold}
              >
                {hidden
                  ? 'Budget warning · review limits'
                  : `${warnings[0].name}: ${warnings[0].percent}% used`}
              </Copy>
            ) : null}
          </GlassPressable>
          <GlassPressable
            label="Savings goals"
            testID="savings-goal-row"
            radius={20}
            contentStyle={styles.goalRow}
            onPress={() => onNavigate('savings')}
          >
            <Icon name="target" size={21} color={c.gold} />
            <View style={ui.fill}>
              <Copy size={13}>Savings goal</Copy>
              {goal ? (
                <Copy muted size={11}>
                  {goal.name}
                  {hidden ? '' : ` · ${goalProgress}% saved`}
                </Copy>
              ) : null}
            </View>
            <Copy size={12} color={c.gold}>
              {goal ? 'View' : 'Set goal'}
            </Copy>
            <Icon name="arrow" size={16} color={c.gold} />
          </GlassPressable>
        </View>

        <ThemeContext.Provider value={{ colors: activity, dark }}>
          <View
            testID="recent-activity-section"
            style={[
              styles.activity,
              { backgroundColor: activity.surface, borderColor: activity.line },
            ]}
          >
            <View style={styles.activityHeading}>
              <Copy size={19} bold>
                Recent activity
              </Copy>
              <GlassPressable
                label="View history"
                onPress={() => onNavigate('history')}
                light={!dark}
                radius={14}
                contentStyle={styles.textAction}
              >
                <Copy size={12} color={activity.goldInk}>
                  View all
                </Copy>
              </GlassPressable>
            </View>
            {recent.length ? (
              recent.map(t =>
                hidden ? (
                  <View key={t.id} style={styles.hiddenRow}>
                    <Copy muted>Transaction hidden</Copy>
                  </View>
                ) : (
                  <TransactionRow
                    key={t.id}
                    item={t}
                    onPress={() => onOpen(t)}
                    glass
                  />
                ),
              )
            ) : (
              <Empty
                title="Your month starts here"
                copy="Detected payments and manual entries will appear here."
                action="Add an entry"
                onPress={() => onAdd()}
              />
            )}
            <GlassPressable
              label="Money owed to you"
              onPress={() => onNavigate('lent')}
              light={!dark}
              radius={16}
              contentStyle={[
                styles.lendingLink,
                { borderColor: activity.line },
              ]}
            >
              <Icon name="lend" size={18} color={activity.goldInk} />
              <Copy muted size={12} style={ui.fill}>
                Money owed to you
              </Copy>
              <Amount
                value={outstandingTotal}
                currency={currency}
                size={15}
                hidden={hidden}
              />
              <Icon name="arrow" size={16} color={activity.goldInk} />
            </GlassPressable>
          </View>
        </ThemeContext.Provider>
      </View>
    </ThemeContext.Provider>
  );
}
const styles = StyleSheet.create({
  dashboard: { gap: 26 },
  hero: { paddingTop: 28, paddingBottom: 12, gap: 9 },
  eyebrow: { letterSpacing: 2 },
  metrics: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  metricsStack: { flexDirection: 'column' },
  metricCard: {
    borderRadius: 28,
    padding: 18,
    gap: 9,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  metricHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: c.subtle,
  },
  incomeArrow: { transform: [{ rotate: '180deg' }] },
  budgetCard: {
    backgroundColor: c.surface,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 30,
    padding: 20,
    gap: 20,
  },
  budgetSummary: { gap: 20 },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32 },
  budgetFigures: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  budgetAmount: { flexShrink: 1, gap: 3 },
  goalRow: {
    backgroundColor: c.subtle,
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 58,
    borderRadius: 20,
  },
  detection: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activity: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 10,
    borderRadius: 32,
    borderWidth: 1,
    overflow: 'hidden',
  },
  activityHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 5,
  },
  textAction: { minHeight: 44, paddingHorizontal: 7, justifyContent: 'center' },
  hiddenRow: { paddingVertical: 22 },
  lendingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 56,
    borderTopWidth: 1,
    marginTop: 6,
    paddingVertical: 15,
  },
});
