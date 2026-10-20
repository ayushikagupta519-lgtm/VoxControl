package com.touchless.touchless.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;

@Entity
public class EmergencyAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmergencyType type;

    @Column(length = 200)
    private String note;

    private Instant createdAt;

    protected EmergencyAlert() {
    }

    public EmergencyAlert(EmergencyType type, String note) {
        this.type = type;
        this.note = note;
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public Long getId() { return id; }
    public EmergencyType getType() { return type; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
}
