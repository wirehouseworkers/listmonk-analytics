/* listmonk-analytics — dashboard (S12 overview + S13 campaign detail)
 *
 * Data-first vanilla JS. No build step, no framework, no storage APIs.
 * Hash routing: "#/"        → overview (GET /api/campaigns)
 *               "#/c/{id}"  → campaign detail, wiring the per-campaign
 *                             endpoints /opens /clicks /links /curve /bounces.
 *
 * Correctness notes mirrored from the backend:
 *  - Rates use campaigns.sent as the denominator; sent = 0 → "—".
 *  - Headline open/click use UNIQUE counts. When individual tracking is off,
 *    unique counts are unavailable; we fall back to TOTAL counts, labelled,
 *    rather than showing blanks or a misleading 0%.
 *  - Complaints are shown separately from soft/hard bounces, never merged.
 */
(function () {
  'use strict';

  // ---- formatting helpers ----
  var nf = new Intl.NumberFormat('en-US');
  function fmtInt(n) { return (n === null || n === undefined) ? '—' : nf.format(n); }
  function fmtPct(r) { return (r === null || r === undefined) ? '—' : (r * 100).toFixed(2) + '%'; }
  function fmtRatio(r) { return (r === null || r === undefined) ? '—' : r.toFixed(2) + '×'; }
  function fmtDate(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fmtDateTime(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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

  function fetchJSON(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } }).then(function (res) {
      if (res.status === 404) { var e = new Error('not found'); e.notFound = true; throw e; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  // Build a kpi card element (shared by overview and detail).
  function card(label, value, sub, subClass, variant) {
    var d = document.createElement('div');
    d.className = 'kpi' + (variant ? ' ' + variant : '');
    var l = document.createElement('div'); l.className = 'kpi-label'; l.textContent = label;
    var v = document.createElement('div');
    v.className = 'kpi-value' + (value === '—' ? ' is-muted' : '');
    v.textContent = value;
    var s = document.createElement('div'); s.className = 'kpi-sub' + (subClass ? ' ' + subClass : ''); s.textContent = sub;
    d.appendChild(l); d.appendChild(v); d.appendChild(s);
    return d;
  }

  // =====================================================================
  //  OVERVIEW
  // =====================================================================
  var overviewRows = [];      // cached campaign rows, also used to enrich detail
  var overviewMeta = '';      // topbar meta string for the overview
  var overviewLoaded = false;

  fetchJSON('/api/campaigns')
    .then(function (data) {
      overviewRows = (data && data.campaigns) || [];
      overviewLoaded = true;
      renderOverview(overviewRows);
      route(); // re-route now that data exists (handles deep links)
    })
    .catch(function (err) {
      el('kpi-loading').textContent = 'Metrics unavailable.';
      el('table-loading').hidden = true;
      var e = el('table-error');
      e.hidden = false;
      e.textContent = 'Could not load campaigns: ' + err.message;
    });

  function uniqueUnavailable(rows, uniqueKey, totalKey) {
    var allNull = true, sumU = 0, sumT = 0;
    for (var i = 0; i < rows.length; i++) {
      if (typeof rows[i][uniqueKey] === 'number') { allNull = false; sumU += rows[i][uniqueKey]; }
      if (typeof rows[i][totalKey] === 'number') { sumT += rows[i][totalKey]; }
    }
    if (allNull) return true;
    return sumT > 0 && sumU === 0;
  }

  function renderOverview(rows) {
    var sent = sum(rows, 'sent');
    var openUnavail = uniqueUnavailable(rows, 'unique_opens', 'total_opens');
    var clickUnavail = uniqueUnavailable(rows, 'unique_clicks', 'total_clicks');
    var bouncesNull = rows.length > 0 && rows.every(function (r) { return r.bounces === null || r.bounces === undefined; });

    var openNum = sum(rows, openUnavail ? 'total_opens' : 'unique_opens');
    var clickNum = sum(rows, clickUnavail ? 'total_clicks' : 'unique_clicks');
    var bounceNum = sum(rows, 'bounces');
    var complaintNum = sum(rows, 'complaints');

    var openRate = sent > 0 ? openNum / sent : null;
    var clickRate = sent > 0 ? clickNum / sent : null;
    var bounceRate = (sent > 0 && !bouncesNull) ? bounceNum / sent : null;
    var complaintRate = (sent > 0 && !bouncesNull) ? complaintNum / sent : null;

    renderBanner('banner', openUnavail || clickUnavail);
    renderOverviewKPIs({
      count: rows.length, sent: sent,
      openRate: openRate, openUnavail: openUnavail, openNum: openNum,
      clickRate: clickRate, clickUnavail: clickUnavail, clickNum: clickNum,
      bounceRate: bounceRate, complaintRate: complaintRate,
      bounceNum: bounceNum, complaintNum: complaintNum, bouncesNull: bouncesNull
    });
    renderTable(rows, { openUnavail: openUnavail, clickUnavail: clickUnavail });

    overviewMeta = fmtInt(rows.length) + ' campaigns · ' + fmtInt(sent) + ' sent';
  }

  function renderBanner(id, trackingOff) {
    var b = el(id);
    if (!trackingOff) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = '<strong>Individual tracking appears to be off.</strong> ' +
      'Unique open/click metrics are unavailable, so figures shown are based on ' +
      'total events (every open/click counted), not unique subscribers.';
  }

  function renderOverviewKPIs(k) {
    var openLabel = k.openUnavail ? 'Open rate (total)' : 'Open rate';
    var clickLabel = k.clickUnavail ? 'Click rate (total)' : 'Click rate';
    var openSub = k.openUnavail ? 'unique unavailable — total opens ' + fmtInt(k.openNum) : 'unique opens ' + fmtInt(k.openNum);
    var clickSub = k.clickUnavail ? 'unique unavailable — total clicks ' + fmtInt(k.clickNum) : 'unique clicks ' + fmtInt(k.clickNum);

    var cards = [
      card('Campaigns', fmtInt(k.count), 'regular, optin excluded', '', ''),
      card('Total sent', fmtInt(k.sent), 'messages delivered', '', ''),
      card(openLabel, fmtPct(k.openRate), openSub, '', 'accent'),
      card(clickLabel, fmtPct(k.clickRate), clickSub, '', 'accent'),
      card('Bounce rate', k.bouncesNull ? '—' : fmtPct(k.bounceRate),
        k.bouncesNull ? 'bounces unavailable' : 'soft + hard · ' + fmtInt(k.bounceNum), 'warn', ''),
      card('Complaint rate', k.bouncesNull ? '—' : fmtPct(k.complaintRate),
        k.bouncesNull ? 'kept separate from bounces' : 'spam reports · ' + fmtInt(k.complaintNum),
        (k.complaintRate && k.complaintRate > 0) ? 'bad' : '', '')
    ];
    var grid = el('kpi-grid');
    grid.innerHTML = '';
    cards.forEach(function (c) { grid.appendChild(c); });
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

  function renderTable(rows, flags) {
    el('table-loading').hidden = true;
    if (!rows.length) { el('table-empty').hidden = false; return; }
    el('table-wrap').hidden = false;
    el('table-note').textContent =
      (flags.openUnavail || flags.clickUnavail) ? 'rates are total-based' : 'unique-based rates · click a row for detail';
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

  function cmpNonNull(x, y, key) {
    if (key === 'sent_date') { x = new Date(x).getTime(); y = new Date(y).getTime(); }
    if (typeof x === 'string') { x = x.toLowerCase(); y = y.toLowerCase(); }
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function sortAndPaint() {
    var rows = overviewRows.slice();
    var key = sortState.key, dir = sortState.dir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var x = a[key], y = b[key];
      var xn = (x === null || x === undefined), yn = (y === null || y === undefined);
      if (xn && yn) return a.id < b.id ? -1 : 1;
      if (xn) return 1;          // nulls always last, independent of direction
      if (yn) return -1;
      var c = cmpNonNull(x, y, key);
      if (c !== 0) return c * dir;
      return a.id < b.id ? -1 : 1;
    });
    var body = el('ctable-body');
    body.innerHTML = '';
    rows.forEach(function (r) { body.appendChild(rowEl(r)); });
  }

  function rowEl(r) {
    var tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.addEventListener('click', function () { location.hash = '#/c/' + r.id; });

    var name = document.createElement('td');
    name.className = 'name';
    name.textContent = r.name || '(untitled)';
    var sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = '#' + r.id;
    name.appendChild(sub);
    tr.appendChild(name);

    var st = document.createElement('td');
    st.appendChild(statusPill(r.status));
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

  function statusPill(status) {
    var pill = document.createElement('span');
    pill.className = 'pill ' + (status || '');
    pill.textContent = status || '—';
    return pill;
  }

  function numCell(text) {
    var td = document.createElement('td');
    td.className = 'num';
    if (text === '—') td.classList.add('dash');
    td.textContent = text;
    return td;
  }

  // =====================================================================
  //  ROUTER
  // =====================================================================
  function currentRoute() {
    var h = location.hash || '';
    var m = h.match(/^#\/c\/(\d+)/);
    if (m) return { view: 'detail', id: parseInt(m[1], 10) };
    if (h === '#/lists') return { view: 'lists' };
    return { view: 'overview' };
  }

  function route() {
    var r = currentRoute();
    el('nav-overview').classList.remove('is-active');
    el('nav-lists').classList.remove('is-active');

    if (r.view === 'detail') {
      el('view-overview').hidden = true;
      el('view-lists').hidden = true;
      el('view-detail').hidden = false;
      window.scrollTo(0, 0);
      loadDetail(r.id);
    } else if (r.view === 'lists') {
      el('view-overview').hidden = true;
      el('view-detail').hidden = true;
      el('view-lists').hidden = false;
      el('nav-lists').classList.add('is-active');
      el('topbar-meta').textContent = '';
      destroyChart();
      window.scrollTo(0, 0);
      loadListsView();
    } else {
      el('view-detail').hidden = true;
      el('view-lists').hidden = true;
      el('view-overview').hidden = false;
      el('nav-overview').classList.add('is-active');
      el('topbar-meta').textContent = overviewMeta;
      destroyChart();
      window.scrollTo(0, 0);
    }
  }
  window.addEventListener('hashchange', route);
  route(); // initial (overview data may still be loading; re-routed on load)

  // =====================================================================
  //  CAMPAIGN DETAIL
  // =====================================================================
  var detailReq = 0;       // guards against stale responses on fast navigation
  var chart = null;

  function destroyChart() {
    if (chart) { chart.destroy(); chart = null; }
  }

  function cachedRow(id) {
    for (var i = 0; i < overviewRows.length; i++) { if (overviewRows[i].id === id) return overviewRows[i]; }
    return null;
  }

  function loadDetail(id) {
    var token = ++detailReq;
    destroyChart();
    el('detail-error').hidden = true;
    el('detail-body').hidden = true;
    el('curve-panel').hidden = true;
    el('links-panel').hidden = true;
    el('bounce-panel').hidden = true;
    el('detail-banner').hidden = true;
    el('detail-loading').hidden = false;
    el('detail-name').textContent = 'Campaign #' + id;
    el('detail-meta').textContent = '';

    Promise.all([
      fetchJSON('/api/campaigns/' + id + '/opens'),
      fetchJSON('/api/campaigns/' + id + '/clicks'),
      fetchJSON('/api/campaigns/' + id + '/links'),
      fetchJSON('/api/campaigns/' + id + '/curve'),
      fetchJSON('/api/campaigns/' + id + '/bounces')
    ]).then(function (res) {
      if (token !== detailReq) return; // a newer navigation superseded this one
      renderDetail(id, { opens: res[0], clicks: res[1], links: res[2], curve: res[3], bounces: res[4] });
    }).catch(function (err) {
      if (token !== detailReq) return;
      el('detail-loading').hidden = true;
      var e = el('detail-error');
      e.hidden = false;
      e.textContent = err.notFound
        ? 'Campaign not found (it may be an opt-in campaign, which is excluded, or it does not exist).'
        : 'Could not load campaign: ' + err.message;
    });
  }

  function renderDetail(id, d) {
    el('detail-loading').hidden = true;

    var opens = d.opens, clicks = d.clicks;
    var trackingOff = opens.individual_tracking === false;

    // Header + meta (enriched from the cached overview row when available).
    el('detail-name').textContent = opens.name || ('Campaign #' + id);
    var meta = el('detail-meta');
    meta.innerHTML = '';
    var row = cachedRow(id);
    if (row && row.status) meta.appendChild(statusPill(row.status));
    var bits = document.createElement('span');
    var sentDate = d.curve.started_at || (row && row.sent_date) || null;
    bits.textContent = fmtInt(opens.sent) + ' sent · ' + (sentDate ? fmtDateTime(sentDate) : 'not sent');
    meta.appendChild(bits);
    el('topbar-meta').textContent = (opens.name || ('#' + id));

    renderBanner('detail-banner', trackingOff);
    renderDetailKPIs(opens, clicks, trackingOff);
    renderCurve(d.curve);
    renderLinks(d.links, trackingOff);
    renderBounceCards(d.bounces);

    el('detail-body').hidden = false;
    el('curve-panel').hidden = false;
    el('links-panel').hidden = false;
    el('bounce-panel').hidden = false;
  }

  function renderDetailKPIs(opens, clicks, trackingOff) {
    // Headline tier: unique rates (or labelled total fallback) + CTOR.
    var openLabel = trackingOff ? 'Open rate (total)' : 'Open rate';
    var clickLabel = trackingOff ? 'Click rate (total)' : 'Click rate';

    var openRate = opens.open_rate;
    var clickRate = clicks.click_rate;
    var openHeadlineSub, clickHeadlineSub;
    if (trackingOff) {
      // Unique unavailable: derive a total-based rate so the card is not blank.
      openRate = (opens.sent > 0 && opens.total_opens != null) ? opens.total_opens / opens.sent : null;
      clickRate = (clicks.sent > 0 && clicks.total_clicks != null) ? clicks.total_clicks / clicks.sent : null;
      openHeadlineSub = 'unique unavailable — total opens ' + fmtInt(opens.total_opens);
      clickHeadlineSub = 'unique unavailable — total clicks ' + fmtInt(clicks.total_clicks);
    } else {
      openHeadlineSub = 'unique opens ' + fmtInt(opens.unique_opens);
      clickHeadlineSub = 'unique clicks ' + fmtInt(clicks.unique_clicks);
    }

    var headline = [
      card(openLabel, fmtPct(openRate), openHeadlineSub, '', 'accent'),
      card(clickLabel, fmtPct(clickRate), clickHeadlineSub, '', 'accent'),
      card('CTOR', fmtPct(clicks.ctor),
        trackingOff ? 'requires individual tracking' : 'unique clicks ÷ unique opens', '', 'accent')
    ];
    var hg = el('detail-headline');
    hg.innerHTML = '';
    headline.forEach(function (c) { hg.appendChild(c); });

    // Diagnostic tier (drill-down): totals + ratios.
    var diag = [
      card('Total opens', fmtInt(opens.total_opens), 're-opens included', '', 'diag'),
      card('Open ratio', fmtRatio(opens.open_ratio),
        trackingOff ? 'unavailable without tracking' : 'total ÷ unique opens', '', 'diag'),
      card('Total clicks', fmtInt(clicks.total_clicks), 'all click events', '', 'diag')
    ];
    var dg = el('detail-diag');
    dg.innerHTML = '';
    diag.forEach(function (c) { dg.appendChild(c); });
  }

  function bucketLabel(b) {
    var h = b.hours_since_send;
    if (b.width_hours === 24) return '+' + Math.round(h / 24) + 'd';
    return '+' + h + 'h';
  }

  function renderCurve(curve) {
    var note = el('curve-note');
    var empty = el('curve-empty');
    var wrap = el('curve-wrap');
    destroyChart();
    empty.hidden = true;
    wrap.hidden = true;
    note.textContent = '';

    var buckets = (curve && curve.buckets) || [];

    if (!curve.started_at) {
      empty.hidden = false;
      empty.textContent = curve.note || 'Campaign not yet sent — no engagement curve.';
      return;
    }
    if (!buckets.length) {
      empty.hidden = false;
      empty.textContent = 'No opens or clicks recorded yet for this campaign.';
      return;
    }

    note.textContent = 'since ' + fmtDateTime(curve.started_at) +
      ' · ' + fmtInt(curve.total_opens) + ' opens · ' + fmtInt(curve.total_clicks) + ' clicks';

    var labels = buckets.map(bucketLabel);
    var opens = buckets.map(function (b) { return b.opens; });
    var clicks = buckets.map(function (b) { return b.clicks; });

    wrap.hidden = false;
    var ctx = el('curve-canvas').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Opens', data: opens, yAxisID: 'y',
            borderColor: '#4338ca', backgroundColor: 'rgba(67,56,202,0.10)',
            fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
          },
          {
            label: 'Clicks', data: clicks, yAxisID: 'y1',
            borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.10)',
            fill: false, tension: 0.3, pointRadius: 2, borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: {
          x: { title: { display: true, text: 'time since send' }, grid: { display: false } },
          y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'opens' } },
          y1: {
            type: 'linear', position: 'right', beginAtZero: true,
            title: { display: true, text: 'clicks' }, grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  function renderLinks(links, trackingOff) {
    var note = el('links-note');
    var empty = el('links-empty');
    var wrap = el('links-wrap');
    var body = el('links-body');
    body.innerHTML = '';
    empty.hidden = true;
    wrap.hidden = true;

    var rows = (links && links.links) || [];
    note.textContent = trackingOff ? 'unique per link unavailable — tracking off' : '';

    if (!rows.length) {
      empty.hidden = false;
      empty.textContent = links.note || 'No links were clicked in this campaign.';
      return;
    }

    wrap.hidden = false;
    rows.forEach(function (l) {
      var tr = document.createElement('tr');
      var u = document.createElement('td');
      u.className = 'links-url';
      u.textContent = l.url;
      tr.appendChild(u);
      tr.appendChild(numCell(fmtInt(l.total_clicks)));
      tr.appendChild(numCell(fmtInt(l.unique_clicks)));
      body.appendChild(tr);
    });
  }

  function renderBounceCards(b) {
    var grid = el('bounce-kpis');
    grid.innerHTML = '';
    if (b.has_bounces === false) {
      grid.appendChild(card('Bounces', '—', b.note || 'bounce tracking unavailable', '', ''));
      return;
    }
    var cards = [
      card('Bounce rate', fmtPct(b.bounce_rate),
        'soft ' + fmtInt(b.soft_bounces) + ' · hard ' + fmtInt(b.hard_bounces) + ' = ' + fmtInt(b.bounces),
        'warn', ''),
      card('Complaint rate', fmtPct(b.complaint_rate),
        fmtInt(b.complaints) + ' spam reports · separate from bounces',
        (b.complaint_rate && b.complaint_rate > 0) ? 'bad' : '', '')
    ];
    cards.forEach(function (c) { grid.appendChild(c); });
  }

  // =====================================================================
  //  LISTS VIEW
  // =====================================================================
  var listsChart = null;
  var listsLoaded = false;

  function destroyListsChart() {
    if (listsChart) { listsChart.destroy(); listsChart = null; }
  }

  function loadListsView() {
    if (listsLoaded) return;

    el('lists-loading').hidden = false;
    el('lists-empty').hidden = true;
    el('lists-wrap').hidden = true;
    el('growth-loading').hidden = false;
    el('growth-empty').hidden = true;
    el('growth-wrap').hidden = true;
    el('growth-note').textContent = '';
    el('lists-note').textContent = '';

    Promise.all([
      fetchJSON('/api/lists'),
      fetchJSON('/api/subscribers/growth')
    ]).then(function (res) {
      renderListsTable(res[0]);
      renderGrowthChart(res[1]);
      listsLoaded = true;
    }).catch(function (err) {
      el('lists-loading').hidden = true;
      el('growth-loading').hidden = true;
      var msg = 'Could not load data: ' + err.message;
      el('lists-empty').hidden = false;
      el('lists-empty').textContent = msg;
      el('growth-empty').hidden = false;
      el('growth-empty').textContent = msg;
    });
  }

  function renderListsTable(data) {
    el('lists-loading').hidden = true;
    var lists = (data && data.lists) || [];

    if (!data.has_subscriber_lists) {
      el('lists-empty').hidden = false;
      el('lists-empty').textContent = data.note || 'Per-list counts unavailable.';
      return;
    }
    if (!lists.length) {
      el('lists-empty').hidden = false;
      el('lists-empty').textContent = 'No lists found.';
      return;
    }

    el('lists-note').textContent = fmtInt(lists.length) + ' lists';
    el('lists-wrap').hidden = false;
    var body = el('lists-body');
    body.innerHTML = '';
    lists.forEach(function (l) {
      var tr = document.createElement('tr');

      var name = document.createElement('td');
      name.className = 'name';
      name.textContent = l.name || '(untitled)';
      var sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = '#' + l.list_id;
      name.appendChild(sub);
      tr.appendChild(name);

      var st = document.createElement('td');
      var sPill = document.createElement('span');
      sPill.className = 'pill' + (l.status === 'active' ? ' finished' : '');
      sPill.textContent = l.status || '—';
      st.appendChild(sPill);
      tr.appendChild(st);

      var typ = document.createElement('td');
      var tPill = document.createElement('span');
      tPill.className = 'pill';
      tPill.textContent = l.type || '—';
      typ.appendChild(tPill);
      tr.appendChild(typ);

      var opt = document.createElement('td');
      var oPill = document.createElement('span');
      oPill.className = 'pill';
      oPill.textContent = l.optin || '—';
      opt.appendChild(oPill);
      tr.appendChild(opt);

      tr.appendChild(numCell(fmtInt(l.active_subscribers)));
      tr.appendChild(numCell(fmtInt(l.total_subscriptions)));

      var rule = document.createElement('td');
      rule.className = 'rule';
      rule.textContent = l.active_rule;
      tr.appendChild(rule);

      body.appendChild(tr);
    });
  }

  function renderGrowthChart(g) {
    el('growth-loading').hidden = true;
    var buckets = (g && g.buckets) || [];
    destroyListsChart();

    if (!buckets.length) {
      el('growth-empty').hidden = false;
      el('growth-empty').textContent = 'No subscriber growth data available.';
      return;
    }

    el('growth-note').textContent =
      (g.interval || 'day') + 'ly · ' + fmtInt(g.total) + ' total subscribers';
    el('growth-wrap').hidden = false;

    var labels = buckets.map(function (b) {
      var d = new Date(b.period);
      if (isNaN(d.getTime())) return b.period;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    });
    var counts = buckets.map(function (b) { return b.new_subscribers; });

    var ctx = el('growth-canvas').getContext('2d');
    listsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'New subscribers', data: counts, yAxisID: 'y',
            borderColor: '#4338ca', backgroundColor: 'rgba(67,56,202,0.10)',
            fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: {
          x: { title: { display: true, text: 'date' }, grid: { display: false } },
          y: { type: 'linear', position: 'left', beginAtZero: true,
               title: { display: true, text: 'new subscribers' } }
        }
      }
    });
  }

  // Keep no-serif rule inside the canvas too.
  if (window.Chart) {
    Chart.defaults.font.family = "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    Chart.defaults.color = '#6b7280';
  }
})();
