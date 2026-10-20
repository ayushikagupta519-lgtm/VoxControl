package com.touchless.touchless.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.touchless.touchless.dto.ConversationSummary;
import com.touchless.touchless.dto.MessageRequest;
import com.touchless.touchless.dto.MessageResponse;
import com.touchless.touchless.entity.Message;
import com.touchless.touchless.exception.NotFoundException;
import com.touchless.touchless.repository.ContactRepository;
import com.touchless.touchless.repository.MessageRepository;

@Service
@Transactional
public class MessageService {

    private final MessageRepository messages;
    private final ContactRepository contacts;

    public MessageService(MessageRepository messages, ContactRepository contacts) {
        this.messages = messages;
        this.contacts = contacts;
    }

    /** All messages, or only one conversation when {@code contact} is given. */
    @Transactional(readOnly = true)
    public List<MessageResponse> list(String contact) {
        List<Message> found = (contact == null || contact.isBlank())
                ? messages.findAllByOrderByIdAsc()
                : messages.findByContactNameIgnoreCaseOrderByIdAsc(contact.trim());
        return found.stream().map(MessageResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ConversationSummary> conversations() {
        return contacts.findAllByOrderByNameAsc().stream().map(c -> {
            var last = messages.findFirstByContactNameIgnoreCaseOrderByIdDesc(c.getName());
            return new ConversationSummary(
                    c.getId(),
                    c.getName(),
                    c.getAvatar(),
                    last.map(Message::getMessageText).orElse(null),
                    last.map(Message::isSent).orElse(false),
                    last.map(Message::getCreatedAt).orElse(null));
        }).toList();
    }

    public MessageResponse create(MessageRequest req) {
        // Always store the canonical contact name, whatever casing was dictated.
        var contact = contacts.findByNameIgnoreCase(req.contactName().trim())
                .orElseThrow(() -> new NotFoundException("Contact", req.contactName()));
        boolean sent = req.sent() == null || req.sent();
        Message saved = messages.save(new Message(contact.getName(), req.messageText().trim(), sent));
        return MessageResponse.from(saved);
    }

    public void delete(Long id) {
        if (!messages.existsById(id)) {
            throw new NotFoundException("Message", id);
        }
        messages.deleteById(id);
    }
}
