import { f as e, l as t, m as n, s as r, y as i } from "./utils-DDFejWIT.js";
import { t as a } from "./sha3-BCedV-jS.js";
import {
  A as o,
  E as s,
  O as c,
  S as l,
  _ as u,
  a as d,
  b as f,
  c as p,
  d as m,
  f as h,
  h as g,
  i as _,
  m as v,
  n as y,
  p as b,
  r as ee,
  t as te,
  u as x,
  y as S,
} from "./curve-B6R_lh-Q.js";
import { n as ne, t as re } from "./typed-data-B0hqt2-N.js";
function C(e) {
  return (
    e instanceof Uint8Array ||
    (ArrayBuffer.isView(e) && e.constructor.name === `Uint8Array`)
  );
}
function ie(e, ...t) {
  if (!C(e)) throw Error(`Uint8Array expected`);
  if (t.length > 0 && !t.includes(e.length))
    throw Error(
      `Uint8Array expected of length ` + t + `, got length=` + e.length,
    );
}
function w(e, t) {
  return Array.isArray(t)
    ? t.length === 0
      ? !0
      : e
        ? t.every((e) => typeof e == `string`)
        : t.every((e) => Number.isSafeInteger(e))
    : !1;
}
function T(e) {
  if (typeof e != `function`) throw Error(`function expected`);
  return !0;
}
function E(e, t) {
  if (typeof t != `string`) throw Error(`${e}: string expected`);
  return !0;
}
function D(e) {
  if (!Number.isSafeInteger(e)) throw Error(`invalid integer: ${e}`);
}
function O(e) {
  if (!Array.isArray(e)) throw Error(`array expected`);
}
function k(e, t) {
  if (!w(!0, t)) throw Error(`${e}: array of strings expected`);
}
function A(e, t) {
  if (!w(!1, t)) throw Error(`${e}: array of numbers expected`);
}
function j(...e) {
  let t = (e) => e,
    n = (e, t) => (n) => e(t(n));
  return {
    encode: e.map((e) => e.encode).reduceRight(n, t),
    decode: e.map((e) => e.decode).reduce(n, t),
  };
}
function M(e) {
  let t = typeof e == `string` ? e.split(``) : e,
    n = t.length;
  k(`alphabet`, t);
  let r = new Map(t.map((e, t) => [e, t]));
  return {
    encode: (r) => (
      O(r),
      r.map((r) => {
        if (!Number.isSafeInteger(r) || r < 0 || r >= n)
          throw Error(
            `alphabet.encode: digit index outside alphabet "${r}". Allowed: ${e}`,
          );
        return t[r];
      })
    ),
    decode: (t) => (
      O(t),
      t.map((t) => {
        E(`alphabet.decode`, t);
        let n = r.get(t);
        if (n === void 0) throw Error(`Unknown letter: "${t}". Allowed: ${e}`);
        return n;
      })
    ),
  };
}
function N(e = ``) {
  return (
    E(`join`, e),
    {
      encode: (t) => (k(`join.decode`, t), t.join(e)),
      decode: (t) => (E(`join.decode`, t), t.split(e)),
    }
  );
}
function P(e, t = `=`) {
  return (
    D(e),
    E(`padding`, t),
    {
      encode(n) {
        for (k(`padding.encode`, n); (n.length * e) % 8;) n.push(t);
        return n;
      },
      decode(n) {
        k(`padding.decode`, n);
        let r = n.length;
        if ((r * e) % 8)
          throw Error(
            `padding: invalid, string should have whole number of bytes`,
          );
        for (; r > 0 && n[r - 1] === t; r--)
          if (((r - 1) * e) % 8 == 0)
            throw Error(`padding: invalid, string has too much padding`);
        return n.slice(0, r);
      },
    }
  );
}
function F(e) {
  return (T(e), { encode: (e) => e, decode: (t) => e(t) });
}
function ae(e, t, n) {
  if (t < 2)
    throw Error(`convertRadix: invalid from=${t}, base cannot be less than 2`);
  if (n < 2)
    throw Error(`convertRadix: invalid to=${n}, base cannot be less than 2`);
  if ((O(e), !e.length)) return [];
  let r = 0,
    i = [],
    a = Array.from(e, (e) => {
      if ((D(e), e < 0 || e >= t)) throw Error(`invalid integer: ${e}`);
      return e;
    }),
    o = a.length;
  for (;;) {
    let e = 0,
      s = !0;
    for (let i = r; i < o; i++) {
      let o = a[i],
        c = t * e,
        l = c + o;
      if (!Number.isSafeInteger(l) || c / t !== e || l - o !== c)
        throw Error(`convertRadix: carry overflow`);
      let u = l / n;
      e = l % n;
      let d = Math.floor(u);
      if (((a[i] = d), !Number.isSafeInteger(d) || d * n + e !== l))
        throw Error(`convertRadix: carry overflow`);
      if (s) d ? (s = !1) : (r = i);
      else continue;
    }
    if ((i.push(e), s)) break;
  }
  for (let t = 0; t < e.length - 1 && e[t] === 0; t++) i.push(0);
  return i.reverse();
}
var I = (e, t) => (t === 0 ? e : I(t, e % t)),
  L = (e, t) => e + (t - I(e, t)),
  R = (() => {
    let e = [];
    for (let t = 0; t < 40; t++) e.push(2 ** t);
    return e;
  })();
