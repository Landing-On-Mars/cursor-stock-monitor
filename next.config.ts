import os from "node:os";
import type { NextConfig } from "next";

function localIpv4Addresses(): string[] {
  const found: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  // next dev blocks /_next/* unless the browser origin host is listed.
  // Home/office LAN IPs change; wildcards cover RFC1918, plus this machine's current IPv4.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.0.199",
    "192.168.*.*",
    "10.*.*.*",
    ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
    ...localIpv4Addresses(),
  ],
};

export default nextConfig;
