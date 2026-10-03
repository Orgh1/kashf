// فك رابط «كشف حساب إلكتروني» من «دفتر الدين».
//
// الرابط: …/#1.<المفتاح>.<المشفَّر>  — كلاهما base64url.
// المشفَّر = nonce (12 بايت) + AES-GCM-128(zlib(JSON)) + وسم GCM (16 بايت).
// هذا الجزء من الرابط لا يُرسل لأي سيرفر: الفك كله هنا في المتصفح.
(function (root) {
  'use strict';

  function fromB64url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function inflate(bytes) {
    var stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('deflate'));
    return await new Response(stream).text();
  }

  // يعيد الكشف (كائن) أو يرمي Error برسالة عربية للزبون.
  async function decode(fragment) {
    var f = (fragment || '').replace(/^#/, '');
    var parts = f.split('.');
    if (parts.length !== 3 || parts[0] !== '1') {
      throw new Error('الرابط ناقص — افتحه كما وصلك كاملاً');
    }
    if (!root.crypto || !root.crypto.subtle || typeof DecompressionStream === 'undefined') {
      throw new Error('المتصفح قديم — حدّثه أو افتح الرابط في Chrome');
    }
    var key, data;
    try {
      key = fromB64url(parts[1]);
      data = fromB64url(parts[2]);
    } catch (e) {
      throw new Error('الرابط تالف — اطلب رابطاً جديداً من المحل');
    }
    if (data.length < 12 + 16) throw new Error('الرابط تالف — اطلب رابطاً جديداً من المحل');
    var plain;
    try {
      var k = await root.crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['decrypt']);
      plain = await root.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: data.slice(0, 12) }, k, data.slice(12));
    } catch (e) {
      // GCM: أي تغيير في الرابط يفشل هنا
      throw new Error('الرابط تالف أو مُعدَّل — اطلب رابطاً جديداً من المحل');
    }
    var st = JSON.parse(await inflate(new Uint8Array(plain)));
    if (st.v !== 1) throw new Error('نسخة كشف غير معروفة — حدّث الصفحة');
    return st;
  }

  root.Kashf = { decode: decode };
})(typeof window !== 'undefined' ? window : globalThis);
