import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import { ApiError } from './ApiError';

/**
 * Downloads a product photo from another website so it can be stored in our own image storage.
 * The address comes from staff, so it is locked down (no server-side request forgery):
 * - only http(s) on the normal ports, at most 3 redirects (each one checked again);
 * - the host name must resolve to public addresses only — the check runs inside the connection's
 *   own DNS lookup, so the address that is checked is the one that is connected to;
 * - 10 s time limit, 4 MB size limit, and the bytes must really be a JPEG, PNG or WebP.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/**
 * Every address range that is not the public internet, for IPv4 and IPv6 — including the IPv6
 * forms that carry an IPv4 address inside (::ffff:127.0.0.1 is written ::ffff:7f00:1 by the URL
 * parser, NAT64, 6to4, Teredo), which a text check would miss.
 */
// Two lists: Node also checks IPv4 addresses against IPv6 rules (::/96 would match every IPv4)
const BLOCKED_V4 = new net.BlockList();
const BLOCKED_V6 = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED_V4.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], // ::, ::1 and the old IPv4-compatible form
  ['::ffff:0:0', 96], // IPv4 written as IPv6
  ['64:ff9b::', 96], ['64:ff9b:1::', 48], // NAT64
  ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], // discard, Teredo, docs, 6to4
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8], // private, link-local, multicast
] as const) BLOCKED_V6.addSubnet(address, prefix, 'ipv6');

/** True for any address that is not a normal public one (anything unparseable counts as blocked). */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (net.isIPv4(v)) return BLOCKED_V4.check(v, 'ipv4');
  if (net.isIPv6(v)) return BLOCKED_V6.check(v, 'ipv6');
  return true;
}

/** DNS lookup used for the connection itself: refuses the connection if any address is private. */
function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
) {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error('Address not allowed'), { code: 'EBLOCKED' }), '', 4);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError(400, 'Not a valid photo address');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ApiError(400, 'Only http(s) photo addresses');
  if (url.username || url.password) throw new ApiError(400, 'Photo address not allowed');
  if (url.port && !['80', '443'].includes(url.port)) throw new ApiError(400, 'Photo address not allowed');
  // A literal IP in the address is checked here (the lookup is skipped for IPs). Photos are on
  // named websites: an IPv6 number is never needed, so it is refused outright.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIPv6(host)) throw new ApiError(400, 'Photo address not allowed');
  if (net.isIP(host) && isPrivateAddress(host)) throw new ApiError(400, 'Photo address not allowed');
  return url;
}

/** JPEG / PNG / WebP by their first bytes, else null. */
export function imageTypeOf(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function getOnce(url: URL): Promise<{ status: number; location?: string; body?: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(
      url,
      {
        lookup: safeLookup as unknown as typeof dns.lookup,
        timeout: TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrynoxaImageImport/1.0)', Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5' },
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ status, location: res.headers.location });
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new ApiError(400, 'The photo could not be downloaded from that address'));
          return;
        }
        const declared = Number(res.headers['content-length'] || 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          reject(new ApiError(400, 'Photo is larger than 4 MB'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new ApiError(400, 'Photo is larger than 4 MB'));
            return;
          }
          chunks.push(c);
        });
        res.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new ApiError(400, 'The other website took too long')));
    req.on('error', (e: NodeJS.ErrnoException) =>
      reject(e instanceof ApiError ? e : new ApiError(400, e.code === 'EBLOCKED' ? 'Photo address not allowed' : 'Could not download the photo'))
    );
  });
}

export async function fetchRemoteImage(raw: string): Promise<{ buffer: Buffer; mimetype: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  let url = checkUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const r = await getOnce(url);
    if (r.location) {
      url = checkUrl(new URL(r.location, url).toString());
      continue;
    }
    const buffer = r.body!;
    const mimetype = imageTypeOf(buffer);
    if (!mimetype) throw new ApiError(400, 'Not a JPEG, PNG or WebP photo');
    return { buffer, mimetype };
  }
  throw new ApiError(400, 'Too many redirects');
}
