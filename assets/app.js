// 外来・在宅ベースアップ評価料 シミュレータ（無床診療所、令和8年度改定対応）
// クライアントサイドのみで動作。入力データは外部送信しません。

const POINT_YEN = 10;
const WELFARE_RATIO = 0.165; // 法定福利費 事業主負担（健保・厚年・労災・子育拠出金等の概算）

// 評価料(Ⅰ) 点数表（令和8年6月～、賃上げ区分別）
// new=初診時、rep=再診時、homeAlone=訪問診療同一建物居住者等以外、homeGroup=訪問診療同一建物居住者
// 注5により、継続的賃上げ実施は訪問診療点数も独自値（107点/26点）
const REV1_POINTS_TABLE = {
  standard:   { new: 17, rep: 4, homeAlone: 79,  homeGroup: 19 },
  continuous: { new: 23, rep: 6, homeAlone: 107, homeGroup: 26 },
};

// 令和6年度改定の評価料(Ⅰ) 点数（改定前＝令和8年5月以前）
const REV1_POINTS_PRIOR = { new: 6, rep: 2, homeAlone: 28, homeGroup: 7 };

// 令和6年度改定の評価料(Ⅱ) 区分表（無床診療所、8区分）
const REV2_TIERS_PRIOR = [
  { id: 1, key: '区分1', new: 8,  rep: 1 },
  { id: 2, key: '区分2', new: 16, rep: 2 },
  { id: 3, key: '区分3', new: 24, rep: 3 },
  { id: 4, key: '区分4', new: 32, rep: 4 },
  { id: 5, key: '区分5', new: 40, rep: 5 },
  { id: 6, key: '区分6', new: 48, rep: 6 },
  { id: 7, key: '区分7', new: 56, rep: 7 },
  { id: 8, key: '区分8', new: 64, rep: 8 },
];

// 評価料(Ⅱ) 区分表（無床診療所、令和8年6月以降）
const REV2_TIERS = {
  // 「それ以外」（新規届出）: 12区分。区分N = 初診8N点／再診N点
  standard: [
    { id: 1,  key: '区分1',  new: 8,  rep: 1  },
    { id: 2,  key: '区分2',  new: 16, rep: 2  },
    { id: 3,  key: '区分3',  new: 24, rep: 3  },
    { id: 4,  key: '区分4',  new: 32, rep: 4  },
    { id: 5,  key: '区分5',  new: 40, rep: 5  },
    { id: 6,  key: '区分6',  new: 48, rep: 6  },
    { id: 7,  key: '区分7',  new: 56, rep: 7  },
    { id: 8,  key: '区分8',  new: 64, rep: 8  },
    { id: 9,  key: '区分9',  new: 72, rep: 9  },
    { id: 10, key: '区分10', new: 80, rep: 10 },
    { id: 11, key: '区分11', new: 88, rep: 11 },
    { id: 12, key: '区分12', new: 96, rep: 12 },
  ],
  // 「継続的賃上げ実施」: 12区分（最大160点）
  continuous: [
    { id: 1,  key: '区分1',  new: 16,  rep: 2  },
    { id: 2,  key: '区分2',  new: 24,  rep: 3  },
    { id: 3,  key: '区分3',  new: 40,  rep: 5  },
    { id: 4,  key: '区分4',  new: 56,  rep: 7  },
    { id: 5,  key: '区分5',  new: 64,  rep: 8  },
    { id: 6,  key: '区分6',  new: 80,  rep: 10 },
    { id: 7,  key: '区分7',  new: 96,  rep: 12 },
    { id: 8,  key: '区分8',  new: 104, rep: 13 },
    { id: 9,  key: '区分9',  new: 120, rep: 15 },
    { id: 10, key: '区分10', new: 136, rep: 17 },
    { id: 11, key: '区分11', new: 144, rep: 18 },
    { id: 12, key: '区分12', new: 160, rep: 20 },
  ],
};

const yen  = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const num  = new Intl.NumberFormat('ja-JP');
const num1 = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 });

// 状態：手動選択された(Ⅱ)区分ID（nullなら未選択＝(Ⅱ)算定しない）
let selectedTierId = null;
// 改定前(Ⅱ)区分ID（継続的賃上げ実施の場合に控除する旧区分。nullなら旧(Ⅱ)未算定）
let selectedPriorTierId = null;

const STORAGE_KEY = 'baseup-simulator-v1';

const PERSIST_NUMBER_IDS = [
  'm1-new', 'm1-rep', 'm1-home1', 'm1-home2',
  'm2-new', 'm2-rep', 'm2-home1', 'm2-home2',
  'm3-new', 'm3-rep', 'm3-home1', 'm3-home2',
  'staff-count',
];
const PERSIST_RADIO_NAMES = ['rev-type', 'raise-type'];

