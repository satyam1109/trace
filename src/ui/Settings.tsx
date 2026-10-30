import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { VendorSettings } from './VendorSettings';
import { useTheme, ui } from './theme';
import { GlassPressable } from './GlassPressable';
import { version as appVersion } from '../../package.json';
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
        <View style={settingsStyles.appearances}>
          {(['system', 'light', 'dark'] as const).map(v => (
            <AppearanceChoice
              key={v}
              theme={v}
              selected={preferences.theme === v}
              disabled={working}
              onPress={() => run(() => savePreferences({ theme: v }))}
            />
          ))}
        </View>
        <Copy muted size={12}>
          Your choice applies to every screen and the payment popup.
        </Copy>
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
  if (section === 'vendors') return <VendorSettings />;
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
            Transactions, budgets, goals, repayments and vendor rules are stored
            locally. Sensitive financial details are encrypted in the Android
            database.
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
      <GlassPressable
        label="Your profile"
        onPress={() => onNavigate('profile')}
        contentStyle={settingsStyles.profile}
        radius={24}
      >
        <View style={[settingsStyles.avatar, { backgroundColor: c.surface }]}>
          <Copy size={23}>
            {preferences.name?.slice(0, 1).toUpperCase() || 'Y'}
          </Copy>
        </View>
        <View style={ui.fill}>
          <Copy size={23}>{preferences.name || 'Your profile'}</Copy>
          <Copy muted size={12}>
            On this device · {preferences.currency}
          </Copy>
        </View>
        <Icon name="arrow" color={c.muted} size={18} />
      </GlassPressable>
      <SettingsGroup title="Make it yours">
        <SettingsLink
          title="Appearance"
          icon="eye"
          value={
            preferences.theme === 'system'
              ? 'System'
              : preferences.theme === 'dark'
              ? 'Dark'
              : 'Light'
          }
          onPress={() => onNavigate('appearance')}
        />
        <SettingsLink
          title="Categories"
          icon="bag"
          onPress={() => onNavigate('categories')}
        />
        <SettingsLink
          title="Remembered vendors"
          icon="activity"
          last
          onPress={() => onNavigate('vendors')}
        />
      </SettingsGroup>
      <SettingsGroup title="Planning">
        <SettingsLink
          title="Budget defaults"
          icon="wallet"
          onPress={() => onNavigate('budgets')}
        />
        <SettingsLink
          title="Budget alerts"
          icon="info"
          value={preferences.alerts ? 'On' : 'Off'}
          last
          onPress={() => onNavigate('alerts')}
        />
      </SettingsGroup>
      <SettingsGroup title="Privacy & data">
        <SettingsLink
          title="Payment detection"
          icon="shield"
          onPress={() => onNavigate('detection')}
        />
        <SettingsLink
          title="Payment location"
          icon="bank"
          value={snapshot?.locationEnabled ? 'On' : 'Off'}
          onPress={() => onNavigate('location')}
        />
        <SettingsLink
          title="App lock"
          icon="lock"
          value={preferences.appLock ? 'On' : 'Off'}
          onPress={() => onNavigate('security')}
        />
        <SettingsLink
          title="Data & storage"
          icon="activity"
          last
          onPress={() => onNavigate('data')}
        />
      </SettingsGroup>
      <View style={settingsStyles.footer}>
        <Icon name="shield" size={16} color={c.muted} />
        <Copy muted size={12}>
          Stored on your device · Trace {appVersion}
        </Copy>
      </View>
    </>
  );
}
function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors: c } = useTheme();
  return (
    <View style={settingsStyles.group}>
      <Copy muted size={12} style={settingsStyles.groupTitle}>
        {title}
      </Copy>
      <View style={[settingsStyles.groupBody, { backgroundColor: c.surface }]}>
        {children}
      </View>
    </View>
  );
}
function SettingsLink({
  title,
  icon,
  value,
  last,
  onPress,
}: {
  title: string;
  icon: string;
  value?: string;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  return (
    <GlassPressable label={title} onPress={onPress} radius={18}>
      <View style={settingsStyles.link}>
        <Icon name={icon} color={c.muted} size={20} />
        <View
          style={[
            settingsStyles.linkBody,
            {
              borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
              borderColor: c.line,
            },
          ]}
        >
          <Copy size={14} style={ui.fill}>
            {title}
          </Copy>
          {value ? (
            <Copy muted size={12}>
              {value}
            </Copy>
          ) : null}
          <Icon name="arrow" color={c.muted} size={15} />
        </View>
      </View>
    </GlassPressable>
  );
}
function AppearanceChoice({
  theme,
  selected,
  disabled,
  onPress,
}: {
  theme: 'system' | 'light' | 'dark';
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTheme();
  const title =
    theme === 'system'
      ? 'System default'
      : theme === 'light'
      ? 'Light'
      : 'Dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        settingsStyles.appearance,
        {
          borderColor: selected ? c.ink : c.line,
          backgroundColor: c.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={settingsStyles.preview}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {(theme === 'system' ? [false, true] : [theme === 'dark']).map(
          (darkPreview, i) => (
            <View
              key={i}
              style={[
                settingsStyles.previewHalf,
                { backgroundColor: darkPreview ? '#17191C' : '#FAF9F6' },
              ]}
            >
              <View
                style={[
                  settingsStyles.previewLine,
                  {
                    width: '50%',
                    backgroundColor: darkPreview ? '#A5A9AF' : '#6E7279',
                  },
                ]}
              />
              <View
                style={[
                  settingsStyles.previewTotal,
                  { backgroundColor: darkPreview ? '#F1F0EC' : '#202329' },
                ]}
              />
              <View
                style={[
                  settingsStyles.previewCard,
                  { backgroundColor: darkPreview ? '#30343A' : '#E9E8E3' },
                ]}
              />
            </View>
          ),
        )}
      </View>
      <View style={settingsStyles.appearanceLabel}>
        <Copy size={12} style={ui.fill}>
          {title}
        </Copy>
        <View
          style={[
            settingsStyles.radio,
            {
              borderColor: selected ? c.ink : c.muted,
              backgroundColor: selected ? c.ink : 'transparent',
            },
          ]}
        >
          {selected ? <Icon name="check" size={12} color={c.bg} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
const settingsStyles = StyleSheet.create({
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    marginBottom: 8,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: { gap: 10, marginBottom: 8 },
  groupTitle: { paddingHorizontal: 4 },
  groupBody: { borderRadius: 24, paddingHorizontal: 14, paddingVertical: 3 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 3 },
  linkBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 60,
    paddingVertical: 14,
    paddingRight: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
  },
  appearances: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  appearance: {
    flexGrow: 1,
    flexBasis: 100,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 10,
    gap: 14,
  },
  preview: {
    flexDirection: 'row',
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewHalf: { flex: 1, paddingHorizontal: 9, paddingVertical: 16, gap: 10 },
  previewLine: { height: 4, borderRadius: 2 },
  previewTotal: { height: 9, width: '78%', borderRadius: 3 },
  previewCard: { height: 39, borderRadius: 8, marginTop: 8 },
  appearanceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
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
      copy="This permanently removes transactions, budgets, goals, lending history, remembered vendors and preferences. Your bank payments and SMS remain unchanged."
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