function z(e, t, n, r) {
  if ((O(e), t <= 0 || t > 32)) throw Error(`convertRadix2: wrong from=${t}`);
  if (n <= 0 || n > 32) throw Error(`convertRadix2: wrong to=${n}`);
  if (L(t, n) > 32)
    throw Error(
      `convertRadix2: carry overflow from=${t} to=${n} carryBits=${L(t, n)}`,
    );
  let i = 0,
    a = 0,
    o = R[t],
    s = R[n] - 1,
    c = [];
  for (let r of e) {
    if ((D(r), r >= o))
      throw Error(`convertRadix2: invalid data word=${r} from=${t}`);
    if (((i = (i << t) | r), a + t > 32))
      throw Error(`convertRadix2: carry overflow pos=${a} from=${t}`);
    for (a += t; a >= n; a -= n) c.push(((i >> (a - n)) & s) >>> 0);
    let e = R[a];
    if (e === void 0) throw Error(`invalid carry`);
    i &= e - 1;
  }
  if (((i = (i << (n - a)) & s), !r && a >= t)) throw Error(`Excess padding`);
  if (!r && i > 0) throw Error(`Non-zero padding: ${i}`);
  return (r && a > 0 && c.push(i >>> 0), c);
}
function oe(e) {
  return (
    D(e),
    {
      encode: (t) => {
        if (!C(t)) throw Error(`radix.encode input should be Uint8Array`);
        return ae(Array.from(t), 256, e);
      },
      decode: (t) => (A(`radix.decode`, t), Uint8Array.from(ae(t, e, 256))),
    }
  );
}
function B(e, t = !1) {
  if ((D(e), e <= 0 || e > 32))
    throw Error(`radix2: bits should be in (0..32]`);
  if (L(8, e) > 32 || L(e, 8) > 32) throw Error(`radix2: carry overflow`);
  return {
    encode: (n) => {
      if (!C(n)) throw Error(`radix2.encode input should be Uint8Array`);
      return z(Array.from(n), 8, e, !t);
    },
    decode: (n) => (A(`radix2.decode`, n), Uint8Array.from(z(n, e, 8, t))),
  };
}
function se(e) {
  return (
    T(e),
    function (...t) {
      try {
        return e.apply(null, t);
      } catch {}
    }
  );
}
(j(B(4), M(`0123456789ABCDEF`), N(``)),
  j(B(5), M(`ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`), P(5), N(``)),
  j(B(5), M(`ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`), N(``)),
  j(B(5), M(`0123456789ABCDEFGHIJKLMNOPQRSTUV`), P(5), N(``)),
  j(B(5), M(`0123456789ABCDEFGHIJKLMNOPQRSTUV`), N(``)),
  j(
    B(5),
    M(`0123456789ABCDEFGHJKMNPQRSTVWXYZ`),
    N(``),
    F((e) => e.toUpperCase().replace(/O/g, `0`).replace(/[IL]/g, `1`)),
  ));
var ce =
    typeof Uint8Array.from([]).toBase64 == `function` &&
    typeof Uint8Array.fromBase64 == `function`,
  le = (e, t) => {
    E(`base64`, e);
    let n = t ? /^[A-Za-z0-9=_-]+$/ : /^[A-Za-z0-9=+/]+$/,
      r = t ? `base64url` : `base64`;
    if (e.length > 0 && !n.test(e)) throw Error(`invalid base64`);
    return Uint8Array.fromBase64(e, {
      alphabet: r,
      lastChunkHandling: `strict`,
    });
  },
  ue = ce
    ? {
        encode(e) {
          return (ie(e), e.toBase64());
        },
        decode(e) {
          return le(e, !1);
        },
      }
    : j(
        B(6),
        M(`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`),
        P(6),
        N(``),
      );
(j(
  B(6),
  M(`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/`),
  N(``),
),
  ce ||
    j(
      B(6),
      M(`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`),
      P(6),
      N(``),
    ),
  j(
    B(6),
    M(`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`),
    N(``),
  ));