function saveState() {
  const data = { nums: {}, radios: {}, tierId: selectedTierId, priorTierId: selectedPriorTierId };
  PERSIST_NUMBER_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) data.nums[id] = el.value;
  });
  PERSIST_RADIO_NAMES.forEach(name => {
    const v = radioVal(name);
    if (v != null) data.radios[name] = v;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function loadState() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { data = null; }
  if (!data) return;
  if (data.nums) {
    Object.entries(data.nums).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && v != null && v !== '') el.value = v;
    });
  }
  if (data.radios) {
    Object.entries(data.radios).forEach(([name, v]) => {
      const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
      if (el) el.checked = true;
    });
  }
  if (typeof data.tierId === 'number') {
    selectedTierId = data.tierId;
  }
  if (typeof data.priorTierId === 'number') {
    selectedPriorTierId = data.priorTierId;
  }
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

function $(id) { return document.getElementById(id); }
function radioVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

// 「初診相当」＝初診料＋訪問診療料Ⅰの1（同一建物居住者以外）
// 「再診相当」＝再診料＋訪問診療料Ⅰの1の2（同一建物居住者）
// 外来・在宅ベースアップ評価料は訪問同一建物以外を初診と、同一建物居住者を再診と同じ点数で算定する
const COUNT_NEW_IDS   = ['m1-new', 'm2-new', 'm3-new'];
const COUNT_REP_IDS   = ['m1-rep', 'm2-rep', 'm3-rep'];
const COUNT_HOME1_IDS = ['m1-home1', 'm2-home1', 'm3-home1'];
const COUNT_HOME2_IDS = ['m1-home2', 'm2-home2', 'm3-home2'];
const COUNT_IDS = [
  ...COUNT_NEW_IDS, ...COUNT_REP_IDS, ...COUNT_HOME1_IDS, ...COUNT_HOME2_IDS,
];

