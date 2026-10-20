package com.touchless.touchless;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.web.WebAppConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.jayway.jsonpath.JsonPath;

/** End-to-end tests of the REST API against an in-memory H2 database. */
@SpringBootTest
@WebAppConfiguration
class ApiIntegrationTests {

    @Autowired
    WebApplicationContext context;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private static final MediaType JSON = MediaType.APPLICATION_JSON;

    @Test
    void seededContactsAreListedAlphabetically() throws Exception {
        mvc.perform(get("/api/contacts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Dad"));
    }

    @Test
    void contactLifecycle() throws Exception {
        MvcResult created = mvc.perform(post("/api/contacts").contentType(JSON)
                        .content("{\"name\":\"Asha\",\"phone\":\"98765 43210\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.avatar").value("👤"))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        // duplicate name (case-insensitive) is rejected
        mvc.perform(post("/api/contacts").contentType(JSON)
                        .content("{\"name\":\"asha\",\"phone\":\"12345\"}"))
                .andExpect(status().isConflict());

        mvc.perform(put("/api/contacts/" + id).contentType(JSON)
                        .content("{\"name\":\"Asha K\",\"phone\":\"11111\",\"avatar\":\"🧕\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Asha K"));

        mvc.perform(delete("/api/contacts/" + id)).andExpect(status().isNoContent());
        mvc.perform(get("/api/contacts/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void invalidContactReturnsFieldErrors() throws Exception {
        mvc.perform(post("/api/contacts").contentType(JSON).content("{\"name\":\"\",\"phone\":\"abc\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.name").exists())
                .andExpect(jsonPath("$.errors.phone").exists());
    }

    @Test
    void messagesAreFilteredByContactAndCanBeDeleted() throws Exception {
        MvcResult created = mvc.perform(post("/api/messages").contentType(JSON)
                        .content("{\"contactName\":\"rahul\",\"messageText\":\"  See you soon  \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.contactName").value("Rahul"))   // canonical casing
                .andExpect(jsonPath("$.messageText").value("See you soon"))
                .andExpect(jsonPath("$.sent").value(true))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mvc.perform(get("/api/messages").param("contact", "Rahul"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id == " + id + ")]").exists());

        mvc.perform(get("/api/messages/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.contactName == 'Rahul')]").exists());

        mvc.perform(delete("/api/messages/" + id)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/messages/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void messageToUnknownContactIsRejected() throws Exception {
        mvc.perform(post("/api/messages").contentType(JSON)
                        .content("{\"contactName\":\"Nobody\",\"messageText\":\"hi\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/messages").contentType(JSON)
                        .content("{\"contactName\":\"Rahul\",\"messageText\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void reminderLifecycle() throws Exception {
        MvcResult created = mvc.perform(post("/api/reminders").contentType(JSON)
                        .content("{\"title\":\"Buy milk\",\"reminderTime\":\"6 pm\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.completed").value(false))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mvc.perform(put("/api/reminders/" + id + "/complete").param("completed", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true));

        mvc.perform(delete("/api/reminders/" + id)).andExpect(status().isNoContent());
        mvc.perform(put("/api/reminders/" + id + "/complete")).andExpect(status().isNotFound());
    }

    @Test
    void emergencyAlertIsLoggedAndBadTypeRejected() throws Exception {
        mvc.perform(post("/api/emergency").contentType(JSON).content("{\"type\":\"FAMILY\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("FAMILY"));
        mvc.perform(get("/api/emergency"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("FAMILY"));
        mvc.perform(post("/api/emergency").contentType(JSON).content("{\"type\":\"ALIENS\"}"))
                .andExpect(status().isBadRequest());
    }
}
