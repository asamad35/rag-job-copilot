export interface AutofillProfile {
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  headline: string;
  mobile: string;
  email: string;
  gender: string;
  totalExperience: string;
  experienceYears: string;
  experienceMonths: string;
  expectedSalary: string;
  currentSalary: string;
  currentLocation: string;
  preferredLocation: string;
  nationality: string;
  noticePeriod: string;
  noticePeriodDays: string;
  github: string;
  linkedin: string;
  portfolio: string;
  projectLinks: string;
  leetcode: string;
  demoVideos: string;
  skills: string;
  frontendSkills: string;
  backendSkills: string;
  devopsSkills: string;
  cloudSkills: string;
  aiSkills: string;
  currentCompany: string;
  currentDesignation: string;
  highestQualification: string;
  degree: string;
  collegeName: string;
  graduationYear: string;
  cgpa: string;
  professionalSummary: string;
  certifications: string;
  servingNoticePeriod: 'Yes' | 'No';
  earliestJoinDays: string;
  sourcePlatform: string;
  lastWorkingDay: string;
  resumeFileName: string;
}

export const DEFAULT_PROFILE: AutofillProfile = {
  fullName: 'Abdus Samad',
  firstName: 'Abdus',
  middleName: '',
  lastName: 'Samad',
  headline: 'Full-Stack Developer',
  mobile: '+919654405340',
  email: 'samad.abdus3535@gmail.com',
  gender: 'Male',
  totalExperience: '5 years and 6 months',
  experienceYears: '5',
  experienceMonths: '6',
  expectedSalary: '3200000',
  currentSalary: '2300000',
  currentLocation: 'Delhi',
  preferredLocation: 'Remote - India',
  nationality: 'Indian',
  noticePeriod: '2 months',
  noticePeriodDays: '60',
  github: 'https://github.com/asamad35',
  linkedin: 'https://www.linkedin.com/in/asamad35/',
  portfolio: 'https://asamad.vercel.app/',
  projectLinks:
    'https://doodleit.vercel.app/, https://kanban-pro.netlify.app/, https://socio-plus.netlify.app/',
  leetcode: 'https://leetcode.com/user5730HH/',
  demoVideos:
    'https://youtu.be/FSHMCYQLUMU, https://youtu.be/MftamlrwZZQ, https://youtu.be/gUq0REh-C-w',
  skills:
    'JavaScript, TypeScript, React.js, Next.js, Node.js, Nest.js, GraphQL, MongoDB, Redis, Docker, Kubernetes, AWS',
  frontendSkills:
    'JavaScript, TypeScript, React.js, Next.js, Tailwind CSS, SCSS, HTML5, Redux, Recoil',
  backendSkills:
    'Node.js, Express.js, Nest.js, GraphQL, Firebase, MongoDB, Mongoose, Prisma, Redis, Kafka, Jest',
  devopsSkills: 'Docker, Kubernetes, Git, GitHub',
  cloudSkills: 'AWS EC2, ECS, S3, CloudWatch, ELB, CloudFront, X-Ray',
  aiSkills: 'Prompt Engineering, Cursor, Copilot, ChatGPT, Claude',
  currentCompany: 'Caw Studios',
  currentDesignation: 'Full Stack Developer',
  highestQualification: 'Bachelor Of Computer Applications',
  degree: 'BCA',
  collegeName: 'Ambedkar Institute of Technology',
  graduationYear: '2023',
  cgpa: '8.7',
  professionalSummary:
    'Full-stack developer with 5 years and 6 months experience building scalable React/Next.js and Node/Nest.js applications.',
  certifications:
    'The Complete JavaScript Course, Full-Stack Web Development Bootcamp, Complete React Developer, Advanced CSS and Sass',
  servingNoticePeriod: 'Yes',
  earliestJoinDays: '1',
  sourcePlatform: 'LinkedIn',
  lastWorkingDay: '',
  resumeFileName: 'Samad_Resume.pdf'
};
