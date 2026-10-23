"""Upgrade and verify local finance storage on the synthetic TraceMoneyMVP AVD only."""
from pathlib import Path
import hashlib, json, os, re, sqlite3, subprocess, tempfile, time, argparse
parser=argparse.ArgumentParser();parser.add_argument("--resume",action="store_true");args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
ADB=str(Path(os.environ.get('ANDROID_HOME',Path.home()/'Library/Android/sdk'))/'platform-tools/adb')
SERIAL='emulator-5580'; PACKAGE='com.tracemymoney'; OUT=ROOT/'artifacts/ux-v2'
def adb(*args,binary=False):
 p=subprocess.run([ADB,'-s',SERIAL,*args],capture_output=True,check=True,timeout=90)
 return p.stdout if binary else p.stdout.decode(errors='replace').strip()
if adb('shell','getprop','ro.kernel.qemu')!='1' or adb('emu','avd','name').splitlines()[0]!='TraceMoneyMVP':raise SystemExit('Only the synthetic test AVD is permitted')
def database():
 with tempfile.TemporaryDirectory(prefix='trace-finance-check-') as folder:
  target=Path(folder)/'ledger.db'
  for suffix in ['', '-wal']:
   p=subprocess.run([ADB,'-s',SERIAL,'exec-out','su','0','cat',f'/data/user/0/{PACKAGE}/databases/ledger.db{suffix}'],capture_output=True,timeout=30)
   if p.returncode==0 and p.stdout:Path(str(target)+suffix).write_bytes(p.stdout)
  with sqlite3.connect(target) as db:
   version=db.execute('PRAGMA user_version').fetchone()[0]
   rows={key:hashlib.sha256(payload.encode()).hexdigest() for key,payload in db.execute('SELECT id,payload FROM transactions')}
   tables=[x[0] for x in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
  return {'schema':version,'rows':rows,'tables':tables}
adb('shell','am','force-stop',PACKAGE)
prior=database()
if args.resume:
 assert prior['schema']==2
 prior=json.loads((OUT/'migration-before.json').read_text())
 assert prior['schema']==1
else:
 assert prior['schema']==1,'Migration proof requires build-11; use --resume only for the recorded upgrade'
 (OUT/'migration-before.json').write_text(json.dumps(prior,indent=2))
release=ROOT/'android/app/build/outputs/apk/release/app-release.apk'
test=ROOT/'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
if not args.resume:(OUT/'trace-prior-build11.apk').write_bytes((ROOT/'artifacts/trace-android-preview.apk').read_bytes())
adb('install','-r',str(release));adb('install','-r',str(test))
adb('shell','pm','grant',PACKAGE,'android.permission.RECEIVE_SMS');adb('shell','pm','grant',PACKAGE,'android.permission.POST_NOTIFICATIONS')
adb('shell','appops','set',PACKAGE,'SYSTEM_ALERT_WINDOW','allow')
adb('shell','am','start','-n',PACKAGE+'/.MainActivity');time.sleep(3)
adb('shell','am','force-stop',PACKAGE)
after=database();assert after['schema']==2 and 'planning' in after['tables']
assert all(after['rows'].get(k)==v for k,v in prior['rows'].items()),'An existing encrypted transaction changed during migration'
(OUT/'migration-after.json').write_text(json.dumps(after,indent=2))
report={'syntheticDataOnly':True,'physicalDeviceVerified':False,'schemaBefore':1,'schemaAfter':2,'preservedEncryptedTransactions':len(prior['rows']),'phases':{}}
for phase in ['finance-prepare','finance-verify','finance-alerts','finance-environment']:
 adb('shell','am','force-stop',PACKAGE)
 output=adb('shell','am','instrument','-w','-e','phase',phase,PACKAGE+'.test/com.tracemymoney.ledger.LendingVerification')
 if 'INSTRUMENTATION_RESULT: result=PASS' not in output:raise AssertionError(output)
 checks=output.split('INSTRUMENTATION_RESULT: checks=',1)[1].split('INSTRUMENTATION_RESULT:',1)[0].strip().splitlines()
 report['phases'][phase]=checks
 (OUT/'native-finance-check.json').write_text(json.dumps(report,indent=2))
 for check in checks:print('PASS:',check,flush=True)
report['apkSha256']=hashlib.sha256(release.read_bytes()).hexdigest()
(OUT/'native-finance-check.json').write_text(json.dumps(report,indent=2))
(ROOT/'artifacts/trace-android-preview.apk').write_bytes(release.read_bytes())
print('Preserved',len(prior['rows']),'existing encrypted transactions through the upgrade.',flush=True)
