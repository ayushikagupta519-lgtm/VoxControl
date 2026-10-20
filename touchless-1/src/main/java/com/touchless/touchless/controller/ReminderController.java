package com.touchless.touchless.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.touchless.touchless.dto.ReminderRequest;
import com.touchless.touchless.dto.ReminderResponse;
import com.touchless.touchless.service.ReminderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {

    private final ReminderService service;

    public ReminderController(ReminderService service) {
        this.service = service;
    }

    @GetMapping
    public List<ReminderResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReminderResponse create(@Valid @RequestBody ReminderRequest request) {
        return service.create(request);
    }

    /** PUT /api/reminders/{id}/complete?completed=true|false  (same contract as before). */
    @PutMapping("/{id}/complete")
    public ReminderResponse setCompleted(@PathVariable Long id,
                                         @RequestParam(defaultValue = "true") boolean completed) {
        return service.setCompleted(id, completed);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
