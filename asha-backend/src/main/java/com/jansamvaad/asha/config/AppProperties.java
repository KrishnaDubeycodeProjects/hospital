package com.jansamvaad.asha.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String jwtSecret;
    private int jwtExpiryMinutes = 720;
    private String allowedOrigins = "*";
}
