/**
 * 周易大学堂 HTML adapter. Observed 2026-11-16 at https://zydx.top/paipan.php.
 * Only POSTs the visible form with save=0; never executes page JavaScript.
 * Website calendar/time conventions are retained rather than silently corrected.
 */
export const ZYDX_URL = 'https://zydx.top/paipan.php';
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const JIAZI = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);
const MAX_HTML_SIZE = 2_000_000;
const pad = (n) => String(n).padStart(2, '0');

function fail(message, code = 'ZYDX_PARSE') {
  const error = new Error(`周易大学堂：${message}`);
  error.code = code;
  return error;
}

function normalize(input) {
  if (!input || typeof input !== 'object') throw fail('需要出生信息。', 'ZYDX_INPUT');
  if (!['male', 'female'].includes(input.gender)) throw fail('性别须为 male 或 female。', 'ZYDX_INPUT');
  if (!['solar', 'lunar'].includes(input.calendar)) throw fail('须明确公历或农历。', 'ZYDX_INPUT');
  const date = typeof input.date === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
  const time = typeof input.time === 'string' && /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.time);
  if (!date || !time) throw fail('日期须为 YYYY-MM-DD，时间须为 HH:mm[:ss]。', 'ZYDX_INPUT');
  const [year, month, day] = date.slice(1).map(Number);
  const [hour, minute, second] = [Number(time[1]), Number(time[2]), Number(time[3] || 0)];
  const maxYear = input.calendar === 'solar' ? 2038 : 2031;
  if (year < 1902 || year > maxYear || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw fail(`超出已核查的表单范围（${input.calendar === 'solar' ? '公历' : '农历'} 1902–${maxYear} 年）或日期时间无效。`, 'ZYDX_INPUT');
  }
  if (input.calendar === 'solar') {
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) throw fail('公历日期不存在。', 'ZYDX_INPUT');
    if (input.leapMonth) throw fail('公历输入不能指定农历闰月。', 'ZYDX_INPUT');
  } else if (day > 30) throw fail('农历日期不能超过三十。', 'ZYDX_INPUT');
  if (input.leapMonth !== undefined && typeof input.leapMonth !== 'boolean') throw fail('leapMonth 须为布尔值。', 'ZYDX_INPUT');
  if (second !== 0) throw fail('网站不支持秒；不能静默舍弃秒数。', 'ZYDX_PRECISION');
  if (input.calendar === 'lunar' && minute !== 0) {
    throw fail('网站农历入口会忽略分钟，请先准确转换为公历再提交。', 'ZYDX_PRECISION');
  }
  const name = input.name === undefined || input.name === '' ? '匿名排盘' : input.name;
  if (typeof name !== 'string' || !name.trim() || name.length > 64 || /[<>\u0000-\u001f\u007f]/.test(name)) {
    throw fail('姓名须为不含 HTML 或控制字符的 1–64 字符文本。', 'ZYDX_INPUT');
  }
  return { ...input, name: name.trim(), year, month, day, hour, minute, second, leapMonth: input.leapMonth === true };
}

/** Returns {url, method, headers, body, ...fetchOptions}. save is always 0. */
export function buildZydxRequest(input) {
  const n = normalize(input);
  const body = new URLSearchParams({
    act: 'ok', name: n.name, DateType: n.calendar === 'solar' ? '0' : '1',
    sex: n.gender === 'male' ? '1' : '0', save: '0', hsp: '1',
    cgp: '1', lnp: '1', qyp: '1', ssp: '1', nyp: '1', shenshap: '1',
    mgp: '1', csp: '1', xyp: '1', PPmode: 'radiobutton',
  });
  if (n.calendar === 'solar') {
    for (const [key, value] of Object.entries({ year: n.year, month: n.month, date: n.day, hour: n.hour, minute: n.minute })) body.set(key, String(value));
  } else {
    for (const [key, value] of Object.entries({ nyear: n.year, nmonth: n.month, ndate: n.day, nhour: n.hour })) body.set(key, String(value));
    if (n.leapMonth) body.set('ifrun', '1');
  }
  return {
    url: ZYDX_URL, method: 'POST', body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'text/html' },
    credentials: 'omit', redirect: 'error', cache: 'no-store',
  };
}

function cleanHtml(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

function textOf(html) {
  const entities = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return html.replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (_, key) => {
    if (key[0] !== '#') return entities[key.toLowerCase()];
    const value = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1));
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '\ufffd';
  }).replace(/\s+/g, ' ').trim();
}

function rowById(html, id, optional = false) {
  const rows = [...html.matchAll(new RegExp(`<tr\\b[^>]*\\bid=["']${id}["'][^>]*>([\\s\\S]*?)<\\/tr\\s*>`, 'gi'))];
  if (optional && rows.length === 0) return null;
  if (rows.length !== 1) throw fail(`找不到唯一的 ${id} 行，页面结构可能已变化。`);
  return rows[0][1];
}

