package com.touchless.touchless.dto;

import java.time.Instant;

/** One row of the Messages inbox: a contact plus their latest message (if any). */
public record ConversationSummary(
        Long contactId,
        String contactName,
        String avatar,
        String lastMessage,
        boolean lastMessageSent,
        Instant lastMessageAt) {
}
