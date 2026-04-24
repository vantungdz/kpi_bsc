package com.company.kpi.response.pm;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
public class TimelineEventDto {
    private Long eventId;
    private String type;
    private LocalDateTime timestamp;
    private Long actorId;
    private String actorName;
    private String description;
}
