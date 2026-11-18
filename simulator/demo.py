"""Live end-to-end demonstration; virtual valve only. No hardware drivers."""
import argparse, json, ssl, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from simulator import read_env_file

ROOT=Path(__file__).resolve().parents[1]
env=read_env_file(ROOT/'backend/.env')
URL='https://127.0.0.1:8444'
device=env['BOOTSTRAP_DEVICE_ID']

def request(method,path,body=None,role='viewer'):
    if role=='device': headers={'x-device-id':device,'x-device-token':env['BOOTSTRAP_DEVICE_TOKEN']}
    elif role=='anonymous': headers={}
    else: headers={'x-user-id':env[f'BOOTSTRAP_{role.upper()}_ID'],'x-user-token':env[f'BOOTSTRAP_{role.upper()}_TOKEN']}
    headers['Content-Type']='application/json'
    req=Request(URL+'/api/v1/'+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urlopen(req,context=ssl._create_unverified_context(),timeout=10) as res: return res.status,json.load(res)
    except HTTPError as e:return e.code,json.load(e)

def reading(kind='normal',purpose='routine',**extra):
    r={'device_id':device,'measured_at':datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),'pH':7.2,'turbidity':2.,'TDS':300.,'temperature_c':26.,'turbidity_unit':'NTU','tds_unit':'mg/L','sensor_status':{'ph':'ok','turbidity':'ok','tds':'ok','temperature':'ok','clock':'synced'},'boot_flag':False,'purpose':purpose}
    if kind=='abnormal':r.update(pH=9.8,turbidity=14.,TDS=750.)
    if kind=='invalid':r['pH']=18
    if kind=='delayed':r['measured_at']=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat(timespec='milliseconds').replace('+00:00','Z')
    r.update(extra);return r

def send(kind='normal',purpose='routine'):
    status,result=request('POST','readings',reading(kind,purpose),'device')
    assert status==(202 if kind=='invalid' else 201),(status,result)
    print(f"Reading: {kind}; rule={result['rule_rating']}; model={result['model']['class']}; decision={result['decision']['outcome']}")
    return result

def state():return request('GET','control?device_id='+device)[1]['state']
def action(name,**body):
    status,result=request('POST','control/'+name,{'device_id':device,**body},'admin');assert status==200,(status,result);return result
def wait_for(predicate,seconds=12):
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
        s=state()
        if predicate(s):return s
        time.sleep(.3)
    raise AssertionError('State timeout: '+json.dumps(state()))

def prepare():
    action('fault',mode='none');send();
    s=state()
    if s['valve']['command_id'] and not s['valve']['verified'] and not s['valve']['fault']:
        wait_for(lambda s:s['valve']['verified'] or s['valve']['fault'])
    action('restore',inspected=True)
    wait_for(lambda s:s['valve']['verified']=='open')
    wait_for(lambda s:time.time()*1000>=s['holdoff_until'])
    print('Virtual supply restored; re-arm holdoff completed.')

def isolate(fault='none'):
    prepare();action('fault',mode=fault)
    for _ in range(3):send('abnormal');time.sleep(.15)
    s=state();assert s['pending'],s
    time.sleep(max(0,(s['pending']['not_before']-time.time()*1000)/1000)+.1)
    result=send('abnormal','repeat_confirmation')
    assert result['isolation_command_issued'],result
    s=wait_for(lambda s:s['valve']['verified']=='closed' or s['valve']['fault'])
    expected={'none':None,'no_ack':'ack_timeout','stuck':'position_mismatch','no_feedback':'verification_timeout'}[fault]
    assert s['valve']['fault']==expected,s
    print('Virtual valve:',json.dumps(s['valve']))
    return s

def suite():
    checks=[]
    def check(name,condition):
        assert condition,name;checks.append(name);print('PASS',name)
    check('Anonymous dashboard denied',request('GET','dashboard',role='anonymous')[0]==401)
    check('Viewer restoration denied',request('POST','control/restore',{'device_id':device,'inspected':True})[0]==403)
    s=isolate();check('End-to-end confirmed virtual closure',s['valve']['verified']=='closed')
    before=state()['valve']['command_id'];send('invalid');send('delayed')
    check('Invalid and delayed cannot replace command',state()['valve']['command_id']==before)
    duplicate=reading();request('POST','readings',duplicate,'device');status,result=request('POST','readings',duplicate,'device')
    check('Duplicate stored but excluded',status==202 and 'DUPLICATE_READING' in result['validity']['codes'])
    for fault in ['no_ack','stuck','no_feedback']:
        s=isolate(fault);check(fault+' is not verified',s['valve']['verified'] is None and bool(s['valve']['fault']))
    action('fault',mode='power_loss');check('Power loss has no fabricated verification',state()['valve']['verified'] is None)
    for provider in ['mock','unavailable']:
        before=state()['valve'];status,result=request('POST','explanations',{'device_id':device,'provider':provider})
        check(provider+' explanation isolated from control',status==200 and state()['valve']==before and bool(result['text']))
    status,history=request('GET','readings?device_id='+device+'&limit=10')
    check('MongoDB history contains model and decision',status==200 and all('model' in r and 'decision' in r for r in history['readings']))
    prepare()
    ROOT.joinpath('docs/stage7-integration-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'hardware_tested':False,'database':'aquasentra_stage7_demo','time':datetime.now(timezone.utc).isoformat()},indent=2))
    print(f'ALL {len(checks)} LIVE INTEGRATION CHECKS PASSED')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--suite',action='store_true');parser.add_argument('--fault',choices=['none','no_ack','stuck','no_feedback'],default='none');parser.add_argument('--restore',action='store_true');args=parser.parse_args()
    if args.suite:suite()
    elif args.restore:prepare()
    else:isolate(args.fault)
