package com.touchless.touchless.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.touchless.touchless.entity.Message;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findAllByOrderByIdAsc();

    List<Message> findByContactNameIgnoreCaseOrderByIdAsc(String contactName);

    Optional<Message> findFirstByContactNameIgnoreCaseOrderByIdDesc(String contactName);

    void deleteByContactNameIgnoreCase(String contactName);
}
