package com.company.kpi.request.gm;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class AddDepartmentMembersRequest {

    @NotEmpty
    @Size(max = 200)
    private List<UUID> userIds;
}