// 空欄を除いた平均（全て空欄なら0）
function avgOfFilled(ids) {
  const vals = ids
    .map(id => $(id).value.trim())
    .filter(v => v !== '')
    .map(v => Math.max(0, Number(v) || 0));
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function readInputs() {
  const anyCount = COUNT_IDS.some(id => $(id).value.trim() !== '');
  const staffRaw = $('staff-count').value.trim();
  const staffNum = Number(staffRaw);
  const hasStaff = staffRaw !== '' && Number.isFinite(staffNum) && staffNum >= 1;
  const avgInitial   = avgOfFilled(COUNT_NEW_IDS);
  const avgFollowup  = avgOfFilled(COUNT_REP_IDS);
  const avgHomeAlone = avgOfFilled(COUNT_HOME1_IDS); // 訪問同一建物以外
  const avgHomeGroup = avgOfFilled(COUNT_HOME2_IDS); // 訪問同一建物
  return {
    // 種別ごとの平均
    avgInitial, avgFollowup, avgHomeAlone, avgHomeGroup,
    // (Ⅱ)用の集約: 訪問は両方とも「初診時」と同じ単価
    avgNew: avgInitial + avgHomeAlone + avgHomeGroup,
    avgRep: avgFollowup,
    revType:   radioVal('rev-type')   || '1-only',
    raiseType: radioVal('raise-type') || 'continuous',
    staffCount: hasStaff ? staffNum : null,
    hasStaff,
    anyCount,
  };
}

function getRev1Points(input) {
  return REV1_POINTS_TABLE[input.raiseType];
}

function getRev2Tiers(input) {
  return input.raiseType === 'continuous' ? REV2_TIERS.continuous : REV2_TIERS.standard;
}

function calculate(input) {
  const avgNew = input.avgNew; // (Ⅱ)用集約値: 初診+訪問外+訪問内
  const avgRep = input.avgRep; // (Ⅱ)用集約値: 再診
  const isContinuous = input.raiseType === 'continuous';

  // 改定後(Ⅰ) 月額: 初診/再診/訪問外/訪問内それぞれ独立点数
  const pt1 = getRev1Points(input);
  const rev1NewMonthly       = input.avgInitial   * pt1.new       * POINT_YEN;
  const rev1RepMonthly       = input.avgFollowup  * pt1.rep       * POINT_YEN;
  const rev1HomeAloneMonthly = input.avgHomeAlone * pt1.homeAlone * POINT_YEN;
  const rev1HomeGroupMonthly = input.avgHomeGroup * pt1.homeGroup * POINT_YEN;
  const rev1Monthly = rev1NewMonthly + rev1RepMonthly + rev1HomeAloneMonthly + rev1HomeGroupMonthly;

  // 改定後(Ⅱ) 各区分の試算
  const tiers = getRev2Tiers(input);
  const tierEvals = tiers.map(t => {
    const monthly = (avgNew * t.new + avgRep * t.rep) * POINT_YEN;
    return { ...t, monthly };
  });
  let useTier = null;
  if (input.revType === '1-and-2' && selectedTierId !== null) {
    useTier = tierEvals.find(t => t.id === selectedTierId) || null;
  }
  const rev2Monthly = useTier ? useTier.monthly : 0;

  // 改定後の総額
  const grossMonthly = rev1Monthly + rev2Monthly;

  // 改定前(令和8年3月時点)の(Ⅰ)(Ⅱ)月額（継続的賃上げ実施の場合のみ控除）
  const priorPt1 = REV1_POINTS_PRIOR;
  const priorRev1Monthly = isContinuous
    ? (input.avgInitial  * priorPt1.new
     + input.avgFollowup * priorPt1.rep
     + input.avgHomeAlone* priorPt1.homeAlone
     + input.avgHomeGroup* priorPt1.homeGroup) * POINT_YEN
    : 0;

  const priorTierEvals = REV2_TIERS_PRIOR.map(t => {
    const monthly = (avgNew * t.new + avgRep * t.rep) * POINT_YEN;
    return { ...t, monthly };
  });
  let priorUseTier = null;
  if (isContinuous && selectedPriorTierId !== null) {
    priorUseTier = priorTierEvals.find(t => t.id === selectedPriorTierId) || null;
  }
  const priorRev2Monthly = priorUseTier ? priorUseTier.monthly : 0;
  const priorTotalMonthly = priorRev1Monthly + priorRev2Monthly;

  // 純増分 = 改定後 − 改定前
  const totalMonthly = grossMonthly - priorTotalMonthly;
  const totalYearly  = totalMonthly * 12;

  // 手当原資（社保事業主負担増を控除）
  const allowanceMonthly = totalMonthly / (1 + WELFARE_RATIO);
  const welfareCost      = totalMonthly - allowanceMonthly;
  // 対象人数が未入力なら1人あたりは算出しない
  const allowancePerStaff = input.hasStaff ? allowanceMonthly / input.staffCount : null;

  return {
    input, avgNew, avgRep,
    pt1, tiers, tierEvals, useTier,
    rev1NewMonthly, rev1RepMonthly, rev1HomeAloneMonthly, rev1HomeGroupMonthly, rev1Monthly,
    rev2Monthly,
    // 改定前関連
    isContinuous,
    priorPt1, priorTierEvals, priorUseTier,
    priorRev1Monthly, priorRev2Monthly, priorTotalMonthly,
    grossMonthly,
    // 純増
    totalMonthly, totalYearly,
    welfareCost, allowanceMonthly, allowancePerStaff,
  };
}

function renderTierTable(r) {
  const wrap = $('tier-table-wrap');
  const section = $('tier-selector');
  const enabled = r.input.revType === '1-and-2';

  // (Ⅰ)のみのときは区分選択セクションを印刷対象から除外
  section.classList.toggle('no-print', !enabled);

  if (!enabled) {
    wrap.innerHTML = `<div class="rounded-md bg-slate-50 p-4 text-center text-sm text-slate-500">
      「評価料(Ⅰ) + (Ⅱ) を算定」を選択すると、区分を選択できます。
    </div>`;
    return;
  }

  const pt1 = r.pt1; // 改定後(Ⅰ)
  const usingTier = !!r.useTier;
  // 開閉状態は明示操作で決まる（区分選択時は自動で閉じる）
  const open = wrap.dataset.tierOpen === '1';

  // 改定後(Ⅰ)行（参考表示・選択不可）
  const row1 = `
    <tr class="bg-white">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">改定後(Ⅰ)</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${pt1.new}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${pt1.rep}点</span></td>
    </tr>`;

  // 改定後(Ⅱ) 行：クリックでアコーディオン開閉
  const tierLabel = usingTier ? `（${r.useTier.key}）` : '<span class="text-slate-500">算定なし</span>';
  const val2New = usingTier
    ? `<span class="font-semibold">${r.useTier.new}点</span>`
    : '<span class="text-slate-400">―</span>';
  const val2Rep = usingTier
    ? `<span class="font-semibold">${r.useTier.rep}点</span>`
    : '<span class="text-slate-400">―</span>';
  const row2 = `
    <tr data-tier-summary="ii" class="cursor-pointer ${usingTier ? 'bg-brand-100 ring-2 ring-brand-600' : 'bg-amber-50/40 hover:bg-amber-100'} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        改定後(Ⅱ) ${tierLabel}
        <span class="ml-1 inline-flex items-center gap-0.5 text-[11px] text-brand-700">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform ${open ? 'rotate-180' : ''}"><path d="m6 9 6 6 6-6"/></svg>
          ${open ? '区分を閉じる' : '区分を選ぶ'}
        </span>
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${val2New}</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${val2Rep}</td>
    </tr>`;

  // 改定後(Ⅰ)+(Ⅱ) 行：合計表示のみ
  const totalNew = pt1.new + (usingTier ? r.useTier.new : 0);
  const totalRep = pt1.rep + (usingTier ? r.useTier.rep : 0);
  const row3 = `
    <tr class="bg-slate-50/60">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">改定後(Ⅰ)+(Ⅱ) <span class="text-xs text-slate-500">合計</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-bold text-brand-700">${totalNew}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-bold text-brand-700">${totalRep}点</span></td>
    </tr>`;

  // ----- 区分テーブル（アコーディオン内）-----
  const tierRows = r.tierEvals.map(t => {
    const isSelected = r.useTier && r.useTier.id === t.id;
    const rowCls = isSelected
      ? 'tier-row-selected bg-brand-100 ring-2 ring-brand-600'
      : 'bg-amber-50/40 hover:bg-amber-100';
    return `<tr data-tier-id="${t.id}" class="cursor-pointer ${rowCls} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${isSelected ? '<span class="mr-1 text-brand-700">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        ${t.key}
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${t.new}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${t.rep}点</span></td>
    </tr>`;
  }).join('');

  // 「算定しない」行
  const tierNoneRow = `
    <tr data-tier-id="0" class="cursor-pointer ${usingTier ? 'bg-white hover:bg-amber-50' : 'bg-brand-100 ring-2 ring-brand-600'} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${!usingTier ? '<span class="mr-1 text-brand-700">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        (Ⅱ)を算定しない
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
    </tr>`;

  wrap.innerHTML = `
    <table class="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
      <thead>
        <tr class="text-xs text-slate-500">
          <th class="rounded-tl-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium">改定後の算定パターン</th>
          <th class="border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">初診点数</th>
          <th class="rounded-tr-lg border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">再診点数</th>
        </tr>
      </thead>
      <tbody>${row1}${row2}${row3}</tbody>
    </table>
    <div id="tier-accordion" class="${open ? '' : 'hidden'} mt-3 overflow-hidden rounded-lg border border-brand-300 bg-brand-50/30">
      <div class="border-b border-brand-200 bg-brand-100/60 px-3 py-1.5 text-[11px] font-medium text-brand-900">改定後に算定する(Ⅱ)区分を選択してください</div>
      <table class="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr class="text-xs text-slate-500">
            <th class="border-b border-slate-200 bg-white px-3 py-2 text-left font-medium">区分</th>
            <th class="border-b border-l border-slate-200 bg-white px-3 py-2 text-right font-medium">初診点数</th>
            <th class="border-b border-l border-slate-200 bg-white px-3 py-2 text-right font-medium">再診点数</th>
          </tr>
        </thead>
        <tbody>${tierNoneRow}${tierRows}</tbody>
      </table>
    </div>`;

  wrap.dataset.tierOpen = open ? '1' : '0';

  // クリックハンドラ：改定後(Ⅱ) サマリー行 → アコーディオン開閉
  wrap.querySelectorAll('tr[data-tier-summary]').forEach(tr => {
    tr.addEventListener('click', () => {
      const isOpen = wrap.dataset.tierOpen === '1';
      wrap.dataset.tierOpen = isOpen ? '0' : '1';
      onCalc();
    });
  });

  // クリックハンドラ：区分行（選択後は自動で閉じる）
  wrap.querySelectorAll('tr[data-tier-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = Number(tr.dataset.tierId);
      selectedTierId = id === 0 ? null : id;
      wrap.dataset.tierOpen = '0';
      onCalc();
    });
  });
}

