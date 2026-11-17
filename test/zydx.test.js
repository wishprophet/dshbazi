import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildZydxRequest, parseZydxHtml, fetchZydx, ZYDX_URL } from '../src/providers/zydx.js';

const INPUT = { name: '接口测试', gender: 'male', calendar: 'solar', date: '2000-01-01', time: '12:34', leapMonth: false, location: '北京' };
// Trimmed server HTML from an anonymous save=0 request on 2026-11-16.
// Kept the real labels, row IDs, columns, attributes, values and inline markup;
// omitted ads, unrelated tables and scripts. No real person's data is present.
const SOLAR_HTML = `<!DOCTYPE html><html><head><title>周易大学堂</title></head><body>
<h2>周易大学堂四柱八字排盘</h2><div>
<b>八字排盘结果：</b><br />
<b>姓名：</b>接口测试 &nbsp;&nbsp;<b>五行：</b>接(火), 口(木), 测(水), 试(金)<br>
<b>性别：</b> 男&nbsp;&nbsp;
<b>胎元：</b>丁卯<font color=#006600>[炉中火]</font>&nbsp;&nbsp;<b>命宫：</b>乙亥<font color=#006600>[山头火]</font><br />
<b>节气：</b>1999-12-07 21:14 大雪&nbsp;&nbsp;2000-01-06 08:50 小寒<br />
<b>起运：</b>命主于出生后<font color=#006600> <b>8</b> 年 <b>2</b> 个月 <b>16</b> 天 <b>16</b> 小时</font>起运&nbsp;&nbsp;<b>排盘方式：</b>公历排盘<br />
<b>交运：</b>命主于公历<font color=#993300>2008年03月18日04时34分</font>交运，<br />
<b>换运：</b>以后每逢尾数带<font color=#993300>8</font>的年份换运<br />
<b>公历：</b><font color="#993300">2000年01月01日12时34分</font><br />
<b>农历：</b><font color="#993300">1999年(生肖兔)冬月廿五午时</font><br />
<table class="table"><tr><td><b>　四柱:&nbsp;</b></td><td>年柱</td><td>月柱</td><td>日柱</td><td>时柱</td></tr>
<tr><td>十神:</td><td>劫财</td><td>偏印</td><td>元男</td><td>比肩</td></tr>
<tr id="bm_tgline"><td><b>　天干:&nbsp;</b></td><td><span class="big">己</span></td><td><span class="big">丙</span></td><td><span id="rigan">戊</span></td><td><span class="big">戊</span></td></tr>
<tr id="bm_dzline"><td><b>　地支:&nbsp;</b></td><td><span class="big">卯</span></td><td><span class="big">子</span></td><td><span class="big">午</span></td><td><span class="big">午</span></td></tr></table>
<table><tr id="xipandayungz"><td>大运</td><td data-age="8" data-year='2008'>乙亥</td><td data-age="18" data-year='2018'>甲戌</td><td data-age="28" data-year='2028'>癸酉</td></tr></table>
</div></body></html>`;

test('solar form uses the observed keys, UTF-8, minute precision and save=0', () => {
  const request = buildZydxRequest({ ...INPUT, save: 1 });
  const form = new URLSearchParams(request.body);
  assert.equal(request.url, ZYDX_URL);
  assert.equal(request.method, 'POST');
  assert.equal(request.credentials, 'omit');
  assert.equal(request.redirect, 'error');
  assert.equal(form.get('save'), '0');
  assert.equal(form.get('name'), '接口测试');
  assert.equal(form.get('date'), '1');
  assert.equal(form.get('minute'), '34');
  assert.equal(form.get('DateType'), '0');
  assert.equal(form.get('sex'), '1');
  assert.equal(form.get('cgp'), '1');
  assert.equal(form.has('location'), false);
  assert.equal(form.has('nyear'), false);
});

test('lunar request sets its actual fields and leap month without guessing minutes', () => {
  const form = new URLSearchParams(buildZydxRequest({ ...INPUT, gender: 'female', calendar: 'lunar', date: '2023-02-01', time: '12:00', leapMonth: true }).body);
  assert.equal(form.get('nyear'), '2023');
  assert.equal(form.get('nmonth'), '2');
  assert.equal(form.get('ndate'), '1');
  assert.equal(form.get('nhour'), '12');
  assert.equal(form.get('ifrun'), '1');
  assert.equal(form.get('sex'), '0');
  assert.equal(form.get('DateType'), '1');
  assert.equal(form.has('minute'), false);
  assert.throws(() => buildZydxRequest({ ...INPUT, calendar: 'lunar' }), { code: 'ZYDX_PRECISION' });
  assert.throws(() => buildZydxRequest({ ...INPUT, time: '12:34:01' }), { code: 'ZYDX_PRECISION' });
});

