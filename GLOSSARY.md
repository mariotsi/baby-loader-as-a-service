# Waiting Pages

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
Everything an Owner configures for a Site: the baby's name and Sex, Due date, Birth details, Milestones, Theme, Privacy settings and Language mode. The Slug is chosen once, at creation, and is not a Site setting.
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
A Site's state before the birth is recorded; its Public page leads with the Countdown.
_Avoid_: Pregnancy, pre-birth, expecting mode

**Born state**:
A Site's state once the Owner has recorded the birth; its Public page leads with the Birth details.
_Avoid_: Announcement mode, arrived

**Due date**:
The expected arrival day.
_Avoid_: ETA, expected date, term

**Countdown**:
The whole number of days until the Due date, or the days late once it has passed.
_Avoid_: Timer, days left

**Birth details**:
The birth date and time, weight, length, and Birth message, recorded when a Site enters the Born state.
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
One of the Platform's curated typefaces.
_Avoid_: Typeface, typography

**Privacy settings**:
The Owner's choice of whether the baby's name and Sex appear on the Public page.
_Avoid_: Visibility, toggles

**Language mode**:
Which language a Site's Public page speaks: Italian only, English only, or Both, where each Visitor picks with the Language switcher.
_Avoid_: Locale, translation setting

**Language switcher**:
The control on a Public page in Both mode that lets a Visitor pick Italian or English.
_Avoid_: Language picker, toggle

### Notifications

**Notification**:
A message an Owner sends to every Subscriber of one Site.
_Avoid_: Push, alert, update, broadcast

**Birth notification**:
The Notification announcing the birth; what a Subscriber opts in to during the Waiting state.
_Avoid_: Birth alert, arrival push
