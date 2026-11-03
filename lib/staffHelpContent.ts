export type StaffHelpTopic = {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  routePrefixes: string[];
  steps: string[];
  important?: string;
  image?: string;
};

export const STAFF_HELP_TOPICS: StaffHelpTopic[] = [
  {
    id: "scan-member",
    title: "Scan / check in a member",
    summary: "Scan a physical card or BGM number and check the access result before allowing entry.",
    keywords: ["scan", "card", "check in", "check-in", "access", "expired", "inactive", "photo", "photo required", "green", "red", "member number", "bgm number", "single gym", "all access", "offline cached"],
    routePrefixes: ["/staff"],
    image: "/staff-help/scan-member.png",
    steps: [
      "Scan the member card. The scanner normally sends the code automatically. You can also type the BGM number in the scanner box and press Scan.",
      "Look at the result before letting the person through.",
      "GREEN = ACCESS GRANTED. Check the member name and photo before allowing entry.",
      "RED = STOP. Do not allow access until the issue is resolved.",
      "If the result says the member has access to one named gym only, this is a Single Gym membership. Access is denied at any other gym.",
      "If OFFLINE CACHED ACCESS appears, follow the access result shown on screen. The result came from the saved offline roster and no live check-in has been recorded yet.",
      "If PHOTO REQUIRED appears, take or upload an official photo if possible, then use Cancel / Scan Next when finished.",
    ],
    important: "If a membership is expired, use Renew. If a card is not found or is ambiguous, open Members and verify the correct person. Never override a Single Gym restriction just because the membership is otherwise active.",
  },
  {
    id: "find-member",
    title: "Find a member",
    summary: "Search for a member to check identity, status, expiry, access, card details or begin a renewal.",
    keywords: ["find", "search", "member", "name", "id", "phone", "email", "card number", "pkcustomer", "active", "expired", "status", "access", "single gym", "all access"],
    routePrefixes: ["/staff"],
    image: "/staff-help/find-member.png",
    steps: [
      "Press Members on Staff Home.",
      "Search using anything you know: name, BGM number, physical card / old pkCustomer, ID number, phone or email.",
      "Tap the correct person.",
      "Confirm the large member photo matches the person in front of you and check the membership status and expiry.",
      "Check the access shown for the member. All Access means the member can use the BGM network. Single Gym means the member can use only the named gym.",
    ],
    important: "ACTIVE is green. EXPIRED or INACTIVE is red. If renewal is needed, use Renew Membership instead of creating a second person.",
  },
  {
    id: "membership-access",
    title: "All Access / Single Gym",
    summary: "Understand which gyms a membership is allowed to use before you sell, renew or admit a member.",
    keywords: ["all access", "single gym", "access", "network", "neptunes", "one gym", "wrong gym", "price", "pricing", "renewal"],
    routePrefixes: [],
    steps: [
      "All Access means the membership can be used at participating BestGymsMalta gyms.",
      "Single Gym means the membership can be used only at the gym named on the membership.",
      "Single Gym is shown only where that gym has Single Gym pricing enabled. Its prices and available durations may be different from All Access.",
      "When creating a new membership, choose the access the customer is buying before you choose the membership type and duration.",
      "When renewing, the member's current access is preselected. Leave it as it is unless the customer is deliberately changing access.",
      "The scanner enforces the access automatically. A valid Single Gym member presented at another gym must be denied.",
    ],
    important: "Do not change a member's access just to make a denied scan turn green. Confirm what membership the customer has actually bought.",
  },
  {
    id: "new-member",
    title: "Add a new member",
    summary: "Create a membership for a person who does not already have a membership record that should be renewed.",
    keywords: ["new member", "join", "membership", "student", "couples", "minor", "guardian", "documents", "voucher", "payment", "photo", "single gym", "all access"],
    routePrefixes: ["/staff/members/enroll?kind=new", "/staff/members/enroll"],
    image: "/staff-help/new-member.png",
    steps: [
      "Press New Member on Staff Home.",
      "If the screen offers All Access / Single Gym, choose the access the customer is buying first.",
      "Choose Regular, Student or Couples and select the correct membership duration and price.",
      "Read the required-document message and tick I understand.",
      "Fill in the applicant details exactly as supplied. Do not guess missing information.",
      "Complete any special checks: student proof, both applicants for Couples, or guardian details for under-18 members.",
      "Accept the required declarations and submit the application for staff review.",
    ],
    important: "If the person already exists in Members, use Renewal instead of creating a duplicate New Member record.",
  },
  {
    id: "waiting-applications",
    title: "Review and activate a waiting application",
    summary: "Complete the final reception checks, card, printing and payment before activating a membership.",
    keywords: ["waiting", "application", "review", "activate", "id passport", "print", "payment", "voucher", "student", "couples", "guardian", "membership active", "single gym", "all access"],
    routePrefixes: ["/staff/members/applications", "/staff"],
    image: "/staff-help/review-application.png",
    steps: [
      "Open Waiting and select the correct application.",
      "Tick ID / passport verified only after physically checking it.",
      "Check membership access, membership type, duration, start date and expiry date. If it says Single Gym, confirm the named gym is correct.",
      "Confirm Review → Continue when everything is correct.",
      "Complete any student, Couples same-address or guardian checks that appear.",
      "Scan or verify the membership card, print the membership form and collect any required signature.",
      "Press Payment Received, enter Staff Name, choose the payment method and apply a voucher only when valid.",
      "Press Payment Received - Activate and do not close the process until Membership Active appears.",
    ],
    important: "Reject an application only when it genuinely cannot be accepted. Never mark an ID or supporting document as verified unless you checked it.",
  },
  {
    id: "renew-membership",
    title: "Renew a membership",
    summary: "Renew the existing person so membership history stays linked correctly.",
    keywords: ["renew", "renewal", "expired", "extend", "membership", "existing member", "expiry", "payment", "voucher", "guardian", "single gym", "all access", "change access"],
    routePrefixes: ["/staff/members/enroll?kind=renewal", "/staff/members/enroll"],
    image: "/staff-help/renewal.png",
    steps: [
      "Press Renew on Staff Home, or open Members, select the person and press Renew Membership.",
      "Search or scan the member and confirm the name and photo.",
      "Check the access shown. The current access is preselected. Leave it unchanged unless the customer is deliberately changing between All Access and Single Gym.",
      "Choose the correct membership type and duration.",
      "Check the starting date carefully. For an active membership, renewal normally starts the day after current expiry so paid days are not lost.",
      "Enter Staff Name and complete guardian details when required.",
      "Submit, then complete review → card verification → print → payment → Membership Active.",
    ],
    important: "Do not create a second person by mistake. If the member already exists, use Renewal. If changing access, confirm the correct access and gym before continuing.",
  },
  {
    id: "reception-cards",
    title: "Reception Tools / replacement card",
    summary: "Use Reception Tools for card scanning and issuing a replacement physical card.",
    keywords: ["reception", "card", "lost card", "stolen card", "damaged card", "replacement card", "issue new card", "new card", "barcode", "scan", "photo"],
    routePrefixes: ["/staff/reception/issue-card", "/staff/reception"],
    image: "/staff-help/reception-card.png",
    steps: [
      "Press Reception Tools on Staff Home.",
      "For a replacement card, press Issue New Card.",
      "Find and select the correct member and confirm the member photo/details.",
      "Enter your Staff Name and choose Lost, Stolen, Damaged or Other.",
      "Scan the NEW preprinted card.",
      "Press Issue New Card and wait for the success message.",
    ],
    important: "Issue New Card changes the physical card only. It does NOT renew, extend or change the access of the membership.",
  },
  {
    id: "sundries",
    title: "Send a Sundries order",
    summary: "Order reception, cleaning or other configured supplies for the gym.",
    keywords: ["sundries", "supplies", "order", "cleaning", "stock", "custom item", "quantity", "notes"],
    routePrefixes: ["/staff/sundries"],
    image: "/staff-help/sundries.png",
    steps: [
      "Press Sundries on Staff Home.",
      "Enter your Staff Name. The order is automatically tied to your gym login.",
      "Use + or - to set the quantity for each required item. Leave anything not needed at 0.",
      "Use Add Custom Item for anything missing from the normal list.",
      "Add notes if needed and press Submit Sundries Order.",
      "Wait for the green saved confirmation.",
    ],
    important: "If email delivery fails, the system still keeps the saved order for follow-up.",
  },
  {
    id: "bar",
    title: "Use the Bar",
    summary: "Record Bar quantities in the open Bar sheet. It saves automatically and keeps running until End of Day is submitted.",
    keywords: ["bar", "drink", "protein", "product", "quantity", "price", "cash", "sales", "others", "auto save", "autosave", "saved", "offline", "midnight", "end of day", "carry"],
    routePrefixes: ["/staff/bar"],
    image: "/staff-help/bar.png",
    steps: [
      "Press Bar on Staff Home.",
      "Find the product you need. You can type in Find Bar product to narrow the list.",
      "Use + or - to record quantities sold. The line total and Bar total since last End of Day update automatically.",
      "Use Others only when the item is not on the official list and enter the required value/details.",
      "Watch the save status. Saved means the open Bar sheet is stored. Offline – waiting to sync means it will sync when the connection returns.",
      "There is no Send Bar List button. The Bar is an auto-save open sheet and its total is pulled into End of Day automatically.",
      "If midnight passes and no End of Day was submitted, the Bar does not start from zero. The open Bar sheet carries across midnight into the next morning.",
    ],
    important: "The Bar resets only when staff submit End of Day successfully. Sales made after that End of Day start building the next End of Day.",
  },
  {
    id: "end-of-day",
    title: "Complete End of Day",
    summary: "Check all automatic figures since the previous successful End of Day, add expenses, enter Staff Name and submit the financial period.",
    keywords: ["end of day", "eod", "close day", "cash", "card", "other", "voucher", "reimbursement", "bar", "expense", "expenses", "staff name", "final total", "midnight", "carry", "print", "hard copy"],
    routePrefixes: ["/staff/end-of-day"],
    image: "/staff-help/end-of-day.png",
    steps: [
      "Press End of Day on Staff Home.",
      "The figures are the open financial period since the previous successful End of Day. They are not reset just because the date changed.",
      "Check New Memberships: Cash, Card and Other. Voucher reimbursement is shown separately for information and is already included correctly in the calculated figures.",
      "Check Renewals: Cash, Card and Other.",
      "Check the Bar total and item quantities carried from the open Bar sheet.",
      "Add every expense that belongs to this open financial period. Enter a description and value for each expense.",
      "Check Gross and End of Day Total. End of Day Total equals all income minus expenses.",
      "Enter the mandatory Staff Name.",
      "Press Submit End of Day only when everything is correct.",
      "Wait for the submitted confirmation. The browser print flow opens so the EOD hard copy can be printed.",
    ],
    important: "Midnight does not reset End of Day. Figures reset only when staff submit End of Day successfully. Any membership, renewal or Bar sales made after that End of Day belong to the next End of Day.",
  },
];

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9€]+/g, " ").replace(/\s+/g, " ").trim();
}

