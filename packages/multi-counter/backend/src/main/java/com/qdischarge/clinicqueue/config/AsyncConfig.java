package com.qdischarge.clinicqueue.config;

import lombok.RequiredArgsConstructor;
import org.springframework.aop.interceptor.SimpleAsyncUncaughtExceptionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Dedicated, bounded thread pool for outbound WhatsApp API calls, so a slow
 * or unreachable WhatsApp provider can't exhaust Tomcat's request-handling
 * threads. HTTP request threads hand off notification sends here and return
 * to the client immediately (see WhatsAppService).
 */
@Configuration
@EnableAsync
@RequiredArgsConstructor
public class AsyncConfig implements AsyncConfigurer {

    private final AppProperties appProperties;

    @Override
    @Bean(name = "whatsappExecutor")
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(appProperties.getAsyncCorePoolSize());
        executor.setMaxPoolSize(appProperties.getAsyncMaxPoolSize());
        executor.setQueueCapacity(appProperties.getAsyncQueueCapacity());
        executor.setThreadNamePrefix("whatsapp-notify-");
        executor.initialize();
        return executor;
    }

    @Override
    public org.springframework.aop.interceptor.AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return new SimpleAsyncUncaughtExceptionHandler();
    }
}
