# Loading Baby

A platform where expecting parents create a customizable countdown and birth-announcement page for their baby, share it by link, and send updates to the people following it.

## Language

### People

**User**:
A person with an account on the Platform.
_Avoid_: Account, customer, member

**Owner**:
The User who created a Site and is the only one allowed to manage it.
_Avoid_: Admin, parent, customer

**Visitor**:
Anyone viewing a Site's Public page; needs no account.
_Avoid_: Guest, follower, viewer

**Subscriber**:
A Visitor's device that has opted in to Notifications from one Site. One person on two devices is two Subscribers.
_Avoid_: Follower, subscription, fan

### Sites and pages

**Platform**:
The product as a whole, as opposed to any one Site: its marketing pages, accounts, and Dashboard.
_Avoid_: App, SaaS, root site

**Site**:
One baby's waiting page together with everything the Owner configured for it.
_Avoid_: Tenant, waiting page, account, project

**Site settings**:
Everything an Owner configures for a Site: the baby's name and Sex, Due date, Birth details, Milestones, Theme, Privacy settings, Languages, Timezone and Signature. The Slug is chosen once, at creation, and is not a Site setting.
_Avoid_: Tenant settings, configuration, preferences

**Slug**:
The short, unique, lowercase name a Site is known by, from which its Address is formed.
_Avoid_: Subdomain, handle, username, site address

**Reserved slug**:
A Slug the Platform keeps for its own use, which no Site may take.
_Avoid_: Blocked name, forbidden slug

**Address**:
The URL at which a Site's Public page is reached, derived from its Slug.
_Avoid_: Link, site URL, subdomain

**Custom domain**:
A domain the Owner brings to serve their Site's Public page in place of its Address, usable once verified. Planned, not yet offered.
_Avoid_: CNAME, vanity domain

**Public page**:
What a Visitor sees for a Site.
_Avoid_: Landing page, tenant page

**Dashboard**:
Where an Owner manages their Sites, Subscribers, and Notifications.
_Avoid_: Admin, backoffice, console

### The baby

**Waiting state**:
A Site's state until the Owner marks the baby as born; its Public page leads with the Countdown.
_Avoid_: Pregnancy, pre-birth, expecting mode

**Born state**:
A Site's state once the Owner marks the baby as born; its Public page leads with the Birth details.
_Avoid_: Announcement mode, arrived

**Due date**:
The expected arrival day.
_Avoid_: ETA, expected date, term

**Countdown**:
The whole number of days until the Due date, or the days late once it has passed.
_Avoid_: Timer, days left

**Birth details**:
The birth date and time, weight, length, and Birth message that the Public page shows in the Born state. They exist only while the baby is marked as born: removing the mark discards them.
_Avoid_: Birth stats, birth info

**Birth message**:
The Owner's own words shown with the Birth details.
_Avoid_: Announcement, caption

**Milestone**:
A labelled date in the baby's story that the Owner adds to a Site.
_Avoid_: Event, timeline entry

**Sex**:
Girl, boy, or unknown; unknown means the Owner prefers not to say.
_Avoid_: Gender

### Presentation

**Theme**:
A Site's Palette and Font together.
_Avoid_: Style, skin, design

**Palette**:
One of the Platform's curated colour sets.
_Avoid_: Colour scheme, colours

**Font**:
One of the Platform's curated pairs of typefaces: a display face for the baby's name, the Countdown and headings, and a body face for everything else.
_Avoid_: Typeface, typography

**Platform theme**:
The Platform's own fixed Palette and Font, worn by its marketing, auth, onboarding and Dashboard pages. Owners cannot pick it.
_Avoid_: Default theme, admin theme

**Privacy settings**:
The Owner's choice of whether the baby's name and Sex appear on the Public page during the Waiting state. The Born state always shows them.
_Avoid_: Visibility, toggles

**Languages**:
The languages a Site's Public page speaks, one or more. A Visitor gets the one their browser asks for; when it asks for none of them, English if the Site speaks it, Italian otherwise. Notifications fall back the same way. A Visitor's pick in the Language switcher is remembered for their next visits.
_Avoid_: Language mode, locale, translation setting

**Signature**:
The Owner's own short line in the header of the Public page, one per Language, usually the parents' names. Optional, and shown in both the Waiting and the Born state: Privacy settings never hide it.
_Avoid_: Byline, wordmark, credits

**Language switcher**:
The control on a Public page with more than one Language that lets a Visitor pick one of them.
_Avoid_: Language picker, toggle

**Timezone**:
The time zone a Site tells its Countdown and Birth details in: the Countdown changes at its midnight.
_Avoid_: Locale, region

### Notifications

**Notification**:
A message an Owner sends to every Subscriber of one Site.
_Avoid_: Push, alert, update, broadcast

**Birth notification**:
The Notification announcing the birth; what a Subscriber opts in to during the Waiting state.
_Avoid_: Birth alert, arrival push
