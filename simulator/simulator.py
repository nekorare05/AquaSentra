#!/usr/bin/env python3
"""AquaSentra Stage 1 virtual ESP32 (stdlib only).

The program simulates raw channels, calibrates them, and uploads JSON readings.
No valve-control endpoint exists in Stage 1. Relay/closure flags are local only.
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import random
import ssl
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

HERE = Path(__file__).resolve().parent
SCENARIOS = (
    'normal', 'ph-drift', 'ph-spike', 'turbidity-spike', 'high-tds',
    'stuck-sensor', 'out-of-range', 'duplicate', 'delayed', 'wifi-loss',
    'backend-down', 'esp32-reset', 'power-loss', 'relay-no-ack',
    'clock-sync-loss', 'transient-recovery'
)


def read_env_file(filename):
    values = {}
    if filename.is_file():
        for line in filename.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def now_iso(at=None):
    return (at or datetime.now(timezone.utc)).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def calibrate(raw, config):
    """Linearly convert synthetic raw channel values to displayed physical units.
    Identity values are only placeholders; firmware needs measured coefficients.
    """
    return {field: round(raw[field] * config['channels'][field]['slope'] + config['channels'][field]['offset'], 4)
            for field in ('pH', 'turbidity', 'TDS', 'temperature_c')}


def make_reading(device_id, config, scenario='normal', index=0, count=5, at=None):
    rng = random.Random(31 + index)
    raw = {'pH': 7.2 + rng.uniform(-0.04, 0.04),
           'turbidity': 1.6 + rng.uniform(-0.2, 0.2),
           'TDS': 285 + rng.uniform(-4, 4),
           'temperature_c': 26.5 + rng.uniform(-0.2, 0.2)}
    status = {'ph': 'ok', 'turbidity': 'ok', 'tds': 'ok', 'temperature': 'ok', 'clock': 'synced'}
    boot = scenario in ('esp32-reset', 'power-loss') and index == 0
    purpose = 'routine'
    if scenario == 'ph-drift': raw['pH'] += index * 0.3
    if scenario == 'ph-spike': raw['pH'] = 10.8
    if scenario == 'turbidity-spike': raw['turbidity'] = 140.0
    if scenario == 'high-tds': raw['TDS'] = 950.0
    if scenario == 'stuck-sensor':
        raw['pH'] = 7.24
        status['ph'] = 'stuck'
    if scenario == 'out-of-range': raw['pH'] = 17.0
    if scenario == 'clock-sync-loss': status['clock'] = 'unsynced'
    if scenario == 'transient-recovery':
        if index == 0: raw['pH'] = 11.0
        else: purpose = 'repeat_confirmation'
    converted = calibrate(raw, config)
    return {
        'device_id': device_id,
        'measured_at': now_iso(at),
        **converted,
        'turbidity_unit': 'NTU',
        'tds_unit': 'mg/L',
        'sensor_status': status,
        'boot_flag': boot,
        'purpose': purpose
    }


def transmit(url, token, device_id, payload, allow_self_signed):
    host = urlparse(url).hostname
    if allow_self_signed and host not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('--insecure-local is permitted only for localhost development')
    ctx = ssl._create_unverified_context() if allow_self_signed else ssl.create_default_context()
    req = Request(url.rstrip('/') + '/api/v1/readings',
                  data=json.dumps(payload).encode('utf-8'), method='POST',
                  headers={'Content-Type': 'application/json',
                           'x-device-id': device_id, 'x-device-token': token})
    try:
        with urlopen(req, context=ctx, timeout=5) as response:
            return response.status, json.loads(response.read().decode('utf-8'))
    except HTTPError as err:
        data = err.read().decode('utf-8')
        try: data = json.loads(data)
        except json.JSONDecodeError: pass
        return err.code, data


def scenario_records(device_id, config, scenario, count=5, wifi_buffer_age_seconds=300):
    records = []
    # Unique, strictly increasing original measurement times even in accelerated runs.
    # Generate slightly in the past to avoid future clock skew during replay.
    start = datetime.now(timezone.utc) - timedelta(milliseconds=10 * count)
    for i in range(count):
        measured = start + timedelta(milliseconds=10 * i)
        if scenario == 'delayed': measured -= timedelta(seconds=300)
        if scenario == 'wifi-loss': measured -= timedelta(seconds=wifi_buffer_age_seconds)
        r = make_reading(device_id, config, scenario, i, count, at=measured)
        records.append(r)
    if scenario == 'duplicate' and records:
        records.insert(1, json.loads(json.dumps(records[0])))
    return records


def main(argv=None):
    ap = argparse.ArgumentParser(description='AquaSentra virtual ESP32 Stage 1')
    ap.add_argument('--scenario', choices=SCENARIOS, default='normal')
    ap.add_argument('--count', type=int, default=5)
    ap.add_argument('--interval-seconds', type=float, default=1.0,
                    help='Wall-clock wait between generated samples (1 simulated minute can be 1 real second)')
    ap.add_argument('--api-url', default='https://localhost:8443')
    ap.add_argument('--device-id', default=None)
    ap.add_argument('--insecure-local', action='store_true',
                    help='Trust local self-signed development certificate only; NEVER use remotely')
    ap.add_argument('--dry-run', action='store_true', help='Print JSON and skip network calls')
    ap.add_argument('--replay-pending', action='store_true', help='Retry previously buffered messages with their ORIGINAL measured_at values')
    ap.add_argument('--wifi-buffer-age-seconds', type=int, default=300)
    args = ap.parse_args(argv)
    if args.count < 1 or args.count > 500 or args.interval_seconds < 0:
        ap.error('count must be 1..500 and interval-seconds must be nonnegative')
    env_file = read_env_file(HERE.parent / 'backend' / '.env')
    device_id = args.device_id or os.environ.get('AQUASENTRA_DEVICE_ID') or env_file.get('BOOTSTRAP_DEVICE_ID') or 'AS-ESP32-001'
    token = os.environ.get('AQUASENTRA_DEVICE_TOKEN') or env_file.get('BOOTSTRAP_DEVICE_TOKEN')
    if not args.dry_run and (not token or token.startswith('REPLACE_')):
        ap.error('Provide AQUASENTRA_DEVICE_TOKEN or configure backend/.env')
    config = json.loads((HERE / 'calibration.json').read_text(encoding='utf-8'))
    pending_file = HERE / 'pending.jsonl'
    if args.replay_pending:
        records = [json.loads(line) for line in pending_file.read_text(encoding='utf-8').splitlines() if line.strip()] if pending_file.exists() else []
        if not records:
            print('No buffered records to replay.')
            return 0
        print(f'[REPLAY] Retrying {len(records)} queued records with original timestamps.')
    else:
        records = scenario_records(device_id, config, args.scenario, args.count, args.wifi_buffer_age_seconds)
    if args.scenario in ('esp32-reset', 'power-loss'):
        print('[LOCAL HARDWARE SIM] Relay de-energized -> normally-closed valve fails closed; backend valve state NOT verified.')
    if args.scenario == 'relay-no-ack':
        print('[STAGE 5 SCENARIO PLACEHOLDER] Local relay acknowledgment disabled; control endpoint not implemented in Stage 1.')
    if args.scenario == 'wifi-loss':
        print(f'[BUFFER] Held {len(records)} records locally during Wi-Fi loss. Replaying original timestamps.')
    if args.scenario == 'backend-down':
        print('[BACKEND-DOWN] Backend expected to be unavailable; will persist failed transmissions to simulator/pending.jsonl.')
    unsent = []
    for i, reading in enumerate(records):
        if args.dry_run:
            print(json.dumps(reading, indent=2))
        else:
            try:
                status, result = transmit(args.api_url, token, device_id, reading, args.insecure_local)
                print(f'[{i + 1}/{len(records)}] HTTP {status} {json.dumps(result)}')
                if status >= 500:
                    unsent.append(reading)
                if status == 401:
                    unsent.append(reading)
            except (URLError, OSError, ValueError, TimeoutError) as exc:
                print(f'[{i + 1}/{len(records)}] Connection failure: {exc}; retained in {pending_file}')
                unsent.append(reading)
        if i < len(records) - 1:
            time.sleep(args.interval_seconds)
    if args.replay_pending:
        if unsent: pending_file.write_text(''.join(json.dumps(row) + '\n' for row in unsent), encoding='utf-8')
        elif pending_file.exists(): pending_file.unlink()
    elif unsent:
        with pending_file.open('a', encoding='utf-8') as f:
            for row in unsent: f.write(json.dumps(row) + '\n')
    return 0 if not unsent else 1


if __name__ == '__main__':
    sys.exit(main())
