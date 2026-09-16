import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchGeoService } from '../backend/services/geo.service.js';

const geo = new BranchGeoService();
const branch = { location: { coordinates: [-69.9312, 18.4861] }, coverage_mode: 'radius', coverage_radius_km: 5 };

test('distance is zero at branch coordinates', () => { assert.ok(geo.distanceKm({ latitude: 18.4861, longitude: -69.9312 }, branch) < 0.001); });
test('radius coverage accepts nearby point', () => { assert.equal(geo.containsLocation(branch, { latitude: 18.49, longitude: -69.93 }), true); });
test('polygon coverage works', () => { const polygonBranch = { ...branch, coverage_mode: 'polygon', coverage_polygon: { type: 'Polygon', coordinates: [[[-70,18.4],[-69.8,18.4],[-69.8,18.6],[-70,18.6],[-70,18.4]]] } }; assert.equal(geo.containsLocation(polygonBranch, { latitude: 18.4861, longitude: -69.9312 }), true); });
test('does not force a branch when customer is outside every configured coverage area', () => { const match = geo.findBestBranch([branch], { latitude: 19.45, longitude: -70.69 }); assert.equal(match, null); });
test('coverage mode none may still select the nearest branch', () => { const openBranch = { ...branch, coverage_mode: 'none' }; const match = geo.findBestBranch([openBranch], { latitude: 19.45, longitude: -70.69 }); assert.equal(match?.branch, openBranch); });
