package com.qdischarge.clinicqueue.lambda;

import com.amazonaws.serverless.exceptions.ContainerInitializationException;
import com.amazonaws.serverless.proxy.model.AwsProxyResponse;
import com.amazonaws.serverless.proxy.model.HttpApiV2ProxyRequest;
import com.amazonaws.serverless.proxy.spring.SpringBootLambdaContainerHandler;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestStreamHandler;
import com.qdischarge.clinicqueue.ClinicQueueApplication;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * AWS Lambda RequestStreamHandler entry point for Spring Boot 3.3.5.
 * Proxies incoming AWS Lambda Function URL and API Gateway HTTP API v2 requests
 * directly to the Spring Boot DispatcherServlet.
 */
@Slf4j
public class StreamLambdaHandler implements RequestStreamHandler {

    private static final SpringBootLambdaContainerHandler<HttpApiV2ProxyRequest, AwsProxyResponse> handler;

    static {
        try {
            log.info("🚀 Bootstrapping Spring Boot 3 on AWS Lambda (HTTP API v2 / Function URL mode)...");
            handler = SpringBootLambdaContainerHandler.getHttpApiV2ProxyHandler(ClinicQueueApplication.class);
            log.info("✅ Spring Boot 3 initialized successfully on AWS Lambda!");
        } catch (ContainerInitializationException e) {
            log.error("❌ Could not initialize Spring Boot application for AWS Lambda", e);
            throw new RuntimeException("Could not initialize Spring Boot application", e);
        }
    }

    @Override
    public void handleRequest(InputStream inputStream, OutputStream outputStream, Context context)
            throws IOException {
        handler.proxyStream(inputStream, outputStream, context);
    }
}
