package com.touchless.touchless.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.touchless.touchless.entity.Contact;

public interface ContactRepository extends JpaRepository<Contact, Long> {

    List<Contact> findAllByOrderByNameAsc();

    Optional<Contact> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
