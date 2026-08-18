import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => [
    // Proxy Firebase's auth handler through our own domain so
    // signInWithRedirect works on Safari. Without this, Safari's ITP
    // partitions sessionStorage by origin, and the redirect return from
    // firebaseapp.com can't find the state it stored before the redirect.
    {
      source: "/__/auth/:path*",
      destination: "https://invoicebro-e0c83.firebaseapp.com/__/auth/:path*",
    },
  ],
};

export default nextConfig;
