export interface AgendaItem {
  time: string;
  title: string;
  location: string;
}

export interface AgendaSection {
  title: string;
  items: AgendaItem[];
}

export interface DaySchedule {
  date: string;
  sections: AgendaSection[];
}

export const schedule: DaySchedule[] = [
  {
    date: "Sat. 22 Feb 2025",
    sections: [
      {
        title: "Hackathon Day 1",
        items: [
          { time: "9:00 - 10:00 am", title: "Registration & Breakfast", location: "17th Floor" },
          { time: "10:00 - 10:45 am", title: "Opening Session", location: "17th Floor" },
          { time: "10:45 - 11:15 am", title: "Team Formation Session", location: "17th Floor" },
          { time: "11:15 am - 12:00 pm", title: "Ideation Session + Biodiversity Workshop", location: "RM 1708" },
          { time: "11:30 am", title: "Expo Hall Opens", location: "17th Floor" },
        ]
      },
      {
        title: "First Wave of Workshops\n12:00 - 2:00 pm",
        items: [
          { time: "12:00 - 1:00 pm", title: "Figma", location: "RM 263" },
          { time: "12:00 - 1:00 pm", title: "HTML/CSS", location: "RM 1708" },
          { time: "1:00 - 2:00 pm", title: "JavaScript/React", location: "RM 262" },
          { time: "1:00 - 2:00 pm", title: "Data Privacy", location: "2nd Floor Tech Talk Space" },
          { time: "2:00 - 5:00 pm", title: "Learning Expo", location: "" },
        ]
      },
      {
        title: "Lightning Talks\n2:00 - 4:00 pm",
        items: [
          { time: "2:00 - 3:00 pm", title: "Lunch", location: "17th Floor" },
          { time: "3:00 - 4:00 pm", title: "Lightning Talks", location: "17th Floor" },
        ]
      },
      {
        title: "Second Wave of Workshops\n4:00 - 6:00 pm",
        items: [
          { time: "4:00 - 5:00 pm", title: "ML/AI", location: "RM 1708" },
          { time: "4:00 - 5:00 pm", title: "Git", location: "17th Floor" },
          { time: "5:00 - 6:00 pm", title: "Open Source", location: "17th Floor" },
        ]
      },
      {
        title: "Evening + Game Night\n7:00 - 11:00 pm",
        items: [
          { time: "7:00 - 8:00 pm", title: "Dinner", location: "17th Floor" },
          { time: "8:00 - 9:00 pm", title: "Evening Session", location: "17th Floor" },
          { time: "9:00 - 11:00 pm", title: "CivicHacks Game Night", location: "RM B62" },
          { time: "11:30 pm", title: "Sleeping Spaces Open", location: "RM 262, 263, 264" },
          { time: "12:00 - 1:00 am", title: "Midnight Snack + Harry Potter Movie Night", location: "Spark! Space" },
        ]
      },
    ]
  },
  {
    date: "Sun. 23 Feb 2025",
    sections: [
      {
        title: "Hackathon Day 2",
        items: [
          { time: "11:00 am", title: "Project Submission Deadline", location: "" },
          { time: "11:00 am - 12:30 pm", title: "Project Presentations", location: "17th Floor" },
          { time: "12:30 - 1:30 pm", title: "Judges Deliberations", location: "" },
          { time: "2:00 - 3:00 pm", title: "Closing Session", location: "17th Floor" },
        ]
      },
    ]
  },
];

