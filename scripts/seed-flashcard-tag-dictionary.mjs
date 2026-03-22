#!/usr/bin/env node

const BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:7800';
const TOKEN = process.env.BACKEND_BEARER_TOKEN || process.env.ACCESS_TOKEN || process.env.TOKEN || '';
const COOKIE_TOKEN = process.env.BACKEND_COOKIE_TOKEN || process.env.COOKIE_TOKEN || '';

if (!TOKEN && !COOKIE_TOKEN) {
  console.error(
    'Missing auth token. Use one of:\n' +
      '1) BACKEND_BEARER_TOKEN="<accessToken>" yarn seed:flashcard-tags\n' +
      '2) TOKEN="<accessToken>" yarn seed:flashcard-tags\n' +
      '3) BACKEND_COOKIE_TOKEN="<browser cookie token>" yarn seed:flashcard-tags\n\n' +
      'Important: use the browser cookie named "token" (accessToken), not "idToken".',
  );
  process.exit(1);
}

const CATEGORY = {
  code: 'flashcard_tag',
  name: '闪卡标签',
  description: '用于标记 Flashcard 的执行特征、价格行为、结构环境与交易时段',
  bizType: 'FLASHCARD',
  selectionMode: 'MULTIPLE',
  sortOrder: 200,
};

const ITEMS = [
  {
    code: 'pending_order_entry',
    label: '提前挂单入场',
    description: '不追当前价格，提前在关键区域附近挂限价单等待成交',
    color: '#00c2b2',
    sortOrder: 100,
  },
  {
    code: 'retest_entry',
    label: '回踩入场',
    description: '等待突破后的回踩确认，再按原方向入场',
    color: '#00c2b2',
    sortOrder: 110,
  },
  {
    code: 'market_entry',
    label: '市价直接入场',
    description: '不等待挂单或深回踩，信号出现后直接跟随入场',
    color: '#00c2b2',
    sortOrder: 120,
  },
  {
    code: 'do_not_chase',
    label: '禁止追单',
    description: '当前动量或价格距离已经过大，直接追单会导致盈亏比失真',
    color: '#f59e0b',
    sortOrder: 130,
  },
  {
    code: 'time_stop_required',
    label: '需要时间止损',
    description: '若若干根K线内未走出预期方向扩张，需要按时间止损离场',
    color: '#f59e0b',
    sortOrder: 140,
  },
  {
    code: 'big_body_up',
    label: '强势大阳突破',
    description: '以明显大实体阳线完成向上突破或强势收盘',
    color: '#22c55e',
    sortOrder: 200,
  },
  {
    code: 'big_body_down',
    label: '强势下跌突破',
    description: '以明显大实体阴线完成向下突破或强势收盘',
    color: '#ef4444',
    sortOrder: 210,
  },
  {
    code: 'long_wick_rejection',
    label: '长影线拒绝',
    description: '价格刺穿关键区域后出现明显长影线，体现拒绝与反向承接',
    color: '#8b5cf6',
    sortOrder: 220,
  },
  {
    code: 'slow_compression',
    label: '缓慢挤压逼近',
    description: '价格持续以更接近关键区域的高低点推进，暗示区间即将被突破',
    color: '#8b5cf6',
    sortOrder: 230,
  },
  {
    code: 'engulfing_reversal',
    label: '吞没反转',
    description: '关键区域出现反向吞没K线，作为反转或承接确认',
    color: '#8b5cf6',
    sortOrder: 240,
  },
  {
    code: 'flip_zone',
    label: '支撑阻力互换',
    description: '原支撑跌破后转为阻力，或原阻力突破后转为支撑',
    color: '#3b82f6',
    sortOrder: 300,
  },
  {
    code: 'range_boundary',
    label: '区间边界',
    description: '信号发生在区间上沿或下沿附近，属于区间交易核心位置',
    color: '#3b82f6',
    sortOrder: 310,
  },
  {
    code: 'near_4h_resistance',
    label: '接近4H阻力',
    description: '当前行为发生在4小时背景阻力区域附近',
    color: '#3b82f6',
    sortOrder: 320,
  },
  {
    code: 'near_4h_support',
    label: '接近4H支撑',
    description: '当前行为发生在4小时背景支撑区域附近',
    color: '#3b82f6',
    sortOrder: 330,
  },
  {
    code: 'at_1h_bos_zone',
    label: '位于1H结构位',
    description: '信号发生在1小时 BOS / 结构确认区域附近',
    color: '#3b82f6',
    sortOrder: 340,
  },
  {
    code: 'chaotic_context',
    label: '混乱环境',
    description: '市场结构不清晰、原剧本被破坏或边界失效，需高度谨慎',
    color: '#6b7280',
    sortOrder: 350,
  },
  {
    code: 'asia_session',
    label: '亚盘',
    description: '题目主要发生在亚洲交易时段',
    color: '#14b8a6',
    sortOrder: 400,
  },
  {
    code: 'london_session',
    label: '欧盘',
    description: '题目主要发生在伦敦交易时段',
    color: '#14b8a6',
    sortOrder: 410,
  },
  {
    code: 'new_york_session',
    label: '美盘',
    description: '题目主要发生在纽约交易时段',
    color: '#14b8a6',
    sortOrder: 420,
  },
];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${path}\n${text || '<empty>'}`,
    );
  }

  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function ensureCategory() {
  const listRes = await request('/dictionary/categories');
  const items = listRes?.data?.items || [];
  const existing = items.find((item) => item.code === CATEGORY.code);

  if (!existing) {
    const createRes = await request('/dictionary/categories', {
      method: 'POST',
      body: JSON.stringify(CATEGORY),
    });
    console.log(`+ created category ${CATEGORY.code}`);
    return createRes?.data;
  }

  const patch = {
    name: CATEGORY.name,
    description: CATEGORY.description,
    bizType: CATEGORY.bizType,
    selectionMode: CATEGORY.selectionMode,
    sortOrder: CATEGORY.sortOrder,
    status: 'ACTIVE',
  };

  await request(`/dictionary/categories/${existing.categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  console.log(`~ updated category ${CATEGORY.code}`);
  return existing;
}

async function upsertItems() {
  const listRes = await request(
    `/dictionary/items?categoryCode=${CATEGORY.code}`,
  );
  const existingItems = listRes?.data?.items || [];
  const byCode = new Map(existingItems.map((item) => [item.code, item]));

  let created = 0;
  let updated = 0;

  for (const item of ITEMS) {
    const existing = byCode.get(item.code);
    if (!existing) {
      await request('/dictionary/items', {
        method: 'POST',
        body: JSON.stringify({
          categoryCode: CATEGORY.code,
          ...item,
        }),
      });
      created += 1;
      console.log(`+ created item ${item.code}`);
      continue;
    }

    await request(`/dictionary/items/${existing.itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        label: item.label,
        alias: item.alias,
        description: item.description,
        color: item.color,
        sortOrder: item.sortOrder,
        status: 'ACTIVE',
      }),
    });
    updated += 1;
    console.log(`~ updated item ${item.code}`);
  }

  return { created, updated, total: ITEMS.length };
}

async function main() {
  console.log(`Seeding flashcard_tag dictionary via ${BASE_URL}`);
  console.log(`Auth mode: ${TOKEN ? 'Authorization Bearer' : 'Cookie token'}`);
  await ensureCategory();
  const result = await upsertItems();
  console.log('\nDone.');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('\nSeed failed:\n');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