function renderPriorTierTable(r) {
  const wrap = $('prior-tier-table-wrap');
  const section = $('prior-tier-selector');
  const show = r.isContinuous;

  // 表示制御（非該当時は丸ごと非表示、印刷も除外）
  section.classList.toggle('hidden', !show);
  section.classList.toggle('no-print', !show);
  if (!show) {
    wrap.innerHTML = '';
    return;
  }

  const priorPt1 = r.priorPt1; // 改定前(Ⅰ) = {new:6, rep:2}

  const fmtSum = (a, b) => `<span class="text-slate-500">(Ⅰ)${a}+(Ⅱ)${b}=</span><span class="font-semibold">${a + b}点</span>`;
  const fmtAlone = (a) => `<span class="text-slate-500">(Ⅰ)</span><span class="font-semibold">${a}点</span>`;

  const usingTier = !!r.priorUseTier;
  // 開閉状態は明示操作で決まる（区分選択時は自動で閉じる）
  const open = wrap.dataset.tierOpen === '1';

  // 改定前(Ⅰ)行（参考表示・選択不可）
  const row1 = `
    <tr class="bg-white">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">改定前(Ⅰ)</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${priorPt1.new}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${priorPt1.rep}点</span></td>
    </tr>`;

  // 改定前(Ⅱ) 行：クリックでアコーディオン開閉＋区分選択
  const tierLabel = usingTier ? `（${r.priorUseTier.key}）` : '<span class="text-slate-500">算定なし</span>';
  const val2New = usingTier
    ? `<span class="font-semibold">${r.priorUseTier.new}点</span>`
    : '<span class="text-slate-400">―</span>';
  const val2Rep = usingTier
    ? `<span class="font-semibold">${r.priorUseTier.rep}点</span>`
    : '<span class="text-slate-400">―</span>';
  const row2 = `
    <tr data-prior-summary="ii" class="cursor-pointer ${usingTier ? 'bg-amber-100 ring-2 ring-amber-500' : 'bg-amber-50/40 hover:bg-amber-100'} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        改定前(Ⅱ) ${tierLabel}
        <span class="ml-1 inline-flex items-center gap-0.5 text-[11px] text-amber-700">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform ${open ? 'rotate-180' : ''}"><path d="m6 9 6 6 6-6"/></svg>
          ${open ? '区分を閉じる' : '区分を選ぶ'}
        </span>
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${val2New}</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums">${val2Rep}</td>
    </tr>`;

  // 改定前(Ⅰ)+(Ⅱ) 行：合計表示のみ
  const totalNew = priorPt1.new + (usingTier ? r.priorUseTier.new : 0);
  const totalRep = priorPt1.rep + (usingTier ? r.priorUseTier.rep : 0);
  const row3 = `
    <tr class="bg-slate-50/60">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">改定前(Ⅰ)+(Ⅱ) <span class="text-xs text-slate-500">合計</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-bold text-amber-700">${totalNew}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-bold text-amber-700">${totalRep}点</span></td>
    </tr>`;

  // ----- 区分テーブル（アコーディオン内）-----
  const tierRows = r.priorTierEvals.map(t => {
    const isSelected = r.priorUseTier && r.priorUseTier.id === t.id;
    const rowCls = isSelected
      ? 'prior-tier-row-selected bg-amber-100 ring-2 ring-amber-500'
      : 'bg-amber-50/40 hover:bg-amber-100';
    return `<tr data-prior-tier-id="${t.id}" class="cursor-pointer ${rowCls} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${isSelected ? '<span class="mr-1 text-amber-600">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        ${t.key}
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${t.new}点</span></td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums"><span class="font-semibold">${t.rep}点</span></td>
    </tr>`;
  }).join('');

  // 「区分を選択しない（=算定なしに戻す）」行
  const tierNoneRow = `
    <tr data-prior-tier-id="0" class="cursor-pointer ${usingTier ? 'bg-white hover:bg-amber-50' : 'bg-amber-100 ring-2 ring-amber-500'} transition">
      <td class="border-t border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
        ${!usingTier ? '<span class="mr-1 text-amber-600">●</span>' : '<span class="mr-1 text-slate-300">○</span>'}
        算定していなかった
      </td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
      <td class="border-t border-slate-200 px-3 py-2 text-right font-mono text-sm tabular-nums text-slate-400">―</td>
    </tr>`;

  wrap.innerHTML = `
    <table class="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
      <thead>
        <tr class="text-xs text-slate-500">
          <th class="rounded-tl-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium">改定前の算定パターン</th>
          <th class="border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">初診点数</th>
          <th class="rounded-tr-lg border border-l-0 border-slate-200 bg-slate-50 px-3 py-2 text-right font-medium">再診点数</th>
        </tr>
      </thead>
      <tbody>${row1}${row2}${row3}</tbody>
    </table>
    <div id="prior-tier-accordion" class="${open ? '' : 'hidden'} mt-3 overflow-hidden rounded-lg border border-amber-300 bg-amber-50/30">
      <div class="border-b border-amber-200 bg-amber-100/60 px-3 py-1.5 text-[11px] font-medium text-amber-900">改定前に算定していた(Ⅱ)区分を選択してください</div>
      <table class="w-full min-w-[420px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr class="text-xs text-slate-500">
            <th class="border-b border-slate-200 bg-white px-3 py-2 text-left font-medium">区分</th>
            <th class="border-b border-l border-slate-200 bg-white px-3 py-2 text-right font-medium">初診点数</th>
            <th class="border-b border-l border-slate-200 bg-white px-3 py-2 text-right font-medium">再診点数</th>
          </tr>
        </thead>
        <tbody>${tierNoneRow}${tierRows}</tbody>
      </table>
    </div>`;

  wrap.dataset.tierOpen = open ? '1' : '0';

  // クリックハンドラ：改定前(Ⅱ) サマリー行 → アコーディオン開閉
  wrap.querySelectorAll('tr[data-prior-summary]').forEach(tr => {
    tr.addEventListener('click', () => {
      const isOpen = wrap.dataset.tierOpen === '1';
      wrap.dataset.tierOpen = isOpen ? '0' : '1';
      onCalc();
    });
  });

  // クリックハンドラ：区分行（選択後は自動で閉じる）
  wrap.querySelectorAll('tr[data-prior-tier-id]').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = Number(tr.dataset.priorTierId);
      selectedPriorTierId = id === 0 ? null : id;
      wrap.dataset.tierOpen = '0';
      onCalc();
    });
  });
}

