import { DEFAULT_PROFILE, type AutofillProfile } from './profile';

export interface ProfileLabelMapping {
  labels: readonly string[];
  value: string;
}

export function getProfileLabelMappings(
  profile: AutofillProfile = DEFAULT_PROFILE
): ProfileLabelMapping[] {
  return [
    { labels: ['full name', 'candidate name', 'applicant name'], value: profile.fullName },
    { labels: ['first name', 'given name'], value: profile.firstName },
    { labels: ['middle name'], value: profile.middleName },
    { labels: ['last name', 'surname'], value: profile.lastName },
    { labels: ['headline', 'professional title', 'title'], value: profile.headline },
    { labels: ['email', 'email address'], value: profile.email },
    { labels: ['mobile', 'phone', 'contact number'], value: profile.mobile },
    { labels: ['country code', 'phone code'], value: '+91' },
    { labels: ['phone number', 'mobile number'], value: '9654405340' },
    { labels: ['gender', 'sex'], value: profile.gender },
    { labels: ['current location', 'city'], value: profile.currentLocation },
    { labels: ['preferred location', 'location preference'], value: profile.preferredLocation },
    { labels: ['nationality', 'citizenship'], value: profile.nationality },
    { labels: ['experience', 'total experience'], value: profile.totalExperience },
    { labels: ['experience years', 'years of experience'], value: profile.experienceYears },
    { labels: ['experience months'], value: profile.experienceMonths },
    { labels: ['current salary', 'current ctc'], value: profile.currentSalary },
    { labels: ['expected salary', 'expected ctc'], value: profile.expectedSalary },
    { labels: ['notice period'], value: profile.noticePeriod },
    { labels: ['notice period in days', 'official notice period in days'], value: profile.noticePeriodDays },
    { labels: ['serving np', 'serving notice period'], value: profile.servingNoticePeriod },
    { labels: ['earliest join days', 'how early can you join'], value: profile.earliestJoinDays },
    { labels: ['last working day', 'lwd'], value: profile.lastWorkingDay || '(today + 60 days)' },
    { labels: ['current company', 'present company'], value: profile.currentCompany },
    { labels: ['current designation', 'current role', 'job title'], value: profile.currentDesignation },
    { labels: ['highest qualification', 'education'], value: profile.highestQualification },
    { labels: ['degree', 'course'], value: profile.degree },
    { labels: ['college', 'institute', 'university'], value: profile.collegeName },
    { labels: ['graduation year', 'passing year'], value: profile.graduationYear },
    { labels: ['cgpa', 'gpa'], value: profile.cgpa },
    { labels: ['skills', 'tech stack', 'key skills'], value: profile.skills },
    { labels: ['frontend skills'], value: profile.frontendSkills },
    { labels: ['backend skills'], value: profile.backendSkills },
    { labels: ['devops skills'], value: profile.devopsSkills },
    { labels: ['cloud skills'], value: profile.cloudSkills },
    { labels: ['ai skills'], value: profile.aiSkills },
    { labels: ['professional summary', 'about me', 'about yourself'], value: profile.professionalSummary },
    { labels: ['certifications', 'courses'], value: profile.certifications },
    { labels: ['source platform', 'how did you hear about this job'], value: profile.sourcePlatform },
    { labels: ['resume', 'resume file name'], value: profile.resumeFileName },
    { labels: ['github', 'github profile'], value: profile.github },
    { labels: ['linkedin'], value: profile.linkedin },
    { labels: ['portfolio', 'website'], value: profile.portfolio },
    { labels: ['project links', 'project urls', 'work samples'], value: profile.projectLinks },
    { labels: ['leetcode', 'coding profile'], value: profile.leetcode },
    { labels: ['demo videos', 'project demo', 'video links'], value: profile.demoVideos }
  ];
}

export const DEFAULT_PROFILE_LABEL_MAPPINGS = getProfileLabelMappings();
