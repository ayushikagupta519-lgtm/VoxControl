package com.touchless.touchless.dto;

import java.time.Instant;

import com.touchless.touchless.entity.Message;

public record MessageResponse(Long id, String contactName, String messageText, boolean sent, Instant createdAt) {

    public static MessageResponse from(Message m) {
        return new MessageResponse(m.getId(), m.getContactName(), m.getMessageText(), m.isSent(), m.getCreatedAt());
    }
}
