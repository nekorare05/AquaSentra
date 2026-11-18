import json
from pathlib import Path
import unittest
from simulator import calibrate, make_reading, scenario_records

CONFIG = json.loads((Path(__file__).parent / 'calibration.json').read_text())

class SimulationTests(unittest.TestCase):
    def test_required_record_fields(self):
        r = make_reading('AS-ESP32-001', CONFIG)
        for field in ('device_id','measured_at','pH','turbidity','turbidity_unit','TDS','tds_unit','temperature_c','sensor_status','boot_flag'):
            self.assertIn(field, r)
        self.assertEqual(r['tds_unit'], 'mg/L')
        self.assertEqual(r['turbidity_unit'], 'NTU')

    def test_calibration_is_explicitly_applied(self):
        cfg = json.loads(json.dumps(CONFIG))
        cfg['channels']['pH']['slope'] = 2.0
        self.assertEqual(calibrate({'pH': 2, 'turbidity': 3, 'TDS': 4, 'temperature_c': 5}, cfg)['pH'], 4)

    def test_duplicate_exact_payload(self):
        rows = scenario_records('AS-ESP32-001', CONFIG, 'duplicate', count=2)
        self.assertEqual(rows[0], rows[1])

    def test_delayed_preserves_original_timestamp(self):
        rows = scenario_records('AS-ESP32-001', CONFIG, 'wifi-loss', count=2, wifi_buffer_age_seconds=300)
        self.assertNotEqual(rows[0]['measured_at'], rows[1]['measured_at'])

    def test_unsynced_clock(self):
        self.assertEqual(make_reading('AS-ESP32-001', CONFIG, 'clock-sync-loss')['sensor_status']['clock'], 'unsynced')

    def test_failed_sensor_and_reset(self):
        self.assertEqual(make_reading('AS-ESP32-001', CONFIG, 'stuck-sensor')['sensor_status']['ph'], 'stuck')
        self.assertTrue(make_reading('AS-ESP32-001', CONFIG, 'power-loss', index=0)['boot_flag'])

if __name__ == '__main__': unittest.main()
