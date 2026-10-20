# VoxControl

A hands-free, voice-controlled phone-style interface: messages, contacts, reminders, calls (simulated) and emergency alerts.
Spring Boot 4 backend + a dependency-free ES-module frontend served from `src/main/resources/static`.

## Run

```bash
./mvnw spring-boot:run            # H2 file database in ./data - nothing to install
# open http://localhost:8080  (Chrome or Edge for voice input; other browsers can type commands)
```

MySQL instead of H2:

```bash
DB_URL=jdbc:mysql://localhost:3306/touchless_db DB_USER=root DB_PASSWORD=*** \
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

Demo contacts, chats and reminders are inserted on first start (`voxcontrol.seed-demo-data=false` disables it).

## REST API

| Method & path | Notes |
|---|---|
| `GET/POST /api/contacts`, `GET/PUT/DELETE /api/contacts/{id}` | unique names (409), phone validation |
| `GET /api/messages?contact=Rahul` | one conversation; omit for all |
| `GET /api/messages/conversations` | inbox: every contact + latest message |
| `POST /api/messages`, `DELETE /api/messages/{id}` | contact must exist (404); text 1-1000 chars |
| `GET/POST /api/reminders`, `PUT /api/reminders/{id}/complete?completed=`, `DELETE /api/reminders/{id}` | open reminders sorted first |
| `POST /api/emergency` `{type: FAMILY\|TRUSTED_CONTACT}`, `GET /api/emergency` | alert history |

Errors are RFC 9457 problem-detail JSON: `{status, title, detail, errors?{field: message}}`.

## Tests

```bash
./mvnw test                          # REST API integration tests (H2 in memory)
node src/test/js/commands.test.mjs   # voice-command interpreter
```

## Voice commands
"Open messages / contacts / reminders", "Call Mom", "Open Priya's contact", "Send message to Rahul",
"Tell Dad I'm on my way", "Remind me to take medicine at 8 pm", "Complete take medicine",
"Delete reminder buy milk", "Emergency", "End call", "Stop listening", "What can I say?".
In the browser console, `voxcontrol.run('open messages')` behaves as if you had said it.
