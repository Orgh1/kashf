// عرض الكشف. كل ما في الرابط يُعرض نصاً (textContent) لا HTML أبداً:
// رابط مزوَّر لا يستطيع حقن شيء في الصفحة.
(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }

  function money(minor) {
    var n = Math.abs(Number(minor) || 0) / 100;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function digits(s) {
    return String(s || '').replace(/[^0-9]/g, '');
  }

  // رقم واتساب المحل بمقدمة الدولة (0599… ← 972599…)
  function waNumber(phone) {
    var d = digits(phone);
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('0') === 0) d = '972' + d.slice(1);
    return d.length >= 11 && d.length <= 15 ? d : null;
  }

  function balanceText(st) {
    var b = Number(st.b) || 0;
    var supplier = st.k === 1;
    if (b === 0) return { label: 'الحساب مسدَّد', amount: '0.00', tone: 'zero' };
    var owes = supplier ? b < 0 : b > 0;
    return {
      label: supplier
        ? (owes ? 'المستحق لكم' : 'رصيد لنا عندكم')
        : (owes ? 'المستحق عليكم' : 'رصيد لكم عندنا'),
      amount: money(b),
      tone: owes ? 'owe' : 'credit'
    };
  }

  function copyButton(text) {
    var b = el('button', 'copy', 'نسخ');
    b.type = 'button';
    b.addEventListener('click', function () {
      var done = function () {
        b.textContent = 'نُسخ ✓';
        setTimeout(function () { b.textContent = 'نسخ'; }, 1500);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    });
    return b;
  }

  // باركود المحفظة: «الضلع:البتات» ← مربعات SVG (عناصر لا نص HTML)
  function qrSvg(spec) {
    var i = String(spec || '').indexOf(':');
    if (i < 0) return null;
    var n = parseInt(spec.slice(0, i), 10);
    if (!(n >= 21 && n <= 177)) return null;
    var s = spec.slice(i + 1).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin;
    try { bin = atob(s); } catch (e) { return null; }
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    var q = 3; // هامش هادئ
    svg.setAttribute('viewBox', '0 0 ' + (n + 2 * q) + ' ' + (n + 2 * q));
    svg.setAttribute('class', 'qr');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'باركود الدفع');
    var bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', n + 2 * q);
    bg.setAttribute('height', n + 2 * q);
    bg.setAttribute('fill', '#fff');
    svg.appendChild(bg);
    var d = '';
    for (var k = 0; k < n * n; k++) {
      var byte = bin.charCodeAt(k >> 3);
      if (byte & (0x80 >> (k & 7))) {
        d += 'M' + (q + (k % n)) + ' ' + (q + Math.floor(k / n)) + 'h1v1h-1z';
      }
    }
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#000');
    svg.appendChild(path);
    return svg;
  }

  function field(label, value, ltr) {
    var row = el('div', 'field');
    var info = el('div', 'info');
    info.appendChild(el('p', 'label', label));
    var v = el('p', 'value', value);
    if (ltr) v.dir = 'ltr';
    info.appendChild(v);
    row.appendChild(info);
    row.appendChild(copyButton(String(value)));
    return row;
  }

  // «150.5» أو «١٥٠» ← أغورات (أو null)
  function cents(text) {
    var t = String(text || '').replace(/[٠-٩]/g, function (c) {
      return String(c.charCodeAt(0) - 0x660);
    }).replace(/,/g, '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    var v = Math.round(parseFloat(t) * 100);
    return v > 0 ? v : null;
  }

  // ادفع الآن: يختار البوابة، يرى تفاصيلها، يكتب المبلغ، ثم يرسل الإشعار
  function paySection(st, pays, wa, bal) {
    var pay = el('section', 'pay');
    pay.appendChild(el('h2', null, 'ادفع الآن'));
    var chosen = -1;
    var list = el('div', 'gateways');
    var detail = el('div', 'gw-detail');
    var buttons = [];
    var bot = /^[A-Za-z0-9_]{5,32}$/.test(String(st.tb || '')) ? st.tb : null;
    var token = /^[A-Za-z0-9_-]{6,16}$/.test(String(st.t || '')) ? st.t : null;
    var send = el('button', 'sent',
      bot && token ? 'أرسل صورة الإشعار (تيليجرام)' : 'أرسل صورة الإشعار (واتساب)');
    send.type = 'button';
    send.disabled = pays.length > 0;

    function pick(i) {
      chosen = i;
      buttons.forEach(function (b, j) {
        b.classList.toggle('on', j === i);
        b.setAttribute('aria-pressed', j === i ? 'true' : 'false');
      });
      detail.textContent = '';
      var p = pays[i];
      if (p[1]) detail.appendChild(field('رقم الحساب', p[1], true));
      if (p[3]) detail.appendChild(field('الآيبان', p[3], true));
      if (p[4]) detail.appendChild(field('رقم الجوال', p[4], true));
      if (p[2]) detail.appendChild(el('p', 'holder', 'اسم الحساب: ' + p[2]));
      var svg = p[5] ? qrSvg(p[5]) : null;
      if (svg) {
        var box = el('div', 'qr-box');
        box.appendChild(svg);
        box.appendChild(el('p', 'hint', 'امسحه من تطبيق المحفظة'));
        detail.appendChild(box);
      }
      send.disabled = false;
    }
    pays.forEach(function (p, i) {
      var b = el('button', 'gw', p[0]);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { pick(i); });
      buttons.push(b);
      list.appendChild(b);
    });
    if (pays.length) {
      pay.appendChild(el('p', 'step', '١. اختر أين تحوّل'));
      pay.appendChild(list);
      pay.appendChild(detail);
    }

    pay.appendChild(el('p', 'step', (pays.length ? '٢. ' : '') + 'المبلغ الذي حوّلته'));
    var amount = document.createElement('input');
    amount.type = 'text';
    amount.inputMode = 'decimal';
    amount.className = 'amount-in';
    amount.dir = 'ltr';
    amount.placeholder = '0.00';
    amount.setAttribute('aria-label', 'المبلغ');
    if (bal.tone === 'owe') amount.value = bal.amount.replace(/,/g, '');
    var amountRow = el('div', 'amount-row');
    amountRow.appendChild(amount);
    amountRow.appendChild(el('span', 'cur', st.c));
    pay.appendChild(amountRow);
    var err = el('p', 'err');
    pay.appendChild(err);

    send.addEventListener('click', function () {
      var c = cents(amount.value);
      if (c === null) { err.textContent = 'اكتب المبلغ الذي حوّلته'; amount.focus(); return; }
      err.textContent = '';
      var gw = chosen >= 0 ? pays[chosen] : null;
      var url;
      if (bot && token && gw && /^[A-Za-z0-9]{4,12}$/.test(String(gw[6] || ''))) {
        url = 'https://t.me/' + bot + '?start=p_' + token + '_' + gw[6] + '_' + c.toString(36);
      } else if (wa) {
        var msg = 'مرحباً، أنا ' + st.n + '. حوّلت ' + money(c) + ' ' + st.c
          + (gw ? ' إلى ' + gw[0] : '') + ' — أرفقت صورة إشعار التحويل.';
        url = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
      } else {
        err.textContent = 'تواصل مع المحل لإرسال صورة الإشعار';
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    pay.appendChild(send);
    pay.appendChild(el('p', 'hint', bot && token
      ? 'يفتح بوت المحل في تيليجرام: أرسل فيه صورة إشعار التحويل، وتصلك رسالة عند المطابقة.'
      : 'أرفق صورة إشعار التحويل في المحادثة.'));
    return pay;
  }

  function render(st) {
    var main = document.getElementById('app');
    main.textContent = '';
    document.title = 'كشف حساب — ' + st.n;

    var head = el('header', 'head');
    head.appendChild(el('p', 'shop', st.s));
    head.appendChild(el('h1', 'who', st.n));
    head.appendChild(el('p', 'when', 'كشف حساب بتاريخ ' + st.d));
    main.appendChild(head);

    var bal = balanceText(st);
    var card = el('section', 'balance ' + bal.tone);
    card.appendChild(el('p', 'label', bal.label));
    var amt = el('p', 'amount');
    amt.appendChild(el('span', 'num', bal.amount));
    amt.appendChild(el('span', 'cur', ' ' + st.c));
    card.appendChild(amt);
    main.appendChild(card);

    var lines = Array.isArray(st.l) ? st.l : [];
    var sec = el('section', 'moves');
    var title = el('h2', null, 'الحركات');
    if (st.x) title.appendChild(el('small', null, ' (آخر ' + lines.length + ' من ' + st.x + ')'));
    sec.appendChild(title);
    if (!lines.length) {
      sec.appendChild(el('p', 'empty', 'لا حركات'));
    } else {
      var wrap = el('div', 'table-wrap');
      var table = el('table');
      var thead = el('thead');
      var hr = el('tr');
      ['التاريخ', 'البيان', st.k === 1 ? 'لكم' : 'عليكم', st.k === 1 ? 'دفعنا' : 'دفعتم', 'الرصيد']
        .forEach(function (h) { hr.appendChild(el('th', null, h)); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tb = el('tbody');
      lines.slice().reverse().forEach(function (l) {
        var tr = el('tr');
        var debit = Number(l[2]) || 0, credit = Number(l[3]) || 0;
        var supplier = st.k === 1;
        var owe = supplier ? credit : debit;
        var paid = supplier ? debit : credit;
        tr.appendChild(el('td', 'date', l[0]));
        tr.appendChild(el('td', 'desc', l[1] || (owe ? 'مشتريات' : 'دفعة')));
        tr.appendChild(el('td', 'num', owe ? money(owe) : ''));
        tr.appendChild(el('td', 'num paid', paid ? money(paid) : ''));
        tr.appendChild(el('td', 'num run', money(l[4])));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      wrap.appendChild(table);
      sec.appendChild(wrap);
    }
    main.appendChild(sec);

    // حوالات أرسلها الزبون ولم يطابقها المحل بعد: لا تُحسب من الرصيد
    var pend = Array.isArray(st.q) ? st.q : [];
    if (pend.length) {
      var ps = el('section', 'pending');
      ps.appendChild(el('h2', null, 'حوالات قيد المطابقة'));
      pend.forEach(function (q) {
        var row = el('div', 'pend-row');
        row.appendChild(el('span', 'date', q[0]));
        row.appendChild(el('span', 'gw', q[2] || ''));
        row.appendChild(el('span', 'num', money(q[1]) + ' ' + st.c));
        ps.appendChild(row);
      });
      ps.appendChild(el('p', 'hint', 'تظهر في الرصيد بعد أن يطابقها المحل.'));
      main.appendChild(ps);
    }

    var pays = Array.isArray(st.p) ? st.p.filter(function (p) {
      return p[1] || p[3] || p[4] || p[5];
    }) : [];
    var wa = waNumber(st.sp);
    // كشف المورّد: المحل هو من يدفع، فلا «ادفع الآن»
    if (st.k !== 1 && (pays.length || wa)) main.appendChild(paySection(st, pays, wa, bal));

    var foot = el('footer', 'foot');
    var pr = el('button', 'print', 'طباعة / حفظ PDF');
    pr.type = 'button';
    pr.addEventListener('click', function () { window.print(); });
    foot.appendChild(pr);
    foot.appendChild(el('p', 'note', 'هذا الكشف كما كان عند إرساله. للرصيد الأحدث اطلب كشفاً جديداً من المحل.'));
    foot.appendChild(el('p', 'brand', 'دفتر الدين · م. أسامة الغزالي'));
    main.appendChild(foot);
  }

  function fail(msg) {
    var main = document.getElementById('app');
    main.textContent = '';
    var box = el('section', 'error');
    box.appendChild(el('h1', null, 'تعذّر فتح الكشف'));
    box.appendChild(el('p', null, msg));
    main.appendChild(box);
  }

  function load() {
    if (!location.hash || location.hash.length < 10) {
      fail('افتح الرابط كما وصلك من المحل كاملاً.');
      return;
    }
    window.Kashf.decode(location.hash).then(render, function (e) {
      fail(e && e.message ? e.message : 'الرابط تالف — اطلب رابطاً جديداً من المحل');
    });
  }

  window.addEventListener('hashchange', load);
  load();
})();
