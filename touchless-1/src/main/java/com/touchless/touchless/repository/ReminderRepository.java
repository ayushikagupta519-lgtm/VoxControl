package com.touchless.touchless.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.touchless.touchless.entity.Reminder;

public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    /** Open reminders first, then completed ones; newest first inside each group. */
    List<Reminder> findAllByOrderByCompletedAscIdDesc();
}
