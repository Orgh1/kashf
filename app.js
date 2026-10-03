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

    var pays = Array.isArray(st.p) ? st.p : [];
    var wa = waNumber(st.sp);
    if (pays.length || wa) {
      var pay = el('section', 'pay');
      pay.appendChild(el('h2', null, 'طرق الدفع'));
      pays.forEach(function (p) {
        var row = el('div', 'channel');
        var info = el('div', 'info');
        info.appendChild(el('p', 'name', p[0]));
        var no = el('p', 'no', p[1]);
        no.dir = 'ltr';
        info.appendChild(no);
        if (p[2]) info.appendChild(el('p', 'holder', 'باسم ' + p[2]));
        row.appendChild(info);
        row.appendChild(copyButton(String(p[1])));
        pay.appendChild(row);
      });
      if (wa) {
        var msg = 'مرحباً، أنا ' + st.n + '. حوّلت دفعة على حسابي'
          + (bal.tone === 'owe' ? ' (الرصيد ' + bal.amount + ' ' + st.c + ')' : '')
          + ' — أرفقت صورة التحويل.';
        var a = el('a', 'sent', 'أرسلت تحويلاً — أبلغ المحل');
        a.href = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(msg);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        pay.appendChild(a);
        pay.appendChild(el('p', 'hint', 'أرفق صورة إيصال التحويل في المحادثة.'));
      }
      main.appendChild(pay);
    }

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
