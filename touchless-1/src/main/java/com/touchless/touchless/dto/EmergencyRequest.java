package com.touchless.touchless.dto;

import com.touchless.touchless.entity.EmergencyType;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EmergencyRequest(
        @NotNull(message = "Emergency type is required (FAMILY or TRUSTED_CONTACT)")
        EmergencyType type,

        @Size(max = 200)
        String note) {
}
