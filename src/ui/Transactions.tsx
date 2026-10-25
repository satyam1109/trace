import DateField from './DateField';
import React, { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import {
  transactionTime,
  type Transaction,
  type TransactionCategory,
  type PaymentMethod,
} from '../types';
import type { ExpenseCategory } from '../categories';
import { localPaymentTime } from '../services/manualExpense';
import {
  allCategories,
  incomeCategories,
  categoryFor,
  currencyOf,
  dateText,
  formatMoney,
  methodLabels,
  parseAmount,
  timeText,
} from '../finance/model';
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
  Section,
  Select,
  Setting,
  Sheet,
} from './components';
import { useFinance } from './store';
import { useTheme, ui } from './theme';
import { GlassPressable } from './GlassPressable';
export function TransactionRow({
  item,
  onPress,
  glass = false,
}: {
  item: Transaction;
  onPress: () => void;
  glass?: boolean;
}) {
  const { finance } = useFinance(),
    { colors: c, dark } = useTheme();
  const cat = categoryFor(finance, item.expenseCategory),
    income = item.category === 'income';
  const label = `Edit ${item.recipient || 'payment'} ${formatMoney(
    item.amountPaise,
    currencyOf(item),
  )}`;
  const content = (
    <>
      <View style={[ui.iconBox, { backgroundColor: c.subtle }]}>
        <Icon
          name={item.category === 'lent' ? 'lend' : cat.icon}
          color={item.category === 'lent' ? c.goldInk : cat.color}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Copy bold>{item.recipient || (income ? 'Income' : 'Payment')}</Copy>
        <Copy size={11} muted>
          {dateText(transactionTime(item))} ·{' '}
          {methodLabels[item.method] || 'Card'}
        </Copy>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '47%' }}>
        <Copy bold color={income ? c.positive : c.ink}>
          {income ? '+' : '−'}
          {formatMoney(item.amountPaise, currencyOf(item))}
        </Copy>
        <Copy muted size={10}>
          {item.category === 'lent'
            ? 'Lent money'
            : item.category === 'transfer'
            ? 'Transfer / card bill'
            : cat.name}
        </Copy>
      </View>
    </>
  );
  return glass ? (
    <GlassPressable
      label={label}
      onPress={onPress}
      light={!dark}
      radius={18}
      contentStyle={[ui.setting, { borderColor: c.line }]}
    >
      {content}
    </GlassPressable>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[ui.setting, { borderColor: c.line }]}
    >
      {content}
    </Pressable>
  );
}
export function TransactionEditor({
  item,
  type = 'expense',
  initialCategorySelected = false,
  onClose,
  onSaved,
}: {
  item?: Transaction;
  type?: TransactionCategory;
  initialCategorySelected?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { finance, preferences, demo, create, edit } = useFinance();
  const [kind, setKind] = useState<TransactionCategory>(item?.category || type),
    [amount, setAmount] = useState(
      item ? (item.amountPaise / 100).toFixed(2) : '',
    ),
    [recipient, setRecipient] = useState(item?.recipient || ''),
    [remarks, setRemarks] = useState(item?.remarks || ''),
    [method, setMethod] = useState<PaymentMethod>(item?.method || 'CASH'),
    [category, setCategory] = useState<string>(
      item?.expenseCategory ||
        (type === 'income' ? 'income_salary' : 'uncategorised'),
    );
  const [categorySelected, setCategorySelected] = useState(
    initialCategorySelected,
  );
  const initial = new Date(item ? transactionTime(item) : Date.now()),
    pad = (v: number) => String(v).padStart(2, '0');
  const [date, setDate] = useState(
      `${initial.getFullYear()}-${pad(initial.getMonth() + 1)}-${pad(
        initial.getDate(),
      )}`,
    ),
    [time, setTime] = useState(
      `${pad(initial.getHours())}:${pad(initial.getMinutes())}`,
    );
  const currency = item ? currencyOf(item) : preferences.currency;
  async function save() {
    const amountPaise = parseAmount(amount),
      occurredAt = localPaymentTime(date, time);
    if (occurredAt > Date.now() || occurredAt < 946684800000)
      throw Error('Choose a past or current payment time.');
    const expenseCategory = (
      kind === 'income'
        ? category.startsWith('income_')
          ? category
          : 'income_other'
        : category.startsWith('income_')
        ? 'uncategorised'
        : category
    ) as ExpenseCategory;
    if (item)
      await edit(
        {
          ...item,
          amountPaise,
          recipient,
          remarks,
          category: kind,
          expenseCategory,
          method,
          transactionAt: occurredAt,
        },
        categorySelected,
      );
    else
      await create({
        amount,
        recipient,
        remarks,
        category: kind,
        expenseCategory,
        method,
        currency,
        occurredAt,
        demo,
        categorySelected,
      });
    onSaved?.();
  }
  return (
    <FormSheet
      title={
        item
          ? 'Edit transaction'
          : kind === 'income'
          ? 'Add income'
          : 'Add expense'
      }
      onClose={onClose}
      onSave={save}
      saveLabel={
        item
          ? 'Save changes'
          : kind === 'income'
          ? 'Save income'
          : 'Save expense'
      }
    >
      <Select
        label="Transaction type"
        value={kind}
        onChange={v => {
          setKind(v);
          setCategorySelected(false);
          setCategory(v === 'income' ? 'income_salary' : 'uncategorised');
        }}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'lent', label: 'Lent money' },
          { value: 'transfer', label: 'Own transfer / card bill' },
        ]}
      />
      <Field
        label={`Amount (${currency})`}
        value={amount}
        onChangeText={setAmount}
        numeric
        placeholder="0.00"
        maxLength={12}
      />
      <Field
        label={
          kind === 'income'
            ? 'Received from · optional'
            : 'Recipient · optional'
        }
        value={recipient}
        onChangeText={setRecipient}
      />
      <Field
        label="Remarks · optional"
        value={remarks}
        onChangeText={setRemarks}
        multiline
        maxLength={500}
      />
      <Select
        label="Category"
        value={category}
        onChange={v => {
          setCategory(v);
          setCategorySelected(true);
        }}
        options={(kind === 'income'
          ? incomeCategories
          : allCategories(finance)
        ).map(c => ({ value: c.id, label: c.name }))}
      />
      {kind === 'expense' ? (
        <Copy muted size={12}>
          Choosing a category remembers it for future payments to this vendor.
          You can manage this in Settings.
        </Copy>
      ) : null}
      <Select
        label="Payment method"
        value={method}
        onChange={setMethod}
        options={Object.entries(methodLabels).map(([value, label]) => ({
          value: value as PaymentMethod,
          label,
        }))}
      />
      <View style={[ui.row, { alignItems: 'flex-start' }]}>
        <View style={ui.fill}>
          <DateField label="Date" value={date} onChangeText={setDate} />
        </View>
        <View style={{ width: 115 }}>
          <DateField
            mode="time"
            label="Time"
            value={time}
            onChangeText={setTime}
          />
        </View>
      </View>
      {kind === 'transfer' ? (
        <Copy muted size={12}>
          Transfers and card-bill repayments are excluded from spending so card
          purchases are counted once.
        </Copy>
      ) : kind === 'lent' ? (
        <Copy muted size={12}>
          Tracked as money owed to you, separate from consumption expenses.
        </Copy>
      ) : null}
      <Copy muted size={12}>
        {item
          ? 'Currency stays with the original record.'
          : 'Saved on this device.'}
      </Copy>
    </FormSheet>
  );
}
export function TransactionDetails({
  item,
  onClose,
  onEdit,
  onLending,
}: {
  item: Transaction;
  onClose: () => void;
  onEdit: () => void;
  onLending: () => void;
}) {
  const { finance, edit, discard } = useFinance(),
    { colors: c } = useTheme();
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  const currency = currencyOf(item);
  return (
    <>
      <Sheet title="Payment details" onClose={onClose}>
        <Card style={{ alignItems: 'center' }}>
          <Copy muted size={11}>
            {item.category.toUpperCase()}
          </Copy>
          <Amount value={item.amountPaise} currency={currency} size={42} />
          <Text style={[ui.title, { color: c.ink, textAlign: 'center' }]}>
            {item.recipient || 'Unknown recipient'}
          </Text>
          <Chip label={categoryFor(finance, item.expenseCategory).name} />
          <Copy muted size={12}>
            {dateText(transactionTime(item))} ·{' '}
            {timeText(transactionTime(item))}
          </Copy>
        </Card>
        <Setting
          title="Remarks"
          subtitle={item.remarks || 'Add a note'}
          onPress={onEdit}
        />
        <Setting
          title="Payment method"
          subtitle={`${methodLabels[item.method]}${
            item.bank && item.source === 'sms' ? ' · ' + item.bank : ''
          }${item.account ? ' · ••' + item.account : ''}`}
          onPress={onEdit}
        />
        <Setting
          title="Category"
          subtitle={categoryFor(finance, item.expenseCategory).name}
          onPress={onEdit}
        />
        <Setting
          title="Source"
          subtitle={
            item.source === 'sms' ? 'Detected from bank SMS' : 'Manually added'
          }
        />
        {item.location ? (
          <Setting
            title="Payment location"
            subtitle={`${
              item.location.approximate ? 'Approximate · ' : ''
            }${item.location.latitude.toFixed(
              4,
            )}, ${item.location.longitude.toFixed(4)} · ±${Math.round(
              item.location.accuracyMeters,
            )}m`}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${
                  item.location!.latitude
                },${item.location!.longitude}`,
              )
            }
          />
        ) : (
          <Setting
            title="Payment location"
            subtitle={
              item.demo
                ? 'Not collected for sample payments.'
                : item.locationStatus === 'disabled'
                ? 'Location capture was off.'
                : item.locationStatus === 'pending'
                ? 'Finding a fresh location…'
                : 'No location was recorded.'
            }
          />
        )}
        <Button label="Edit transaction" onPress={onEdit} />
        {item.category === 'lent' ? (
          <Button
            label="View lending & repayments"
            secondary
            onPress={onLending}
          />
        ) : item.category === 'expense' ? (
          <Button
            label="Mark as money lent"
            secondary
            onPress={async () => {
              try {
                await edit({
                  ...item,
                  category: 'lent',
                  transactionAt: transactionTime(item),
                });
                onClose();
                onLending();
              } catch (e) {
                setError(String(e));
              }
            }}
          />
        ) : null}
        {error ? <Copy color={c.danger}>{error}</Copy> : null}
        <Button label="Discard entry" danger onPress={() => setConfirm(true)} />
      </Sheet>
      {confirm ? (
        <Confirm
          title="Discard this entry?"
          copy="This removes the entry from Trace and updates its totals. Your bank payment and SMS stay unchanged."
          label="Discard entry"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await discard(item.id);
            onClose();
          }}
        />
      ) : null}
    </>
  );
}
export type HistoryFilter = {
  category?: string;
  method?: string;
  type?: string;
  from?: string;
  to?: string;
};
export function History({
  items,
  month,
  initial,
  onOpen,
}: {
  items: Transaction[];
  month: string;
  initial?: HistoryFilter;
  onOpen: (t: Transaction) => void;
}) {
  const { finance, preferences } = useFinance();
  const [search, setSearch] = useState(''),
    [type, setType] = useState(initial?.type || 'all'),
    [category, setCategory] = useState(initial?.category || 'all'),
    [method, setMethod] = useState(initial?.method || 'all'),
    [sort, setSort] = useState('newest'),
    [allDates, setAllDates] = useState(false),
    [filters, setFilters] = useState(!!initial),
    [from, setFrom] = useState(initial?.from || ''),
    [to, setTo] = useState(initial?.to || '');
  let rows = items
    .filter(t => currencyOf(t) === preferences.currency)
    .filter(
      t =>
        (allDates ||
          from ||
          to ||
          new Date(transactionTime(t)).getFullYear() +
            '-' +
            String(new Date(transactionTime(t)).getMonth() + 1).padStart(
              2,
              '0',
            ) ===
            month) &&
        (type === 'all' || t.category === type) &&
        (category === 'all' || t.expenseCategory === category) &&
        (method === 'all' || t.method === method) &&
        `${t.recipient} ${t.remarks} ${t.bank} ${
          categoryFor(finance, t.expenseCategory).name
        }`
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  if (from)
    rows = rows.filter(
      t => transactionTime(t) >= new Date(from + 'T00:00:00').getTime(),
    );
  if (to)
    rows = rows.filter(
      t =>
        transactionTime(t) <
        new Date(new Date(to + 'T00:00:00').getTime() + 86400000).getTime(),
    );
  rows = rows.sort((a, b) =>
    sort === 'highest'
      ? b.amountPaise - a.amountPaise
      : sort === 'lowest'
      ? a.amountPaise - b.amountPaise
      : sort === 'oldest'
      ? transactionTime(a) - transactionTime(b)
      : transactionTime(b) - transactionTime(a),
  );
  return (
    <>
      <Field
        label="Search transactions"
        value={search}
        onChangeText={setSearch}
        placeholder="Payments, notes, people"
      />
      <View style={ui.wrap}>
        <Chip
          label={allDates ? 'All dates' : month}
          selected={!allDates}
          onPress={() => setAllDates(!allDates)}
        />
        <Chip
          label="Filters & sort"
          selected={filters}
          onPress={() => setFilters(!filters)}
        />
      </View>
      {filters ? (
        <Card>
          <Select
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
              { value: 'lent', label: 'Lent money' },
              { value: 'transfer', label: 'Transfer / card bill' },
            ]}
          />
          <Select
            label="Filter category"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: 'All categories' },
              ...allCategories(finance).map(c => ({
                value: c.id,
                label: c.name,
              })),
              ...incomeCategories.map(c => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            label="Filter payment method"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'all', label: 'All payment methods' },
              ...Object.entries(methodLabels).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <Select
            label="Sort transactions"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'highest', label: 'Highest amount' },
              { value: 'lowest', label: 'Lowest amount' },
            ]}
          />
          <DateField
            label="From date · optional (YYYY-MM-DD)"
            value={from}
            onChangeText={setFrom}
          />
          <DateField
            label="To date · optional (YYYY-MM-DD)"
            value={to}
            onChangeText={setTo}
          />
          <Button
            label="Clear filters"
            secondary
            onPress={() => {
              setType('all');
              setCategory('all');
              setMethod('all');
              setFrom('');
              setTo('');
              setSearch('');
              setAllDates(false);
              setSort('newest');
            }}
          />
        </Card>
      ) : null}
      <Section
        title={`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`}
      />
      {rows.length ? (
        rows.map(t => (
          <TransactionRow key={t.id} item={t} onPress={() => onOpen(t)} />
        ))
      ) : (
        <Empty
          title="No matching entries"
          copy="Try another month, a broader date range or fewer filters."
          icon="search"
        />
      )}
    </>
  );
}
