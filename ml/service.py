from pathlib import Path
import json
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field, ConfigDict
from xgboost import XGBClassifier

ROOT = Path(__file__).parent
report = json.loads((ROOT/'artifacts/metrics.json').read_text())
model = XGBClassifier(); model.load_model(ROOT/'artifacts/model.ubj')
app = FastAPI(title='AquaSentra synthetic research inference')

class Reading(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    pH: float = Field(ge=0, le=14)
    turbidity: float = Field(ge=0, le=3000)
    TDS: float = Field(ge=0, le=1000)
    temperature_c: float = Field(ge=-55, le=125)

@app.get('/health')
def health(): return {'status':'ok', **report}

@app.post('/predict')
def predict(reading: Reading):
    x = np.array([[getattr(reading,k) for k in report['features']]])
    score = float(model.predict_proba(x)[0,1])
    return {'status':'available','score':score,'class':'Anomalous' if score >= report['threshold'] else 'Normal','threshold':report['threshold'],'model_version':report['model_version'],'synthetic_only':True}