var V = ((e) => j(oe(58), M(e), N(``)))(
    `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`,
  ),
  de = j(M(`qpzry9x8gf2tvdw0s3jn54khce6mua7l`), N(``)),
  fe = [996825010, 642813549, 513874426, 1027748829, 705979059];
function H(e) {
  let t = e >> 25,
    n = (e & 33554431) << 5;
  for (let e = 0; e < fe.length; e++) ((t >> e) & 1) == 1 && (n ^= fe[e]);
  return n;
}
function pe(e, t, n = 1) {
  let r = e.length,
    i = 1;
  for (let t = 0; t < r; t++) {
    let n = e.charCodeAt(t);
    if (n < 33 || n > 126) throw Error(`Invalid prefix (${e})`);
    i = H(i) ^ (n >> 5);
  }
  i = H(i);
  for (let t = 0; t < r; t++) i = H(i) ^ (e.charCodeAt(t) & 31);
  for (let e of t) i = H(i) ^ e;
  for (let e = 0; e < 6; e++) i = H(i);
  return ((i ^= n), de.encode(z([i % R[30]], 30, 5, !1)));
}
function me(e) {
  let t = e === `bech32` ? 1 : 734539939,
    n = B(5),
    r = n.decode,
    i = n.encode,
    a = se(r);
  function o(e, n, r = 90) {
    (E(`bech32.encode prefix`, e),
      C(n) && (n = Array.from(n)),
      A(`bech32.encode`, n));
    let i = e.length;
    if (i === 0) throw TypeError(`Invalid prefix length ${i}`);
    let a = i + 7 + n.length;
    if (r !== !1 && a > r) throw TypeError(`Length ${a} exceeds limit ${r}`);
    let o = e.toLowerCase(),
      s = pe(o, n, t);
    return `${o}1${de.encode(n)}${s}`;
  }
  function s(e, n = 90) {
    E(`bech32.decode input`, e);
    let r = e.length;
    if (r < 8 || (n !== !1 && r > n))
      throw TypeError(`invalid string length: ${r} (${e}). Expected (8..${n})`);
    let i = e.toLowerCase();
    if (e !== i && e !== e.toUpperCase())
      throw Error(`String must be lowercase or uppercase`);
    let a = i.lastIndexOf(`1`);
    if (a === 0 || a === -1)
      throw Error(`Letter "1" must be present between prefix and data only`);
    let o = i.slice(0, a),
      s = i.slice(a + 1);
    if (s.length < 6) throw Error(`Data must be at least 6 characters long`);
    let c = de.decode(s).slice(0, -6),
      l = pe(o, c, t);
    if (!s.endsWith(l))
      throw Error(`Invalid checksum in ${e}: expected "${l}"`);
    return { prefix: o, words: c };
  }
  let c = se(s);
  function l(e) {
    let { prefix: t, words: n } = s(e, !1);
    return { prefix: t, words: n, bytes: r(n) };
  }
  function u(e, t) {
    return o(e, i(t));
  }
  return {
    encode: o,
    decode: s,
    encodeFromBytes: u,
    decodeToBytes: l,
    decodeUnsafe: c,
    fromWords: r,
    fromWordsUnsafe: a,
    toWords: i,
  };
}
(me(`bech32`),
  me(`bech32m`),
  (typeof Uint8Array.from([]).toHex == `function` &&
    typeof Uint8Array.fromHex == `function`) ||
    j(
      B(4),
      M(`0123456789abcdef`),
      N(``),
      F((e) => {
        if (typeof e != `string` || e.length % 2 != 0)
          throw TypeError(
            `hex.decode: expected string, got ${typeof e} with length ${e.length}`,
          );
        return e.toLowerCase();
      }),
    ));
var U = BigInt(0),
  W = BigInt(1),
  he = BigInt(2),
  ge = BigInt(8),
  _e = { zip215: !0 };
