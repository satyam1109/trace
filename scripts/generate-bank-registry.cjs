const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const banks = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/smsBanks.json'), 'utf8'),
);
const seen = new Set();
const entries = banks.flatMap(bank =>
  bank.senders.map(sender => {
    if (!/^[A-Z]{3,8}$/.test(sender) || seen.has(sender)) {
      throw new Error(`Invalid or duplicated bank sender: ${sender}`);
    }
    seen.add(sender);
    return `        ${JSON.stringify(sender)} to Profile(${JSON.stringify(
      bank.name,
    )}, ${bank.cardOnly})`;
  }),
);
const content = `// Generated from src/data/smsBanks.json. Run node scripts/generate-bank-registry.cjs.
package com.tracemymoney.ledger

import java.util.Locale

object BankRegistry {
    data class Profile(val name: String, val cardOnly: Boolean)
    private val senders = mapOf(
${entries.join(',\n')}
    )

    fun identify(sender: String): Profile? = sender.uppercase(Locale.ROOT)
        .split('-').firstNotNullOfOrNull { senders[it] }
}
`;
const destination = path.join(
  root,
  'android/app/src/main/java/com/tracemymoney/ledger/BankRegistry.kt',
);
if (process.argv.includes('--check')) {
  if (
    !fs.existsSync(destination) ||
    fs.readFileSync(destination, 'utf8') !== content
  ) {
    throw new Error(
      'Native bank registry is stale. Run node scripts/generate-bank-registry.cjs.',
    );
  }
} else if (
  !fs.existsSync(destination) ||
  fs.readFileSync(destination, 'utf8') !== content
) {
  fs.writeFileSync(destination, content);
}
