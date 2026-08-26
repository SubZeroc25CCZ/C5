/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A `next build` run beside a live `next dev` clobbers the dev server's
  // .next and every chunk starts 404ing. Point either at its own directory
  // (NEXT_DIST_DIR) to keep them out of each other's way; unset, nothing
  // changes — Vercel and CI use the default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
