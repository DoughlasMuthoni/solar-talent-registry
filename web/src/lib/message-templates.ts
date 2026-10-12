/** Ready-made messages for admins. {{name}} = candidate's first name, {{reference}} = application reference. */
export const MESSAGE_TEMPLATES = [
  {
    id: "documents",
    label: "Request documents",
    subject: "Documents needed for your application {{reference}}",
    body: "Hello {{name}},\n\nThank you for applying to Waterlift Solar. To continue with your application ({{reference}}), please reply to this email with:\n\n- a clear photo or PDF of your EPRA solar PV licence\n- any training or safety certificates you mentioned\n\nKind regards,\nWaterlift Solar Recruitment",
  },
  {
    id: "clarify",
    label: "Ask for clarification",
    subject: "A question about your application {{reference}}",
    body: "Hello {{name}},\n\nThank you for your application ({{reference}}). Before we continue, could you tell us more about the largest system you installed and your exact role on that project?\n\nPlease reply to this email.\n\nKind regards,\nWaterlift Solar Recruitment",
  },
  {
    id: "renewal",
    label: "Licence renewal",
    subject: "Your EPRA licence — application {{reference}}",
    body: "Hello {{name}},\n\nOur records show your EPRA licence needs renewal. Please renew it with EPRA and reply with your updated licence details so we can keep your application ({{reference}}) active.\n\nKind regards,\nWaterlift Solar Recruitment",
  },
  {
    id: "pool",
    label: "Welcome to the pool",
    subject: "Welcome to the Waterlift Solar technician pool",
    body: "Hello {{name}},\n\nCongratulations — you have been approved into the Waterlift Solar technician pool. We will contact you as projects in your area come up.\n\nKind regards,\nWaterlift Solar Recruitment",
  },
  {
    id: "regret",
    label: "Not progressing",
    subject: "Your application {{reference}}",
    body: "Hello {{name}},\n\nThank you for your interest in working with Waterlift Solar. After careful review by our team, we will not be taking your application ({{reference}}) further at this time.\n\nYou are welcome to ask us for the reasons, or to apply again in future — for example when your licence class or experience changes.\n\nKind regards,\nWaterlift Solar Recruitment",
  },
] as const;

export const MAX_BULK_RECIPIENTS = 100;
