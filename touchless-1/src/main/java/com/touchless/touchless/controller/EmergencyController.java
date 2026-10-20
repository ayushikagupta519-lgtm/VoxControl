package com.touchless.touchless.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.touchless.touchless.dto.EmergencyRequest;
import com.touchless.touchless.dto.EmergencyResponse;
import com.touchless.touchless.service.EmergencyService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/emergency")
public class EmergencyController {

    private final EmergencyService service;

    public EmergencyController(EmergencyService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EmergencyResponse raise(@Valid @RequestBody EmergencyRequest request) {
        return service.raise(request);
    }

    @GetMapping
    public List<EmergencyResponse> recent() {
        return service.recent();
    }
}
