package com.touchless.touchless.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.touchless.touchless.entity.EmergencyAlert;

public interface EmergencyAlertRepository extends JpaRepository<EmergencyAlert, Long> {

    List<EmergencyAlert> findTop20ByOrderByIdDesc();
}
