import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' ws://localhost:3001 wss:",
              "frame-src https://browserbase.com https://*.browserbase.com",
              "img-src 'self' data: blob:",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
