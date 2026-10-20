package com.touchless.touchless.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReminderRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 120, message = "Title must be at most 120 characters")
        String title,

        @Size(max = 60, message = "Time must be at most 60 characters")
        String reminderTime) {
}
