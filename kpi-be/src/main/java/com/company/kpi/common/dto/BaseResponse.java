package com.company.kpi.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BaseResponse<T> {

    private boolean success;
    private String message;
    private String timestamp;
    private int status;
    private T data;

    public static <T> BaseResponse<T> ok(T data) {
        return BaseResponse.<T>builder()
                .success(true)
                .message(null)
                .timestamp(Instant.now().toString())
                .status(200)
                .data(data)
                .build();
    }

    public static <T> BaseResponse<T> ok(T data, String message) {
        return BaseResponse.<T>builder()
                .success(true)
                .message(message)
                .timestamp(Instant.now().toString())
                .status(200)
                .data(data)
                .build();
    }

    public static <T> BaseResponse<T> error(int status, String message) {
        return BaseResponse.<T>builder()
                .success(false)
                .message(message)
                .timestamp(Instant.now().toString())
                .status(status)
                .data(null)
                .build();
    }

    public static <T> BaseResponse<T> error(String message) {
        return error(500, message);
    }
}
