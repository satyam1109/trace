import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ledger } from '../services/ledger';
import type { VendorRule } from '../types';
import { allCategories, categoryFor } from '../finance/model';
import {
  Button,
  Confirm,
  Copy,
  Empty,
  ErrorNotice,
  FormSheet,
  Select,
  Setting,
} from './components';
import { useFinance } from './store';

export function VendorSettings() {
  const { demo, finance } = useFinance();
  const [rules, setRules] = useState<VendorRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<VendorRule | null>(null);
  const [forgetting, setForgetting] = useState<VendorRule | 'all' | null>(null);
  const load = useCallback(async () => {
    const next = await ledger.getVendorRules(demo);
    setRules(next.sort((a, b) => a.name.localeCompare(b.name)));
  }, [demo]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRules([]);
    setError('');
    ledger
      .getVendorRules(demo)
      .then(next => {
        if (active) setRules(next.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(e => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demo]);
  return (
    <>
      <Copy muted>
        Categories are remembered only when you choose one. Future payments
        still show the popup with that category selected.
      </Copy>
      <Copy muted size={12}>
        {demo ? 'Sample workspace' : 'On this phone'} · Exact vendor names · No
        automatic expiry
      </Copy>
      <ErrorNotice message={error} />
      {loading ? (
        <Copy muted>Loading remembered vendors…</Copy>
      ) : rules.length ? (
        rules.map(rule => (
          <View key={rule.key}>
            <Setting
              title={rule.name}
              subtitle={categoryFor(finance, rule.category).name}
              icon={categoryFor(finance, rule.category).icon}
              value="Edit"
              onPress={() => setEditing(rule)}
            />
          </View>
        ))
      ) : (
        <Empty
          title="No remembered vendors yet"
          copy="Choose a category in a payment popup or transaction editor to remember it for that vendor."
        />
      )}
      {rules.length ? (
        <Button
          label="Clear remembered vendors"
          secondary
          onPress={() => setForgetting('all')}
        />
      ) : null}
      {editing ? (
        <FormSheet
          title="Vendor category"
          saveLabel="Save vendor category"
          onClose={() => setEditing(null)}
          onSave={async () => {
            await ledger.editVendorRule(demo, editing.key, editing.category);
            await load();
          }}
        >
          <Copy bold>{editing.name}</Copy>
          <Select
            label="Remembered category"
            value={editing.category}
            options={allCategories(finance)
              .filter(c => c.id !== 'uncategorised')
              .map(c => ({
                value: c.id as VendorRule['category'],
                label: c.name,
              }))}
            onChange={category => setEditing({ ...editing, category })}
          />
          <Copy muted size={12}>
            Changes apply to future payments. Your existing transactions stay
            unchanged.
          </Copy>
          <Button
            label="Forget vendor"
            secondary
            onPress={() => {
              setForgetting(editing);
              setEditing(null);
            }}
          />
        </FormSheet>
      ) : null}
      {forgetting ? (
        <Confirm
          title={
            forgetting === 'all'
              ? 'Clear remembered vendors?'
              : 'Forget vendor?'
          }
          copy={
            forgetting === 'all'
              ? 'Remove all category rules in this workspace. Transactions stay saved.'
              : `Stop remembering the category for ${forgetting.name}. Existing transactions stay saved.`
          }
          label={
            forgetting === 'all' ? 'Clear vendor memory' : 'Forget this vendor'
          }
          onClose={() => setForgetting(null)}
          onConfirm={async () => {
            if (forgetting === 'all') await ledger.clearVendorRules(demo);
            else await ledger.forgetVendorRule(demo, forgetting.key);
            await load();
          }}
        />
      ) : null}
    </>
  );
}
