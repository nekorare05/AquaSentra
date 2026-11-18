'use strict';
const express = require('express');
const helmet = require('helmet');
const { Device, SensorReading, Alert } = require('./models');
const { deviceAuth, userAuth } = require('./middleware/auth');
const { ingestReading } = require('./services/ingest');
const { assessStoredReading } = require('./services/assessment');
const { assertRatingParameters } = require('./services/rating');
const params = require('../config/parameters.json');
const pipeline = require('./services/pipeline');

function parseLimit(value, fallback = 30, max = 500) {
  const limit = value == null ? fallback : Number(value);
  return Number.isInteger(limit) && limit >= 1 && limit <= max ? limit : null;
}
function parseFilters(query, { withDates = false } = {}) {
  const filter = {};
  if (query.device_id != null) {
    if (typeof query.device_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(query.device_id)) return null;
    filter.device_id = query.device_id;
  }
  if (withDates) {
    const range = {};
    for (const [field, op] of [['from', '$gte'], ['to', '$lte']]) {
      if (query[field] != null) {
        if (typeof query[field] !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(query[field])) return null;
        const d = new Date(query[field]);
        if (Number.isNaN(d.getTime())) return null;
        range[op] = d;
      }
    }
    if (range.$gte && range.$lte && range.$gte > range.$lte) return null;
    if (Object.keys(range).length) filter.measured_at = range;
  }
  return filter;
}

