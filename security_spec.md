# RAKSHchat Security Specification

## Data Invariants
1. A message must belong to a valid chat.
2. A user can only read/write messages in chats where they are a participant.
3. User profiles are only writable by the owner.
4. Chat participant lists are immutable after creation (for private chats).

## Dirty Dozen Payloads
1. Attempt to create a message in a chat where user is NOT a participant.
2. Attempt to read messages from another user's chat.
3. Attempt to update another user's profile displayName.
4. Attempt to delete a chat participant as a non-admin.
5. Attempt to create a chat with a fake timestamp.
6. Attempt to update a message 'text' field after creation (immutability test).
7. Attempt to inject a 2MB string into a message.
8. Attempt to query for ALL chats in the system.
9. Attempt to create a chat with only one participant (self).
10. Attempt to spoof 'senderId' in a message payload.
11. Attempt to add a 'ghost field' to a message.
12. Attempt to read a user's private settings from the public profile.

## Firestore Rules Drafting
I will now generate the fortress rules.
