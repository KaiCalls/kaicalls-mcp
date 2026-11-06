/** A realistic `sms.received` envelope, shaped like KaiCalls buildCommunicationEventWebhookPayload. */
export function smsReceivedEvent(overrides: Record<string, unknown> = {}, data: Record<string, unknown> = {}) {
  return {
    event: "sms.received",
    event_id: "evt_1",
    event_type: "sms.received",
    business_id: "11111111-1111-4111-8111-111111111111",
    occurred_at: "2026-11-06T12:00:00.000Z",
    dedupe_key: "dk_1",
    object: { type: "sms_message", id: "sms_1" },
    correlation: { agent_id: "22222222-2222-4222-8222-222222222222", lead_id: "lead_1" },
    data: {
      sms_message_id: "sms_1",
      conversation_id: "conv_1",
      lead_id: "lead_1",
      lead_name: "Dana",
      direction: "inbound",
      channel: "sms",
      from_phone: "+15551230000",
      to_phone: "+15559870000",
      content: "Do you have a table at 7?",
      media_count: 0,
      conversation_owner: "external",
      agent_connection_id: "conn_1",
      external_agent_id: "openclaw:test",
      ...data,
    },
    content_annotations: {
      "data.content": { content_trust: "third_party", source: "sms", injection_suspected: false },
    },
    ...overrides,
  };
}
