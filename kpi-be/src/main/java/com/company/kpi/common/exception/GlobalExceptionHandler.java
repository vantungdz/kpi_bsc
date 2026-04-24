package com.company.kpi.common.exception;

import com.company.kpi.common.dto.BaseResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

        private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
        public ResponseEntity<BaseResponse<Void>> handleAppException(AppException ex, HttpServletRequest request) {
                logger.warn("AppException at {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
                return ResponseEntity.status(ex.getStatus())
                                .body(BaseResponse.error(ex.getStatus().value(), ex.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<BaseResponse<Void>> handleResponseStatus(ResponseStatusException ex) {
        int http = ex.getStatusCode().value();
        String reason = ex.getReason() != null ? ex.getReason() : ex.getMessage();
        return ResponseEntity.status(ex.getStatusCode())
                .body(BaseResponse.error(http, reason != null ? reason : "Request failed"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<BaseResponse<Map<String, String>>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, FieldError::getDefaultMessage, (a, b) -> a));
        logger.warn("Validation failed at {} {}: {}", request.getMethod(), request.getRequestURI(), errors);
        return ResponseEntity.badRequest()
                .body(BaseResponse.<Map<String, String>>builder()
                        .success(false)
                        .message("Validation failed")
                        .data(errors)
                        .build());
    }

    @ExceptionHandler(UnsupportedOperationException.class)
        public ResponseEntity<BaseResponse<Void>> handleNotImplemented(UnsupportedOperationException ex, HttpServletRequest request) {
                logger.warn("Not implemented at {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
                return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                                .body(BaseResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
        public ResponseEntity<BaseResponse<Void>> handleGeneric(Exception ex, HttpServletRequest request) {
                logger.error("Unhandled exception at {} {}: {}", request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);
                return ResponseEntity.internalServerError()
                                .body(BaseResponse.error("Internal server error: " + ex.getMessage()));
    }
}
