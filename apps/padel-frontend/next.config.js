/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Frontends share UI from /packages/shared-ui via workspaces; no transpilePackages needed
  // because they're plain TS/TSX in the workspace.
  transpilePackages: ["@sports-outlet-ai/shared-ui"],
  env: {
    SPORT: process.env.SPORT,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CHATBOT_URL: process.env.NEXT_PUBLIC_CHATBOT_URL,
  },
};
module.exports = nextConfig;
