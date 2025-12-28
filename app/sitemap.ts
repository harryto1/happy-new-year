import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: "https://2026.harryruiz.com",
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1.0,
        }
    ]
}