function cellsOf(row) {
  return [...row.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td\s*>/gi)].map((m) => ({ attrs: m[1], text: textOf(m[2]) }));
}

function field(header, label) {
  const matches = [...header.matchAll(new RegExp(`<b\\b[^>]*>\\s*${label}[：:]\\s*<\\/b>\\s*([\\s\\S]*?)(?=<b\\b|<br\\b|$)`, 'gi'))];
  if (matches.length !== 1) throw fail(`未识别唯一的「${label}」字段。`);
  return textOf(matches[0][1]);
}

function dateTimeParts(text, label) {
  const match = /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})时\s*(\d{1,2})分/.exec(text);
  if (!match) throw fail(`${label}缺少可核对的年月日时分。`);
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw fail(`${label}日期时间无效。`);
  return { year, month, day, hour, minute, date: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:00` };
}

const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const DAY_NAMES = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

/** Strict parser for observed server-rendered rows, never JavaScript placeholders. */
export function parseZydxHtml(html, input, { fetchedAt = new Date().toISOString() } = {}) {
  const n = normalize(input);
  if (typeof html !== 'string' || html.length > MAX_HTML_SIZE) throw fail('返回内容无效或过大。');
  const safe = cleanHtml(html);
  const tables = [...safe.matchAll(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi)].filter((m) => /\bid=["']bm_tgline["']/.test(m[0]));
  if (tables.length !== 1) throw fail('没有唯一的四柱结果表；可能返回了登录页、表单或页面结构已变。');
  const table = tables[0][0];
  const header = safe.slice(0, tables[0].index);
  if (!textOf(header).includes('八字排盘结果')) throw fail('缺少排盘结果标识。');
  const firstRow = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/i.exec(table);
  const headings = firstRow && cellsOf(firstRow[1]).map((c) => c.text);
  if (!headings || headings.length !== 5 || headings.slice(1).join('|') !== '年柱|月柱|日柱|时柱') throw fail('四柱列顺序发生变化。');
  const stems = cellsOf(rowById(table, 'bm_tgline'));
  const branches = cellsOf(rowById(table, 'bm_dzline'));
  if (stems.length !== 5 || branches.length !== 5 || !/^天干[:：]$/.test(stems[0].text) || !/^地支[:：]$/.test(branches[0].text)) throw fail('四柱干支行结构无效。');
  const pillars = {};
  ['year', 'month', 'day', 'hour'].forEach((key, i) => {
    const pillar = stems[i + 1].text + branches[i + 1].text;
    if (!JIAZI.includes(pillar)) throw fail(`${key} 柱不是有效的六十甲子。`);
    pillars[key] = pillar;
  });
  if (field(header, '性别') !== (n.gender === 'male' ? '男' : '女')) throw fail('网站返回性别与请求不一致。', 'ZYDX_MISMATCH');
  if (field(header, '排盘方式') !== (n.calendar === 'solar' ? '公历排盘' : '农历排盘')) throw fail('网站返回的历法与请求不一致。', 'ZYDX_MISMATCH');
  const solar = dateTimeParts(field(header, '公历'), '公历');
  const lunarText = field(header, '农历');
  if (solar.hour !== n.hour || solar.minute !== n.minute) throw fail('网站返回时分与请求不一致，不能舍弃精度。', 'ZYDX_MISMATCH');
  if (n.calendar === 'solar') {
    if (solar.year !== n.year || solar.month !== n.month || solar.day !== n.day) throw fail('网站返回公历日期与请求不一致。', 'ZYDX_MISMATCH');
  } else {
    const lunar = /^(\d{4})年\s*\(生肖[^)]+\)\s*(闰?)(正|一|二|三|四|五|六|七|八|九|十|冬|十一|腊|十二)月(初[一二三四五六七八九十]|十[一二三四五六七八九]|二十|廿[一二三四五六七八九]|三十)([子丑寅卯辰巳午未申酉戌亥])时$/.exec(lunarText);
    const monthName = lunar && ({ 一: '正', 十一: '冬', 十二: '腊' }[lunar[3]] || lunar[3]);
    if (!lunar || Number(lunar[1]) !== n.year || MONTH_NAMES.indexOf(monthName) + 1 !== n.month || DAY_NAMES.indexOf(lunar[4]) + 1 !== n.day || Boolean(lunar[2]) !== n.leapMonth || lunar[5] !== BRANCHES[Math.floor((n.hour + 1) / 2) % 12]) {
      throw fail('网站返回农历年月日、闰月或时辰与请求不一致。', 'ZYDX_MISMATCH');
    }
  }
  const cyclesRow = rowById(safe, 'xipandayungz', true);
  const cycles = cyclesRow ? cellsOf(cyclesRow).slice(1).map((cell) => {
    const year = /\bdata-year=["'](\d{4})["']/.exec(cell.attrs);
    const age = /\bdata-age=["'](\d{1,3})["']/.exec(cell.attrs);
    if (!year || !age || !JIAZI.includes(cell.text)) throw fail('大运表内容发生变化。');
    return { pillar: cell.text, startYear: Number(year[1]), startAge: Number(age[1]) };
  }) : [];
  let forward;
  if (cycles.length > 1) {
    const direction = (JIAZI.indexOf(cycles[1].pillar) - JIAZI.indexOf(cycles[0].pillar) + 60) % 60;
    if (![1, 59].includes(direction)) throw fail('相邻大运顺序无效。');
    for (let i = 1; i < cycles.length; i++) {
      if ((JIAZI.indexOf(cycles[i].pillar) - JIAZI.indexOf(cycles[i - 1].pillar) + 60) % 60 !== direction || cycles[i].startYear - cycles[i - 1].startYear !== 10 || cycles[i].startAge - cycles[i - 1].startAge !== 10) throw fail('大运序列不连续。');
    }
    forward = direction === 1;
  }
  const headerText = textOf(header);
  const age = /起运[：:]\s*命主于出生后\s*(\d+)\s*年\s*(\d+)\s*个月\s*(\d+)\s*天\s*(\d+)\s*小时\s*起运/.exec(headerText);
  let startLuck;
  if (/交运[：:]/.test(headerText)) {
    const at = dateTimeParts(field(header, '交运'), '交运');
    if (cycles.length && cycles[0].startYear !== at.year) throw fail('首步大运年份与交运时间不一致。');
    startLuck = { date: at.date, ...(age ? { age: Object.fromEntries(['years', 'months', 'days', 'hours'].map((key, i) => [key, Number(age[i + 1])])) } : {}), ...(forward === undefined ? {} : { forward }) };
  }
  return {
    provider: 'zydx', url: ZYDX_URL, fetchedAt, pillars,
    ...(startLuck ? { startLuck } : {}), cycles,
    rawText: textOf(`${header}\n${table}\n${cyclesRow || ''}`),
    notes: [
      '通过网站表单 save=0 不保存提交；未登录、未携带账户 Cookie。网站自身访问日志不受本程序控制。',
      '网站仅接收出生日期、钟表时分与性别，没有出生地、时区、夏令时或真太阳时选项；其内部口径尚未全面验证。',
      '仅解析服务端返回的四柱和交运/大运；未执行网页脚本，也未读取动态流年占位数据。',
      'rawText 仅保留基本信息、四柱表和大运行，排除称骨、广告及动态占位内容。',
      ...(n.location ? ['输入的出生地未发送至该网站，不能据此声称网站已做地域时间校正。'] : []),
    ],
  };
}

/** Network failures are explicit; the caller decides whether to use another provider. */
export async function fetchZydx(input, { fetchImpl = globalThis.fetch, timeoutMs = 15_000, signal } = {}) {
  if (typeof fetchImpl !== 'function') throw fail('当前运行时没有 fetch。', 'ZYDX_NETWORK');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw fail('timeoutMs 须为 1–120000 的整数。', 'ZYDX_INPUT');
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw fail('signal 须为 AbortSignal。', 'ZYDX_INPUT');
  signal?.throwIfAborted();
  const { url, ...init } = buildZydxRequest(input);
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let response;
  let html;
  try {
    response = await fetchImpl(url, { ...init, signal: requestSignal });
    requestSignal.throwIfAborted();
    if (!response.ok) throw fail(`HTTP ${response.status}，未获得排盘。`, 'ZYDX_HTTP');
    if (response.redirected || (response.url && response.url !== ZYDX_URL)) throw fail('响应发生跳转，拒绝读取登录页或其他地址。', 'ZYDX_HTTP');
    if (!/^text\/html\b/i.test(response.headers.get('content-type') || '')) throw fail('返回的内容不是 HTML。', 'ZYDX_HTTP');
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_HTML_SIZE * 3) throw fail('返回内容过大。', 'ZYDX_HTTP');
    const bytes = await response.arrayBuffer();
    requestSignal.throwIfAborted();
    if (bytes.byteLength > MAX_HTML_SIZE * 3) throw fail('返回内容过大。', 'ZYDX_HTTP');
    html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    // Caller cancellation must remain cancellation, not trigger provider fallback.
    if (signal?.aborted) throw signal.reason;
    if (error?.code?.startsWith?.('ZYDX_')) throw error;
    throw fail(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? '排盘请求超时。' : `获取排盘失败：${error?.message ?? String(error)}`, 'ZYDX_NETWORK');
  }
  signal?.throwIfAborted();
  return parseZydxHtml(html, input);
}
