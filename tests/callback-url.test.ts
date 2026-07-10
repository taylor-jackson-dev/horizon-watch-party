import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl } from "@/lib/callback-url";

describe("sanitizeCallbackUrl", () => {
  it("passes through a plain relative path", () => {
    expect(sanitizeCallbackUrl("/room/abc123")).toBe("/room/abc123");
  });

  it("preserves query and hash on a relative path", () => {
    expect(sanitizeCallbackUrl("/room/abc?asViewer=1#top")).toBe("/room/abc?asViewer=1#top");
  });

  it("falls back when the value is missing", () => {
    expect(sanitizeCallbackUrl(undefined)).toBe("/dashboard");
    expect(sanitizeCallbackUrl(null)).toBe("/dashboard");
    expect(sanitizeCallbackUrl("")).toBe("/dashboard");
  });

  it("falls back for repeated query params (string[])", () => {
    expect(sanitizeCallbackUrl(["/a", "/b"])).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeCallbackUrl("https://evil.example/phish")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("http://evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("//evil.example/phish")).toBe("/dashboard");
  });

  it("rejects the backslash bypass (browsers treat \\ as /)", () => {
    expect(sanitizeCallbackUrl("/\\evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("/\\/evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("\\\\evil.example")).toBe("/dashboard");
  });

  it("rejects tab/newline-injected bypasses (parsers strip them pre-parse)", () => {
    expect(sanitizeCallbackUrl("/\t/evil.example")).toBe("/dashboard");
    expect(sanitizeCallbackUrl("/\n/evil.example")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(sanitizeCallbackUrl("https://evil.example", "/lobby")).toBe("/lobby");
  });
});
