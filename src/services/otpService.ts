import AsyncStorage from "@react-native-async-storage/async-storage";

// InfinityFree slowAES decryption implementation for AES-128-CBC (mode 2)
// This solves the InfinityFree __test anti-bot challenge automatically in the background
const slowAES: any = {
  aes: {
    keySize: { SIZE_128: 16 },
    sbox: [99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22],
    rsbox: [82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125],
    rotate: function(i: any) {
      for (var t = i[0], r = 0; r < 3; r++) i[r] = i[r + 1];
      return (i[3] = t), i;
    },
    Rcon: [141,1,2,4,8,16,32,64,128,27,54],
    core: function(i: any, t: any) {
      i = this.rotate(i);
      for (var r = 0; r < 4; ++r) i[r] = this.sbox[i[r]];
      return (i[0] = i[0] ^ this.Rcon[t]), i;
    },
    expandKey: function(i: any, t: any) {
      for (var r = 16 * (this.numberOfRounds(t) + 1), o = 0, n = 1, s: any = [], e: any = [], a = 0; a < r; a++) e[a] = 0;
      for (var h = 0; h < t; h++) e[h] = i[h];
      for (o += t; o < r;) {
        for (var u = 0; u < 4; u++) s[u] = e[o - 4 + u];
        if (o % t == 0) s = this.core(s, n++);
        for (var l = 0; l < 4; l++) (e[o] = e[o - t] ^ s[l]), o++;
      }
      return e;
    },
    addRoundKey: function(i: any, t: any) {
      for (var r = 0; r < 16; r++) i[r] ^= t[r];
      return i;
    },
    createRoundKey: function(i: any, t: any) {
      for (var r: any = [], o = 0; o < 4; o++) for (var n = 0; n < 4; n++) r[4 * n + o] = i[t + 4 * o + n];
      return r;
    },
    subBytes: function(i: any, t: any) {
      for (var r = 0; r < 16; r++) i[r] = (t ? this.rsbox : this.sbox)[i[r]];
      return i;
    },
    shiftRows: function(i: any, t: any) {
      for (var r = 0; r < 4; r++) i = this.shiftRow(i, 4 * r, r, t);
      return i;
    },
    shiftRow: function(i: any, t: any, r: any, o: any) {
      for (var n = 0; n < r; n++)
        if (o) {
          for (var s = i[t + 3], e = 3; 0 < e; e--) i[t + e] = i[t + e - 1];
          i[t] = s;
        } else {
          for (var s = i[t], e = 0; e < 3; e++) i[t + e] = i[t + e + 1];
          i[t + 3] = s;
        }
      return i;
    },
    galois_multiplication: function(i: any, t: any) {
      for (var r = 0, o = 0; o < 8; o++) {
        if (1 == (1 & t)) r ^= i;
        if (256 < r) r ^= 256;
        var n = 128 & i;
        if (256 < (i <<= 1)) i ^= 256;
        if (128 == n) i ^= 27;
        if (256 < i) i ^= 256;
        if (256 < (t >>= 1)) t ^= 256;
      }
      return r;
    },
    mixColumns: function(i: any, t: any) {
      for (var r: any = [], o = 0; o < 4; o++) {
        for (var n = 0; n < 4; n++) r[n] = i[4 * n + o];
        r = this.mixColumn(r, t);
        for (var s = 0; s < 4; s++) i[4 * s + o] = r[s];
      }
      return i;
    },
    mixColumn: function(i: any, t: any) {
      for (var r = t ? [14, 9, 13, 11] : [2, 1, 1, 3], o: any = [], n = 0; n < 4; n++) o[n] = i[n];
      return (
        (i[0] =
          this.galois_multiplication(o[0], r[0]) ^
          this.galois_multiplication(o[3], r[1]) ^
          this.galois_multiplication(o[2], r[2]) ^
          this.galois_multiplication(o[1], r[3])),
        (i[1] =
          this.galois_multiplication(o[1], r[0]) ^
          this.galois_multiplication(o[0], r[1]) ^
          this.galois_multiplication(o[3], r[2]) ^
          this.galois_multiplication(o[2], r[3])),
        (i[2] =
          this.galois_multiplication(o[2], r[0]) ^
          this.galois_multiplication(o[1], r[1]) ^
          this.galois_multiplication(o[0], r[2]) ^
          this.galois_multiplication(o[3], r[3])),
        (i[3] =
          this.galois_multiplication(o[3], r[0]) ^
          this.galois_multiplication(o[2], r[1]) ^
          this.galois_multiplication(o[1], r[2]) ^
          this.galois_multiplication(o[0], r[3])),
        i
      );
    },
    invRound: function(i: any, t: any) {
      return (
        (i = this.shiftRows(i, !0)),
        (i = this.subBytes(i, !0)),
        (i = this.addRoundKey(i, t)),
        (i = this.mixColumns(i, !0))
      );
    },
    invMain: function(i: any, t: any, r: any) {
      i = this.addRoundKey(i, this.createRoundKey(t, 16 * r));
      for (var o = r - 1; 0 < o; o--) i = this.invRound(i, this.createRoundKey(t, 16 * o));
      return (
        (i = this.shiftRows(i, !0)),
        (i = this.subBytes(i, !0)),
        (i = this.addRoundKey(i, this.createRoundKey(t, 0)))
      );
    },
    numberOfRounds: function(i: any) {
      return i == this.keySize.SIZE_128 ? 10 : 12;
    },
    decrypt: function(i: any, t: any, r: any) {
      for (var o: any = [], n: any = [], s = this.numberOfRounds(r), e = 0; e < 4; e++)
        for (var a = 0; a < 4; a++) n[e + 4 * a] = i[4 * e + a];
      for (var r = this.expandKey(t, r), n = this.invMain(n, r, s), h = 0; h < 4; h++)
        for (var u = 0; u < 4; u++) o[4 * h + u] = n[h + 4 * u];
      return o;
    }
  },
  modeOfOperation: { CBC: 2 },
  getBlock: function(i: any, t: any, r: any, o: any) {
    if (16 < r - t) r = t + 16;
    return i.slice(t, r);
  },
  decrypt: function(t: any, r: any, o: any, n: any) {
    var s = o.length;
    var e: any,
      a: any = [],
      h: any = [],
      u: any = [],
      f: any = [],
      l = !0;
    if (null !== t) {
      for (var c = 0; c < Math.ceil(t.length / 16); c++) {
        var d = 16 * c,
          p = 16 * c + 16;
        if (16 * c + 16 > t.length) p = t.length;
        if (
          ((e = this.getBlock(t, d, p, r)),
          (h = this.aes.decrypt(e, o, s)),
          null !== h)
        ) {
          for (var i = 0; i < 16; i++) u[i] = (l ? n : a)[i] ^ h[i];
          l = !1;
          for (var v = 0; v < p - d; v++) f.push(u[v]);
          a = e;
        }
      }
    }
    return f;
  }
};

