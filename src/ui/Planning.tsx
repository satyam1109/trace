import DateField from './DateField';
import React, { useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../components/Icon';
import type { Transaction, PaymentMethod } from '../types';
import { transactionTime } from '../types';
import {
  allCategories,
  localDate,
  allocated,
  addRepayment,
  categoryTotals,
  currencyOf,
  dateText,
  formatMoney,
  id,
  methodLabels,
  monthKey,
  monthLabel,
  monthPlan,
  outstanding,
  parseAmount,
  returned,
  setMonthPlan,
  summary,
  type Goal,
} from '../finance/model';
import { localPaymentTime } from '../services/manualExpense';
import {
  Amount,
  Button,
  Card,
  Chip,
  Confirm,
  Copy,
  Empty,
  Field,
  FormSheet,
  Progress,
  Section,
  Select,
  Setting,
} from './components';
import { useFinance } from './store';
import { ui, useTheme } from './theme';
export function Budgets({
  month,
  onAlerts,
}: {
  month: string;
  onAlerts: () => void;
}) {
  const { finance, preferences, transactions } = useFinance(),
    { colors: c } = useTheme();
  const [edit, setEdit] = useState<string | null>(null);
  const plan = monthPlan(finance, month, preferences.currency),
    data = summary(transactions, month, preferences.currency),
    remaining = (plan.budget || 0) - data.spent;
  return (
    <>
      <Copy muted>{monthLabel(month)}</Copy>
      <Card>
        <View style={ui.spread}>
          <Copy muted size={11}>
            OVERALL BUDGET
          </Copy>
          <Chip label="Edit budget" onPress={() => setEdit('overall')} />
        </View>
        {plan.budget !== null ? (
          <>
            <Amount
              value={Math.abs(remaining)}
              currency={preferences.currency}
              size={34}
              color={remaining < 0 ? c.danger : c.ink}
            />
            <Copy>
              {remaining < 0 ? 'over budget' : 'remaining this month'}
            </Copy>
            <Progress
              value={plan.budget ? (data.spent / plan.budget) * 100 : 0}
              color={remaining < 0 ? c.danger : c.gold}
            />
            <Copy muted size={12}>
              {formatMoney(data.spent, preferences.currency)} spent of{' '}
              {formatMoney(plan.budget, preferences.currency)}
              {plan.budget
                ? ` · ${Math.round((data.spent / plan.budget) * 100)}% used`
                : ''}
            </Copy>
          </>
        ) : (
          <Empty
            title="Give this month a limit"
            copy="Set an overall budget, then add limits for the categories you care about."
            action="Set monthly budget"
            onPress={() => setEdit('overall')}
          />
        )}
      </Card>
      <Section title="Category budgets" />
      {categoryTotals(data.expenses, finance).map(cat => {
        const limit = plan.limits[cat.id] || 0,
          pct = limit ? (cat.amount / limit) * 100 : 0;
        return (
          <Card
            key={cat.id}
            onPress={() => setEdit(cat.id)}
            label={`Set ${cat.name} budget`}
          >
            <View style={ui.row}>
              <Icon name={cat.icon} color={cat.color} />
              <Copy bold style={ui.fill}>
                {cat.name}
              </Copy>
              <Copy size={12} color={pct >= 100 ? c.danger : c.goldInk}>
                {limit ? `${Math.round(pct)}% used` : 'Set limit'}
              </Copy>
            </View>
            {limit ? (
              <>
                <Progress
                  value={pct}
                  color={pct >= 100 ? c.danger : cat.color}
                />
                <View style={ui.spread}>
                  <Copy size={12} muted>
                    {formatMoney(cat.amount, preferences.currency)} /{' '}
                    {formatMoney(limit, preferences.currency)}
                  </Copy>
                  <Copy size={12} color={cat.amount > limit ? c.danger : c.ink}>
                    {formatMoney(
                      Math.abs(limit - cat.amount),
                      preferences.currency,
                    )}{' '}
                    {cat.amount > limit ? 'over' : 'left'}
                  </Copy>
                </View>
              </>
            ) : (
              <Copy size={12} muted>
                {formatMoney(cat.amount, preferences.currency)} spent · No limit
                set
              </Copy>
            )}
          </Card>
        );
      })}
      <Setting
        title="Budget alerts"
        subtitle="Local notifications at 70%, 90% and 100%."
        icon="info"
        onPress={onAlerts}
      />
      <Copy muted size={12}>
        Budgets reset for each calendar month. Historical monthly limits are
        kept.
      </Copy>
      {edit ? (
        <BudgetEditor
          month={month}
          category={edit}
          onClose={() => setEdit(null)}
        />
      ) : null}
    </>
  );
}
function BudgetEditor({
  month,
  category,
  onClose,
}: {
  month: string;
  category: string;
  onClose: () => void;
}) {
  const { finance, preferences, saveFinance } = useFinance();
  const plan = monthPlan(finance, month, preferences.currency),
    cat = allCategories(finance).find(c => c.id === category),
    overall = category === 'overall';
  const [amount, setAmount] = useState(
      (overall ? plan.budget : plan.limits[category])
        ? String((overall ? plan.budget! : plan.limits[category]) / 100)
        : '',
    ),
    [defaultOn, setDefaultOn] = useState(false);
  const save = () =>
    saveFinance(state => {
      const existing = monthPlan(state, month, preferences.currency),
        value = amount.trim() ? parseAmount(amount) : null;
      return setMonthPlan(
        state,
        month,
        preferences.currency,
        overall
          ? { ...existing, budget: value }
          : {
              ...existing,
              limits: { ...existing.limits, [category]: value || 0 },
            },
        defaultOn,
      );
    });
  return (
    <FormSheet
      title={overall ? 'Monthly budget' : `${cat?.name || 'Category'} budget`}
      onClose={onClose}
      onSave={save}
      saveLabel="Save budget"
    >
      <Copy muted>
        {monthLabel(month)} · {preferences.currency}
      </Copy>
      <Field
        label={overall ? 'Overall monthly limit' : 'Category monthly limit'}
        value={amount}
        onChangeText={setAmount}
        numeric
        placeholder="No limit"
        maxLength={12}
      />
      <Copy muted size={12}>
        Leave blank to remove this limit. Category limits are tracked
        independently of the overall budget.
      </Copy>
      {month === monthKey() ? (
        <Setting
          title="Use as monthly default"
          subtitle="Applies to this and future months. Past months keep their budgets."
          toggle={defaultOn}
          onPress={() => setDefaultOn(!defaultOn)}
        />
      ) : null}
    </FormSheet>
  );
}
export function Savings({
  month,
  onGoal,
}: {
  month: string;
  onGoal: (goal: Goal) => void;
}) {
  const { finance, preferences, transactions } = useFinance(),
    { colors: c } = useTheme();
  const [edit, setEdit] = useState(false),
    [target, setTarget] = useState(false),
    [history, setHistory] = useState(false);
  const data = summary(transactions, month, preferences.currency),
    plan = monthPlan(finance, month, preferences.currency),
    goals = finance.goals.filter(g => g.currency === preferences.currency);
  return (
    <>
      <Copy muted>{monthLabel(month)}</Copy>
      <Card
        navy
        onPress={() => setTarget(true)}
        label="Set monthly savings target"
      >
        <Copy color={c.onNavy} size={11}>
          SAVED THIS MONTH
        </Copy>
        {data.incomeRecorded ? (
          <>
            <Amount
              value={data.surplus}
              currency={preferences.currency}
              size={40}
              color={c.gold}
            />
            <Copy color={c.onNavy} size={12}>
              Recorded income − expenses
              {data.surplus < 0 ? ' · Monthly deficit' : ''}
            </Copy>
            {plan.savingsTarget ? (
              <>
                <Progress value={(data.surplus / plan.savingsTarget) * 100} />
                <Copy color={c.onNavy} size={12}>
                  Target {formatMoney(plan.savingsTarget, preferences.currency)}{' '}
                  ·{' '}
                  {data.surplus >= plan.savingsTarget
                    ? 'Reached'
                    : formatMoney(
                        plan.savingsTarget - data.surplus,
                        preferences.currency,
                      ) + ' to go'}
                </Copy>
              </>
            ) : (
              <Copy color={c.onNavy} size={12}>
                Tap to set a monthly savings target
              </Copy>
            )}
          </>
        ) : (
          <Copy color={c.onNavy}>
            Add this month’s income to calculate your monthly surplus.
          </Copy>
        )}
      </Card>
      <Section
        title="Your goals"
        action="New goal"
        onPress={() => setEdit(true)}
      />
      {goals.length ? (
        goals.map(g => (
          <Card
            key={g.id}
            onPress={() => onGoal(g)}
            label={`Open ${g.name} goal`}
          >
            <View style={ui.row}>
              <Icon name={g.icon} color={c.goldInk} />
              <Copy style={ui.fill} bold size={18}>
                {g.name}
              </Copy>
              <Copy color={c.goldInk} bold>
                {Math.round((allocated(finance, g.id) / g.target) * 100)}%
              </Copy>
            </View>
            <Amount
              value={allocated(finance, g.id)}
              currency={g.currency}
              size={28}
            />
            <Copy muted size={12}>
              of {formatMoney(g.target, g.currency)}
            </Copy>
            <Progress value={(allocated(finance, g.id) / g.target) * 100} />
            {g.due ? (
              <Copy size={12} muted>
                Target date · {g.due}
              </Copy>
            ) : null}
          </Card>
        ))
      ) : (
        <Empty
          title="What are you saving for?"
          copy="Create a goal for a laptop, holiday or something that matters to you."
          action="Create savings goal"
          onPress={() => setEdit(true)}
        />
      )}
      <Setting
        title="Monthly savings target"
        subtitle={
          plan.savingsTarget
            ? formatMoney(plan.savingsTarget, preferences.currency)
            : 'Set your monthly target'
        }
        onPress={() => setTarget(true)}
        icon="wallet"
      />
      <Setting
        title="Savings history"
        subtitle="Recorded income minus expenses, month by month."
        icon="activity"
        onPress={() => setHistory(!history)}
      />
      {history
        ? Array.from({ length: 6 }, (_, i) => {
            const d = new Date(month + '-01T00:00:00');
            d.setMonth(d.getMonth() - i);
            const m = monthKey(d),
              s = summary(transactions, m, preferences.currency);
            return (
              <Card key={m}>
                <Copy bold>{monthLabel(m)}</Copy>
                {s.incomeRecorded ? (
                  <Amount
                    value={s.surplus}
                    currency={preferences.currency}
                    size={25}
                  />
                ) : (
                  <Copy muted>Income not recorded</Copy>
                )}
                <Copy muted size={12}>
                  {formatMoney(s.spent, preferences.currency)} recorded expenses
                </Copy>
              </Card>
            );
          })
        : null}
      <Copy muted size={12}>
        Monthly surplus is separate from money you allocate to goals. Goal
        allocations do not add another expense.
      </Copy>
      {edit ? <GoalEditor onClose={() => setEdit(false)} /> : null}
      {target ? (
        <SavingsTarget month={month} onClose={() => setTarget(false)} />
      ) : null}
    </>
  );
}
function SavingsTarget({
  month,
  onClose,
}: {
  month: string;
  onClose: () => void;
}) {
  const { finance, preferences, saveFinance } = useFinance(),
    plan = monthPlan(finance, month, preferences.currency);
  const [value, setValue] = useState(
      plan.savingsTarget ? String(plan.savingsTarget / 100) : '',
    ),
    [defaultOn, setDefaultOn] = useState(false);
  return (
    <FormSheet
      title="Monthly savings target"
      onClose={onClose}
      saveLabel="Save target"
      onSave={() =>
        saveFinance(state =>
          setMonthPlan(
            state,
            month,
            preferences.currency,
            {
              ...monthPlan(state, month, preferences.currency),
              savingsTarget: value.trim() ? parseAmount(value) : null,
            },
            defaultOn,
          ),
        )
      }
    >
      <Copy muted>{monthLabel(month)}</Copy>
      <Field
        label="Savings target"
        value={value}
        onChangeText={setValue}
        numeric
      />
      <Copy muted size={12}>
        Target for recorded income minus expenses. Leave blank to remove it.
      </Copy>
      {month === monthKey() ? (
        <Setting
          title="Use as monthly default"
          toggle={defaultOn}
          onPress={() => setDefaultOn(!defaultOn)}
        />
      ) : null}
    </FormSheet>
  );
}
export function GoalEditor({
  goal,
  onClose,
}: {
  goal?: Goal;
  onClose: () => void;
}) {
  const { preferences, saveFinance } = useFinance();
  const [name, setName] = useState(goal?.name || ''),
    [amount, setAmount] = useState(goal ? String(goal.target / 100) : ''),
    [due, setDue] = useState(goal?.due || ''),
    [icon, setIcon] = useState(goal?.icon || 'wallet');
  return (
    <FormSheet
      title={goal ? 'Edit savings goal' : 'Create savings goal'}
      onClose={onClose}
      saveLabel="Save goal"
      onSave={async () => {
        if (!name.trim()) throw Error('Give your goal a name.');
        const target = parseAmount(amount);
        if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due))
          throw Error('Use YYYY-MM-DD for the target date.');
        if (due) localPaymentTime(due, '12:00');
        await saveFinance(s => ({
          ...s,
          goals: goal
            ? s.goals.map(g =>
                g.id === goal.id
                  ? { ...g, name: name.trim(), target, due, icon }
                  : g,
              )
            : [
                ...s.goals,
                {
                  id: id(),
                  name: name.trim(),
                  target,
                  currency: preferences.currency,
                  due,
                  icon,
                },
              ],
        }));
      }}
    >
      <Field
        label="Goal name"
        value={name}
        onChangeText={setName}
        maxLength={60}
        placeholder="Laptop, holiday…"
      />
      <Field
        label="Goal target amount"
        value={amount}
        onChangeText={setAmount}
        numeric
        maxLength={12}
      />
      <DateField
        label="Target date · optional"
        value={due}
        onChangeText={setDue}
      />
      <Select
        label="Goal icon"
        value={icon}
        onChange={setIcon}
        options={[
          { value: 'wallet', label: 'Savings' },
          { value: 'car', label: 'Travel' },
          { value: 'bag', label: 'Shopping' },
          { value: 'leaf', label: 'Life goal' },
          { value: 'bank', label: 'Home' },
        ]}
      />
      <Copy muted size={12}>
        {goal?.currency || preferences.currency} · Track money you have set
        aside without moving money between accounts.
      </Copy>
    </FormSheet>
  );
}
export function GoalDetails({
  goal,
  onDeleted,
}: {
  goal: Goal;
  onDeleted: () => void;
}) {
  const { finance, saveFinance } = useFinance(),
    { colors: c } = useTheme();
  const [edit, setEdit] = useState(false),
    [contribute, setContribute] = useState(false),
    [deleting, setDeleting] = useState(false),
    [removeContribution, setRemoveContribution] = useState<string | null>(null);
  const total = allocated(finance, goal.id);
  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <Icon name={goal.icon} color={c.goldInk} size={32} />
        <Amount value={total} currency={goal.currency} size={42} />
        <Copy muted>
          allocated of {formatMoney(goal.target, goal.currency)}
        </Copy>
        <View style={{ width: '100%' }}>
          <Progress value={(total / goal.target) * 100} />
        </View>
        <Copy bold color={c.goldInk}>
          {Math.round((total / goal.target) * 100)}% complete
        </Copy>
        <Copy muted size={12}>
          {total >= goal.target
            ? 'Goal reached'
            : formatMoney(goal.target - total, goal.currency) + ' to go'}
        </Copy>
      </Card>
      <Setting
        title="Target date"
        subtitle={goal.due || 'Not set'}
        onPress={() => setEdit(true)}
      />
      <Button label="Add contribution" onPress={() => setContribute(true)} />
      <Button label="Edit goal" secondary onPress={() => setEdit(true)} />
      <Section title="Contribution history" />
      {finance.contributions
        .filter(v => v.goalId === goal.id)
        .sort((a, b) => b.at - a.at)
        .map(v => (
          <Setting
            key={v.id}
            title={formatMoney(v.amount, goal.currency)}
            subtitle={`${dateText(v.at)}${v.note ? ' · ' + v.note : ''}`}
            value="Remove"
            onPress={() => setRemoveContribution(v.id)}
          />
        ))}
      <Copy muted size={12}>
        Allocations update this goal, not your expense total.
      </Copy>
      <Button label="Delete goal" danger onPress={() => setDeleting(true)} />
      {edit ? <GoalEditor goal={goal} onClose={() => setEdit(false)} /> : null}
      {contribute ? (
        <ContributionEditor goal={goal} onClose={() => setContribute(false)} />
      ) : null}
      {deleting ? (
        <Confirm
          title="Delete savings goal?"
          copy={`Remove ${goal.name} and its allocation history. Your income and expense records are kept.`}
          label="Delete goal"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await saveFinance(s => ({
              ...s,
              goals: s.goals.filter(g => g.id !== goal.id),
              contributions: s.contributions.filter(v => v.goalId !== goal.id),
            }));
            onDeleted();
          }}
        />
      ) : null}
      {removeContribution ? (
        <Confirm
          title="Remove contribution?"
          copy="This removes the allocation from this goal. It does not change your income or expenses."
          label="Remove contribution"
          onClose={() => setRemoveContribution(null)}
          onConfirm={() =>
            saveFinance(s => ({
              ...s,
              contributions: s.contributions.filter(
                v => v.id !== removeContribution,
              ),
            }))
          }
        />
      ) : null}
    </>
  );
}
function ContributionEditor({
  goal,
  onClose,
}: {
  goal: Goal;
  onClose: () => void;
}) {
  const { finance, saveFinance } = useFinance();
  const [amount, setAmount] = useState(''),
    [note, setNote] = useState(''),
    [date, setDate] = useState(localDate());
  return (
    <FormSheet
      title="Add contribution"
      onClose={onClose}
      saveLabel="Save contribution"
      onSave={async () => {
        const value = parseAmount(amount),
          at = localPaymentTime(date, '00:00');
        if (at > Date.now()) throw Error('Choose a past or current date.');
        await saveFinance(s => ({
          ...s,
          contributions: [
            { id: id(), goalId: goal.id, amount: value, at, note },
            ...s.contributions,
          ],
        }));
      }}
    >
      <Copy bold>{goal.name}</Copy>
      <Field
        label="Contribution amount"
        value={amount}
        onChangeText={setAmount}
        numeric
      />
      <DateField
        label="Contribution date"
        value={date}
        onChangeText={setDate}
      />
      <Field
        label="Contribution note · optional"
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />
      <Copy muted>
        Currently allocated:{' '}
        {formatMoney(allocated(finance, goal.id), goal.currency)}
      </Copy>
      <Copy muted size={12}>
        Use this to record money already set aside. No bank transfer is
        performed.
      </Copy>
    </FormSheet>
  );
}
export function Lending({
  onOpen,
  onHistory,
}: {
  onOpen: (t: Transaction) => void;
  onHistory: () => void;
}) {
  const { finance, transactions, preferences } = useFinance(),
    { colors: c } = useTheme();
  const [tab, setTab] = useState('outstanding');
  const loans = transactions.filter(
      t => t.category === 'lent' && currencyOf(t) === preferences.currency,
    ),
    total = loans.reduce((s, t) => s + outstanding(finance, t), 0),
    rows = loans.filter(t =>
      tab === 'outstanding'
        ? outstanding(finance, t) > 0
        : outstanding(finance, t) === 0,
    );
  return (
    <>
      <Card navy>
        <Copy size={11} color={c.onNavy}>
          OUTSTANDING
        </Copy>
        <Amount
          label="Total outstanding"
          value={total}
          currency={preferences.currency}
          size={42}
          color={c.gold}
        />
        <Copy size={12} color={c.onNavy}>
          Money owed to you · Separate from spending
        </Copy>
      </Card>
      <View style={ui.row}>
        <Chip
          label="Outstanding"
          selected={tab === 'outstanding'}
          onPress={() => setTab('outstanding')}
        />
        <Chip
          label="Returned"
          selected={tab === 'returned'}
          onPress={() => setTab('returned')}
        />
      </View>
      {rows.length ? (
        rows.map(t => (
          <Card key={t.id} onPress={() => onOpen(t)}>
            <View style={ui.spread}>
              <Copy bold size={18}>
                {t.recipient || 'Unnamed borrower'}
              </Copy>
              <Amount
                value={outstanding(finance, t)}
                currency={currencyOf(t)}
                size={25}
              />
            </View>
            <Progress value={(returned(finance, t) / t.amountPaise) * 100} />
            <Copy size={12} muted>
              {formatMoney(returned(finance, t), currencyOf(t))} returned of{' '}
              {formatMoney(t.amountPaise, currencyOf(t))} lent
            </Copy>
          </Card>
        ))
      ) : (
        <Empty
          title={
            tab === 'returned'
              ? 'No completed loans yet'
              : 'No money outstanding'
          }
          copy="Open a payment and mark it as Lent money to track what someone owes you."
          action="Choose a transaction"
          onPress={onHistory}
          icon="lend"
        />
      )}
    </>
  );
}
export function LoanDetails({
  loan,
  onEdit,
}: {
  loan: Transaction;
  onEdit: () => void;
}) {
  const { finance, saveFinance } = useFinance();
  const [repayment, setRepayment] = useState(false),
    [remove, setRemove] = useState<string | null>(null);
  return (
    <>
      <Card>
        <Copy muted size={11}>
          STILL OWED TO YOU
        </Copy>
        <Amount
          value={outstanding(finance, loan)}
          currency={currencyOf(loan)}
          size={42}
        />
        <Progress value={(returned(finance, loan) / loan.amountPaise) * 100} />
        <Copy muted size={12}>
          {formatMoney(loan.amountPaise, currencyOf(loan))} lent ·{' '}
          {formatMoney(returned(finance, loan), currencyOf(loan))} returned
        </Copy>
      </Card>
      <Copy>{loan.remarks || 'No remarks added.'}</Copy>
      {outstanding(finance, loan) > 0 ? (
        <Button label="Record a repayment" onPress={() => setRepayment(true)} />
      ) : (
        <Chip label="Fully returned" selected />
      )}
      <Button label="Edit lending entry" secondary onPress={onEdit} />
      <Section title="Repayment history" />
      {finance.repayments
        .filter(r => r.transactionId === loan.id)
        .sort((a, b) => b.at - a.at)
        .map(r => (
          <Setting
            key={r.id}
            title={formatMoney(r.amount, currencyOf(loan))}
            subtitle={`${dateText(r.at)} · ${methodLabels[r.method]}${
              r.note ? ' · ' + r.note : ''
            }`}
            value="Remove"
            onPress={() => setRemove(r.id)}
          />
        ))}
      <Copy muted size={12}>
        Repayments reduce the amount owed; they are not new income.
      </Copy>
      {repayment ? (
        <RepaymentEditor loan={loan} onClose={() => setRepayment(false)} />
      ) : null}
      {remove ? (
        <Confirm
          title="Remove repayment?"
          copy="This increases the outstanding amount by the removed repayment. The original payment is kept."
          label="Remove repayment"
          onClose={() => setRemove(null)}
          onConfirm={() =>
            saveFinance(s => ({
              ...s,
              repayments: s.repayments.filter(r => r.id !== remove),
            }))
          }
        />
      ) : null}
    </>
  );
}
function RepaymentEditor({
  loan,
  onClose,
}: {
  loan: Transaction;
  onClose: () => void;
}) {
  const { finance, saveFinance } = useFinance();
  const [amount, setAmount] = useState(''),
    [note, setNote] = useState(''),
    [method, setMethod] = useState<PaymentMethod>('UPI'),
    [date, setDate] = useState(localDate());
  return (
    <FormSheet
      title="Record repayment"
      onClose={onClose}
      saveLabel="Save repayment"
      onSave={async () => {
        const at = Math.max(
          localPaymentTime(date, '00:00'),
          transactionTime(loan),
        );
        if (date !== localDate(new Date(at)))
          throw Error('Repayment cannot be before the lending date.');
        const value = parseAmount(amount);
        await saveFinance(s =>
          addRepayment(s, loan, {
            id: id(),
            transactionId: loan.id,
            amount: value,
            at,
            method,
            note,
          }),
        );
      }}
    >
      <Copy bold>
        {loan.recipient || 'Borrower'} owes{' '}
        {formatMoney(outstanding(finance, loan), currencyOf(loan))}
      </Copy>
      <Field
        label="Repayment amount"
        value={amount}
        onChangeText={setAmount}
        numeric
      />
      <Select
        label="Repayment method"
        value={method}
        onChange={setMethod}
        options={Object.entries(methodLabels).map(([value, label]) => ({
          value: value as PaymentMethod,
          label,
        }))}
      />
      <DateField label="Repayment date" value={date} onChangeText={setDate} />
      <Field
        label="Repayment note · optional"
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />
      <Button
        label="Use full outstanding amount"
        secondary
        onPress={() => setAmount(String(outstanding(finance, loan) / 100))}
      />
    </FormSheet>
  );
}
