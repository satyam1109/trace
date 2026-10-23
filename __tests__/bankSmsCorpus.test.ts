import { readFileSync } from 'fs';
import { join } from 'path';
import { parseDemo } from '../src/services/demoParser';

const fixtures = readFileSync(
  join(__dirname, '../testdata/bank-sms.tsv'),
  'utf8',
)
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.startsWith('#'))
  .map(line => {
    const columns = line.split('\t');
    if (columns.length !== 9) {
      throw new Error('Invalid bank SMS fixture column count');
    }
    return columns;
  });

describe('shared bank SMS corpus', () => {
  it.each(fixtures)(
    '%s',
    (
      _id,
      sender,
      amount,
      bank,
      account,
      method,
      recipient,
      reference,
      body,
    ) => {
      const result = parseDemo(sender, body.replace(/\\n/g, '\n'));
      if (amount === 'IGNORE') {
        expect(result).toBeNull();
      } else {
        const value = (field: string) => (field === '-' ? '' : field);
        expect(result).toEqual({
          amountPaise: Number(amount),
          bank,
          account: value(account),
          method,
          recipient: value(recipient),
          reference: value(reference),
        });
      }
    },
  );
});
