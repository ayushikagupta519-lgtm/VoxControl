package com.touchless.touchless.dto;

import java.time.Instant;

import com.touchless.touchless.entity.Reminder;

public record ReminderResponse(Long id, String title, String reminderTime, boolean completed, Instant createdAt) {

    public static ReminderResponse from(Reminder r) {
        return new ReminderResponse(r.getId(), r.getTitle(), r.getReminderTime(), r.isCompleted(), r.getCreatedAt());
    }
}
