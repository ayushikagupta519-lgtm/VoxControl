package com.touchless.touchless.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.touchless.touchless.dto.EmergencyRequest;
import com.touchless.touchless.dto.EmergencyResponse;
import com.touchless.touchless.entity.EmergencyAlert;
import com.touchless.touchless.repository.EmergencyAlertRepository;

@Service
@Transactional
public class EmergencyService {

    private final EmergencyAlertRepository alerts;

    public EmergencyService(EmergencyAlertRepository alerts) {
        this.alerts = alerts;
    }

    public EmergencyResponse raise(EmergencyRequest req) {
        String note = req.note() == null || req.note().isBlank() ? null : req.note().trim();
        return EmergencyResponse.from(alerts.save(new EmergencyAlert(req.type(), note)));
    }

    @Transactional(readOnly = true)
    public List<EmergencyResponse> recent() {
        return alerts.findTop20ByOrderByIdDesc().stream().map(EmergencyResponse::from).toList();
    }
}
