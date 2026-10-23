import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { isBrowser, ledger } from '../services/ledger';
import { Icon } from '../components/Icon';
import { allCategories, id, type Category } from '../finance/model';
import {
  Button,
  Card,
  Confirm,
  Copy,
  Field,
  ErrorNotice,
  FormSheet,
  Section,
  Select,
  Setting,
  Sheet,
} from './components';
import { useFinance } from './store';
import { useTheme, ui } from './theme';
const diagnostics: Record<string, string> = {
  never_received: 'No incoming SMS checked yet.',
  paused: 'Detection was paused when the last SMS arrived.',
  unreadable_sms: 'Android could not decode the last SMS.',
  unsupported_sender: 'The latest SMS sender is not supported.',
  ignored_message: 'The latest SMS was not a successful debit.',
  unsupported_format: 'The latest bank SMS format was not recognised.',
  saved: 'The latest supported payment was saved.',
  duplicate: 'An already recorded payment was ignored.',
  processing_error: 'The latest SMS could not be processed.',
  saved_prompt_error: 'Payment saved; its popup could not be shown.',
};
export function Settings({
  section,
  onNavigate,
  onPreview,
  onReset,
}: {
  section: string;
  onNavigate: (screen: string) => void;
  onPreview: () => void;
  onReset: () => void;
}) {
  const {
      preferences,
      savePreferences,
      snapshot,
      refresh,
      setError,
      error,
      authenticate,
      demo,
      setDemo,
    } = useFinance(),
    { colors: c } = useTheme();
  const [disclosure, setDisclosure] = useState(false),
    [details, setDetails] = useState(false),
    [confirmReset, setConfirmReset] = useState(false),
    [name, setName] = useState(preferences.name),
    [working, setWorking] = useState(false);
  async function run(action: () => Promise<unknown>) {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update this setting.',
      );
    } finally {
      setWorking(false);
    }
  }
  if (section === 'appearance')
    return (
      <>
        <Copy muted>
          Choose a theme. System follows your phone’s appearance.
        </Copy>
        {(['system', 'light', 'dark'] as const).map(v => (
          <Setting
            key={v}
            title={
              v === 'system'
                ? 'System default'
                : v === 'light'
                ? 'Light'
                : 'Dark'
            }
            value={preferences.theme === v ? 'Selected' : ''}
            icon="eye"
            onPress={() => run(() => savePreferences({ theme: v }))}
          />
        ))}
      </>
    );
  if (section === 'profile')
    return (
      <>
        <Field
          label="Display name · optional"
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Select
          label="Currency"
          value={preferences.currency}
          onChange={v => run(() => savePreferences({ currency: v }))}
          options={[
            { value: 'INR', label: 'Indian rupee · INR (₹)' },
            { value: 'USD', label: 'US dollar · USD ($)' },
            { value: 'EUR', label: 'Euro · EUR (€)' },
            { value: 'GBP', label: 'British pound · GBP (£)' },
          ]}
        />
        <Copy muted size={12}>
          Each entry keeps its original currency. Totals show only the currency
          selected here. No exchange-rate conversion is performed. Bank SMS
          payments are recorded in INR.
        </Copy>
        <Button
          label="Save profile"
          disabled={working}
          onPress={() => run(() => savePreferences({ name: name.trim() }))}
        />
        <Copy muted size={12}>
          Your profile stays on this device. No sign-in is required.
        </Copy>
      </>
    );
  if (section === 'categories') return <Categories />;
  if (section === 'alerts')
    return (
      <>
        <Setting
          title="Budget alerts"
          subtitle="Local notifications and in-app budget warnings."
          toggle={preferences.alerts}
          onPress={() =>
            run(() => savePreferences({ alerts: !preferences.alerts }))
          }
        />
        <Section title="Category thresholds" />
        {[70, 90, 100].map(t => (
          <Setting
            key={t}
            title={`${t}% of budget`}
            toggle={preferences.thresholds.includes(t)}
            subtitle={
              t === 100
                ? 'Also used when the overall monthly limit is reached.'
                : undefined
            }
            onPress={() =>
              run(() =>
                savePreferences({
                  thresholds: preferences.thresholds.includes(t)
                    ? preferences.thresholds.filter(v => v !== t)
                    : [...preferences.thresholds, t].sort((a, b) => a - b),
                }),
              )
            }
          />
        ))}
        <Card>
          <Copy bold>Notification permission</Copy>
          <Copy muted size={12}>
            {isBrowser
              ? 'Local budget notifications are available in the Android app.'
              : snapshot?.notificationsGranted
              ? 'Allowed'
              : 'Allow notifications to receive budget warnings while Trace is closed.'}
          </Copy>
          {!isBrowser && !snapshot?.notificationsGranted ? (
            <Button
              label="Enable notifications"
              disabled={working}
              onPress={() => run(() => ledger.requestNotifications())}
            />
          ) : null}
        </Card>
        <Copy muted size={12}>
          Alerts are sent once per threshold, category, budget limit and month.
          SMS capture continues when budget alerts are off.
        </Copy>
      </>
    );
  if (section === 'security')
    return (
      <>
        <Card>
          <Icon name="lock" color={c.goldInk} size={30} />
          <Copy bold size={22}>
            Your phone’s lock, for Trace
          </Copy>
          <Copy muted>
            Unlock with an enrolled biometric or your Android screen-lock PIN,
            pattern or password.
          </Copy>
        </Card>
        <Setting
          title="App lock"
          subtitle={
            isBrowser
              ? 'Available on Android.'
              : 'Locks Trace when it goes into the background.'
          }
          toggle={preferences.appLock}
          onPress={() =>
            run(async () => {
              if (isBrowser)
                throw Error('App lock is available in the Android app.');
              if (await authenticate())
                await savePreferences({ appLock: !preferences.appLock });
            })
          }
        />
        <Copy muted size={12}>
          Trace does not store your PIN. While app lock is enabled, payment
          details open inside the locked app rather than in an automatic
          floating popup. Payment capture continues.
        </Copy>
      </>
    );
  if (section === 'detection')
    return (
      <>
        <Card>
          <View style={ui.row}>
            <Icon name="shield" color={c.goldInk} size={28} />
            <Copy bold size={22}>
              {snapshot?.smsGranted && snapshot.detectionEnabled
                ? 'Detection on'
                : 'Payment detection'}
            </Copy>
          </View>
          <Copy muted>
            Supported debit and card-spend SMS are processed on this phone. A
            payment is saved before its optional popup appears.
          </Copy>
        </Card>
        <Setting
          title="Automatically capture payments"
          toggle={!!snapshot?.detectionEnabled}
          onPress={() =>
            snapshot?.detectionEnabled
              ? run(() => ledger.setDetectionEnabled(false))
              : setDisclosure(true)
          }
        />
        <Setting
          title="SMS access"
          subtitle={
            isBrowser
              ? 'Android app required'
              : snapshot?.smsGranted
              ? 'Allowed'
              : 'Not allowed'
          }
          onPress={() => setDisclosure(true)}
        />
        <Setting
          title="Display payment popup"
          subtitle={
            isBrowser
              ? 'Android app required'
              : snapshot?.overlayGranted
              ? 'Allowed'
              : 'Permission needed'
          }
          onPress={() => run(() => ledger.openOverlaySettings())}
        />
        <Setting
          title="Notifications"
          subtitle={snapshot?.notificationsGranted ? 'Allowed' : 'Not allowed'}
          onPress={() => run(() => ledger.requestNotifications())}
        />
        <Button label="Preview payment popup" secondary onPress={onPreview} />
        <Setting
          title="SMS diagnostics"
          subtitle="Receiver status without message text."
          onPress={() => setDetails(!details)}
        />
        {details ? (
          <Card>
            <Copy>
              {diagnostics[
                snapshot?.smsDiagnostics?.lastResult || 'never_received'
              ] || 'Status unavailable.'}
            </Copy>
            <Copy muted size={12}>
              {snapshot?.smsDiagnostics?.receivedCount || 0} incoming messages
              checked
              {snapshot?.smsDiagnostics?.lastReceivedAt
                ? ' · ' +
                  new Date(
                    snapshot.smsDiagnostics.lastReceivedAt,
                  ).toLocaleString('en-IN')
                : ''}
            </Copy>
            <Copy muted size={12}>
              A status check is not a guaranteed capture rate. OTPs, personal
              messages and unsupported formats are ignored.
            </Copy>
          </Card>
        ) : null}
        {disclosure ? (
          <Sheet
            title="Enable SMS capture"
            onClose={() => setDisclosure(false)}
          >
            <ErrorNotice message={error} />
            <Copy>
              Android grants access to incoming SMS, including non-bank
              messages. Trace checks supported bank messages on your device and
              saves transaction details.
            </Copy>
            <Copy muted>
              OTPs and unrelated messages are ignored. SMS text is not uploaded.
              You can disable capture at any time.
            </Copy>
            <Button
              label="Continue to SMS permission"
              disabled={working}
              onPress={() =>
                run(async () => {
                  if (isBrowser)
                    throw Error(
                      'Live SMS detection is available in the Android app.',
                    );
                  if (await ledger.requestPermissions()) {
                    await ledger.setDetectionEnabled(true);
                    setDemo(false);
                    setDisclosure(false);
                  }
                })
              }
            />
            <Button
              label="Not now"
              secondary
              onPress={() => setDisclosure(false)}
            />
          </Sheet>
        ) : null}
      </>
    );
  if (section === 'location')
    return (
      <>
        <Card>
          <Icon name="bank" color={c.goldInk} size={28} />
          <Copy bold size={23}>
            Location is optional
          </Copy>
          <Copy muted>
            Save one fresh device-location estimate near the time a supported
            payment SMS arrives. It does not continuously track you.
          </Copy>
        </Card>
        <Setting
          title="Save payment location"
          subtitle={
            isBrowser
              ? 'Android only. No browser location is collected.'
              : snapshot?.locationEnabled
              ? 'Enabled'
              : 'Off'
          }
          toggle={!!snapshot?.locationEnabled}
          onPress={() =>
            run(async () => {
              if (isBrowser)
                throw Error(
                  'Location capture is available in the Android app.',
                );
              if (snapshot?.locationEnabled)
                await ledger.setLocationEnabled(false);
              else if (await ledger.requestLocationPermission())
                await ledger.setLocationEnabled(true);
            })
          }
        />
        <Setting
          title="Location permission"
          subtitle={
            snapshot?.locationForegroundGranted ? 'Allowed' : 'Not allowed'
          }
          onPress={() => run(() => ledger.openLocationPermissionSettings())}
        />
        <Setting
          title="Background location"
          subtitle={
            snapshot?.locationBackgroundGranted
              ? 'Allowed'
              : 'Allow all the time for capture while Trace is closed.'
          }
          onPress={() => run(() => ledger.openLocationPermissionSettings())}
        />
        <Setting
          title="Phone location services"
          subtitle={snapshot?.locationServicesEnabled ? 'On' : 'Off'}
          onPress={() => run(() => ledger.openDeviceLocationSettings())}
        />
        <Copy muted size={12}>
          Approximate access is supported. A delayed SMS can capture a location
          after the payment. If a fresh fix is unavailable, the payment is still
          saved. Older and manual entries are not backfilled.
        </Copy>
      </>
    );
  if (section === 'data')
    return (
      <>
        <Card>
          <Copy bold size={23}>
            Saved on this device
          </Copy>
          <Copy muted>
            Transactions, budgets, goals and repayments are stored locally.
            Sensitive financial details are encrypted in the Android database.
          </Copy>
        </Card>
        <Setting
          title="Sample workspace"
          subtitle={
            demo ? 'Viewing sample records' : 'Viewing your real local records'
          }
          toggle={demo}
          onPress={isBrowser ? undefined : () => setDemo(!demo)}
        />
        <Copy muted size={12}>
          {isBrowser
            ? 'The browser contains demo records only.'
            : 'Sample payments and planning data are kept separate from your real ledger.'}
        </Copy>
        <Copy muted size={12}>
          Uninstalling Trace or clearing Android app storage removes local
          records. There is currently no cloud backup.
        </Copy>
        <Button
          label="Reset all local data"
          danger
          onPress={() => setConfirmReset(true)}
        />
        {confirmReset ? (
          <ResetConfirmation
            onClose={() => setConfirmReset(false)}
            onDone={onReset}
          />
        ) : null}
      </>
    );
  return (
    <>
      <Card onPress={() => onNavigate('profile')}>
        <View style={ui.row}>
          <View style={[ui.iconBox, { backgroundColor: c.goldSoft }]}>
            <Copy bold color={c.goldInk}>
              {preferences.name?.slice(0, 1).toUpperCase() || 'Y'}
            </Copy>
          </View>
          <View style={ui.fill}>
            <Copy bold size={19}>
              {preferences.name || 'Your profile'}
            </Copy>
            <Copy muted size={12}>
              Local profile · No sign-in required
            </Copy>
          </View>
          <Icon name="arrow" color={c.muted} />
        </View>
      </Card>
      <Section title="Personalise" />
      <Setting
        title="Appearance"
        subtitle={
          preferences.theme === 'system'
            ? 'System default'
            : preferences.theme === 'dark'
            ? 'Dark'
            : 'Light'
        }
        icon="eye"
        onPress={() => onNavigate('appearance')}
      />
      <Setting
        title="Categories"
        subtitle="Expense categories and custom labels"
        icon="bag"
        onPress={() => onNavigate('categories')}
      />
      <Setting
        title="Budget defaults"
        subtitle="Monthly and category limits"
        icon="wallet"
        onPress={() => onNavigate('budgets')}
      />
      <Setting
        title="Budget alerts"
        subtitle="Local notifications and thresholds"
        icon="info"
        onPress={() => onNavigate('alerts')}
      />
      <Section title="Privacy & data" />
      <Setting
        title="Payment detection"
        subtitle="SMS access and receiver status"
        icon="shield"
        onPress={() => onNavigate('detection')}
      />
      <Setting
        title="Payment location"
        subtitle={snapshot?.locationEnabled ? 'Enabled' : 'Optional · Off'}
        icon="bank"
        onPress={() => onNavigate('location')}
      />
      <Setting
        title="App lock"
        subtitle="Device biometric or screen lock"
        icon="lock"
        onPress={() => onNavigate('security')}
      />
      <Setting
        title="Data & storage"
        subtitle="Workspace and reset options"
        icon="activity"
        onPress={() => onNavigate('data')}
      />
      <Copy muted size={12}>
        Trace · Offline money tracking · v0.2.0
      </Copy>
    </>
  );
}
function ResetConfirmation({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { reset } = useFinance();
  return (
    <Confirm
      title="Reset all local data?"
      copy="This permanently removes transactions, budgets, goals, lending history and preferences. Your bank payments and SMS remain unchanged."
      label="Reset local data"
      onClose={onClose}
      onConfirm={async () => {
        await reset();
        onDone();
      }}
    />
  );
}
function Categories() {
  const { finance, transactions, saveFinance } = useFinance();
  const [editing, setEditing] = useState<Category | null | undefined>(
      undefined,
    ),
    [deleting, setDeleting] = useState<Category | null>(null);
  return (
    <>
      <Copy muted>
        Categories stay consistent across history, budgets and insights.
      </Copy>
      {allCategories(finance).map(c => (
        <Setting
          key={c.id}
          title={c.name}
          icon={c.icon}
          value={c.id.startsWith('custom_') ? 'Edit' : 'Built-in'}
          onPress={c.id.startsWith('custom_') ? () => setEditing(c) : undefined}
        />
      ))}
      <Button label="Create custom category" onPress={() => setEditing(null)} />
      {editing !== undefined ? (
        <CategoryEditor
          category={editing || undefined}
          onClose={() => setEditing(undefined)}
          onDelete={() => {
            setDeleting(editing || null);
            setEditing(undefined);
          }}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title="Delete category?"
          copy={`Remove ${deleting.name}. Categories used by transactions or budgets must be reassigned first.`}
          label="Delete category"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (
              transactions.some(t => t.expenseCategory === deleting.id) ||
              Object.values(finance.months).some(p => p.limits[deleting.id]) ||
              Object.values(finance.defaults).some(p => p.limits[deleting.id])
            )
              throw Error(
                'This category is used. Reassign its transactions and remove its budget limits first.',
              );
            await saveFinance(s => ({
              ...s,
              categories: s.categories.filter(c => c.id !== deleting.id),
            }));
          }}
        />
      ) : null}
    </>
  );
}
function CategoryEditor({
  category,
  onClose,
  onDelete,
}: {
  category?: Category;
  onClose: () => void;
  onDelete: () => void;
}) {
  const { finance, saveFinance } = useFinance();
  const [name, setName] = useState(category?.name || ''),
    [icon, setIcon] = useState(category?.icon || 'wallet'),
    [color, setColor] = useState(category?.color || '#C7A15A');
  return (
    <FormSheet
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
      saveLabel="Save category"
      onSave={async () => {
        const trimmed = name.trim();
        if (!trimmed) throw Error('Enter a category name.');
        if (
          allCategories(finance).some(
            v =>
              v.id !== category?.id &&
              v.name.toLowerCase() === trimmed.toLowerCase(),
          )
        )
          throw Error('A category already has that name.');
        const value = {
          id: category?.id || 'custom_' + id(),
          name: trimmed,
          icon,
          color,
        };
        await saveFinance(s => ({
          ...s,
          categories: category
            ? s.categories.map(v => (v.id === category.id ? value : v))
            : [...s.categories, value],
        }));
      }}
    >
      <Field
        label="Category name"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />
      <Select
        label="Category icon"
        value={icon}
        onChange={setIcon}
        options={[
          { value: 'wallet', label: 'Wallet' },
          { value: 'coffee', label: 'Food' },
          { value: 'bag', label: 'Shopping' },
          { value: 'car', label: 'Travel' },
          { value: 'shield', label: 'Health' },
          { value: 'leaf', label: 'Lifestyle' },
          { value: 'phone', label: 'Bills' },
          { value: 'play', label: 'Entertainment' },
        ]}
      />
      <Section title="Category colour" />
      <View style={ui.wrap}>
        {['#C7A15A', '#8F9FC4', '#B1A3C5', '#6F859C', '#A56668', '#589488'].map(
          v => (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${v}`}
              accessibilityState={{ checked: color === v }}
              onPress={() => setColor(v)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: v,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {color === v ? <Icon name="check" color="#FFFFFF" /> : null}
            </Pressable>
          ),
        )}
      </View>
      <Card>
        <View style={ui.row}>
          <Icon name={icon} color={color} />
          <Copy bold>{name || 'Your category'}</Copy>
        </View>
      </Card>
      {category ? (
        <Button label="Delete custom category" danger onPress={onDelete} />
      ) : null}
    </FormSheet>
  );
}
