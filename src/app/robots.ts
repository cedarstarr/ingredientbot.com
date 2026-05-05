import type { MetadataRoute } from 'next'

const AI_CRAWLERS = [
  'GPTBot', 'ChatGPT-User', 'Claude-Web', 'anthropic-ai',
  'Google-Extended', 'CCBot', 'PerplexityBot', 'Bytespider',
  'YouBot', 'Diffbot', 'Amazonbot', 'cohere-ai', 'meta-externalagent',
]

export default function robots(): MetadataRoute.Robots {
  const noIndex = process.env.NO_INDEX === 'true'

  if (noIndex) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...AI_CRAWLERS.map(bot => ({ userAgent: bot, disallow: '/' })),
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'}/sitemap.xml`,
  }
}
