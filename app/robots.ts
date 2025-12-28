import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/']
        },
        sitemap: 'https://2026.harryruiz.com/sitemap.xml',
    }
}