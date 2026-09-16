/**
 * Guards against SSRF when the scanner is pointed at a user-supplied URL.
 *
 * `new URL(x)` is a parser, not a security control — it happily accepts
 * `file:///etc/passwd` and `http://169.254.169.254/`. Everything that
 * navigates a browser to a caller-supplied address must go through here.
 */
import { isIPv4, isIPv6 } from "node:net";
import { lookup } from "node:dns/promises";

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

/** Resolves a hostname to its IP addresses. Injectable so tests avoid real DNS. */
export type Resolver = (hostname: string) => Promise<string[]>;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Resolves via dns.lookup rather than dns.resolve so that /etc/hosts entries
 * are honoured — otherwise "localhost" would slip past the check.
 */
const defaultResolver: Resolver = async (hostname) => {
  const records = await lookup(hostname, { all: true });
  return records.map((r) => r.address);
};

function ipv4IsPrivate(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o))) {
    return true; // unparseable — fail closed
  }
  const [a, b] = octets;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast

  return false;
}

/**
 * Expands an IPv6 address to its eight 16-bit groups, resolving "::" and any
 * trailing dotted-quad. Returns null if it cannot be parsed.
 *
 * Needed because `new URL()` rewrites IPv4-mapped addresses into hex form —
 * "[::ffff:127.0.0.1]" comes back as "::ffff:7f00:1" — so a textual match on
 * the dotted-quad would miss a loopback address.
 */
function expandIPv6(address: string): number[] | null {
  let addr = address.toLowerCase();

  const dotted = addr.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const o = dotted[1].split(".").map(Number);
    if (o.some((n) => n > 255)) return null;
    const hex = `${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
    addr = addr.slice(0, dotted.index) + hex;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill("0"), ...tail];
  }

  const parsed = groups.map((g) => parseInt(g || "0", 16));
  return parsed.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)
    ? null
    : parsed;
}

function ipv6IsPrivate(address: string): boolean {
  const g = expandIPv6(address.replace(/^\[|\]$/g, ""));
  if (!g) return true; // unparseable — fail closed

  const isZeroPrefix = g.slice(0, 5).every((n) => n === 0);

  // IPv4-mapped (::ffff:a.b.c.d) / IPv4-compatible — judge the embedded v4.
  if (isZeroPrefix && (g[5] === 0xffff || g[5] === 0)) {
    const embedded = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
    if (g[5] === 0xffff) return ipv4IsPrivate(embedded);
    if (g[6] === 0 && g[7] <= 1) return true; // :: and ::1
    return ipv4IsPrivate(embedded);
  }

  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  return false;
}

/** True if the address is loopback, private, link-local or otherwise not a public destination. */
export function isPrivateAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  if (isIPv4(bare)) return ipv4IsPrivate(bare);
  if (isIPv6(bare)) return ipv6IsPrivate(bare);
  return true; // not an IP we understand — fail closed
}

/**
 * Validates that `raw` is a public http(s) URL safe for the scanner to open.
 *
 * Must be re-run after redirects: a permitted host can 302 to an internal one.
 *
 * @throws {BlockedUrlError} if the scheme, host or resolved addresses are not permitted.
 */
export async function assertScannableUrl(
  raw: string,
  resolve: Resolver = defaultResolver
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`Not a valid URL: ${raw}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new BlockedUrlError(
      `Unsupported scheme "${url.protocol}" — only http and https can be scanned`
    );
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no DNS round trip — judge it directly.
  if (isIPv4(host) || isIPv6(host)) {
    if (isPrivateAddress(host)) {
      throw new BlockedUrlError(
        `Refusing to scan a private or reserved address: ${host}`
      );
    }
    return url;
  }

  let addresses: string[];
  try {
    addresses = await resolve(host);
  } catch {
    throw new BlockedUrlError(`Could not resolve host: ${host}`);
  }

  if (addresses.length === 0) {
    throw new BlockedUrlError(`Could not resolve host: ${host}`);
  }

  // Every address must be public — one private answer is enough to be a rebind.
  const offender = addresses.find(isPrivateAddress);
  if (offender) {
    throw new BlockedUrlError(
      `Host ${host} resolves to a private or reserved address (${offender})`
    );
  }

  return url;
}
