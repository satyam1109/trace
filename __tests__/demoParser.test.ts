import { parseDemo } from '../src/services/demoParser';
import { samples } from '../src/demo';

describe('browser demonstration parser', () => {
  it('recognises explicit completed card transaction layouts', () => {
    expect(
      parseDemo(
        'VM-KOTAKB-S',
        'Transaction of Rs.500.00 has been made on Kotak credit card xx4321 on 20-Oct at Example Shop.',
      ),
    ).toMatchObject({
      amountPaise: 50000,
      account: '4321',
      method: 'CARD',
      recipient: 'Example Shop',
    });
    expect(
      parseDemo(
        'VM-SBICRD-S',
        'Your SBI credit card ending 4321 was used for INR 125.00 at Example Shop on 20-Oct-26.',
      ),
    ).toMatchObject({ amountPaise: 12500, method: 'CARD' });
  });
  it('ignores card limits and unlabelled account transaction layouts', () => {
    expect(
      parseDemo(
        'VM-SBICRD-S',
        'SBI Card ending 4321 credit limit used INR 5000.00.',
      ),
    ).toBeNull();
    expect(
      parseDemo(
        'VM-KOTAKB-S',
        'Transaction of Rs.500.00 has been made on account xx1234.',
      ),
    ).toBeNull();
  });
  it('extracts payment amount instead of remaining balance', () => {
    const payment = parseDemo(
      'VM-HDFCBK',
      'A/c XX4821 debited by INR 240.50 to Blue Tokai via UPI. Ref 612345678901. Avl bal INR 90,000.00',
    );
    expect(payment).toMatchObject({
      amountPaise: 24050,
      recipient: 'Blue Tokai',
      account: '4821',
      reference: '612345678901',
      method: 'UPI',
    });
  });
  it.each(samples.slice(0, 3))('extracts $label', sample => {
    expect(parseDemo(sample.sender, sample.message)?.amountPaise).toBe(
      sample.amount,
    );
  });
  it.each(samples.slice(3))('ignores $label', sample => {
    expect(parseDemo(sample.sender, sample.message)).toBeNull();
  });
  it('rejects personal senders and decimal truncation', () => {
    expect(parseDemo('+919876543210', samples[0].message)).toBeNull();
    expect(parseDemo('VM-HDFCBK', 'Account debited by INR 10.999')).toBeNull();
  });
  it('does not record future, reversed or incomplete debits', () => {
    for (const message of [
      'Your account will be debited by INR 100.00',
      'Your account debited by INR 100.00. Payment reversed.',
      'Account has been debited. Balance INR 500.00.',
    ]) {
      expect(parseDemo('VM-HDFCBK', message)).toBeNull();
    }
  });
  it('captures the ICICI format with a credited beneficiary', () => {
    expect(
      parseDemo(
        'AX-ICICIT-S',
        'ICICI Bank Acct XX123 debited for RS 1.00 on 19-Oct-26; Example Person credited. UPI: 123456789. Call 1800000000 for dispute. SMS BLOCK 123 to 56789',
      ),
    ).toMatchObject({
      amountPaise: 100,
      account: '123',
      recipient: 'Example Person',
      method: 'UPI',
      reference: '123456789',
    });
  });
  it('keeps own credits and failed transfers out of expenses', () => {
    for (const message of [
      'ICICI Bank Acct XX123 credited for RS 1.00; Sender debited for RS 1.00. UPI: 123456789.',
      'ICICI Bank Acct XX123 debited for RS 1.00; Your account credited. UPI: 123456789.',
      'ICICI Bank Acct XX123 debited for RS 1.00; Example Person credited. UPI: 123456789. Transaction failed.',
    ]) {
      expect(parseDemo('AX-ICICIT-S', message)).toBeNull();
    }
  });
});