function buildFormula(pt1, pt2, tierKey) {
  const pt1Span = `<span class="text-base font-bold text-slate-900">${pt1}</span><span class="text-xs text-slate-500">点（Ⅰ）</span>`;
  if (pt2 == null) {
    return `${pt1Span} <span class="text-slate-400">＝</span> <span class="text-lg font-bold text-emerald-700">${pt1}</span><span class="text-xs text-slate-500">点</span>`;
  }
  const pt2Span = `<span class="text-base font-bold text-brand-700">${pt2}</span><span class="text-xs text-slate-500">点（Ⅱ ${tierKey}）</span>`;
  const total = pt1 + pt2;
  return `${pt1Span} <span class="text-slate-400">＋</span> ${pt2Span} <span class="text-slate-400">＝</span> <span class="text-lg font-bold text-emerald-700">${total}</span><span class="text-xs text-slate-500">点</span>`;
}

function render(r) {
  // 入力待ち案内を隠す
  $('result-notice').classList.add('hidden');

  // 3か月平均（入力済みの欄のみ・空欄種別は「―」）
  renderAverages();

  // 令和8年6月以降の点数（式形式）
  // 改定後の式表示（初診/再診/訪問外/訪問内）。(Ⅱ)では訪問は初診と同じ単価
  const ut = r.useTier;
  const utKey = ut ? ut.key : null;
  $('r-formula-new').innerHTML   = buildFormula(r.pt1.new,       ut ? ut.new : null, utKey);
  $('r-formula-rep').innerHTML   = buildFormula(r.pt1.rep,       ut ? ut.rep : null, utKey);
  $('r-formula-home1').innerHTML = buildFormula(r.pt1.homeAlone, ut ? ut.new : null, utKey);
  $('r-formula-home2').innerHTML = buildFormula(r.pt1.homeGroup, ut ? ut.new : null, utKey);
  ['r-formula-new','r-formula-rep','r-formula-home1','r-formula-home2']
    .forEach(id => $(id).classList.remove('text-slate-400'));

  // 令和8年5月までの点数（継続的賃上げ実施の場合のみ）
  const priorBlock = $('prior-formula-block');
  if (r.isContinuous) {
    priorBlock.classList.remove('hidden');
    const put = r.priorUseTier;
    const putKey = put ? put.key : null;
    $('r-formula-prior-new').innerHTML   = buildFormula(r.priorPt1.new,       put ? put.new : null, putKey);
    $('r-formula-prior-rep').innerHTML   = buildFormula(r.priorPt1.rep,       put ? put.rep : null, putKey);
    $('r-formula-prior-home1').innerHTML = buildFormula(r.priorPt1.homeAlone, put ? put.new : null, putKey);
    $('r-formula-prior-home2').innerHTML = buildFormula(r.priorPt1.homeGroup, put ? put.new : null, putKey);
    ['r-formula-prior-new','r-formula-prior-rep','r-formula-prior-home1','r-formula-prior-home2']
      .forEach(id => $(id).classList.remove('text-slate-400'));
  } else {
    priorBlock.classList.add('hidden');
  }

  // 増収額
  $('r-rev1-monthly').textContent = yen.format(Math.round(r.rev1Monthly));
  $('r-rev2-monthly').textContent = yen.format(Math.round(r.rev2Monthly));
  $('r-gross-monthly').textContent = yen.format(Math.round(r.grossMonthly));
  $('r-total-monthly').textContent = yen.format(Math.round(r.totalMonthly));
  $('r-total-yearly').textContent  = yen.format(Math.round(r.totalYearly));

  const row2 = $('row-rev2-monthly');
  if (r.input.revType === '1-and-2') row2.classList.remove('opacity-40');
  else row2.classList.add('opacity-40');

  // 改定前控除行・小計行（継続的賃上げ実施の場合のみ表示）
  const rowPrior = $('row-prior');
  const rowGross = $('row-gross');
  if (r.isContinuous) {
    rowGross.classList.remove('hidden');
    rowPrior.classList.remove('hidden');
    $('r-prior-monthly').textContent = '− ' + yen.format(Math.round(r.priorTotalMonthly));
    $('r-total-label').textContent = '月間想定増収額（純増分・改定前控除後）';
  } else {
    rowGross.classList.add('hidden');
    rowPrior.classList.add('hidden');
    $('r-total-label').textContent = '月間想定増収額（合計）';
  }

  // 手当額
  $('r-allow-base').textContent  = yen.format(Math.round(r.totalMonthly));
  $('r-welfare').textContent     = '− ' + yen.format(Math.round(r.welfareCost));
  $('r-allowance').textContent   = yen.format(Math.round(r.allowanceMonthly));
  $('r-allowance-yearly').textContent = yen.format(Math.round(r.allowanceMonthly * 12));
  if (r.input.hasStaff) {
    $('r-allowance-per').textContent = yen.format(Math.round(r.allowancePerStaff));
    $('r-allowance-per-yearly').textContent = yen.format(Math.round(r.allowancePerStaff * 12));
    $('r-staff-display').textContent = num.format(r.input.staffCount);
  } else {
    $('r-allowance-per').textContent = '― 円';
    $('r-allowance-per-yearly').textContent = '―';
    $('r-staff-display').textContent = '―';
  }

  // (Ⅰ) 内訳: 初診/再診/訪問外/訪問内 の4種別
  const rows = [
    ['初診',              r.pt1.new,       r.input.avgInitial,   r.rev1NewMonthly],
    ['再診',              r.pt1.rep,       r.input.avgFollowup,  r.rev1RepMonthly],
    ['訪問診療(同一建物外)', r.pt1.homeAlone, r.input.avgHomeAlone, r.rev1HomeAloneMonthly],
    ['訪問診療(同一建物内)', r.pt1.homeGroup, r.input.avgHomeGroup, r.rev1HomeGroupMonthly],
  ];
  $('rev1-breakdown').innerHTML = rows.map(([label, pt, cnt, monthly]) => `
    <tr>
      <td class="px-3 py-2">${label}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}点</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num1.format(cnt)}</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(monthly))}</td>
    </tr>
  `).join('') + `
    <tr class="bg-slate-50 font-medium">
      <td class="px-3 py-2" colspan="3">月額合計</td>
      <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(r.rev1Monthly))}</td>
    </tr>`;

  // (Ⅱ) 内訳
  const tierLabelEl = $('rev2-tier-label');
  const rev2Body    = $('rev2-breakdown');
  $('rev2-card').classList.toggle('no-print', !r.useTier);
  if (r.useTier) {
    tierLabelEl.textContent = `／ ${r.useTier.key}`;
    const r2NewMonthly = r.avgNew * r.useTier.new * POINT_YEN;
    const r2RepMonthly = r.avgRep * r.useTier.rep * POINT_YEN;
    const r2Rows = [
      ['初診・訪問診療', r.useTier.new, r.avgNew, r2NewMonthly],
      ['再診',         r.useTier.rep, r.avgRep, r2RepMonthly],
    ];
    rev2Body.innerHTML = r2Rows.map(([label, pt, cnt, monthly]) => `
      <tr>
        <td class="px-3 py-2">${label}</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${pt}点</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num1.format(cnt)}</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(monthly))}</td>
      </tr>
    `).join('') + `
      <tr class="bg-slate-50 font-medium">
        <td class="px-3 py-2" colspan="3">月額合計</td>
        <td class="px-3 py-2 text-right font-mono tabular-nums">${num.format(Math.round(r.rev2Monthly))}</td>
      </tr>`;
  } else {
    tierLabelEl.textContent = '';
    const msg = r.input.revType === '1-and-2'
      ? '左の区分テーブルから区分を選択してください'
      : '「(Ⅰ)+(Ⅱ)を算定」を選択し区分を選ぶと表示されます';
    rev2Body.innerHTML = `<tr><td class="px-3 py-2" colspan="4"><span class="text-slate-400">${msg}</span></td></tr>`;
  }

  // 手当原資計算過程
  const perStaffStep = r.input.hasStaff
    ? `1人あたりベースアップ額（月額）：${num.format(Math.round(r.allowanceMonthly))} ÷ ${r.input.staffCount} 人 ＝ <span class="font-mono font-semibold text-emerald-700">${num.format(Math.round(r.allowancePerStaff))} 円/月</span>`
    : `1人あたりベースアップ額（月額）：<span class="text-slate-400">ベースアップ対象従業員数を入力すると表示されます</span>`;
  const steps = [];
  if (r.isContinuous) {
    steps.push(`改定後 (Ⅰ)＋(Ⅱ) 月額：<span class="font-mono">${num.format(Math.round(r.grossMonthly))} 円</span>`);
    steps.push(`改定前 (Ⅰ)＋(Ⅱ) 月額（控除）：<span class="font-mono text-rose-700">− ${num.format(Math.round(r.priorTotalMonthly))} 円</span>`);
    steps.push(`月間想定増収額（純増分）：<span class="font-mono font-semibold">${num.format(Math.round(r.totalMonthly))} 円</span>`);
  } else {
    steps.push(`月間想定増収額 (Ⅰ+Ⅱ)：<span class="font-mono font-semibold">${num.format(Math.round(r.totalMonthly))} 円</span>`);
  }
  steps.push(`事業主負担の社会保険料増（16.5%）：<span class="font-mono">${num.format(Math.round(r.welfareCost))} 円</span>`);
  steps.push(`手当原資（月額）：${num.format(Math.round(r.totalMonthly))} ÷ 1.165 ＝ <span class="font-mono font-semibold text-emerald-700">${num.format(Math.round(r.allowanceMonthly))} 円</span>`);
  steps.push(perStaffStep);
  $('allow-steps').innerHTML = steps.map((s, i) => `
    <li class="flex gap-2">
      <span class="mt-0.5 grid h-5 w-5 flex-none place-content-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-800">${i + 1}</span>
      <span>${s}</span>
    </li>`).join('');

  renderTierTable(r);
  renderPriorTierTable(r);
}

