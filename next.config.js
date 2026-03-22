/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['node-telegram-bot-api']
  }
}

module.exports = nextConfig
