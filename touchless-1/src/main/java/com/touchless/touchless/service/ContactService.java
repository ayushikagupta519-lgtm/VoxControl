package com.touchless.touchless.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.touchless.touchless.dto.ContactRequest;
import com.touchless.touchless.dto.ContactResponse;
import com.touchless.touchless.entity.Contact;
import com.touchless.touchless.exception.ConflictException;
import com.touchless.touchless.exception.NotFoundException;
import com.touchless.touchless.repository.ContactRepository;
import com.touchless.touchless.repository.MessageRepository;

@Service
@Transactional
public class ContactService {

    private static final String DEFAULT_AVATAR = "👤";

    private final ContactRepository contacts;
    private final MessageRepository messages;

    public ContactService(ContactRepository contacts, MessageRepository messages) {
        this.contacts = contacts;
        this.messages = messages;
    }

    @Transactional(readOnly = true)
    public List<ContactResponse> list() {
        return contacts.findAllByOrderByNameAsc().stream().map(ContactResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ContactResponse get(Long id) {
        return ContactResponse.from(find(id));
    }

    public ContactResponse create(ContactRequest req) {
        String name = req.name().trim();
        if (contacts.existsByNameIgnoreCase(name)) {
            throw new ConflictException("A contact named '" + name + "' already exists");
        }
        Contact saved = contacts.save(new Contact(name, req.phone().trim(), avatarOrDefault(req.avatar())));
        return ContactResponse.from(saved);
    }

    public ContactResponse update(Long id, ContactRequest req) {
        Contact contact = find(id);
        String newName = req.name().trim();

        boolean renamed = !contact.getName().equalsIgnoreCase(newName);
        if (renamed && contacts.existsByNameIgnoreCase(newName)) {
            throw new ConflictException("A contact named '" + newName + "' already exists");
        }
        if (!contact.getName().equals(newName)) {
            // Messages reference the contact by name, so keep them attached.
            String oldName = contact.getName();
            messages.findByContactNameIgnoreCaseOrderByIdAsc(oldName)
                    .forEach(m -> m.setContactName(newName));
        }
        contact.setName(newName);
        contact.setPhone(req.phone().trim());
        contact.setAvatar(avatarOrDefault(req.avatar()));
        return ContactResponse.from(contact);
    }

    public void delete(Long id) {
        Contact contact = find(id);
        messages.deleteByContactNameIgnoreCase(contact.getName());
        contacts.delete(contact);
    }

    private Contact find(Long id) {
        return contacts.findById(id).orElseThrow(() -> new NotFoundException("Contact", id));
    }

    private String avatarOrDefault(String avatar) {
        return (avatar == null || avatar.isBlank()) ? DEFAULT_AVATAR : avatar.trim();
    }
}
