import type { ProfileFieldKey } from './types';

export const TEST_TEXT_VALUE = 'test';

export const EXCLUDED_INPUT_TYPES = new Set([
  'hidden',
  'submit',
  'button',
  'image',
  'reset',
  'file'
]);

export const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'url',
  'email',
  'tel',
  'password'
]);

export const PLACEHOLDER_PREFIXES = ['select', 'choose', 'please select'];

export const PROFILE_FIELD_PATTERNS: Array<{
  key: ProfileFieldKey;
  patterns: readonly string[];
}> = [
  {
    key: 'firstName',
    patterns: ['first name', 'firstname', 'given name', 'given_name']
  },
  {
    key: 'middleName',
    patterns: ['middle name', 'middlename']
  },
  {
    key: 'lastName',
    patterns: ['last name', 'lastname', 'surname', 'family name', 'family_name']
  },
  {
    key: 'fullName',
    patterns: [
      'full name',
      'fullname',
      'candidate name',
      'applicant name',
      'your name'
    ]
  },
  {
    key: 'headline',
    patterns: ['headline', 'title', 'profile title', 'professional title']
  },
  {
    key: 'mobileCountryCode',
    patterns: ['country code', 'countrycode', 'phone country code']
  },
  {
    key: 'mobileLocalNumber',
    patterns: ['phone number', 'mobile number', 'contact number']
  },
  {
    key: 'mobile',
    patterns: ['mobile', 'phone', 'contact no', 'contact', 'whatsapp']
  },
  {
    key: 'email',
    patterns: ['email', 'e-mail', 'mail id']
  },
  {
    key: 'gender',
    patterns: ['gender', 'sex']
  },
  {
    key: 'experienceYears',
    patterns: ['experience in years', 'experience years', 'exp years', 'years of experience']
  },
  {
    key: 'experienceMonths',
    patterns: ['experience months', 'exp months', 'months of experience']
  },
  {
    key: 'totalExperience',
    patterns: ['total experience', 'overall experience', 'work experience']
  },
  {
    key: 'expectedSalary',
    patterns: [
      'expected salary',
      'expected ctc',
      'expected compensation',
      'salary expectation',
      'expected annual'
    ]
  },
  {
    key: 'currentSalary',
    patterns: [
      'current salary',
      'current ctc',
      'present salary',
      'current compensation'
    ]
  },
  {
    key: 'currentCompany',
    patterns: ['current company', 'present company', 'company name', 'employer']
  },
  {
    key: 'currentDesignation',
    patterns: [
      'current designation',
      'current role',
      'designation',
      'job title',
      'current title'
    ]
  },
  {
    key: 'noticePeriodDays',
    patterns: ['notice period in days', 'official notice period', 'notice days', 'notice in days']
  },
  {
    key: 'noticePeriod',
    patterns: ['notice period', 'joining availability', 'joining time', 'availability']
  },
  {
    key: 'earliestJoinDays',
    patterns: ['how early can you join', 'negotiable in days', 'join early']
  },
  {
    key: 'servingNoticePeriod',
    patterns: ['serving np', 'serving notice', 'serving notice period']
  },
  {
    key: 'lastWorkingDay',
    patterns: ['lwd', 'last working day']
  },
  {
    key: 'sourcePlatform',
    patterns: ['through which platform', 'learn about this job', 'job source', 'source']
  },
  {
    key: 'currentLocation',
    patterns: ['current location', 'location', 'city', 'residing city']
  },
  {
    key: 'preferredLocation',
    patterns: ['preferred location', 'location preference', 'preferred city']
  },
  {
    key: 'nationality',
    patterns: ['nationality', 'citizenship']
  },
  {
    key: 'highestQualification',
    patterns: [
      'highest qualification',
      'highest education',
      'qualification',
      'education level'
    ]
  },
  {
    key: 'degree',
    patterns: ['degree', 'course', 'education degree']
  },
  {
    key: 'collegeName',
    patterns: ['college', 'institute', 'university', 'school name']
  },
  {
    key: 'graduationYear',
    patterns: ['graduation year', 'passing year', 'year of graduation']
  },
  {
    key: 'cgpa',
    patterns: ['cgpa', 'gpa', 'grade point']
  },
  {
    key: 'professionalSummary',
    patterns: ['professional summary', 'summary', 'about me', 'about yourself', 'profile summary']
  },
  {
    key: 'certifications',
    patterns: ['certification', 'certifications', 'courses', 'training']
  },
  {
    key: 'frontendSkills',
    patterns: ['frontend skills', 'front end skills', 'ui skills']
  },
  {
    key: 'backendSkills',
    patterns: ['backend skills', 'back end skills', 'api skills']
  },
  {
    key: 'devopsSkills',
    patterns: ['devops skills', 'infrastructure tools', 'deployment tools']
  },
  {
    key: 'cloudSkills',
    patterns: ['cloud skills', 'cloud platforms', 'aws skills', 'azure skills', 'gcp skills']
  },
  {
    key: 'aiSkills',
    patterns: ['ai skills', 'ml skills', 'llm skills', 'prompt engineering']
  },
  {
    key: 'github',
    patterns: ['github', 'git hub', 'github profile']
  },
  {
    key: 'linkedin',
    patterns: ['linkedin', 'linked in']
  },
  {
    key: 'portfolio',
    patterns: ['portfolio', 'website', 'personal site']
  },
  {
    key: 'projectLinks',
    patterns: ['project links', 'project urls', 'project url', 'work samples']
  },
  {
    key: 'leetcode',
    patterns: ['leetcode', 'coding profile', 'coding platform profile']
  },
  {
    key: 'demoVideos',
    patterns: ['demo video', 'project demo', 'youtube', 'video links']
  },
  {
    key: 'skills',
    patterns: ['skills', 'technology', 'tech stack', 'primary skill', 'key skill']
  },
  {
    key: 'resumeFileName',
    patterns: ['resume', 'cv', 'upload file', 'upload resume', 'attach resume']
  },
  {
    key: 'captcha',
    patterns: ['captcha']
  }
];
