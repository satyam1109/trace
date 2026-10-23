import React from 'react';
import { View } from 'react-native';
import { Icon } from '../components/Icon';
import { transactionTime, type Transaction } from '../types';
import {
  allocated,
  allCategories,
  budgetWarnings,
  categoryTotals,
  comparison,
  currencyOf,
  formatMoney,
  monthLabel,
  monthPlan,
  outstanding,
  summary,
} from '../finance/model';
import {
  Amount,
  Button,
  Card,
  Chip,
  Copy,
  Empty,
  Progress,
  Section,
} from './components';
import { TransactionRow } from './Transactions';
import { useFinance } from './store';
import { ui, useTheme } from './theme';
export function Home({
  month,
  hidden,
  onNavigate,
  onAdd,
  onOpen,
}: {
  month: string;
  hidden: boolean;
  onNavigate: (screen: string, category?: string) => void;
  onAdd: (income?: boolean) => void;
  onOpen: (item: Transaction) => void;
}) {
  const { finance, preferences, transactions, snapshot, demo } = useFinance(),
    { colors: c } = useTheme();
  const data = summary(transactions, month, preferences.currency),
    plan = monthPlan(finance, month, preferences.currency),
    remaining = plan.budget === null ? null : plan.budget - data.spent,
    compare = comparison(transactions, month, preferences.currency),
    cats = categoryTotals(data.expenses, finance).filter(v => v.amount > 0),
    warnings = budgetWarnings(
      data.expenses,
      plan,
      allCategories(finance),
      preferences.thresholds,
    ),
    outstandingTotal = transactions
      .filter(
        t => t.category === 'lent' && currencyOf(t) === preferences.currency,
      )
      .reduce((s, t) => s + outstanding(finance, t), 0),
    goal = finance.goals.find(g => g.currency === preferences.currency);
  return (
    <>
      {!demo && (!snapshot?.detectionEnabled || !snapshot.smsGranted) ? (
        <Card
          onPress={() => onNavigate('detection')}
          style={{ backgroundColor: c.goldSoft, borderWidth: 0, padding: 15 }}
        >
          <View style={ui.row}>
            <Icon name="shield" color={c.goldInk} />
            <View style={ui.fill}>
              <Copy bold color={c.goldInk}>
                Enable payment capture
              </Copy>
              <Copy size={12} color={c.goldInk}>
                Record supported bank debit alerts automatically.
              </Copy>
            </View>
            <Icon name="arrow" color={c.goldInk} />
          </View>
        </Card>
      ) : null}
      <Card navy style={{ padding: 24, gap: 16 }}>
        <Copy size={11} bold color={c.onNavy}>
          SPENT THIS MONTH
        </Copy>
        <Amount
          label="Monthly expenses"
          value={data.spent}
          currency={preferences.currency}
          size={48}
          color={c.gold}
          hidden={hidden}
        />
        <View style={ui.row}>
          {compare.hasPrevious ? (
            <Chip
              label={
                hidden
                  ? 'Comparison hidden'
                  : `${compare.delta >= 0 ? '↑' : '↓'} ${Math.abs(
                      compare.percent || 0,
                    )}% vs last month`
              }
              onPress={() => onNavigate('analytics')}
            />
          ) : (
            <Copy size={12} color={c.onNavy}>
              {monthLabel(month)}
            </Copy>
          )}
        </View>
      </Card>
      <View style={ui.row}>
        <Card
          style={ui.fill}
          onPress={() =>
            data.incomeRecorded ? onNavigate('income') : onAdd(true)
          }
          label="View monthly income"
        >
          <Copy muted size={11}>
            Income
          </Copy>
          {data.incomeRecorded ? (
            <Amount
              value={data.earned}
              currency={preferences.currency}
              size={25}
              hidden={hidden}
            />
          ) : (
            <Copy bold color={c.goldInk}>
              Add income →
            </Copy>
          )}
        </Card>
        <Card
          style={ui.fill}
          onPress={() => onNavigate('savings')}
          label="View monthly savings"
        >
          <Copy muted size={11}>
            {data.incomeRecorded && data.surplus < 0
              ? 'Monthly deficit'
              : 'Saved this month'}
          </Copy>
          {data.incomeRecorded ? (
            <Amount
              value={data.surplus}
              currency={preferences.currency}
              size={25}
              hidden={hidden}
            />
          ) : (
            <Copy muted size={12}>
              Income not recorded
            </Copy>
          )}
        </Card>
      </View>
      <Card onPress={() => onNavigate('budgets')} label="Open monthly budget">
        <View style={ui.spread}>
          <Copy bold>Monthly budget</Copy>
          <Copy
            color={remaining !== null && remaining < 0 ? c.danger : c.goldInk}
            size={12}
            bold
          >
            {plan.budget
              ? `${Math.round((data.spent / plan.budget) * 100)}% used`
              : 'Set budget →'}
          </Copy>
        </View>
        {plan.budget !== null ? (
          <>
            <Progress
              value={plan.budget ? (data.spent / plan.budget) * 100 : 0}
              color={remaining !== null && remaining < 0 ? c.danger : undefined}
            />
            <View style={ui.spread}>
              <View style={ui.fill}>
                <Amount
                  value={Math.abs(remaining!)}
                  currency={preferences.currency}
                  size={27}
                  hidden={hidden}
                />
                <Copy muted size={12}>
                  {remaining! < 0 ? 'over budget' : 'remaining'}
                </Copy>
              </View>
              <Copy muted size={12}>
                {hidden
                  ? '••••'
                  : `of ${formatMoney(plan.budget, preferences.currency)}`}
              </Copy>
            </View>
          </>
        ) : (
          <Copy muted size={12}>
            Set monthly and category limits to see what is left.
          </Copy>
        )}
      </Card>
      <View style={ui.row}>
        <Button
          label="Manage budgets"
          secondary
          onPress={() => onNavigate('budgets')}
          style={{ flex: 1, paddingHorizontal: 10 }}
        />
        <Button
          label="Savings goals"
          secondary
          onPress={() => onNavigate('savings')}
          style={{ flex: 1, paddingHorizontal: 10 }}
        />
      </View>
      {preferences.alerts && warnings[0] ? (
        <Card
          onPress={() => onNavigate('budgets')}
          style={{
            backgroundColor:
              warnings[0].level >= 100 ? c.dangerSoft : c.goldSoft,
            borderWidth: 0,
            padding: 16,
          }}
        >
          <Copy bold color={warnings[0].level >= 100 ? c.danger : c.goldInk}>
            {warnings[0].name}: {warnings[0].percent}% used
          </Copy>
          <Copy size={12} muted>
            {hidden
              ? 'Budget amounts hidden'
              : `${formatMoney(
                  Math.abs(warnings[0].limit - warnings[0].spent),
                  preferences.currency,
                )} ${
                  warnings[0].spent > warnings[0].limit
                    ? 'over budget'
                    : 'remaining'
                }`}
          </Copy>
        </Card>
      ) : null}
      {cats.length ? (
        <>
          <Section
            title="Where it went"
            action="See insights"
            onPress={() => onNavigate('analytics')}
          />
          {cats.slice(0, 4).map(cat => (
            <Card
              key={cat.id}
              onPress={() => onNavigate('category', cat.id)}
              style={{ padding: 15, gap: 10 }}
            >
              <View style={ui.row}>
                <Icon name={cat.icon} color={cat.color} />
                <Copy bold style={ui.fill}>
                  {cat.name}
                </Copy>
                <Amount
                  value={cat.amount}
                  currency={preferences.currency}
                  size={16}
                  hidden={hidden}
                />
              </View>
              <Progress
                value={(cat.amount / data.spent) * 100}
                color={cat.color}
              />
            </Card>
          ))}
        </>
      ) : null}
      <Card onPress={() => onNavigate('lent')} label="Money owed to you">
        <View style={ui.row}>
          <Icon name="lend" color={c.goldInk} />
          <View style={ui.fill}>
            <Copy muted size={12}>
              Money owed to you
            </Copy>
            <Amount
              value={outstandingTotal}
              currency={preferences.currency}
              size={27}
              hidden={hidden}
            />
          </View>
          <Icon name="arrow" color={c.muted} />
        </View>
      </Card>
      {goal ? (
        <Card onPress={() => onNavigate('goal', goal.id)}>
          <View style={ui.spread}>
            <Copy bold>{goal.name}</Copy>
            <Copy bold color={c.goldInk}>
              {Math.round((allocated(finance, goal.id) / goal.target) * 100)}%
            </Copy>
          </View>
          <Progress value={(allocated(finance, goal.id) / goal.target) * 100} />
          <Copy muted size={12}>
            {hidden
              ? 'Amounts hidden'
              : `${formatMoney(
                  allocated(finance, goal.id),
                  goal.currency,
                )} of ${formatMoney(goal.target, goal.currency)}`}
          </Copy>
        </Card>
      ) : null}
      <Section
        title="Recent activity"
        action="View history"
        onPress={() => onNavigate('history')}
      />
      {data.rows.length ? (
        data.rows
          .slice()
          .sort((a, b) => transactionTime(b) - transactionTime(a))
          .slice(0, 4)
          .map(t =>
            hidden ? (
              <Card key={t.id}>
                <Copy muted>Transaction hidden</Copy>
              </Card>
            ) : (
              <TransactionRow key={t.id} item={t} onPress={() => onOpen(t)} />
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
      <Button label="Add income" secondary onPress={() => onAdd(true)} />
    </>
  );
}
