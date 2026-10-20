package com.touchless.touchless.dto;

import com.touchless.touchless.entity.Contact;

public record ContactResponse(Long id, String name, String phone, String avatar) {

    public static ContactResponse from(Contact c) {
        return new ContactResponse(c.getId(), c.getName(), c.getPhone(), c.getAvatar());
    }
}
