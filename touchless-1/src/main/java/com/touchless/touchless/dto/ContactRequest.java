package com.touchless.touchless.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ContactRequest(
        @NotBlank(message = "Name is required")
        @Size(max = 60, message = "Name must be at most 60 characters")
        String name,

        @NotBlank(message = "Phone is required")
        @Pattern(regexp = "^[0-9+()\\-xX ]{5,20}$", message = "Phone number looks invalid")
        String phone,

        @Size(max = 8, message = "Avatar must be a single emoji")
        String avatar) {
}
