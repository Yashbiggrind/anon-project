export type LegalPage = "privacy" | "terms" | "rules" | "grievance" | "transparency";

export type LegalSection = {
  heading: string;
  items: string[];
};

export type LegalDoc = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
  footer?: string;
  updated?: string;
};

export const LEGAL: Record<LegalPage, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "What we never collect, what we hold for a moment, and what happens the second you leave.",
    updated: "24 September 2026",
    sections: [
      { heading: "What we never collect", items: ["No name, no email, no phone number.", "No profile photo, no social account, no password — there is no account.", "No home address, no location, no device fingerprinting.", "No third-party advertising pixels, no cross-site tracking cookies.", "No permanent identity — nothing about you is carried between visits."] },
      { heading: "What we hold while you are here", items: ["A temporary anonymous name, generated on arrival and destroyed on departure.", "Your messages — held only in the server's memory, never written to disk.", "Your session ID, used to keep you connected while the tab is open.", "A cryptographic hash of your IP address — used only to block repeat abusers."] },
      { heading: "What happens when you leave", items: ["Your session ends the moment you close the tab.", "Your messages stop existing on the server.", "Your anonymous name is discarded and never reused."] },
      { heading: "What we retain for safety and law", items: ["A hashed connection identifier for 180 days — required by Rule 3(1)(h) of the IT Rules, 2021.", "This hash cannot be reversed back into your identity, but can be matched if you return.", "Reports submitted by other users are retained for moderation and legal compliance.", "Anti-spam strikes decay automatically and are purged when no longer needed."] },
      { heading: "Your rights under the DPDP Act, 2023", items: ["You have the right to know what data we hold and to request correction or erasure.", "Because we don't link data to a permanent identity, we may not be able to locate your specific data beyond the retention windows above.", "To exercise these rights, contact our Grievance Officer — details on the Grievance page.", "In the event of a data breach we will notify the Data Protection Board of India within 48 hours."] },
      { heading: "What we are not", items: ["We are anonymous to other users — that is our promise.", "We are not invisible to the law — we do not pretend to be untraceable.", "We do not sell your data. There is nothing to sell.", "We do not silently ship your messages to third-party AI services."] },
    ],
    footer: "For privacy questions, use the Grievance Officer contact on the Grievance page.",
  },

  terms: {
    title: "Terms of Service",
    subtitle: "The rules you agree to the moment you step through the door.",
    updated: "24 September 2026",
    sections: [
      { heading: "Who can use this", items: ["You must be 18 years or older to use this platform.", "By entering, you confirm you meet this requirement.", "By continuing, you agree to these Terms and to our Privacy Policy."] },
      { heading: "What you agree to", items: ["You will not use ANON for anything illegal under Indian law or the laws of your jurisdiction.", "You will not attempt to break, overload, or scrape the service.", "You will not impersonate other users or manipulate your identity to deceive.", "You will not post content that belongs to another person without consent.", "You understand that anything you post in a public room can be seen by strangers."] },
      { heading: "Prohibited content — Rule 3, IT Rules 2021", items: ["Content that is grossly harmful, harassing, defamatory, obscene, pornographic, paedophilic, libellous, or invasive of another's privacy.", "Content that is hateful, racially or ethnically objectionable, or disparaging on the basis of religion, caste, gender, or sexual orientation.", "Content that relates to or encourages money laundering, gambling, or any unlawful activity.", "Content that harms minors in any way, including child sexual abuse material (CSAM).", "Content that infringes any patent, trademark, copyright, or other proprietary right.", "Content that threatens the unity, integrity, defence, security, or sovereignty of India.", "Content that impersonates another person or misleads about the origin of a message.", "Any software virus, malware, or code designed to interrupt or damage a computer resource."] },
      { heading: "Our rights", items: ["We may remove any content, at any time, without notice.", "We may block or ban any session that violates these terms.", "We may report illegal activity to law enforcement.", "We may shut down the service, in whole or in part, at any time."] },
      { heading: "Lawful orders and cooperation", items: ["ANON complies with all lawful orders under Section 69A of the IT Act, 2000, and with valid court orders.", "We remove or disable access to unlawful content within 36 hours of a reasoned order from an authorised authority.", "We cooperate with lawfully authorised agencies within 72 hours of a valid written request.", "We retain the hashed connection data described in the Privacy Policy for 180 days, as required by law."] },
      { heading: "No warranty", items: ["ANON is provided \"as is\" and \"as available\".", "We do not guarantee uptime, safety, or the accuracy of anything said by users.", "You use this platform at your own risk. Never share personal information with strangers."] },
      { heading: "Legal status", items: ["ANON operates as an intermediary under Section 2(1)(w) of the IT Act, 2000.", "We do not initiate, transmit, or modify user content.", "Our safe harbour under Section 79 of the IT Act applies subject to our compliance with the IT Rules, 2021.", "These Terms are governed by the laws of India, with exclusive jurisdiction in Indian courts."] },
      { heading: "Grievance Officer", items: ["For complaints, legal notices, or takedown requests, see the Grievance page.", "Email: grievance@anon.chat", "Acknowledgement within 24 hours.", "Resolution within 15 days, as required by the IT Rules, 2021."] },
    ],
    footer: "Continued use of ANON means you accept these terms. If you do not, close the tab.",
  },

  rules: {
    title: "Community Guidelines",
    subtitle: "You can talk about almost anything here. These are the few lines you must not cross.",
    updated: "24 September 2026",
    sections: [
      { heading: "How we talk here", items: ["Be kind when someone is struggling — you do not know their day.", "Disagree with ideas, not with a person's right to exist.", "Vent, argue, confess. That is what this place is for."] },
      { heading: "Strictly banned", items: ["Anything sexual involving minors — zero tolerance. We report this to authorities immediately.", "Content promoting terrorism or threatening the sovereignty and integrity of India.", "Sharing someone's real identity or location without their consent.", "Threats of violence, against anyone.", "Spam links, referral codes, or advertising.", "Soliciting money, crypto, or financial details.", "Impersonating other anonymous users to deceive."] },
      { heading: "How enforcement works", items: ["Enforcement is progressive and behavioural — never based on who you are.", "First offence: soft warning.", "Repeated offences: short cooldown.", "Sustained abuse: longer cooldown.", "Continued abuse: temporary shadow-ban — your messages become visible only to you.", "Serious offences (CSAM, terrorism): immediate permanent action."] },
      { heading: "If you see something wrong", items: ["Tap the report button next to any message or in the online list.", "Tap block to disappear someone from your session instantly.", "Reports go to a moderator queue. Blocks are private — the other person is never told.", "For serious matters, contact the Grievance Officer directly."] },
      { heading: "If you are in crisis", items: ["If you or someone here is in danger, please reach a real human:", "India — iCall: 9152987821", "India — Vandrevala Foundation: 1860 2662 345", "International — findahelpline.com"] },
    ],
    footer: "Break these rules and you will be blocked, banned, or reported. Otherwise, welcome.",
  },

  grievance: {
    title: "Grievance Officer",
    subtitle: "How to raise a complaint, request a takedown, or exercise your data rights under Indian law.",
    updated: "24 September 2026",
    sections: [
      { heading: "Why this page exists", items: ["Rule 3(2) of the IT Rules, 2021 requires every intermediary to appoint a Grievance Officer.", "The Grievance Officer is your direct point of contact for complaints, legal notices, and data requests.", "This page fulfils that legal obligation."] },
      { heading: "Contact", items: ["Grievance Officer: [Your Name]", "Email: grievance@anon.chat", "Phone: [Your Indian phone number]", "Address: [Your business address in India]", "Working hours: Monday–Friday, 10:00 AM – 6:00 PM IST."] },
      { heading: "What you can complain about", items: ["Content that violates our Community Guidelines or applicable Indian law.", "A moderation action you believe was taken in error.", "Requests under the Digital Personal Data Protection Act, 2023.", "Any other concern about the operation of the service."] },
      { heading: "Our response timelines", items: ["Acknowledgement of your complaint: within 24 hours.", "Resolution: within 15 days.", "Court-ordered takedowns under Section 69A: content removed within 36 hours.", "Law enforcement requests: cooperation within 72 hours of a valid written request."] },
      { heading: "What to include", items: ["Your session ID (if you have it) or the approximate time of the incident.", "A clear description of the problem.", "Any relevant screenshots or context.", "Your preferred contact method for our response."] },
      { heading: "Escalation", items: ["If you are not satisfied with our resolution, you may escalate to the appropriate authority under the IT Rules, 2021.", "You may also approach a court of competent jurisdiction in India.", "We maintain records of every complaint and its resolution for the period required by law."] },
    ],
    footer: "We take every complaint seriously. If you believe the law has been violated, please write to us.",
  },

  transparency: {
    title: "Transparency Report",
    subtitle: "How ANON fights abuse without tracking you.",
    updated: "24 September 2026",
    sections: [
      { heading: "Why this report exists", items: ["ANON is an anonymous platform. We believe anonymity and safety are not opposites.", "This report explains how we protect users from abuse without building permanent profiles.", "It exists so that anyone — user, journalist, regulator — can verify how we operate."] },
      { heading: "Our anti-abuse engine", items: ["ANON uses a multi-layer behavioural engine that analyses patterns, not identities.", "Duplicate detection: catches the same message sent repeatedly.", "Burst detection: catches rapid bursts within seconds.", "Link-spam detection: catches excessive URLs in a short window.", "Repetition detection: catches the same content across a longer window.", "Behavioural deviation: compares current behaviour to a session's own baseline.", "Image-spam detection: images pass through the same engine as text.", "The engine has no knowledge of who you are. It only sees behaviour in the current session."] },
      { heading: "Progressive enforcement", items: ["We never permanently ban users for ordinary spam. Enforcement escalates gradually:", "Level 1: soft warning, visible only to you.", "Level 2: short cooldown.", "Level 3: longer cooldown.", "Level 4: temporary shadow-ban — your messages become visible only to you.", "Level 4 decays automatically. It is not a permanent record.", "Serious offences (CSAM, terrorism): immediate permanent action."] },
      { heading: "What we do not do", items: ["We do not build permanent behavioural profiles.", "We do not sell or share user data with advertisers.", "We do not use browser or device fingerprinting.", "We do not track users across the web.", "We do not use AI to make final moderation decisions — AI signals are advisory only.", "We do not silently feed your messages to third-party large language models."] },
      { heading: "Cooperation with law enforcement", items: ["ANON complies with all lawful orders from Indian courts and authorised agencies.", "We act under Section 69A of the IT Act, 2000, and under valid court orders.", "We retain hashed IP addresses for 180 days, as required by Rule 3(1)(h) of the IT Rules, 2021.", "We do not proactively monitor users. We act only when presented with a valid legal request.", "We do not disclose the content of private communications except as compelled by a valid court order."] },
      { heading: "Reporting a problem", items: ["If you encounter abuse, use the Report button or contact the Grievance Officer.", "Every report is reviewed.", "If you are a researcher or journalist, write to us to discuss our moderation practices."] },
    ],
    footer: "Anonymity and accountability can coexist. This report is our attempt to prove it.",
  },
};