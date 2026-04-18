/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: [] },
  },
  // We import TS files from ../src with .ts extensions; Next's default config
  // handles that via the shared tsconfig.json.
  typescript: {
    ignoreBuildErrors: false,
  },
  // Every admin route hits Airtable — do not statically cache.
  // (Using dynamic = "force-dynamic" in the pages themselves.)
};

export default nextConfig;
