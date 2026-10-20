package com.touchless.touchless.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.touchless.touchless.entity.Contact;
import com.touchless.touchless.entity.Message;
import com.touchless.touchless.entity.Reminder;
import com.touchless.touchless.repository.ContactRepository;
import com.touchless.touchless.repository.MessageRepository;
import com.touchless.touchless.repository.ReminderRepository;

/** Fills an empty database with the demo contacts, chats and reminders. */
@Configuration
public class DemoDataSeeder {

    @Bean
    CommandLineRunner seedDemoData(
            @Value("${voxcontrol.seed-demo-data:true}") boolean enabled,
            ContactRepository contacts,
            MessageRepository messages,
            ReminderRepository reminders) {

        return args -> {
            if (!enabled || contacts.count() > 0) {
                return;
            }
            contacts.save(new Contact("Rahul", "98xxxxxx12", "🧑"));
            contacts.save(new Contact("Priya", "97xxxxxx45", "👩"));
            contacts.save(new Contact("Mom", "99xxxxxx78", "👩‍🦳"));
            contacts.save(new Contact("Dad", "98xxxxxx90", "👨"));

            if (messages.count() == 0) {
                messages.save(new Message("Rahul", "Are you coming today?", false));
                messages.save(new Message("Priya", "Send me the notes.", false));
                messages.save(new Message("Mom", "Call me when you are free.", false));
            }
            if (reminders.count() == 0) {
                reminders.save(new Reminder("Take medicine", "8 pm"));
                reminders.save(new Reminder("Call the doctor", "Tomorrow 10 am"));
            }
        };
    }
}
