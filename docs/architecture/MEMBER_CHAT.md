# Author-member conversations

5 November 2026. A single backend process uses Socket.IO 4.8.4 for live delivery hints and MySQL for durable conversations, messages and read positions. REST writes share the existing authenticated API/session lifecycle. There is no Kafka, message broker, Redis socket adapter or claim of multi-process fan-out.

## Access and privacy

One conversation belongs to an author and a reader. Both may initiate it while the reader has eligible membership with that author. The reader cannot select another participant; an author can select an eligible member. Administrators receive no private-conversation privilege. The common entitlement service governs creation, joining, history and sending. A hidden/unapproved/inactive author is unavailable.

Members lose restricted history access when membership expires or is revoked. Authors retain their own conversation history, but sending in either direction requires an eligible member. Conversation summaries then expose only participant titles/inactive status to the existing participant, with zero unread count for a locked member. They contain no message previews. Restoring eligibility restores authorized history; records are not deleted.

Socket handshakes require a trusted Origin, caller identity and purpose-bound RS256 access token. Durable session checks and JTI revocation apply on connection, joining, each delivery and periodic checks. There are at most five sockets per user. Access tokens travel in handshake auth, never URL query strings. Joining is throttled; the client retries one rapid-switch rejection. A 15-second heartbeat disconnects invalid sessions and clears a member's selected conversation on expiry. Every outgoing body is freshly authorized, so expiry does not wait for that heartbeat to stop new delivery. Previously delivered text cannot be recalled from a reader's own copies.

## Persistence and recovery

Messages are plain text, at most 4,000 characters; React renders them as text. A stable sender-scoped UUID and payload hash make retries idempotent and reject conflicting reuse. A user lock serializes sends, then a conversation lock orders writes. New sends are limited to 30/minute and 1,000/day. Twelve concurrent retries are covered by a real database regression.

Conversation creation locks the shared author parent before insertion. An earlier implementation locked the initiating user's row; concurrent author/member creation reproduced a foreign-key deadlock. The common parent order fixes that race without discarding either request. The unique author/member constraint still guarantees one conversation. The regression repeats first creation from both sides across twelve reader fixtures.

Authorization queries accept the transaction's existing connection. Requesting another pool connection while holding locks can exhaust a bounded pool under concurrent retries; the shared entitlement repositories now accept a connection explicitly. The same seam removes that risk from checkout quoting. A dedicated conversation-summary repository performs one bounded query using the shared active-membership SQL predicate, avoiding authorization query fan-out per sidebar row.

Local events are emitted only after persistence. The socket hub filters to the two participants, then checks each recipient/session before emitting a body. Disconnected clients recover from cursor-paginated history on reconnect. Socket.IO connection-state packet replay is not enabled because cached protected packets could outlive eligibility. A failed live hint does not undo a committed message; history remains the recovery source. No transactional outbox is necessary for this best-effort hint contract.

Read positions only advance and must reference a message in that conversation. Unread totals exclude the caller's own messages. Histories and conversation lists use decreasing ID cursors, 50 rows per page; history pages render chronologically. The UI merges persisted IDs to handle acknowledgments and socket echoes without duplicate bubbles. Lost acknowledgments retain the composer and client UUID; retry returns the same row. Unsent text is memory-only and is cleared on conversation switch or leaving the page. It is not an offline durable queue.

## Verification and deployment limits

Real MySQL/socket tests cover creation races, cross-user/admin denial, forged tokens, wrong token identity, untrusted Origin, socket delivery, pagination, monotonic/scoped read state, expiry, reconnect denial, stale delivery suppression, rates and revoked sessions. The headed browser journey exchanges messages, goes offline/reconnects, loses a committed acknowledgment, verifies one stored row, reloads history, checks mobile layout and expires the membership.

Deploy one backend instance for this implementation and proxy `/socket.io/` with WebSocket upgrade support. Scaling to multiple instances requires a supported adapter and routing strategy; adding it without a deployment need would add complexity. There are no file attachments, push notifications or read-receipt guarantee for inactive tabs. Read state updates while the conversation is visible/focused.

References: [Socket.IO middleware](https://socket.io/docs/v4/middlewares/), [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [connection recovery](https://socket.io/docs/v4/connection-state-recovery/).
