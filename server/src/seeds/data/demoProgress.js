/**
 * Sample learning activity for the demo students (only seeded when they exist
 * and their enrollment in the course is active). `lessonsCompleted` counts the
 * first published lessons of the course in roadmap order; the lesson after
 * them becomes the one they were last reading.
 */
export const DEMO_PROGRESS = [
  { email: 'aarav.demo@example.com', course: 'full-stack-mern-development', lessonsCompleted: 8 },
  { email: 'neha.demo@example.com', course: 'full-stack-mern-development', lessonsCompleted: 3 },
];

/** Sample submissions, found by assignment title in the course. */
export const DEMO_SUBMISSIONS = [
  {
    email: 'aarav.demo@example.com',
    course: 'full-stack-mern-development',
    assignment: 'Personal Profile Page',
    items: [
      { type: 'github_url', url: 'https://github.com/aarav-demo/profile-page' },
      { type: 'project_url', url: 'https://aarav-demo.github.io/profile-page/' },
    ],
    note: 'I added a skip link and checked the form with a screen reader.',
    status: 'reviewed',
    marks: 86,
    feedback: `Good semantic structure and a properly labelled form.

- Heading order is correct throughout
- Add \`alt\` text to the avatar image
- The tagline could use a \`<p>\` instead of a second \`<h2>\``,
  },
  {
    email: 'neha.demo@example.com',
    course: 'full-stack-mern-development',
    assignment: 'Personal Profile Page',
    items: [{ type: 'github_url', url: 'https://github.com/neha-demo/profile' }],
    note: '',
    status: 'resubmit_requested',
    marks: null,
    feedback: `The repository is there, but the page isn't deployed yet.

Please publish it with GitHub Pages, Netlify or Vercel and submit **both** links.`,
  },
];
