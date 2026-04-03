import { MetadataRoute } from 'next'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/signup', '/privacy', '/terms'],
      disallow: ['/api/', '/admin/', '/dashboard/', '/saved/', '/kitchen/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