export function searchStaffHelpTopics(query: string): StaffHelpTopic[] {
  const normalised = normalise(query);
  if (!normalised) return STAFF_HELP_TOPICS;
  const terms = normalised.split(" ").filter(Boolean);

  return STAFF_HELP_TOPICS
    .map((topic) => {
      const title = normalise(topic.title);
      const keywords = normalise(topic.keywords.join(" "));
      const body = normalise([topic.summary, ...topic.steps, topic.important || ""].join(" "));
      if (!terms.every((term) => `${title} ${keywords} ${body}`.includes(term))) return null;
      let score = 0;
      if (title.includes(normalised)) score += 100;
      if (keywords.includes(normalised)) score += 60;
      for (const term of terms) {
        if (title.includes(term)) score += 20;
        if (keywords.includes(term)) score += 12;
        if (body.includes(term)) score += 4;
      }
      return { topic, score };
    })
    .filter((entry): entry is { topic: StaffHelpTopic; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.topic);
}

export function getContextStaffHelpTopic(pathname: string): StaffHelpTopic | null {
  const pathWithQuery = pathname || "/staff";
  const candidates = STAFF_HELP_TOPICS.flatMap((topic) =>
    topic.routePrefixes.map((prefix) => ({ topic, prefix }))
  )
    .filter(({ prefix }) => prefix !== "/staff" && pathWithQuery.startsWith(prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return candidates[0]?.topic || null;
}
