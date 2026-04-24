package com.company.kpi.entity;

import lombok.Data;

import com.company.kpi.entity.base.BaseEntity;

@Data
public class SysStatusCode extends BaseEntity {
    private Integer code;
    private String category;
    private String name;
    private String description;
}