function onCalc() {
  const input = readInputs();
  renderAverages();
  if (!input.anyCount) {
    renderIncomplete();
    saveState();
    return;
  }
  const result = calculate(input);
  render(result);
  saveState();
}

// 3か月平均は、入力済みの欄だけで算出して表示する（全て空欄なら「―」）
function renderAverages() {
  const display = (ids, elId) => {
    const any = ids.some(id => $(id).value.trim() !== '');
    $(elId).textContent = any ? num1.format(avgOfFilled(ids)) : '―';
  };
  display(COUNT_NEW_IDS,   'avg-new');
  display(COUNT_REP_IDS,   'avg-rep');
  display(COUNT_HOME1_IDS, 'avg-home1');
  display(COUNT_HOME2_IDS, 'avg-home2');
}

// 必須項目が未入力のときの表示（結果を伏せて案内を出す）
function renderIncomplete() {
  $('result-notice').classList.remove('hidden');

  ['r-formula-new','r-formula-rep','r-formula-home1','r-formula-home2'].forEach(id => {
    const el = $(id);
    if (el) { el.innerHTML = '―'; el.classList.add('text-slate-400'); }
  });
  const priorBlock = $('prior-formula-block');
  if (priorBlock) priorBlock.classList.add('hidden');
  ['r-formula-prior-new','r-formula-prior-rep','r-formula-prior-home1','r-formula-prior-home2'].forEach(id => {
    const el = $(id);
    if (el) { el.innerHTML = '―'; el.classList.add('text-slate-400'); }
  });

  ['r-rev1-monthly', 'r-rev2-monthly', 'r-gross-monthly', 'r-prior-monthly',
   'r-total-monthly', 'r-total-yearly',
   'r-allow-base', 'r-welfare', 'r-allowance', 'r-allowance-yearly',
   'r-allowance-per', 'r-allowance-per-yearly'].forEach(id => { $(id).textContent = '― 円'; });
  $('r-staff-display').textContent = '―';
  $('r-tier-badge') && $('r-tier-badge').classList.add('hidden');

  $('rev1-breakdown').innerHTML = '<tr><td class="px-3 py-2" colspan="4"><span class="text-slate-400">①の算定回数を入力すると表示されます</span></td></tr>';
  $('rev2-breakdown').innerHTML = '<tr><td class="px-3 py-2" colspan="4"><span class="text-slate-400">①の算定回数を入力すると表示されます</span></td></tr>';
  $('rev2-tier-label').textContent = '';
  $('allow-steps').innerHTML = '<li class="text-slate-400">①の算定回数を入力すると表示されます</li>';

  $('tier-table-wrap').innerHTML = `<div class="rounded-md bg-slate-50 p-4 text-center text-sm text-slate-500">
    ①の回数を入力すると、区分ごとの金額が表示されます。
  </div>`;

  // 改定前セクションも非表示
  const ps = $('prior-tier-selector');
  if (ps) { ps.classList.add('hidden', 'no-print'); }
  $('prior-tier-table-wrap').innerHTML = '';
}