function toNumbers(d: string): number[] {
  const e: number[] = [];
  d.replace(/(..)/g, function(sub: string) {
    e.push(parseInt(sub, 16));
    return "";
  });
  return e;
}

function toHex(d: number[]): string {
  let e = "";
  for (let f = 0; f < d.length; f++) {
    e += (16 > d[f] ? "0" : "") + d[f].toString(16);
  }
  return e.toLowerCase();
}

function solveInfinityFreeChallenge(html: string): string | null {
  try {
    const matches = Array.from(html.matchAll(/toNumbers\("([a-f0-9]+)"\)/g)).map((m) => m[1]);
    if (matches.length < 3) return null;
    const a = toNumbers(matches[0]);
    const b = toNumbers(matches[1]);
    const c = toNumbers(matches[2]);
    const decrypted = slowAES.decrypt(c, 2, a, b);
    return toHex(decrypted);
  } catch (e) {
    console.error("Challenge solve error:", e);
    return null;
  }
}

let inMemoryTestCookie: string | null = null;
const COOKIE_STORAGE_KEY = "CA_INFINITYFREE_TEST_COOKIE";

async function getStoredCookie(): Promise<string | null> {
  if (inMemoryTestCookie) return inMemoryTestCookie;
  try {
    const stored = await AsyncStorage.getItem(COOKIE_STORAGE_KEY);
    if (stored) inMemoryTestCookie = stored;
    return stored;
  } catch {
    return null;
  }
}

async function setStoredCookie(cookie: string): Promise<void> {
  inMemoryTestCookie = cookie;
  try {
    await AsyncStorage.setItem(COOKIE_STORAGE_KEY, cookie);
  } catch {}
}

const OTP_ENDPOINT = "http://coursearena.great-site.net/otp.php";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Robust fetch client that automatically bypasses InfinityFree's anti-bot system in the background
 */
export async function callInfinityFreeBackend(endpoint: string, payload: Record<string, any>): Promise<any> {
  let cookie = await getStoredCookie();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  if (cookie) {
    headers["Cookie"] = `__test=${cookie}`;
  }

  let res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  let text = await res.text();

  // If InfinityFree returned the HTML testcookie challenge, solve it immediately!
  if (text.includes("/aes.js") || text.includes("toNumbers(")) {
    const solvedCookie = solveInfinityFreeChallenge(text);
    if (!solvedCookie) {
      throw new Error("Unable to solve security challenge. Please try again.");
    }
    await setStoredCookie(solvedCookie);
    headers["Cookie"] = `__test=${solvedCookie}`;

    // Retry request with solved cookie!
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    text = await res.text();
  }

  try {
    const data = JSON.parse(text);
    if (data.error && !data.success) throw new Error(data.error);
    return data;
  } catch (err: any) {
    if (err.message && !err.message.includes("JSON")) {
      throw err;
    }
    throw new Error("Server returned an invalid response. Please try again.");
  }
}

/**
 * Call OTP specific endpoint
 */
export async function callOtpBackend(payload: Record<string, any>): Promise<any> {
  return await callInfinityFreeBackend(OTP_ENDPOINT, payload);
}

/**
 * Request an OTP code for email verification during sign-up
 */
export async function sendRegistrationOtp(email: string): Promise<{ success: boolean; message?: string }> {
  return await callOtpBackend({
    action: "request",
    email: email.trim().toLowerCase(),
    purpose: "register",
  });
}

/**
 * Request an OTP code for password reset
 */
export async function sendPasswordResetOtp(email: string): Promise<{ success: boolean; message?: string }> {
  return await callOtpBackend({
    action: "request",
    email: email.trim().toLowerCase(),
    purpose: "reset",
  });
}

/**
 * Verify OTP code entered by the user
 */
export async function verifyOtpCode(email: string, otp: string): Promise<{ success: boolean; message?: string }> {
  return await callOtpBackend({
    action: "verify_otp",
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });
}

/**
 * Update password after OTP has been verified
 */
export async function resetUserPassword(email: string, newPassword: string): Promise<{ success: boolean; message?: string }> {
  return await callOtpBackend({
    action: "set_password",
    email: email.trim().toLowerCase(),
    newPassword,
  });
}

