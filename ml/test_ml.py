import unittest
import numpy as np
from fastapi.testclient import TestClient
from ml.service import app, model, report
from ml.train import dataset

class MLTests(unittest.TestCase):
    def setUp(self): self.client=TestClient(app)
    def test_health_discloses_synthetic(self): self.assertTrue(self.client.get('/health').json()['synthetic_only'])
    def test_prediction_matches_saved_model(self):
        values={'pH':7.2,'turbidity':2,'TDS':300,'temperature_c':26}
        result=self.client.post('/predict',json=values).json()
        score=float(model.predict_proba(np.array([list(values.values())]))[0,1])
        self.assertAlmostEqual(result['score'],score)
        self.assertEqual(result['class'],'Anomalous' if score>=report['threshold'] else 'Normal')
    def test_missing_rejected(self): self.assertEqual(self.client.post('/predict',json={'pH':7}).status_code,422)
    def test_out_of_range_rejected(self): self.assertEqual(self.client.post('/predict',json={'pH':18,'turbidity':2,'TDS':300,'temperature_c':26}).status_code,422)
    def test_extra_features_rejected(self): self.assertEqual(self.client.post('/predict',json={'pH':7,'turbidity':2,'TDS':300,'temperature_c':26,'label':1}).status_code,422)
    def test_episode_partitions_disjoint(self):
        splits=[set(range(a,b+1)) for a,b in report['split'].values()]
        self.assertFalse(splits[0]&splits[1] or splits[1]&splits[2] or splits[0]&splits[2])
    def test_dataset_reproducible(self): self.assertEqual(dataset(),dataset())
    def test_confusion_matrix_test_size(self): self.assertEqual(sum(map(sum,report['evaluation']['confusion_matrix'])),report['sample_counts'][2])

if __name__=='__main__': unittest.main()
