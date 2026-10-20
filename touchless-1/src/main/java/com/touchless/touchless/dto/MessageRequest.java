package com.touchless.touchless.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code sent} defaults to true (a message typed by the user). */
public record MessageRequest(
        @NotBlank(message = "Contact name is required")
        @Size(max = 60)
        String contactName,

        @NotBlank(message = "Message cannot be empty")
        @Size(max = 1000, message = "Message must be at most 1000 characters")
        String messageText,

        Boolean sent) {
}
