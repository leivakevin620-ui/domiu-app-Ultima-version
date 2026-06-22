import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://domiu.app";
  const routes = [
    "",
    "/login",
    "/register",
    "/forgot-password",
    "/terminos",
    "/privacidad",
    "/notificaciones",
    "/cliente",
    "/negocio",
    "/repartidor",
    "/admin",
  ];
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority:
      route === ""
        ? 1
        : route.startsWith("/cliente") ||
            route.startsWith("/negocio") ||
            route.startsWith("/repartidor") ||
            route.startsWith("/admin")
          ? 0.8
          : 0.5,
  })) as MetadataRoute.Sitemap;
}