function onReset() {
  selectedTierId = null;
  selectedPriorTierId = null;
  clearState();
  // すべての入力欄を空欄に戻す
  [...COUNT_IDS, 'staff-count'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  const rev1 = document.querySelector('input[name="rev-type"][value="1-only"]');
  const raise = document.querySelector('input[name="raise-type"][value="continuous"]');
  if (rev1) rev1.checked = true;
  if (raise) raise.checked = true;
  onCalc();
}

document.addEventListener('DOMContentLoaded', () => {
  $('calc-btn').addEventListener('click', onCalc);
  $('reset-btn').addEventListener('click', onReset);
  $('print-btn').addEventListener('click', () => window.print());

  // 数値入力欄ごとに input/change を直接リッスン
  [...COUNT_IDS, 'staff-count'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input',  onCalc);
    el.addEventListener('change', onCalc);
  });

  // ラジオ変更時は手動選択をクリアして再計算
  document.querySelectorAll('input[name="rev-type"], input[name="raise-type"]')
    .forEach(el => el.addEventListener('change', () => {
      selectedTierId = null;
      selectedPriorTierId = null;
      onCalc();
    }));

  // Enterで再計算
  $('sim-form').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      onCalc();
    }
  });

  // 印刷時は計算詳細を一時的に開く
  window.addEventListener('beforeprint', () => {
    const d = $('detail-disclosure');
    if (d) { d.dataset.wasOpen = d.open ? '1' : '0'; d.style.height = ''; d.open = true; }
  });
  window.addEventListener('afterprint', () => {
    const d = $('detail-disclosure');
    if (d && d.dataset.wasOpen === '0') d.open = false;
  });

  setupDetailsAnimation($('detail-disclosure'));

  loadState();
  onCalc();
});

