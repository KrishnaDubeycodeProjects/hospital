package com.qdischarge.clinicqueue.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Safety net for anything not already caught inside a controller method
 * (each controller mirrors the original Express routes' own try/catch, so
 * this mostly covers things like malformed JSON request bodies).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleBadJson(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body(false, "Invalid or malformed request body."));
    }

    /** Bean validation failure on a @Valid request body (e.g. blank phone/username/status). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getDefaultMessage())
                .orElse("Invalid request.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body(false, message));
    }

    /**
     * No matching static resource and no bundled frontend/index.html to fall
     * back to (see WebConfig's SPA resolver) -> 404, same as Express's
     * default handling when res.sendFile() can't find frontend/dist/index.html.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Void> handleNoResource(NoResourceFoundException e) {
        return ResponseEntity.notFound().build();
    }

    /**
     * Handles client disconnects silently (e.g. browser closed tab, ngrok tunnel timeout,
     * or connection aborted by host machine while writing response).
     */
    @ExceptionHandler({
            org.springframework.web.context.request.async.AsyncRequestNotUsableException.class,
            org.apache.catalina.connector.ClientAbortException.class
    })
    public void handleClientDisconnect(Exception e) {
        log.debug("Client closed connection before response completed: {}", e.getMessage());
    }

    @ExceptionHandler(java.io.IOException.class)
    public void handleIOException(java.io.IOException e) {
        String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
        if (msg.contains("aborted") || msg.contains("broken pipe") || msg.contains("connection reset")) {
            log.debug("Client connection aborted: {}", e.getMessage());
        } else {
            log.error("I/O error during request processing: {}", e.getMessage());
        }
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception e) {
        // Ignore client abort exceptions wrapped inside other exceptions
        Throwable cause = e;
        while (cause != null) {
            String msg = cause.getMessage() != null ? cause.getMessage().toLowerCase() : "";
            if (msg.contains("aborted by the software in your host machine") || msg.contains("broken pipe") || msg.contains("connection reset")) {
                log.debug("Client aborted request: {}", cause.getMessage());
                return null;
            }
            cause = cause.getCause();
        }
        log.error("Unhandled error", e);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", e.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    private Map<String, Object> body(boolean success, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", success);
        body.put("message", message);
        return body;
    }
}