function ve(e) {
  let t = y(e);
  return (
    o(
      e,
      { hash: `function`, a: `bigint`, d: `bigint`, randomBytes: `function` },
      {
        adjustScalarBytes: `function`,
        domain: `function`,
        uvRatio: `function`,
        mapToCurve: `function`,
      },
    ),
    Object.freeze({ ...t })
  );
}
function ye(e) {
  let t = ve(e),
    {
      Fp: n,
      n: r,
      prehash: i,
      hash: a,
      randomBytes: o,
      nByteLength: p,
      h: m,
    } = t,
    h = he << (BigInt(p * 8) - W),
    y = n.create,
    b = _(t.n, t.nBitLength);
  function ne(e, r) {
    let i = n.sqr(e),
      a = n.sqr(r),
      o = n.add(n.mul(t.a, i), a),
      s = n.add(n.ONE, n.mul(t.d, n.mul(i, a)));
    return n.eql(o, s);
  }
  if (!ne(t.Gx, t.Gy)) throw Error(`bad curve params: generator point`);
  let re =
      t.uvRatio ||
      ((e, t) => {
        try {
          return { isValid: !0, value: n.sqrt(e * n.inv(t)) };
        } catch {
          return { isValid: !1, value: U };
        }
      }),
    C = t.adjustScalarBytes || ((e) => e),
    ie =
      t.domain ||
      ((e, t, n) => {
        if ((g(`phflag`, n), t.length || n))
          throw Error(`Contexts/pre-hash are not supported`);
        return e;
      });
  function w(e, t, n = !1) {
    let r = n ? W : U;
    v(`coordinate ` + e, t, r, h);
  }
  function T(e) {
    if (!(e instanceof O)) throw Error(`ExtendedPoint expected`);
  }
  let E = s((e, t) => {
      let { ex: r, ey: i, ez: a } = e,
        o = e.is0();
      t ??= o ? ge : n.inv(a);
      let s = y(r * t),
        c = y(i * t),
        l = y(a * t);
      if (o) return { x: U, y: W };
      if (l !== W) throw Error(`invZ was invalid`);
      return { x: s, y: c };
    }),
    D = s((e) => {
      let { a: n, d: r } = t;
      if (e.is0()) throw Error(`bad point: ZERO`);
      let { ex: i, ey: a, ez: o, et: s } = e,
        c = y(i * i),
        l = y(a * a),
        u = y(o * o),
        d = y(u * u),
        f = y(c * n);
      if (y(u * y(f + l)) !== y(d + y(r * y(c * l))))
        throw Error(`bad point: equation left != right (1)`);
      if (y(i * a) !== y(o * s))
        throw Error(`bad point: equation left != right (2)`);
      return !0;
    });
  class O {
    constructor(e, t, n, r) {
      (w(`x`, e),
        w(`y`, t),
        w(`z`, n, !0),
        w(`t`, r),
        (this.ex = e),
        (this.ey = t),
        (this.ez = n),
        (this.et = r),
        Object.freeze(this));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    static fromAffine(e) {
      if (e instanceof O) throw Error(`extended point not allowed`);
      let { x: t, y: n } = e || {};
      return (w(`x`, t), w(`y`, n), new O(t, n, W, y(t * n)));
    }
    static normalizeZ(e) {
      let t = d(
        n,
        e.map((e) => e.ez),
      );
      return e.map((e, n) => e.toAffine(t[n])).map(O.fromAffine);
    }
    static msm(e, t) {
      return te(O, b, e, t);
    }
    _setWindowSize(e) {
      j.setWindowSize(this, e);
    }
    assertValidity() {
      D(this);
    }
    equals(e) {
      T(e);
      let { ex: t, ey: n, ez: r } = this,
        { ex: i, ey: a, ez: o } = e,
        s = y(t * o),
        c = y(i * r),
        l = y(n * o),
        u = y(a * r);
      return s === c && l === u;
    }
    is0() {
      return this.equals(O.ZERO);
    }
    negate() {
      return new O(y(-this.ex), this.ey, this.ez, y(-this.et));
    }
    double() {
      let { a: e } = t,
        { ex: n, ey: r, ez: i } = this,
        a = y(n * n),
        o = y(r * r),
        s = y(he * y(i * i)),
        c = y(e * a),
        l = n + r,
        u = y(y(l * l) - a - o),
        d = c + o,
        f = d - s,
        p = c - o,
        m = y(u * f),
        h = y(d * p),
        g = y(u * p),
        _ = y(f * d);
      return new O(m, h, _, g);
    }
    add(e) {
      T(e);
      let { a: n, d: r } = t,
        { ex: i, ey: a, ez: o, et: s } = this,
        { ex: c, ey: l, ez: u, et: d } = e,
        f = y(i * c),
        p = y(a * l),
        m = y(s * r * d),
        h = y(o * u),
        g = y((i + a) * (c + l) - f - p),
        _ = h - m,
        v = h + m,
        b = y(p - n * f),
        ee = y(g * _),
        te = y(v * b),
        x = y(g * b),
        S = y(_ * v);
      return new O(ee, te, S, x);
    }
    subtract(e) {
      return this.add(e.negate());
    }
    wNAF(e) {
      return j.wNAFCached(this, e, O.normalizeZ);
    }
    multiply(e) {
      let t = e;
      v(`scalar`, t, W, r);
      let { p: n, f: i } = this.wNAF(t);
      return O.normalizeZ([n, i])[0];
    }
    multiplyUnsafe(e, t = O.ZERO) {
      let n = e;
      return (
        v(`scalar`, n, U, r),
        n === U
          ? A
          : this.is0() || n === W
            ? this
            : j.wNAFCachedUnsafe(this, n, O.normalizeZ, t)
      );
    }
    isSmallOrder() {
      return this.multiplyUnsafe(m).is0();
    }
    isTorsionFree() {
      return j.unsafeLadder(this, r).is0();
    }
    toAffine(e) {
      return E(this, e);
    }
    clearCofactor() {
      let { h: e } = t;
      return e === W ? this : this.multiplyUnsafe(e);
    }
    static fromHex(e, r = !1) {
      let { d: i, a } = t,
        o = n.BYTES;
      ((e = l(`pointHex`, e, o)), g(`zip215`, r));
      let s = e.slice(),
        c = e[o - 1];
      s[o - 1] = c & -129;
      let u = S(s),
        d = r ? h : n.ORDER;
      v(`pointHex.y`, u, U, d);
      let f = y(u * u),
        p = y(f - W),
        m = y(i * f - a),
        { isValid: _, value: b } = re(p, m);
      if (!_) throw Error(`Point.fromHex: invalid y coordinate`);
      let ee = (b & W) === W,
        te = !!(c & 128);
      if (!r && b === U && te) throw Error(`Point.fromHex: x=0 and x_0=1`);
      return (te !== ee && (b = y(-b)), O.fromAffine({ x: b, y: u }));
    }
    static fromPrivateKey(e) {
      let { scalar: t } = P(e);
      return k.multiply(t);
    }
    toRawBytes() {
      let { x: e, y: t } = this.toAffine(),
        r = c(t, n.BYTES);
      return ((r[r.length - 1] |= e & W ? 128 : 0), r);
    }
    toHex() {
      return u(this.toRawBytes());
    }
  }
  ((O.BASE = new O(t.Gx, t.Gy, W, y(t.Gx * t.Gy))),
    (O.ZERO = new O(U, W, W, U)));
  let { BASE: k, ZERO: A } = O,
    j = ee(O, p * 8);
  function M(e) {
    return x(e, r);
  }
  function N(e) {
    return M(S(e));
  }
  function P(e) {
    let t = n.BYTES;
    e = l(`private key`, e, t);
    let r = l(`hashed private key`, a(e), 2 * t),
      i = C(r.slice(0, t));
    return { head: i, prefix: r.slice(t, 2 * t), scalar: N(i) };
  }
  function F(e) {
    let { head: t, prefix: n, scalar: r } = P(e),
      i = k.multiply(r);
    return {
      head: t,
      prefix: n,
      scalar: r,
      point: i,
      pointBytes: i.toRawBytes(),
    };
  }
  function ae(e) {
    return F(e).pointBytes;
  }
  function I(e = Uint8Array.of(), ...t) {
    let n = f(...t);
    return N(a(ie(n, l(`context`, e), !!i)));
  }
  function L(e, t, a = {}) {
    ((e = l(`message`, e)), i && (e = i(e)));
    let { prefix: o, scalar: s, pointBytes: u } = F(t),
      d = I(a.context, o, e),
      p = k.multiply(d).toRawBytes(),
      m = M(d + I(a.context, p, u, e) * s);
    v(`signature.s`, m, U, r);
    let h = f(p, c(m, n.BYTES));
    return l(`result`, h, n.BYTES * 2);
  }
  let R = _e;
  function z(e, t, r, a = R) {
    let { context: o, zip215: s } = a,
      c = n.BYTES;
    ((e = l(`signature`, e, 2 * c)),
      (t = l(`message`, t)),
      (r = l(`publicKey`, r, c)),
      s !== void 0 && g(`zip215`, s),
      i && (t = i(t)));
    let u = S(e.slice(c, 2 * c)),
      d,
      f,
      p;
    try {
      ((d = O.fromHex(r, s)),
        (f = O.fromHex(e.slice(0, c), s)),
        (p = k.multiplyUnsafe(u)));
    } catch {
      return !1;
    }
    if (!s && d.isSmallOrder()) return !1;
    let m = I(o, f.toRawBytes(), d.toRawBytes(), t);
    return f
      .add(d.multiplyUnsafe(m))
      .subtract(p)
      .clearCofactor()
      .equals(O.ZERO);
  }
  return (
    k._setWindowSize(8),
    {
      CURVE: t,
      getPublicKey: ae,
      sign: L,
      verify: z,
      ExtendedPoint: O,
      utils: {
        getExtendedPublicKey: F,
        randomPrivateKey: () => o(n.BYTES),
        precompute(e = 8, t = O.BASE) {
          return (t._setWindowSize(e), t.multiply(BigInt(3)), t);
        },
      },
    }
  );
}
var be = BigInt(
    `57896044618658097711785492504343953926634992332820282019728792003956564819949`,
  ),
  xe = BigInt(
    `19681161376707505956807079304988542015446066515923890162744021073123829784752`,
  ),
  Se = BigInt(1),
  Ce = BigInt(2),
  we = BigInt(5),
  Te = BigInt(8);
function Ee(e) {
  let t = BigInt(10),
    n = BigInt(20),
    r = BigInt(40),
    i = BigInt(80),
    a = be,
    o = (((e * e) % a) * e) % a,
    s = (m(o, Ce, a) * o) % a,
    c = (m(s, Se, a) * e) % a,
    l = (m(c, we, a) * c) % a,
    u = (m(l, t, a) * l) % a,
    d = (m(u, n, a) * u) % a,
    f = (m(d, r, a) * d) % a,
    p = (m(f, i, a) * f) % a,
    h = (m(p, i, a) * f) % a,
    g = (m(h, t, a) * l) % a;
  return { pow_p_5_8: (m(g, Ce, a) * e) % a, b2: o };
}
function De(e) {
  return ((e[0] &= 248), (e[31] &= 127), (e[31] |= 64), e);
}
function Oe(e, t) {
  let n = be,
    r = x(t * t * t, n),
    i = Ee(e * x(r * r * t, n)).pow_p_5_8,
    a = x(e * r * i, n),
    o = x(t * a * a, n),
    s = a,
    c = x(a * xe, n),
    l = o === e,
    u = o === x(-e, n),
    d = o === x(-e * xe, n);
  return (
    l && (a = s),
    (u || d) && (a = c),
    p(a, n) && (a = x(-a, n)),
    { isValid: l || u, value: a }
  );
}
var ke = _(be, void 0, !0),
  Ae = ye({
    a: ke.create(BigInt(-1)),
    d: BigInt(
      `37095705934669439343138083508754565189542113879843219016388785533085940283555`,
    ),
    Fp: ke,
    n: BigInt(
      `7237005577332262213973186563042994240857116359379907606001950938285454250989`,
    ),
    h: Te,
    Gx: BigInt(
      `15112221349535400772501151409588531511454012693041857206046113283949847762202`,
    ),
    Gy: BigInt(
      `46316835694926478169428394003475163141307993866256225615783033603165251855960`,
    ),
    hash: b,
    randomBytes: n,
    adjustScalarBytes: De,
    uvRatio: Oe,
  }),
  je = [`hypercore`, `hyperevm`, `ethereum`, `arbitrum`, `solana`],
  Me = [...je, `robinhood`],
  Ne = { ethereum: 0, arbitrum: 3, solana: 5 },
  Pe = 10000000n,
  Fe = 10000000n,
  Ie = 1000000n,
  Le = 10000000n,
  Re = 100000n,
  ze = (e) => e - Re,
  Be = `HyperliquidTransaction:SendAsset`,
  Ve = `HyperliquidTransaction:SendToEvmWithData`,
  He = `HyperliquidTransaction:SpotSend`,
  Ue = `HyperliquidTransaction:UsdClassTransfer`,
  We = `0x2000000000000000000000000000000000000000`,
  G = (e) => {
    let t = String(e % 1000000n)
      .padStart(6, `0`)
      .replace(/0+$/, ``);
    return `${e / 1000000n}${t === `` ? `` : `.${t}`}`;
  },
  K = (e, t, n, r) => ({
    typedData: {
      domain: { ...ne, chainId: e.chainId },
      types: { [t]: re[t] },
      primaryType: t,
      message: r,
    },
    action: {
      type: n,
      signatureChainId: `0x${e.chainId.toString(16)}`,
      ...Object.fromEntries(
        Object.entries(r).map(([e, t]) => [
          e,
          typeof t == `bigint` ? Number(t) : t,
        ]),
      ),
    },
  }),
  Ge = (e, t) => {
    let n = {
      hyperliquidChain: t.hyperliquidChain,
      token: `USDC`,
      amount: G(ze(e.amount)),
    };
    if (e.route === `hyperevm`)
      return K(t, Be, `sendAsset`, {
        ...n,
        destination: We,
        sourceDex: `spot`,
        destinationDex: `spot`,
        fromSubAccount: ``,
        nonce: e.nonce,
      });
    let r =
      e.route === `solana`
        ? {
            destinationRecipient: Mt(e.destination),
            addressEncoding: `base58`,
            data: e.createRecipient ? Nt(e.destination) : `0x`,
          }
        : {
            destinationRecipient: e.destination.toLowerCase(),
            addressEncoding: `hex`,
            data: `0x`,
          };
    return K(t, Ve, `sendToEvmWithData`, {
      ...n,
      sourceDex: `spot`,
      ...r,
      destinationChainId: Ne[e.route],
      gasLimit: 2e5,
      nonce: e.nonce,
    });
  },
  q = (e) => `0x${r(e)}`,
  J = (t, n) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(n))
      throw TypeError(`${t} is not an EVM address`);
    return e(n.slice(2));
  },
  Ke = [`default`, `unifiedAccount`, `portfolioMargin`],
  qe = (e, t) => {
    let n = t.hyperliquidChain,
      r = G(e.amount),
      i = q(J(`proxy`, e.proxy)),
      a = e.account === `perp` ? e.nonce + 1n : e.nonce,
      o =
        e.accountMode === "default"
          ? K(t, He, `spotSend`, {
              hyperliquidChain: n,
              destination: i,
              token: `USDC`,
              amount: r,
              time: a,
            })
          : K(t, Be, `sendAsset`, {
              hyperliquidChain: n,
              destination: i,
              sourceDex: `spot`,
              destinationDex: `spot`,
              token: `USDC`,
              amount: r,
              fromSubAccount: ``,
              nonce: a,
            });
    return e.account === `perp`
      ? [
          K(t, Ue, `usdClassTransfer`, {
            hyperliquidChain: n,
            amount: G(e.amount + e.activationFee),
            toPerp: !1,
            nonce: e.nonce,
          }),
          o,
        ]
      : [o];
  },
  Je = `0x28b5a0e9c621a5badaa536219b3a228c8168cf5d`,
  Ye = `0x${`0`.repeat(24)}b21d281dedb17ae5b501f6aa8256fe38c4e45757`,
  Xe = { fast: 1e3, standard: 2e3 },
  Ze = {
    ethereum: {
      chainId: 1,
      usdc: `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`,
    },
    arbitrum: {
      chainId: 42161,
      usdc: `0xaf88d065e77c8cc2239327c5edb3a432268e5831`,
    },
  },
  Qe = `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
  $e = `CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe`,
  et = `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`,
  tt = `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`,
  nt = `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`,
  rt = 4294967295,
  it = [
    `function depositFor(address recipient,uint256 amount,uint32 destinationDex)`,
    `function calculateCrossChainWithdrawalFee(bool shouldForward,uint32 destinationDomain) view returns (uint256)`,
  ],
  Y = (t, n) => {
    let r = BigInt(t);
    if (r < 0n || r >= 1n << BigInt(n * 8))
      throw RangeError(`${r} exceeds uint${n * 8}`);
    return e(r.toString(16).padStart(n * 2, `0`));
  },
  X = (e) => Y(e, 32),
  Z = (e, n) => t(new Uint8Array(12), J(e, n)),
  Q = (e) => a(i(e)).subarray(0, 4),
  at = Q(
    `depositForBurnWithHook(uint256,uint32,bytes32,address,bytes32,uint256,uint32,bytes)`,
  ),
  ot = Q(`depositFor(address,uint256,uint32)`),
  st = t(i(`cctp-forward`), new Uint8Array(12)),
  ct = (e) => t(st, Y(0, 4), Y(24, 4), J(`proxy`, e), Y(rt, 4)),
  lt = (n, r) => {
    if (r.maxFee >= r.amount)
      throw RangeError(`amount must exceed the maximum route fee`);
    let i = ct(r.proxy),
      a = e(Ye.slice(2)),
      o = Ze[n];
    return {
      chainId: o.chainId,
      to: Je,
      token: o.usdc,
      data: q(
        t(
          at,
          X(r.amount),
          X(19),
          a,
          Z(`usdc`, o.usdc),
          a,
          X(r.maxFee),
          X(r.finalityThreshold),
          X(256),
          X(i.length),
          i,
          new Uint8Array(-i.length & 31),
        ),
      ),
    };
  },
  ut = ({ coreDepositWallet: e, proxy: n, amount: r }) => ({
    to: q(J(`coreDepositWallet`, e)),
    data: q(t(ot, Z(`proxy`, n), X(r), X(rt))),
  }),
  $ = { chainId: 4663, usdg: `0x5fc5360d0400a0fd4f2af552add042d716f1d168` },
  dt = `0xd29c85f15df544ba632c9e25829fd29d767d7978`,
  ft = `0x5e7840e06faccb6d1c3b5f5e0d1d3d07f2829bba`,
  pt = Q(`approve(address,uint256)`),
  mt = Q(`makeCallWithBalance(address,bytes,uint256,(address,uint256)[])`),
  ht = Q(`drainLeftoverTokens(address,address)`),
  gt = Q(
    `deposit(bytes32,bytes32,bytes32,bytes32,uint256,uint256,uint256,bytes32,uint32,uint32,uint32,bytes)`,
  ),
  _t = (e) => t(X(e.length), e, new Uint8Array(-e.length & 31)),
  vt = (e) => t(new Uint8Array(28), Y(e, 4)),
  yt = (e, n, r) => {
    let i = _t(n);
    return t(
      mt,
      Z(`target`, e),
      X(128),
      X(0),
      X(128 + i.length),
      i,
      X(1),
      Z(`token`, r),
      X(36),
    );
  },
  bt = (e) => {
    let n = e.map((e) => t(Z(`handler`, ft), X(96), X(0), _t(e))),
      r = [],
      i = n.length * 32;
    for (let e of n) (r.push(X(i)), (i += e.length));
    return t(X(32), X(64), new Uint8Array(32), X(n.length), ...r, ...n);
  },
  xt = ({ owner: e, proxy: n, usdc: r, coreDepositWallet: i }) =>
    bt([
      yt(r, t(pt, Z(`coreDepositWallet`, i), X(0)), r),
      yt(i, t(ot, Z(`proxy`, n), X(0), X(rt)), r),
      t(ht, Z(`usdc`, r), Z(`owner`, e)),
    ]),
  St = (e) => {
    let { amount: n, quote: r } = e;
    if (r.outputAmount <= 0n || r.outputAmount > n)
      throw RangeError(`output must be positive and at most the amount`);
    return {
      chainId: $.chainId,
      to: dt,
      token: $.usdg,
      data: q(
        t(
          gt,
          Z(`owner`, e.owner),
          Z(`handler`, ft),
          Z(`usdg`, $.usdg),
          Z(`usdc`, e.usdc),
          X(n),
          X(r.outputAmount),
          X(e.destinationChainId),
          Z(`exclusiveRelayer`, r.exclusiveRelayer),
          vt(r.quoteTimestamp),
          vt(r.fillDeadline),
          vt(r.exclusivityParameter),
          X(384),
          _t(xt(e)),
        ),
      ),
    };
  },
  Ct = (e) => {
    let t = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(String(e));
    if (t === null) throw TypeError(`Circle minimumFee is malformed`);
    return (
      BigInt(t[1] ?? `0`) * 100n + BigInt((t[2] ?? ``).padEnd(2, `0`) || `0`)
    );
  },
  wt = (e, t, n) => {
    let r = e.find((e) => e.finalityThreshold === t);
    if (r === void 0) throw TypeError(`Circle omitted finality threshold ${t}`);
    let i = String(r.forwardFee.med ?? r.forwardFee.medium ?? ``);
    if (!/^(0|[1-9][0-9]*)$/.test(i))
      throw TypeError(`Circle omitted a medium forward fee`);
    let a = n * Ct(r.minimumFee);
    return (a === 0n ? 0n : (a - 1n) / 1000000n + 1n) + BigInt(i);
  },
  Tt = V.decode(Qe),
  Et = V.decode(tt),
  Dt = V.decode(nt),
  Ot = new TextEncoder().encode(`ProgramDerivedAddress`),
  kt = (e) => {
    try {
      let t = V.decode(e);
      return t.length === 32 && t.some((e) => e !== 0) && V.encode(t) === e;
    } catch {
      return !1;
    }
  },
  At = (e) => {
    try {
      return (Ae.ExtendedPoint.fromHex(e), !0);
    } catch {
      return !1;
    }
  },
  jt = (e) => kt(e) && At(V.decode(e)),
  Mt = (e) => {
    let t = [V.decode(e), Et, Tt];
    for (let e = 255; e >= 0; --e) {
      let n = h(
        Uint8Array.from([...t.flatMap((e) => [...e]), e, ...Dt, ...Ot]),
      );
      if (!At(n)) return V.encode(n);
    }
    throw RangeError(`no USDC account address exists for this owner`);
  },
  Nt = (e) => q(t(st, Uint8Array.of(1), V.decode(e)));
export {
  jt as A,
  xt as C,
  G as D,
  wt as E,
  ue as F,
  Mt as M,
  Ge as N,
  qe as O,
  V as P,
  St as S,
  ct as T,
  et as _,
  Ye as a,
  Qe as b,
  Ze as c,
  Ie as d,
  Fe as f,
  $ as g,
  Re as h,
  Xe as i,
  ze as j,
  ut as k,
  je as l,
  Pe as m,
  dt as n,
  it as o,
  Le as p,
  Ne as r,
  Me as s,
  ft as t,
  Ke as u,
  $e as v,
  lt as w,
  Je as x,
  tt as y,
};
