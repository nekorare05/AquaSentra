"""Reproducible synthetic-only experiment. Never a drinking-water validation."""
from pathlib import Path
import csv, json, hashlib
import numpy as np
from xgboost import XGBClassifier
from sklearn.metrics import precision_score, recall_score, f1_score, average_precision_score, confusion_matrix

ROOT = Path(__file__).parent
FEATURES = ['pH', 'turbidity', 'TDS', 'temperature_c']

def dataset():
    rng = np.random.default_rng(1707)
    rows = []
    # Each independent episode stays wholly in one chronological partition.
    for episode in range(300):
        abnormal = int(rng.random() < .35)
        center = np.array([7.3, 2.2, 310, 26]) + rng.normal(0, [.25, .6, 55, 1.5])
        if abnormal:
            center += [rng.choice([-1, 1]) * rng.uniform(.5, 2.6), rng.uniform(2, 13), rng.uniform(80, 500), rng.uniform(-4, 4)]
        for step in range(16):
            x = center + rng.normal(0, [.2, .7, 35, .6])
            x = np.clip(x, [0, 0, 0, -55], [14, 3000, 1000, 125])
            rows.append((episode, episode * 16 + step, *x, abnormal))
    return rows

def metrics(y, p, threshold):
    predicted = p >= threshold
    return dict(precision=float(precision_score(y, predicted, zero_division=0)), recall=float(recall_score(y, predicted, zero_division=0)), f1=float(f1_score(y, predicted, zero_division=0)), pr_auc_average_precision=float(average_precision_score(y, p)), confusion_matrix=confusion_matrix(y, predicted, labels=[0,1]).tolist())

def main():
    rows = dataset()
    ROOT.joinpath('artifacts').mkdir(exist_ok=True)
    with ROOT.joinpath('artifacts/synthetic.csv').open('w', newline='') as f:
        writer = csv.writer(f); writer.writerow(['episode','time_index',*FEATURES,'injected_anomaly']); writer.writerows(rows)
    data = np.asarray(rows); x, y = data[:,2:6], data[:,6].astype(int)
    train, val, test = data[:,0] < 180, (data[:,0] >= 180) & (data[:,0] < 240), data[:,0] >= 240
    candidates = []
    for depth in [2, 3]:
        model = XGBClassifier(n_estimators=100, max_depth=depth, learning_rate=.08, random_state=1707, n_jobs=2, eval_metric='logloss')
        model.fit(x[train], y[train])
        scores = model.predict_proba(x[val])[:,1]
        for threshold in [.3,.4,.5,.6,.7]:
            candidates.append((f1_score(y[val], scores >= threshold), threshold, depth, model))
    _, threshold, depth, model = max(candidates, key=lambda c: (c[0],c[1]))
    scores = model.predict_proba(x[test])[:,1]
    baseline = ((x[test,0]<6.5)|(x[test,0]>8.5)|(x[test,1]>5)|(x[test,2]>600)).astype(float)
    report = dict(model_version='synthetic-xgb-v1', synthetic_only=True, features=FEATURES, decision_window_len=1, seed=1707, threshold=threshold, selected_depth=depth, split={'train_episodes':[0,179],'validation_episodes':[180,239],'test_episodes':[240,299]}, sample_counts=[int(train.sum()),int(val.sum()),int(test.sum())], test_prevalence=float(y[test].mean()), evaluation=metrics(y[test],scores,threshold), baseline=metrics(y[test],baseline,.5), limitations=['Labels identify injected synthetic episodes, not laboratory water safety.', 'No GECCO or local household dataset used.', 'Window length 1 uses only current measurements; temporal anomaly learning is not validated.', 'Held-out episodes share the generator; real-world generalization is unknown.'])
    model.save_model(ROOT/'artifacts/model.ubj')
    report['dataset_sha256'] = hashlib.sha256(ROOT.joinpath('artifacts/synthetic.csv').read_bytes()).hexdigest()
    ROOT.joinpath('artifacts/metrics.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__ == '__main__': main()
