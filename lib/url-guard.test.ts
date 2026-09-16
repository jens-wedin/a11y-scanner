import { describe, it, expect } from "vitest";
import { assertScannableUrl, BlockedUrlError } from "./url-guard";

// A resolver stub so tests never depend on real DNS.
const resolvesTo = (...addresses: string[]) => async () => addresses;

describe("assertScannableUrl — scheme validation", () => {
  it("rejects file: URLs", async () => {
    await expect(
      assertScannableUrl("file:///etc/passwd", resolvesTo())
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects javascript: URLs", async () => {
    await expect(
      assertScannableUrl("javascript:alert(1)", resolvesTo())
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects data: URLs", async () => {
    await expect(
      assertScannableUrl("data:text/html,<h1>hi</h1>", resolvesTo())
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects strings that are not URLs at all", async () => {
    await expect(
      assertScannableUrl("not a url", resolvesTo())
    ).rejects.toThrow(BlockedUrlError);
  });

  it("accepts an ordinary https URL", async () => {
    const url = await assertScannableUrl(
      "https://example.com/page",
      resolvesTo("93.184.216.34")
    );
    expect(url.href).toBe("https://example.com/page");
  });

  it("accepts an ordinary http URL", async () => {
    const url = await assertScannableUrl(
      "http://example.com/",
      resolvesTo("93.184.216.34")
    );
    expect(url.protocol).toBe("http:");
  });
});

describe("assertScannableUrl — literal private addresses", () => {
  const blocked: Array<[string, string]> = [
    ["IPv4 loopback", "http://127.0.0.1:8080/"],
    ["IPv6 loopback", "http://[::1]:3000/admin"],
    ["unspecified address", "http://0.0.0.0/"],
    ["link-local / cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["RFC1918 10/8", "http://10.0.0.5/"],
    ["RFC1918 172.16/12", "http://172.16.0.1/"],
    ["RFC1918 192.168/16", "http://192.168.1.1/"],
    ["CGNAT 100.64/10", "http://100.64.0.1/"],
    ["IPv6 unique local", "http://[fd00::1]/"],
    ["IPv6 link-local", "http://[fe80::1]/"],
    ["IPv4-mapped IPv6 loopback", "http://[::ffff:127.0.0.1]/"],
    ["decimal-encoded loopback", "http://2130706433/"],
  ];

  for (const [label, url] of blocked) {
    it(`rejects ${label}`, async () => {
      await expect(
        assertScannableUrl(url, async () => [])
      ).rejects.toThrow(BlockedUrlError);
    });
  }

  it("accepts a public IPv4 literal", async () => {
    const url = await assertScannableUrl("http://93.184.216.34/", async () => [
      "93.184.216.34",
    ]);
    expect(url.hostname).toBe("93.184.216.34");
  });
});

describe("assertScannableUrl — DNS resolution", () => {
  it("rejects a hostname that resolves to loopback", async () => {
    await expect(
      assertScannableUrl("http://localhost:6379/", resolvesTo("127.0.0.1"))
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects a public-looking hostname that resolves to a private IP (DNS rebinding)", async () => {
    await expect(
      assertScannableUrl("https://evil.example/", resolvesTo("192.168.0.10"))
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects when any resolved address is private, even if one is public", async () => {
    await expect(
      assertScannableUrl(
        "https://mixed.example/",
        resolvesTo("93.184.216.34", "10.1.2.3")
      )
    ).rejects.toThrow(BlockedUrlError);
  });

  it("rejects a hostname that does not resolve at all", async () => {
    await expect(
      assertScannableUrl("https://nxdomain.example/", resolvesTo())
    ).rejects.toThrow(BlockedUrlError);
  });

  it("accepts a hostname resolving only to public addresses", async () => {
    const url = await assertScannableUrl(
      "https://example.com/",
      resolvesTo("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946")
    );
    expect(url.hostname).toBe("example.com");
  });
});