test('invalid or unsupported dates are rejected before network requests', () => {
  for (const changes of [{ date: '2001-02-29' }, { date: '2000-13-01' }, { date: '1900-01-01' }, { date: '2039-01-01' }, { gender: '' }, { calendar: 'guess' }, { time: '24:00' }, { leapMonth: 'false' }, { name: '<script>' }]) {
    assert.throws(() => buildZydxRequest({ ...INPUT, ...changes }), { code: 'ZYDX_INPUT' });
  }
});

test('observed solar fixture parses all four pillars, exact displayed start date and cycle order', () => {
  const result = parseZydxHtml(SOLAR_HTML, INPUT, { fetchedAt: '2026-11-16T14:00:00Z' });
  assert.deepEqual(result.pillars, { year: '己卯', month: '丙子', day: '戊午', hour: '戊午' });
  assert.deepEqual(result.startLuck, { date: '2008-03-18 04:34:00', age: { years: 8, months: 2, days: 16, hours: 16 }, forward: false });
  assert.deepEqual(result.cycles[0], { pillar: '乙亥', startYear: 2008, startAge: 8 });
  assert.equal(result.provider, 'zydx');
  assert.equal(result.fetchedAt, '2026-11-16T14:00:00Z');
  assert.equal(result.rawText.includes('<script'), false);
});

test('mismatched date, minute, sex and calendar cannot silently become an accepted chart', () => {
  for (const changes of [{ date: '2000-01-02' }, { time: '12:35' }, { gender: 'female' }, { calendar: 'lunar', time: '12:00' }]) {
    assert.throws(() => parseZydxHtml(SOLAR_HTML, { ...INPUT, ...changes }), { code: 'ZYDX_MISMATCH' });
  }
});

test('login/form HTML, missing rows, changed columns, illegal pillars and discontinuous cycles fail closed', () => {
  const cases = [
    '<html>请登录<form>出生日期</form></html>',
    SOLAR_HTML.replace('id="bm_tgline"', 'id="new_row"'),
    SOLAR_HTML.replace('<td>年柱</td><td>月柱</td>', '<td>月柱</td><td>年柱</td>'),
    SOLAR_HTML.replace('class="big">己', 'class="big">甲'),
    SOLAR_HTML.replace("data-year='2018'", "data-year='2019'"),
    SOLAR_HTML.replace('甲戌</td>', '甲子</td>'),
  ];
  for (const html of cases) assert.throws(() => parseZydxHtml(html, INPUT), { code: 'ZYDX_PARSE' });
});

test('script and comment copies are not read as another chart or executed', () => {
  const polluted = `<script>globalThis.__zydxExecuted = true; ${SOLAR_HTML}</script><!--${SOLAR_HTML}-->${SOLAR_HTML}`;
  assert.deepEqual(parseZydxHtml(polluted, INPUT).pillars, { year: '己卯', month: '丙子', day: '戊午', hour: '戊午' });
  assert.equal(globalThis.__zydxExecuted, undefined);
});

