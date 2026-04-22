package com.company.kpi.controller.base;

import com.company.kpi.common.dto.BaseResponse;
import org.springframework.http.ResponseEntity;

public abstract class BaseController {

    protected ResponseEntity<BaseResponse<Void>> success() {
        return ResponseEntity.ok(BaseResponse.ok(null));
    }

    protected <T> ResponseEntity<BaseResponse<T>> success(T data) {
        return ResponseEntity.ok(BaseResponse.ok(data));
    }

    protected <T> ResponseEntity<BaseResponse<T>> success(T data, String message) {
        return ResponseEntity.ok(BaseResponse.ok(data, message));
    }

    protected <T> ResponseEntity<BaseResponse<T>> created(T data) {
        return ResponseEntity.status(201).body(BaseResponse.<T>builder()
                .success(true)
                .status(201)
                .data(data)
                .build());
    }
}
