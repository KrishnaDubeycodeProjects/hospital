package com.qdischarge.clinicqueue.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Mirrors what the original index.js did with
 * express.static(frontend/dist) + a catch-all fallback: serve a built SPA
 * (if any) from src/main/resources/static, falling back to index.html for
 * client-side routes. CORS is configured centrally in SecurityConfig.
 *
 * /api/** and /webhook/** are handled by @RestController beans, which Spring's
 * RequestMappingHandlerMapping resolves before this resource handler, so they
 * are never swallowed by the SPA fallback below.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        Resource index = new ClassPathResource("/static/index.html");
                        return index.exists() ? index : null;
                    }
                });
    }
}
