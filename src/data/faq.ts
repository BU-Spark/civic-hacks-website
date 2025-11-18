export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export const faqs: FAQItem[] = [
  {
    id: "collapseTwo",
    question: "What is a hackathon? Will there be actual hacking?",
    answer: "A hackathon is an event where students \"hack\" together and create an app, website, game, etc. in 24-48 hours."
  },
  {
    id: "collapseOne",
    question: "Is the event free to attend?",
    answer: "Yes! The event is free and food will be provided for the duration of the event. We will also have swag and prizes!"
  },
  {
    id: "collapseThree",
    question: "Who can attend? What if I don't have any experience?",
    answer: `This event is open to any student currently enrolled in a college, university, community college, or equivalent program. Professionals are not allowed to participate. 
    
The Hackathon is beginner friendly, with workshops to help you learn during the event, and mentors available to help you as you work on your project.`
  },
  {
    id: "collapse_4",
    question: "Where is the event? Is it in person or virtual? Where can I park?",
    answer: `The event can only be attended in person and is located on the 17th floor of the Duan Family Center for Computing & Data Sciences at <a href="https://maps.app.goo.gl/E1RZcsFnY5jMipXN8" target="_blank"><span class="faq-link">665 Commonwealth Ave, Boston MA</span></a>.
    
There is free two-hour parking on the side streets and the Agganis Arena parking garage and Lot (Lot A and LOT C2) are open daily for public, transient parking from 7am to 11pm with the exception of holidays and event days. During event days, these locations become available for parking 90 minutes prior to the start of the performance or sporting event. You can learn more here <span class="faq-link">https://www.agganisarena.com/plan-your-visit/parking/</span>

We do not provide parking passes.`
  },
  {
    id: "collapse_11",
    question: "Are you sending out acceptances? Is there a deadline to apply? Is there a waitlist?",
    answer: `We will send out acceptances by February 14th. If you need to know before then to book travel, please reach out to our team for an early review. 

Applications will be closing once we reach the maximum amount of hackers we can support, but we will have a waitlist the day of the event for any local hackers who want to fill the spots of any accepted hackers who do not end up attending.`
  },
  {
    id: "collapse_12",
    question: "How do I sign up to be a mentor/judge/volunteer?",
    answer: `You can <a class="underline" href="https://airtable.com/appmORmY9unGbIHj2/shrVBUpAKTgqN2Pe8" target="_blank">sign up to mentor here.</a>

You can <a class="underline" id="faq-link" href="https://airtable.com/appmORmY9unGbIHj2/shrjwEdDGoomh4yOF" target="_blank">sign up to judge here.</a>`
  },
  {
    id: "collapse_5",
    question: "Do I have to stay overnight?",
    answer: `We prefer students stay in the building overnight, but they are welcome to leave at night and come back in the morning. 

Air mattresses are provided to every attendee and we will have dedicated sleeping rooms.`
  },
  {
    id: "collapse_6",
    question: "What should I bring?",
    answer: "Your laptop, charger, headphones. And any personal toiletry items including but not limited to toothbrush, deodorant, pillow/blanket, etc."
  },
  {
    id: "collapse_7",
    question: "Are there travel reimbursements?",
    answer: "We do not provide travel reimbursements."
  },
  {
    id: "collapse_8",
    question: "When can we start working on our project? Can I work on a previous project?",
    answer: "You cannot start until after opening ceremony. You may come up with ideas, but are not allowed to start coding. You cannot work on a previous project, but can use frameworks if you clearly credit them in your readme and differentiate what you made vs what you used."
  },
  {
    id: "collapse_9",
    question: "What is the team size limit?",
    answer: `You can be on teams of up to 5. 

We will have a team matching activities to ensure everyone has a team!`
  },
  {
    id: "collapse_10",
    question: "What kind of activities will there be?",
    answer: "You can check the agenda above. There will be a combination of workshops and activities to take a break and meet other hackers and our wonderful sponsors."
  },
  {
    id: "collapse_13",
    question: "I still have a question!",
    answer: "Email us at buspark@bu.edu"
  },
];

