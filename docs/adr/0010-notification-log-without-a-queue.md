# A Notification is sent in its own request and logged per Subscription, with no Queue

Sending a Notification creates a stored Notification and one Delivery per Subscription, then sends them in the request that asked for it. The route awaits the send, so the Owner sees "Sent to 3 of 4", and hands the same promise to `ctx.waitUntil`, so a closed tab doesn't cancel it. A send that stops anyway leaves its Deliveries `pending` or `failed`, and "Finish sending" sends those again with the stored text; nothing retries on its own.

A Cloudflare Queue would survive any Worker failure and retry by itself, but it adds a consumer Worker and its deploy and loses the immediate count, for Sites whose Subscriptions number in the dozens. The log gives the Owner what a retry would hide: which devices got the message, and a way to finish, reaching only the devices still outstanding.

## Consequences

- `waitUntil` gives a send 30 seconds after a client disconnects. A Site with enough Subscriptions to outrun that needs Finish sending, or a Queue.
- Statuses are written after each batch of 20, so a Worker killed mid-batch leaves those Deliveries `pending` and Finish sending can reach those devices twice.
- Delivered means the push service accepted the message, which is as much as web push tells the server.
- A Delivery belongs to its Notification and outlives its Subscription. It keeps a copy of the device label, and nothing else about the device, for as long as the Site exists.
