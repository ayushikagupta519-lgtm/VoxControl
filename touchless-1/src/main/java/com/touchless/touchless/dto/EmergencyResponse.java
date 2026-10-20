package com.touchless.touchless.dto;

import java.time.Instant;

import com.touchless.touchless.entity.EmergencyAlert;
import com.touchless.touchless.entity.EmergencyType;

public record EmergencyResponse(Long id, EmergencyType type, String note, Instant createdAt) {

    public static EmergencyResponse from(EmergencyAlert a) {
        return new EmergencyResponse(a.getId(), a.getType(), a.getNote(), a.getCreatedAt());
    }
}