// <details> の開閉を高さアニメーションさせる
function setupDetailsAnimation(details) {
  if (!details) return;
  const summary = details.querySelector('summary');
  const body = details.querySelector('.details-body');
  if (!summary || !body) return;

  const DURATION = 320;
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
  let animation = null;
  let isClosing = false;
  let isExpanding = false;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  summary.addEventListener('click', (e) => {
    e.preventDefault();
    if (reduceMotion.matches) { details.open = !details.open; return; }
    details.style.overflow = 'hidden';
    if (isClosing || !details.open) {
      open();
    } else if (isExpanding || details.open) {
      shrink();
    }
  });

  function open() {
    details.style.height = `${details.offsetHeight}px`;
    details.open = true;
    window.requestAnimationFrame(expand);
  }

  function expand() {
    isExpanding = true;
    const start = `${details.offsetHeight}px`;
    const end = `${summary.offsetHeight + body.offsetHeight}px`;
    if (animation) animation.cancel();
    animation = details.animate({ height: [start, end] }, { duration: DURATION, easing: EASING });
    body.animate(
      { opacity: [0, 1], transform: ['translateY(-8px)', 'translateY(0)'] },
      { duration: DURATION, easing: EASING }
    );
    animation.onfinish = () => finish(true);
    animation.oncancel = () => { isExpanding = false; };
  }

  function shrink() {
    isClosing = true;
    const start = `${details.offsetHeight}px`;
    const end = `${summary.offsetHeight}px`;
    if (animation) animation.cancel();
    animation = details.animate({ height: [start, end] }, { duration: DURATION, easing: EASING });
    body.animate(
      { opacity: [1, 0], transform: ['translateY(0)', 'translateY(-8px)'] },
      { duration: DURATION, easing: EASING }
    );
    animation.onfinish = () => finish(false);
    animation.oncancel = () => { isClosing = false; };
  }

  function finish(isOpen) {
    details.open = isOpen;
    animation = null;
    isClosing = isExpanding = false;
    details.style.height = details.style.overflow = '';
  }
}
