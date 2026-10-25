import { PermissionsAndroid, Platform } from 'react-native';
import NativeLedger from '../native/NativeMoneyLedger';
import type {
  DemoResult,
  Snapshot,
  TransactionCategory,
  ManualExpense,
  Transaction,
} from '../types';
import type { ExpenseCategory } from '../categories';

export const isBrowser = false;

export const ledger = {
  async getVendorRules(
    demo: boolean,
  ): Promise<import('../types').VendorRule[]> {
    if (!NativeLedger) throw Error('Android module unavailable.');
    return JSON.parse(await NativeLedger.getVendorRules(demo));
  },
  async editVendorRule(demo: boolean, key: string, category: ExpenseCategory) {
    if (!NativeLedger) throw Error('Android module unavailable.');
    await NativeLedger.editVendorRule(demo, key, category);
  },
  async forgetVendorRule(demo: boolean, key: string) {
    if (!NativeLedger) throw Error('Android module unavailable.');
    await NativeLedger.forgetVendorRule(demo, key);
  },
  async clearVendorRules(demo: boolean) {
    if (!NativeLedger) throw Error('Android module unavailable.');
    await NativeLedger.clearVendorRules(demo);
  },
  async saveFinance(
    demo: boolean,
    state: import('../finance/model').FinanceState,
  ) {
    if (!NativeLedger) throw new Error('Android module unavailable.');
    await NativeLedger.savePlanningState(demo, JSON.stringify(state));
  },
  async savePreferences(preferences: import('../finance/model').Preferences) {
    if (!NativeLedger) throw new Error('Android module unavailable.');
    await NativeLedger.savePreferences(JSON.stringify(preferences));
  },
  async editTransaction(input: Transaction, categorySelected = false) {
    if (!NativeLedger) throw new Error('Android module unavailable.');
    await NativeLedger.editTransaction(
      JSON.stringify({ ...input, categorySelected }),
    );
  },
  async resetAllData() {
    await NativeLedger?.resetAllData();
  },
  async authenticate() {
    return NativeLedger ? NativeLedger.authenticate() : false;
  },
  async requestNotifications() {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
    return (
      (await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      )) === PermissionsAndroid.RESULTS.GRANTED
    );
  },
  async createManual(input: ManualExpense): Promise<Transaction> {
    if (!NativeLedger) throw new Error('Android module unavailable.');
    return JSON.parse(await NativeLedger.createManual(JSON.stringify(input)));
  },
  async getSnapshot(): Promise<Snapshot> {
    if (!NativeLedger) {
      return {
        transactions: [],
        detectionEnabled: false,
        smsGranted: false,
        overlayGranted: false,
        notificationsGranted: false,
        nativeAvailable: false,
        locationEnabled: false,
        locationForegroundGranted: false,
        locationBackgroundGranted: false,
        locationServicesEnabled: false,
        smsDiagnostics: null,
      };
    }
    return JSON.parse(await NativeLedger.getSnapshot());
  },
  async ingestDemo(sender: string, message: string): Promise<DemoResult> {
    if (!NativeLedger) {
      throw new Error('The SMS simulator requires the Android build.');
    }
    return JSON.parse(await NativeLedger.ingestDemo(sender, message));
  },
  async updateTransaction(
    id: string,
    recipient: string,
    category: TransactionCategory,
    expenseCategory: ExpenseCategory,
    remarks: string,
    categorySelected = false,
  ) {
    if (!NativeLedger) {
      throw new Error('Android module unavailable.');
    }
    await NativeLedger.updateTransaction(
      id,
      recipient,
      category,
      expenseCategory,
      remarks,
      categorySelected,
    );
  },
  async discardTransaction(id: string) {
    await NativeLedger?.discardTransaction(id);
  },
  async clearTransactions(demoOnly: boolean) {
    await NativeLedger?.clearTransactions(demoOnly);
  },
  async setDetectionEnabled(enabled: boolean) {
    await NativeLedger?.setDetectionEnabled(enabled);
  },
  async openOverlaySettings() {
    await NativeLedger?.openOverlaySettings();
  },
  async setLocationEnabled(enabled: boolean) {
    await NativeLedger?.setLocationEnabled(enabled);
  },
  async openLocationPermissionSettings() {
    await NativeLedger?.openLocationPermissionSettings();
  },
  async openDeviceLocationSettings() {
    await NativeLedger?.openDeviceLocationSettings();
  },
  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeLedger) return false;
    const permissions = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED ||
      permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  },
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android' || !NativeLedger) {
      return false;
    }
    const sms = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      {
        title: 'Automatically find your payments',
        message:
          'Android grants access to incoming SMS, including non-bank messages. Trace checks supported bank messages on your phone and saves only transaction details. It discards OTPs and unrelated messages. No SMS is uploaded.',
        buttonPositive: 'Continue',
        buttonNegative: 'Not now',
      },
    );
    if (sms !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    return true;
  },
};
