// Scoring rules tests. Run: node --test solar-recruitment-app/tests
// Loads the pure <script id="scoring"> block straight out of the prototype, so there is no build step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../solar-talent-registry.html', import.meta.url), 'utf8');
const src = /<script id="scoring">([\s\S]*?)<\/script>/.exec(html)?.[1];
assert.ok(src, 'scoring script block not found');
const ctx = vm.createContext({});
vm.runInContext(`${src};globalThis.api={scoreCandidate,daysTo,STATUS}`, ctx);
const { scoreCandidate, daysTo, STATUS } = ctx.api;

const NOW = new Date(2026, 9, 7, 15, 0); // 7 Oct 2026, 15:00 local
const long = n => 'x'.repeat(n + 1);

// Eligible, every scoring criterion maxed out → 100.
const full = (over = {}) => ({
  epraClass: 'T3', licenceNumber: 'EPRA/SPVT/1', expiry: '2027-06-30', verifyConsent: true,
  years: 10, largestPv: 500, categories: ['a', 'b', 'c', 'd', 'e', 'f'],
  inverters: long(20), batteries: long(20), logger: long(25), highVoltage: 'yes', voltage: long(25), certifications: long(20),
  ref1: long(20), ref2: long(20), ref3: long(20), travel: 'national', largestProject: long(50),
  ...over,
});
// Technical section at its minimum (6 of 40) → non-experience points = 6 + 30 = 36.
const lowTech = { inverters: '', batteries: '', logger: '', highVoltage: 'no', voltage: '', certifications: '' };
const score = c => scoreCandidate(c, NOW);

test('fully evidenced candidate scores 100 → Priority review', () => {
  const r = score(full());
  assert.equal(r.score, 100);
  assert.deepEqual({ ...r.parts }, { experience: 30, technical: 40, verification: 30 });
  assert.equal(r.status, STATUS.PRIORITY);
  assert.equal(r.eligible, true);
});

test('routing thresholds at each boundary', () => {
  const cases = [
    [full({ years: 5, largestPv: 0, categories: [] }), 80, STATUS.PRIORITY],
    [full({ years: 4.5, largestPv: 0, categories: [] }), 79, STATUS.STANDARD],
    [full({ ...lowTech, years: 5, largestPv: 70, categories: [1, 2, 3, 4, 5, 6] }), 65, STATUS.STANDARD],
    [full({ ...lowTech, years: 5, largestPv: 60, categories: [1, 2, 3, 4, 5, 6] }), 64, STATUS.CLARIFY],
    [full({ ...lowTech, years: 5, largestPv: 0, categories: [1, 2] }), 50, STATUS.CLARIFY],
    [full({ ...lowTech, years: 4.5, largestPv: 0, categories: [1, 2] }), 49, STATUS.BELOW],
  ];
  for (const [c, expectedScore, expectedStatus] of cases) {
    const r = score(c);
    assert.equal(r.score, expectedScore);
    assert.equal(r.status, expectedStatus, `score ${expectedScore}`);
  }
});

test('minimal eligible application scores 9 → Below threshold', () => {
  const r = score({ epraClass: 'T1', licenceNumber: 'L1', expiry: '2027-01-01', verifyConsent: true });
  assert.equal(r.score, 9); // inverters 3 + batteries 3 + travel 1 + project 2
  assert.equal(r.status, STATUS.BELOW);
});

test('eligibility gate overrides any score', () => {
  for (const over of [
    { epraClass: 'None' }, { epraClass: '' }, { licenceNumber: '' }, { licenceNumber: '   ' },
    { verifyConsent: false }, { expiry: '' }, { expiry: 'not-a-date' }, { expiry: '2026-10-06' },
  ]) {
    const r = score(full(over));
    assert.equal(r.score, 100);
    assert.equal(r.eligible, false, JSON.stringify(over));
    assert.equal(r.status, STATUS.INELIGIBLE, JSON.stringify(over));
  }
});

test('licence expiring today is still valid; yesterday is not (regression: -0 >= 0)', () => {
  assert.equal(daysTo('2026-10-07', NOW), 0);
  assert.equal(daysTo('2026-10-06', NOW), -1);
  assert.equal(score(full({ expiry: '2026-10-07' })).eligible, true);
  assert.equal(score(full({ expiry: '2026-10-06' })).eligible, false);
});

test('expiring flag covers 0–90 days only', () => {
  assert.equal(score(full({ expiry: '2027-01-05' })).expiring, true);  // 90 days
  assert.equal(score(full({ expiry: '2027-01-06' })).expiring, false); // 91 days
  assert.equal(score(full({ expiry: '2026-10-07' })).expiring, true);  // today
  assert.equal(score(full({ expiry: '2026-10-06' })).expiring, false); // expired
});

test('bad numeric input never produces NaN', () => {
  const r = score(full({ years: 'abc', largestPv: -40, categories: undefined }));
  assert.ok(Number.isFinite(r.score));
  assert.equal(r.parts.experience, 0);
});

test('high-voltage points need both the claim and evidence', () => {
  assert.equal(score(full({ highVoltage: 'no' })).parts.technical, 32);
  assert.equal(score(full({ voltage: 'short' })).parts.technical, 32);
});
