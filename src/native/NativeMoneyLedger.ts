import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  createManual(input: string): Promise<string>;
  savePlanningState(demo: boolean, input: string): Promise<void>;
  savePreferences(input: string): Promise<void>;
  editTransaction(input: string): Promise<void>;
  getVendorRules(demo: boolean): Promise<string>;
  editVendorRule(demo: boolean, key: string, category: string): Promise<void>;
  forgetVendorRule(demo: boolean, key: string): Promise<void>;
  clearVendorRules(demo: boolean): Promise<void>;
  resetAllData(): Promise<void>;
  authenticate(): Promise<boolean>;
  pickDate(initial: string): Promise<string>;
  pickTime(initial: string): Promise<string>;
  getSnapshot(): Promise<string>;
  ingestDemo(sender: string, message: string): Promise<string>;
  updateTransaction(
    id: string,
    recipient: string,
    category: string,
    expenseCategory: string,
    remarks: string,
    categorySelected: boolean,
  ): Promise<void>;
  discardTransaction(id: string): Promise<void>;
  clearTransactions(demoOnly: boolean): Promise<void>;
  setDetectionEnabled(enabled: boolean): Promise<void>;
  openOverlaySettings(): Promise<void>;
  setLocationEnabled(enabled: boolean): Promise<void>;
  openLocationPermissionSettings(): Promise<void>;
  openDeviceLocationSettings(): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('MoneyLedger');
