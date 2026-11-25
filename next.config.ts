import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/pos",
        permanent: false,
      },
      // Old long address (bookmarks and already-installed apps keep working)
      {
        source: "/pos/admin/secure/control-panel/:path*",
        destination: "/pos",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;


