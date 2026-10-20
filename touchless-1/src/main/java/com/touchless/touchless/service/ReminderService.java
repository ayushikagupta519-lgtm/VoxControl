package com.touchless.touchless.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.touchless.touchless.dto.ReminderRequest;
import com.touchless.touchless.dto.ReminderResponse;
import com.touchless.touchless.entity.Reminder;
import com.touchless.touchless.exception.NotFoundException;
import com.touchless.touchless.repository.ReminderRepository;

@Service
@Transactional
public class ReminderService {

    private final ReminderRepository reminders;

    public ReminderService(ReminderRepository reminders) {
        this.reminders = reminders;
    }

    @Transactional(readOnly = true)
    public List<ReminderResponse> list() {
        return reminders.findAllByOrderByCompletedAscIdDesc().stream().map(ReminderResponse::from).toList();
    }

    public ReminderResponse create(ReminderRequest req) {
        String time = req.reminderTime() == null ? null : req.reminderTime().trim();
        Reminder saved = reminders.save(new Reminder(req.title().trim(), time));
        return ReminderResponse.from(saved);
    }

    public ReminderResponse setCompleted(Long id, boolean completed) {
        Reminder reminder = reminders.findById(id).orElseThrow(() -> new NotFoundException("Reminder", id));
        reminder.setCompleted(completed);
        return ReminderResponse.from(reminder);
    }

    public void delete(Long id) {
        if (!reminders.existsById(id)) {
            throw new NotFoundException("Reminder", id);
        }
        reminders.deleteById(id);
    }
}