test('fetch adapter submits save=0 and returns only validated parsed data', async () => {
  let calls = 0;
  const result = await fetchZydx(INPUT, { fetchImpl: async (url, init) => {
    calls++;
    assert.equal(url, ZYDX_URL);
    assert.equal(new URLSearchParams(init.body).get('save'), '0');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Cookie, undefined);
    assert.ok(init.signal instanceof AbortSignal);
    return new Response(SOLAR_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.pillars.day, '戊午');
});

test('HTTP, MIME, redirect, timeout, connection and decoding errors remain explicit', async () => {
  for (const response of [new Response('unavailable', { status: 503 }), new Response('{}', { headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(fetchZydx(INPUT, { fetchImpl: async () => response }), { code: 'ZYDX_HTTP' });
  }
  await assert.rejects(fetchZydx(INPUT, { fetchImpl: async () => ({ ok: true, redirected: true }) }), { code: 'ZYDX_HTTP' });
  await assert.rejects(fetchZydx(INPUT, { fetchImpl: async () => { throw new DOMException('timeout', 'TimeoutError'); } }), { code: 'ZYDX_NETWORK' });
  await assert.rejects(fetchZydx(INPUT, { fetchImpl: async () => { throw new TypeError('fetch failed'); } }), { code: 'ZYDX_NETWORK' });
  await assert.rejects(fetchZydx(INPUT, { fetchImpl: async () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'text/html' } }) }), { code: 'ZYDX_NETWORK' });
});

// Real responses are checked offline. Refreshing them is an explicit manual task;
// no test below uses the real fetch or sends birth data over the network.
for (const id of ['solar-20000101', 'latezi-19880215', 'lunar-leap-20230201']) {
  test(`captured anonymous website fixture: ${id}`, () => {
    const html = readFileSync(new URL(`./fixtures/zydx-${id}.html`, import.meta.url), 'utf8');
    const fixture = JSON.parse(readFileSync(new URL(`./fixtures/zydx-${id}.json`, import.meta.url), 'utf8'));
    assert.equal(fixture.save, false);
    assert.equal(/<script\b/i.test(html), false);
    const parsed = parseZydxHtml(html, fixture.input, { fetchedAt: fixture.fetchedAt });
    assert.deepEqual(parsed.pillars, fixture.expected.pillars);
    assert.deepEqual(parsed.startLuck, fixture.expected.startLuck);
    assert.deepEqual(parsed.cycles, fixture.expected.cycles);
    assert.equal(parsed.cycles.length, 9);
    assert.equal(parsed.rawText.includes('称骨评语'), false);
    assert.equal(parsed.rawText.includes('知道'), false);
    assert.throws(() => parseZydxHtml(html, { ...fixture.input, gender: fixture.input.gender === 'male' ? 'female' : 'male' }), { code: 'ZYDX_MISMATCH' });
    if (fixture.input.calendar === 'lunar') {
      assert.throws(() => parseZydxHtml(html, { ...fixture.input, leapMonth: false }), { code: 'ZYDX_MISMATCH' });
      assert.throws(() => parseZydxHtml(html, { ...fixture.input, date: '2023-02-02' }), { code: 'ZYDX_MISMATCH' });
    }
  });
}

test('already-cancelled caller signal prevents the HTTP request and preserves its reason', async () => {
  const controller = new AbortController();
  const reason = new Error('user cancelled');
  controller.abort(reason);
  let calls = 0;
  await assert.rejects(fetchZydx(INPUT, { signal: controller.signal, fetchImpl: async () => { calls++; } }), (error) => error === reason);
  assert.equal(calls, 0);
});

test('caller cancellation is forwarded to the active HTTP request without becoming a network fallback', async () => {
  const controller = new AbortController();
  const reason = new Error('stop the current chart');
  let activeSignal;
  await assert.rejects(fetchZydx(INPUT, {
    signal: controller.signal,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      activeSignal = init.signal;
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      controller.abort(reason);
    }),
  }), (error) => error === reason);
  assert.equal(activeSignal.aborted, true);
  assert.equal(activeSignal.reason, reason);
});

test('cancellation during response body consumption prevents parsing and preserves the reason', async () => {
  const controller = new AbortController();
  const reason = new DOMException('cancel body read', 'AbortError');
  await assert.rejects(fetchZydx(INPUT, {
    signal: controller.signal,
    fetchImpl: async () => ({
      ok: true, url: ZYDX_URL, redirected: false,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      arrayBuffer: async () => {
        controller.abort(reason);
        return new TextEncoder().encode(SOLAR_HTML).buffer;
      },
    }),
  }), (error) => error === reason);
});

test('configured timeout aborts the actual in-flight signal independently of caller cancellation', async () => {
  const controller = new AbortController();
  let activeSignal;
  await assert.rejects(fetchZydx(INPUT, {
    signal: controller.signal, timeoutMs: 10,
    fetchImpl: (_url, init) => new Promise((resolve, reject) => {
      activeSignal = init.signal;
      const timer = setTimeout(() => resolve(new Response(SOLAR_HTML)), 1000);
      init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason); }, { once: true });
    }),
  }), { code: 'ZYDX_NETWORK' });
  assert.equal(activeSignal.aborted, true);
  assert.equal(activeSignal.reason.name, 'TimeoutError');
  assert.equal(controller.signal.aborted, false);
});
