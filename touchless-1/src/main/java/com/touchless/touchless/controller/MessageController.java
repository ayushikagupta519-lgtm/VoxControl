package com.touchless.touchless.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.touchless.touchless.dto.ConversationSummary;
import com.touchless.touchless.dto.MessageRequest;
import com.touchless.touchless.dto.MessageResponse;
import com.touchless.touchless.service.MessageService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService service;

    public MessageController(MessageService service) {
        this.service = service;
    }

    /** GET /api/messages  or  GET /api/messages?contact=Rahul */
    @GetMapping
    public List<MessageResponse> list(@RequestParam(required = false) String contact) {
        return service.list(contact);
    }

    /** Inbox: every contact with their latest message. */
    @GetMapping("/conversations")
    public List<ConversationSummary> conversations() {
        return service.conversations();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse create(@Valid @RequestBody MessageRequest request) {
        return service.create(request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
