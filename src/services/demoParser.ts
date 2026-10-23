import registry from '../data/smsBanks.json';
import type { PaymentMethod } from '../types';

// Browser demonstration only; live SMS always uses the native Kotlin parser.
const money =
  '(?:INR\\s*:?|Rs[.:]?|₹)\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)(?![0-9]|\\.[0-9])';
const action = '(?:debited|spent|paid|purchase(?:d)?|withdrawn)';
const token = '([0-9xX*•][0-9xX*•._-]*(?:\\s+\\d{3,5})?)(?![A-Za-z0-9xX*•])';
const rx = (pattern: string) => new RegExp(pattern, 'i');
const all = (text: string, pattern: string) => [
  ...text.matchAll(new RegExp(pattern, 'gi')),
];
const credit = '\\b(?:credited|credit received)\\b';
const suffix = (value: string) =>
  value
    .replace(/ /g, '')
    .replace(/[._-]+$/, '')
    .match(/\d{3,}$/)?.[0]
    .slice(-4) || '';

export function parseDemo(sender: string, rawBody: string) {
  const parts = sender.toUpperCase().split('-');
  const profile = registry.find(bank =>
    bank.senders.some(value => parts.includes(value)),
  );
  if (!profile || rawBody.length > 4096) return null;
  const body = rawBody.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n');
  const guarded = body.replace(
    /\b(?:never|do not|don't)\s+share\s+(?:your\s+)?OTP\b(?:\s*[/,]\s*(?:PIN|CVV|password))*(?!\s*[/,]\s*(?:PIN|CVV|password))(?!\s*[:=-]?\s*\d)/gi,
    '',
  );
  if (
    /\b(?:OTP|one[ -]time|verification code|will be|to be debited|scheduled|declined|failed|unsuccessful|reversed|reversal|refunded|refund|requested|request received)\b/i.test(
      guarded,
    ) ||
    /\b(?:payment|collect|transaction)\s+request\b|\b(?:total|minimum)\s+(?:amount\s+)?due\b|\bpayment\s+(?:is\s+)?due\b|\b(?:bill|statement)\s+(?:(?:has been|is)\s+)?(?:generated|ready|due)\b/i.test(
      guarded,
    )
  )
    return null;

  const card = all(
    body,
    '\\b(?:credit\\s*card|debit\\s*card|card|BOBCARD)(?:\\s*(?:no\\.?|ending(?:\\s+with)?|number))?\\s*[:.-]?\\s*' +
      token,
  ).find(
    match =>
      !/\b(?:block|unblock|activate|manage)\s*$/i.test(
        body.slice(Math.max(0, match.index! - 24), match.index),
      ),
  );
  const cardContext = !!card || /\bon\s+HDFC\s+Bank\s+card\b/i.test(body);
  const sent =
    profile.name === 'HDFC Bank'
      ? body.match(
          rx(
            '^\\s*(?:Amt\\s+)?Sent\\s*' +
              money +
              '\\s*From\\s+HDFC\\s+Bank\\s+A/C\\b',
          ),
        )
      : profile.name === 'Kotak Mahindra Bank'
      ? body.match(
          rx('^\\s*Sent\\s*' + money + '\\s*from\\s+Kotak\\s+Bank\\s+AC\\b'),
        )
      : null;
  const axisLayout =
    profile.name === 'Axis Bank'
      ? body.match(
          rx(
            '^\\s*Spent\\s*\\n\\s*(?:Axis\\s+Bank\\s+)?Card\\s+no\\.?\\s+[0-9xX* .-]+\\n\\s*' +
              money,
          ),
        )
      : null;
  const after = body.match(
    rx(
      '\\b' +
        action +
        '\\b\\s*[:;-]?\\s*(?:(?:by|for|of|with|amount|is)\\s*[:=]?\\s*){0,2}' +
        money,
    ),
  );
  const before = body.match(
    rx(money + '\\s*(?:(?:has been|was|is)\\s+)?' + action + '\\b'),
  );
  const cardUse =
    cardContext || profile.cardOnly
      ? body.match(
          rx(
            '\\bused\\s+for\\s+(?:(?:a\\s+)?(?:transaction|purchase|txn)\\s+(?:of\\s+)?)?' +
              money,
          ),
        ) ||
        body.match(
          rx(
            '\\b(?:transaction|txn|purchase)\\s+of\\s+' +
              money +
              '\\s+(?:(?:has been|was)\\s+)?(?:made|done)\\s+(?:on|using)\\b',
          ),
        ) ||
        (profile.name === 'HSBC'
          ? body.match(rx('\\bused\\s+at\\s+[^\\n]{1,100}?\\s+for\\s+' + money))
          : null)
      : null;
  const amount = sent || axisLayout || after || before || cardUse;
  if (!amount) return null;
  const amountEnd = amount.index! + amount[0].length - 1;

  const candidate =
    profile.name === 'ICICI Bank'
      ? body.match(/;\s*([^;\n]{1,100}?)\s+(credited)\b/i)
      : null;
  const beneficiary =
    candidate &&
    candidate.index! > amountEnd &&
    !/^(?:your|our|transaction|txn|amount|payment|refund|reversal|a\/c|acct|account)\b/i.test(
      candidate[1].trim(),
    )
      ? candidate
      : null;
  const allowedCredits = new Set<number>();
  if (beneficiary)
    allowedCredits.add(
      beneficiary.index! + beneficiary[0].lastIndexOf(beneficiary[2]),
    );
  if (['SBI', 'Bank of India', 'Standard Chartered'].includes(profile.name)) {
    for (const pattern of [
      '\\band\\s+(credited)\\s+to\\b',
      '\\band\\s+(?:a/c|account)\\b[^.;\\n]{1,120}?\\s+(?:is\\s+)?(credited)\\b',
    ]) {
      for (const match of all(body, pattern)) {
        const start = match.index! + match[0].lastIndexOf(match[1]);
        if (start > amountEnd) allowedCredits.add(start);
      }
    }
  }
  if (all(body, credit).some(match => !allowedCredits.has(match.index!)))
    return null;

  const number = amount[1];
  if (!/^\d+(?:\.\d{1,2})?$/.test(number.replace(/,/g, ''))) return null;
  if (
    number.includes(',') &&
    !/^(?:\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(?:\.\d{1,2})?$/.test(
      number,
    )
  )
    return null;
  const [rupees, fraction = ''] = number.replace(/,/g, '').split('.');
  const amountPaise = Number(rupees) * 100 + Number(fraction.padEnd(2, '0'));
  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0 ||
    amountPaise > 10_000_000_000
  )
    return null;

  const accountMatch =
    card ||
    body.match(
      rx(
        '\\b(?:a/c|a\\.c\\.?|ac|acct|account)(?:\\s*(?:no\\.?|number))?\\s*[:.-]?\\s*' +
          token,
      ),
    );
  const account = suffix(accountMatch?.[1] || '');
  const method: PaymentMethod =
    cardContext || profile.cardOnly
      ? 'CARD'
      : /\bUPI\b/i.test(body)
      ? 'UPI'
      : 'BANK';
  const recipient =
    beneficiary?.[1].trim() || merchant(profile.name, body, amount.index!);
  const reference =
    body.match(
      /\b(?:UPI\s*)?(?:ref(?:erence)?(?:\s*(?:no\.?|number|id))?|UTR|RRN|txn\s*(?:id|no\.?))\s*[:#.-]?\s*([A-Za-z0-9]{6,35})(?![A-Za-z0-9])/i,
    )?.[1] ||
    body.match(/\bUPI\s*:\s*(\d{6,35})(?!\d)/i)?.[1] ||
    '';
  return {
    amountPaise,
    bank: profile.name,
    account,
    method,
    recipient,
    reference,
  };
}

function merchant(bank: string, body: string, amountStart: number): string {
  if (bank === 'Axis Bank' && body.includes('\n')) {
    const lines = body
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const date = lines.findIndex(line =>
      /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/i.test(line),
    );
    if (
      date >= 0 &&
      date + 1 < lines.length &&
      !/^(?:avl|available|SMS|not you|call|INR|Rs\b)/i.test(lines[date + 1])
    )
      return lines[date + 1].slice(0, 100);
  }
  if (bank === 'YES Bank') {
    const found = body.match(
      /@UPI[_\s]+([^\n]+?)\s+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/i,
    );
    if (found) return found[1].trim().slice(0, 100);
  }
  if (bank === 'ICICI Bank') {
    const found = body.match(
      /\bon\s+\d{1,2}[-/][A-Za-z0-9]{1,9}[-/]\d{2,4}\s+on\s+([^.;\n]+)/i,
    );
    if (found) return found[1].trim().slice(0, 100);
  }
  const fraud = Math.min(
    body.match(/\b(?:Not You|If not|SMS BLOCK|Call\s+\d)/i)?.index ??
      body.length,
    body.match(/\b(?:never|do not|don't)\s+share\s+(?:your\s+)?OTP\b/i)
      ?.index ?? body.length,
  );
  const found = all(
    body,
    "\\b(?:to|at|towards)\\s+(?:VPA\\s+)?([A-Za-z0-9][A-Za-z0-9 @&'*._/-]{1,100}?)(?=\\s+(?:on\\b|via\\b|through\\b|ref\\b|UPI\\b|avl\\b|available\\b|RRN\\b|with\\b|for\\b)|[,;\\n]|\\.(?=\\s|$|Ref(?:\\b|\\s*No)|UPI\\b|Avl\\b)|$)",
  ).find(
    match =>
      match.index! > amountStart &&
      match.index! < fraud &&
      !/^(?:a\/c|ac\b|acct\b|account\b|card\b|your\b|INR\b|Rs\b|\d{1,2}[-/])/i.test(
        match[1].trim(),
      ),
  );
  return found?.[1].trim() || '';
}