function createApp() {
  assertRatingParameters(params);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '20kb', strict: false }));
  app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', stage: 7, safety: 'research-prototype-not-certified', valve_automation_enabled: false, virtual_valve_automation_enabled: true }));
  app.post('/api/v1/readings', deviceAuth, async (req, res, next) => {
    try {
      const result = await ingestReading({ payload: req.body, deviceId: req.auth.deviceId, repository: SensorReading, params });
      const reading = result.saved;
      await assessStoredReading({ saved: reading, readings: SensorReading, alerts: Alert, params });
      const advanced = await pipeline.assess(reading);
      await Device.updateOne({ device_id: req.auth.deviceId }, { $set: { last_seen_at: new Date() } });
      res.status(reading.validity.is_valid ? 201 : 202).json({
        id: String(reading._id), validity: reading.validity,
        is_delayed: reading.is_delayed, eligible_for_live_decision: reading.eligible_for_live_decision,
        received_at: reading.received_at, rule_rating: reading.rule_rating,
        rule_details: reading.rule_details ?? null, rule_parameter_set_version: reading.rule_parameter_set_version ?? null,
        stage: 7, ...advanced, isolation_command_issued: advanced.decision.outcome === 'isolation_commanded'
      });
    } catch (err) { next(err); }
  });
  app.get('/api/v1/readings', userAuth(['viewer', 'admin']), async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit);
      if (!limit) return res.status(400).json({ error: 'limit_must_be_1_to_500' });
      const filter = parseFilters(req.query, { withDates: true });
      if (!filter) return res.status(400).json({ error: 'invalid_device_or_date_filter' });
      const list = await SensorReading.find(filter).sort({ received_at: -1, _id: -1 }).limit(limit).lean();
      res.json({ count: list.length, readings: list });
    } catch (err) { next(err); }
  });
  app.get('/api/v1/devices', userAuth(['viewer', 'admin']), async (req, res, next) => {
    try {
      const devices = await Device.find({ is_active: true }).select('device_id last_seen_at').sort({ device_id: 1 }).lean();
      res.json({ devices });
    } catch (err) { next(err); }
  });
  app.get('/api/v1/dashboard', userAuth(['viewer', 'admin']), async (req, res, next) => {
    try {
      const filter = parseFilters(req.query);
      if (!filter) return res.status(400).json({ error: 'invalid_device_filter' });
      const devices = await Device.find({ is_active: true }).select('device_id last_seen_at').sort({ device_id: 1 }).lean();
      const selectedId = filter.device_id || devices[0]?.device_id || null;
      if (selectedId && !devices.some(d => d.device_id === selectedId)) return res.status(404).json({ error: 'device_not_found' });
      const list = selectedId ? await SensorReading.find({ device_id: selectedId }).sort({ received_at: -1, _id: -1 }).limit(200).lean() : [];
      const latest = list[0] || null;
      const latest_valid = list.find(r => r.validity?.is_valid && r.eligible_for_live_decision) || null;
      const device = devices.find(d => d.device_id === selectedId);
      const ageSeconds = device?.last_seen_at ? Math.max(0, (Date.now() - new Date(device.last_seen_at).getTime()) / 1000) : null;
      const advanced = await pipeline.snapshot(selectedId);
      res.json({
        selected_device_id: selectedId, devices,
        device_status: !device?.last_seen_at ? 'never_seen' : ageSeconds <= params.dashboard_offline_after_seconds ? 'online' : 'offline',
        device_age_seconds: ageSeconds, latest_reading: latest, latest_live_valid_reading: latest_valid,
        recent_count: list.length, recent_invalid_count: list.filter(r => !r.validity?.is_valid).length,
        recent_risky_count: list.filter(r => r.rule_rating === 'Risky').length,
        recent_critical_count: list.filter(r => r.rule_rating === 'Critical').length,
        model: advanced.model, control: advanced.state,
        valve: advanced.state.valve,
        provisional: true, parameter_set_version: params.parameter_set_version
      });
    } catch (err) { next(err); }
  });
  app.get('/api/v1/alerts', userAuth(['viewer', 'admin']), async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 50);
      if (!limit) return res.status(400).json({ error: 'limit_must_be_1_to_500' });
      const filter = parseFilters(req.query);
      if (!filter) return res.status(400).json({ error: 'invalid_device_filter' });
      const alerts = await Alert.find(filter).sort({ occurred_at: -1, _id: -1 }).limit(limit).lean();
      res.json({ count: alerts.length, alerts });
    } catch (err) { next(err); }
  });
  app.get('/api/v1/parameters', userAuth(['viewer', 'admin']), (req, res) => res.json({...params, control: pipeline.config}));
  app.get('/api/v1/control', userAuth(['viewer','admin']), async(req,res,next)=>{
    try {const f=parseFilters(req.query);if(!f?.device_id)return res.status(400).json({error:'device_id_required'});
      res.json({...await pipeline.snapshot(f.device_id),events:await pipeline.ValveEvent.find(f).sort({_id:-1}).limit(100).lean()});
    }catch(e){next(e);}
  });
  app.post('/api/v1/control/:action', userAuth(['admin']), async(req,res,next)=>{
    try{const f=parseFilters({device_id:req.body?.device_id});
      if(!f?.device_id || !['restore','fault'].includes(req.params.action))return res.status(400).json({error:'invalid_control_request'});
      if(!await Device.exists({device_id:f.device_id,is_active:true}))return res.status(404).json({error:'device_not_found'});
      const state=await pipeline.mutate(f.device_id,req.params.action,req.body);res.json(state);
    }catch(e){res.status(409).json({error:e.message});}
  });
  app.post('/api/v1/explanations', userAuth(['viewer','admin']), async(req,res,next)=>{
    try{const f=parseFilters({device_id:req.body?.device_id});if(!f?.device_id)return res.status(400).json({error:'device_id_required'});
      res.json(await pipeline.explanation(f.device_id, req.body.provider||'mock'));
    }catch(e){next(e);}
  });
  app.get('/api/v1/device/confirmation', deviceAuth, async(req,res,next)=>{
    try{res.json({pending:(await pipeline.snapshot(req.auth.deviceId)).state.pending});}catch(e){next(e);}
  });
  app.use((req, res) => res.status(404).json({ error: 'route_not_found' }));
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) return res.status(400).json({ error: 'malformed_json_not_a_sensor_record' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large' });
    console.error('[server-error]', error);
    res.status(500).json({ error: 'internal_error' });
  });
  return app;
}
module.exports = { createApp, parseLimit, parseFilters };
