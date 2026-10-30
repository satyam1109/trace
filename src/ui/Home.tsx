import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Icon } from '../components/Icon';
import { transactionTime, type Transaction } from '../types';
import {
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
import { StackedFunds } from './StackedFunds';
import { TransactionRow, type HistoryFilter } from './Transactions';
import { useFinance } from './store';
import { ui, useTheme } from './theme';

export function Home({
  month,
  hidden,
  fundsExpanded,
  onFundsExpandedChange,
  onNavigate,
  onAdd,
  onOpen,
}: {
  month: string;
  hidden: boolean;
  fundsExpanded: boolean;
  onFundsExpandedChange: (value: boolean) => void;
  onNavigate: (screen: string, id?: string, filter?: HistoryFilter) => void;
  onAdd: (income?: boolean) => void;
  onOpen: (item: Transaction) => void;
}) {
  const { finance, preferences, transactions, snapshot, demo } = useFinance();
  const { colors: c, dark } = useTheme();
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
    recent = data.rows
      .slice()
      .sort((a, b) => transactionTime(b) - transactionTime(a))
      .slice(0, 3),
    outstandingTotal = transactions
      .filter(t => t.category === 'lent' && currencyOf(t) === currency)
      .reduce((total, t) => total + outstanding(finance, t), 0);
  const stackMetrics =
    fontScale > 1.35 ||
    (width < 360 &&
      Math.max(
        formatMoney(data.spent, currency).length,
        formatMoney(data.earned, currency).length,
      ) > 11);
  const heroSize = Math.min(
    66,
    (Math.min(width, 680) - 48) /
      (formatMoney(daily.spent, currency, hidden).length * 0.57),
  );
  return (
    <View testID="home-dashboard" style={styles.dashboard}>
      <GlassPressable
        label="View today's expenses"
        testID="today-spend-card"
        light={!dark}
        radius={20}
        onPress={() =>
          onNavigate('history', undefined, {
            type: 'expense',
            from: localDate(today),
            to: localDate(today),
          })
        }
        contentStyle={styles.hero}
      >
        <Copy muted size={13}>
          Spent today
        </Copy>
        <Amount
          label="Today's expenses"
          value={daily.spent}
          currency={currency}
          size={heroSize}
          weight="400"
          hidden={hidden}
          fit
        />
        <View style={styles.heroFooter}>
          <Copy muted size={12}>
            {today.toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Copy>
          <View style={styles.inline}>
            <Copy size={12}>
              {daily.count} {daily.count === 1 ? 'payment' : 'payments'}
            </Copy>
            <Icon name="arrowUp" size={13} color={c.muted} />
          </View>
        </View>
      </GlassPressable>

      <View
        style={[
          styles.metrics,
          { borderColor: c.line },
          stackMetrics && styles.metricsStack,
        ]}
      >
        <GlassPressable
          label="View monthly income"
          testID="monthly-income-card"
          light={!dark}
          radius={12}
          style={ui.fill}
          contentStyle={styles.metric}
          onPress={() =>
            data.incomeRecorded ? onNavigate('income') : onAdd(true)
          }
        >
          <View style={styles.inline}>
            <View style={styles.incomeArrow}>
              <Icon name="arrowUp" size={14} color={c.muted} />
            </View>
            <Copy muted size={12}>
              Income
            </Copy>
          </View>
          {data.incomeRecorded ? (
            <Amount
              label="Monthly income"
              value={data.earned}
              currency={currency}
              size={25}
              weight="500"
              hidden={hidden}
              fit
            />
          ) : (
            <Copy size={21} style={styles.medium}>
              Add income +
            </Copy>
          )}
          <Copy muted size={11}>
            {data.incomeRecorded
              ? monthLabel(month, true)
              : 'Income not recorded'}
          </Copy>
        </GlassPressable>
        <View
          style={[
            styles.divider,
            { backgroundColor: c.line },
            stackMetrics && styles.horizontalDivider,
          ]}
        />
        <GlassPressable
          label="View monthly expenses"
          testID="monthly-expense-card"
          light={!dark}
          radius={12}
          style={ui.fill}
          contentStyle={styles.metric}
          onPress={() => onNavigate('history', undefined, { type: 'expense' })}
        >
          <View style={styles.inline}>
            <Icon name="arrowUp" size={14} color={c.muted} />
            <Copy muted size={12}>
              Expense
            </Copy>
          </View>
          <Amount
            label="Monthly expenses"
            value={data.spent}
            currency={currency}
            size={25}
            weight="500"
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
          light={!dark}
          radius={18}
          contentStyle={[styles.detection, { backgroundColor: c.surface }]}
        >
          <Icon name="shield" size={18} color={c.muted} />
          <Copy size={13} style={ui.fill}>
            Enable payment capture
          </Copy>
          <Icon name="arrow" size={16} color={c.muted} />
        </GlassPressable>
      ) : null}

      <View testID="monthly-budget-card">
        <GlassPressable
          label="Manage budgets"
          testID="budget-summary"
          onPress={() => onNavigate('budgets')}
          light={!dark}
          radius={24}
          contentStyle={[styles.budget, { backgroundColor: c.surface }]}
        >
          <View style={styles.spread}>
            <Copy size={13}>Monthly budget</Copy>
            <View style={styles.inline}>
              {remaining === null ? (
                <Copy muted size={12}>
                  Set budget
                </Copy>
              ) : null}
              <Icon name="arrowUp" size={15} color={c.muted} />
            </View>
          </View>
          {remaining !== null ? (
            <>
              <View style={styles.budgetFigures}>
                <Amount
                  value={Math.abs(remaining)}
                  currency={currency}
                  size={27}
                  weight="400"
                  hidden={hidden}
                  fit
                  color={remaining < 0 ? c.danger : c.ink}
                />
                <Copy muted size={12}>
                  {remaining < 0 ? 'over budget' : 'left to spend'}
                </Copy>
              </View>
              <Progress
                value={hidden ? 0 : utilisation}
                color={remaining < 0 ? c.danger : c.ink}
                label={
                  hidden ? 'Budget progress hidden' : 'Monthly budget used'
                }
              />
              <View style={styles.spread}>
                <Copy muted size={11}>
                  {hidden ? '••••' : `${utilisation}% used`}
                </Copy>
                <Copy muted size={11}>
                  of {formatMoney(plan.budget!, currency, hidden)}
                </Copy>
              </View>
            </>
          ) : (
            <Copy muted size={12}>
              Set your monthly spending limit.
            </Copy>
          )}
          {preferences.alerts && warnings[0] ? (
            <Copy
              size={12}
              color={warnings[0].level >= 100 ? c.danger : c.muted}
            >
              {hidden
                ? 'Budget warning · review limits'
                : `${warnings[0].name}: ${warnings[0].percent}% used`}
            </Copy>
          ) : null}
        </GlassPressable>
      </View>

      <StackedFunds
        finance={finance}
        currency={currency}
        hidden={hidden}
        expanded={fundsExpanded}
        onExpandedChange={onFundsExpandedChange}
        onGoal={goal => onNavigate('goal', goal.id)}
        onManage={() => onNavigate('savings')}
      />

      <View testID="recent-activity-section" style={styles.activity}>
        <View style={styles.spread}>
          <Copy size={15} style={styles.medium}>
            Recent activity
          </Copy>
          <GlassPressable
            label="View history"
            onPress={() => onNavigate('history')}
            light={!dark}
            radius={12}
            contentStyle={styles.textAction}
          >
            <Copy muted size={12}>
              View all
            </Copy>
            <Icon name="arrowUp" size={13} color={c.muted} />
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
                quiet
              />
            ),
          )
        ) : (
          <Empty
            title="Your month starts here"
            copy="Your payments will appear here."
            action="Add an entry"
            onPress={() => onAdd()}
          />
        )}
        <GlassPressable
          label="Money owed to you"
          onPress={() => onNavigate('lent')}
          light={!dark}
          radius={14}
          contentStyle={[styles.lendingLink, { borderColor: c.line }]}
        >
          <Icon name="lend" size={17} color={c.muted} />
          <Copy muted size={12} style={ui.fill}>
            Money owed to you
          </Copy>
          <Amount
            value={outstandingTotal}
            currency={currency}
            size={15}
            weight="500"
            hidden={hidden}
          />
          <Icon name="arrow" size={15} color={c.muted} />
        </GlassPressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  dashboard: { gap: 24 },
  hero: { paddingTop: 24, paddingBottom: 5, gap: 8 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  medium: { fontWeight: '500' },
  metrics: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 18,
  },
  metricsStack: { flexDirection: 'column' },
  metric: { gap: 5 },
  divider: { width: 1 },
  horizontalDivider: { height: 1, width: '100%' },
  incomeArrow: { transform: [{ rotate: '180deg' }] },
  budget: { padding: 19, borderRadius: 24, gap: 14 },
  budgetFigures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flexWrap: 'wrap',
  },
  detection: {
    padding: 14,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activity: { marginTop: 6 },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hiddenRow: { paddingVertical: 22 },
  lendingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 56,
    borderTopWidth: 1,
    marginTop: 8,
    paddingVertical: 15,
  },
});
