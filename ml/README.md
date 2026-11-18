# Stage 3 synthetic XGBoost experiment

Run `.venv/Scripts/python.exe ml/train.py` from the project root. Read artifacts/metrics.json
for actual results, selected validation threshold, split ranges, feature order and dataset hash.
Serve with `.venv/Scripts/python.exe -m uvicorn ml.service:app --host 127.0.0.1 --port 8001`.
Only current pH, turbidity, TDS and temperature enter the model (window length 1).
The synthetic episode label is assigned by the generator before measurements, not copied from
rule categories. All rows of an episode stay within one chronological partition. No imputation,
normalization or resampling is performed; no test samples are used for selection.
The model is not a forecast and is not trained or evaluated on real household or GECCO data.
Perfect held-out synthetic metrics do not imply field generalization or safety certification.
