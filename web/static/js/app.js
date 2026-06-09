/* listmonk-analytics — dashboard shell + overview (S12)
 *
 * Data-first vanilla JS. No build step, no framework, no storage APIs.
 * Wires the overview to GET /api/campaigns (the S04 comparison endpoint),
 * computes top-line KPIs, and renders a sortable campaign table.
 *
 * Correctness notes mirrored from the backend:
 *  - Rates use campaigns.sent as the denominator; sent = 0 → "—".
 *  - Headline open/click use UNIQUE counts. When individual tracking is off,
 *    unique counts are unavailable; we fall back to TOTAL counts, labelled,
 *    rather than showing blanks or a misleading 0%.
 */
(function () {
  'use strict';

  // ---- formatting helpers ----
  var nf = new Intl.NumberFormat('en-US');
  function fmtInt(n) { return (n === null || n === undefined) ? '—' : nf.format(n); }
  function fmtPct(r) { return (r === null || r === undefined) ? '—' : (r * 100).toFixed(2) + '%'; }
  function fmtDate(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function sum(rows, key) {
    var t = 0;
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i][key];
      if (typeof v === 'number') t += v;
    }
    return t;
  }
  function el(id) { return document.getElementById(id); }

  // ---- load ----
  fetch('/api/campaigns', { headers: { 'Accept': 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var rows = (data && data.campaigns) || [];
      render(rows);
    })
    .catch(function (err) {
      showError('Could not load campaigns: ' + err.message);
    });

  function showError(msg) {
    el('kpi-loading').textContent = 'Metrics unavailable.';
    el('table-loading').hidden = true;
    var e = el('table-error');
    e.hidden = false;
    e.textContent = msg;
  }

  // ---- aggregate availability detection ----
  // Unique metrics are "unavailable" when no campaign carries a unique count
  // (campaign_views/links absent) OR when totals exist but every unique count
  // is zero — the signature of individual tracking being off.
  function uniqueUnavailable(rows, uniqueKey, totalKey) {
    var allNull = true, sumU = 0, sumT = 0;
    for (var i = 0; i < rows.length; i++) {
      if (typeof rows[i][uniqueKey] === 'number') { allNull = false; sumU += rows[i][uniqueKey]; }
      if (typeof rows[i][totalKey] === 'number') { sumT += rows[i][totalKey]; }
    }
    if (allNull) return true;
    return sumT > 0 && sumU === 0;
  }

  function render(rows) {
    var sent = sum(rows, 'sent');

    var openUnavail = uniqueUnavailable(rows, 'unique_opens', 'total_opens');
    var clickUnavail = uniqueUnavailable(rows, 'unique_clicks', 'total_clicks');
    var bouncesNull = rows.length > 0 && rows.every(function (r) { return r.bounces === null || r.bounces === undefined; });

    // Numerators: unique when available, else total (labelled).
    var openNum = sum(rows, openUnavail ? 'total_opens' : 'unique_opens');
    var clickNum = sum(rows, clickUnavail ? 'total_clicks' : 'unique_clicks');
    var bounceNum = sum(rows, 'bounces');
    var complaintNum = sum(rows, 'complaints');

    var openRate = sent > 0 ? openNum / sent : null;
    var clickRate = sent > 0 ? clickNum / sent : null;
    var bounceRate = (sent > 0 && !bouncesNull) ? bounceNum / sent : null;
    var complaintRate = (sent > 0 && !bouncesNull) ? complaintNum / sent : null;

    renderBanner(openUnavail || clickUnavail);
    renderKPIs({
      count: rows.length,
      sent: sent,
      openRate: openRate, openUnavail: openUnavail, openNum: openNum,
      clickRate: clickRate, clickUnavail: clickUnavail, clickNum: clickNum,
      bounceRate: bounceRate, complaintRate: complaintRate,
      bounceNum: bounceNum, complaintNum: complaintNum, bouncesNull: bouncesNull
    });
    renderTable(rows, { openUnavail: openUnavail, clickUnavail: clickUnavail });

    el('topbar-meta').textContent = fmtInt(rows.length) + ' campaigns · ' + fmtInt(sent) + ' sent';
  }

  function renderBanner(trackingOff) {
    var b = el('banner');
    if (!trackingOff) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = '<strong>Individual tracking appears to be off.</strong> ' +
      'Unique open/click metrics are unavailable, so rates below are based on ' +
      'total events (every open/click counted), not unique subscribers.';
  }

  function renderKPIs(k) {
    var openLabel = k.openUnavail ? 'Open rate (total)' : 'Open rate';
    var clickLabel = k.clickUnavail ? 'Click rate (total)' : 'Click rate';
    var openSub = k.openUnavail
      ? 'unique unavailable — total opens ' + fmtInt(k.openNum)
      : 'unique opens ' + fmtInt(k.openNum);
    var clickSub = k.clickUnavail
      ? 'unique unavailable — total clicks ' + fmtInt(k.clickNum)
      : 'unique clicks ' + fmtInt(k.clickNum);

    var cards = [
      card('Campaigns', fmtInt(k.count), 'regular, optin excluded', '', false),
      card('Total sent', fmtInt(k.sent), 'messages delivered', '', false),
      card(openLabel, fmtPct(k.openRate), openSub, '', true),
      card(clickLabel, fmtPct(k.clickRate), clickSub, '', true),
      card('Bounce rate',
        k.bouncesNull ? '—' : fmtPct(k.bounceRate),
        k.bouncesNull ? 'bounces unavailable' : 'soft + hard · ' + fmtInt(k.bounceNum),
        'warn', false),
      card('Complaint rate',
        k.bouncesNull ? '—' : fmtPct(k.complaintRate),
        k.bouncesNull ? 'kept separate from bounces' : 'spam reports · ' + fmtInt(k.complaintNum),
        (k.complaintRate && k.complaintRate > 0) ? 'bad' : '', false)
    ];

    var grid = el('kpi-grid');
    grid.innerHTML = '';
    cards.forEach(function (c) { grid.appendChild(c); });
  }

  function card(label, value, sub, subClass, accent) {
    var d = document.createElement('div');
    d.className = 'kpi' + (accent ? ' accent' : '');
    var v = document.createElement('div');
    v.className = 'kpi-value' + (value === '—' ? ' is-muted' : '');
    v.textContent = value;
    var l = document.createElement('div'); l.className = 'kpi-label'; l.textContent = label;
    var s = document.createElement('div'); s.className = 'kpi-sub' + (subClass ? ' ' + subClass : ''); s.textContent = sub;
    d.appendChild(l); d.appendChild(v); d.appendChild(s);
    return d;
  }

  // ---- sortable campaign table ----
  var COLUMNS = [
    { key: 'name', label: 'Campaign', num: false },
    { key: 'status', label: 'Status', num: false },
    { key: 'sent', label: 'Sent', num: true },
    { key: 'open_rate', label: 'Open rate', num: true },
    { key: 'click_rate', label: 'Click rate', num: true },
    { key: 'bounce_rate', label: 'Bounce', num: true },
    { key: 'complaint_rate', label: 'Complaint', num: true },
    { key: 'sent_date', label: 'Sent date', num: false }
  ];
  var sortState = { key: 'sent_date', dir: 'desc' };
  var tableRows = [];
  var tableFlags = {};

  function renderTable(rows, flags) {
    tableRows = rows;
    tableFlags = flags;
    el('table-loading').hidden = true;

    if (!rows.length) { el('table-empty').hidden = false; return; }

    el('table-wrap').hidden = false;
    el('table-note').textContent =
      (flags.openUnavail ? 'open/' : '') + (flags.clickUnavail ? 'click ' : '') +
      (flags.openUnavail || flags.clickUnavail ? 'rates are total-based' : 'unique-based rates');

    buildHead();
    sortAndPaint();
  }

  function buildHead() {
    var tr = el('ctable-head');
    tr.innerHTML = '';
    COLUMNS.forEach(function (col) {
      var th = document.createElement('th');
      if (col.num) th.className = 'num';
      th.textContent = col.label;
      if (col.key === sortState.key) {
        var a = document.createElement('span');
        a.className = 'arrow';
        a.textContent = sortState.dir === 'asc' ? ' ▲' : ' ▼';
        th.appendChild(a);
      }
      th.addEventListener('click', function () {
        if (sortState.key === col.key) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
          sortState.key = col.key;
          sortState.dir = col.num ? 'desc' : 'asc';
        }
        buildHead();
        sortAndPaint();
      });
      tr.appendChild(th);
    });
  }

  // cmpNonNull compares two present (non-null) values for the given key.
  function cmpNonNull(x, y, key) {
    if (key === 'sent_date') { x = new Date(x).getTime(); y = new Date(y).getTime(); }
    if (typeof x === 'string') {
      x = x.toLowerCase(); y = y.toLowerCase();
    }
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function sortAndPaint() {
    var rows = tableRows.slice();
    var key = sortState.key, dir = sortState.dir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var x = a[key], y = b[key];
      var xn = (x === null || x === undefined), yn = (y === null || y === undefined);
      // Nulls always sort last, independent of sort direction.
      if (xn && yn) return a.id < b.id ? -1 : 1;
      if (xn) return 1;
      if (yn) return -1;
      var c = cmpNonNull(x, y, key);
      if (c !== 0) return c * dir;
      return a.id < b.id ? -1 : 1; // stable-ish tiebreak by id
    });

    var body = el('ctable-body');
    body.innerHTML = '';
    rows.forEach(function (r) { body.appendChild(rowEl(r)); });
  }

  function rowEl(r) {
    var tr = document.createElement('tr');

    var name = document.createElement('td');
    name.className = 'name';
    name.textContent = r.name || '(untitled)';
    var sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = '#' + r.id;
    name.appendChild(sub);
    tr.appendChild(name);

    var st = document.createElement('td');
    var pill = document.createElement('span');
    pill.className = 'pill ' + (r.status || '');
    pill.textContent = r.status || '—';
    st.appendChild(pill);
    tr.appendChild(st);

    tr.appendChild(numCell(fmtInt(r.sent)));
    tr.appendChild(numCell(fmtPct(r.open_rate)));
    tr.appendChild(numCell(fmtPct(r.click_rate)));
    tr.appendChild(numCell(fmtPct(r.bounce_rate)));
    tr.appendChild(numCell(fmtPct(r.complaint_rate)));

    var dt = document.createElement('td');
    dt.textContent = fmtDate(r.sent_date);
    if (!r.sent_date) dt.className = 'dash';
    tr.appendChild(dt);

    return tr;
  }

  function numCell(text) {
    var td = document.createElement('td');
    td.className = 'num';
    if (text === '—') td.classList.add('dash');
    td.textContent = text;
    return td;
  }
})();
