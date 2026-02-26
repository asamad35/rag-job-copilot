import type { AutofillProfile } from '../../shared/profile';
import { PROFILE_FIELD_PATTERNS, TEST_TEXT_VALUE } from './constants';
import { collectHints, isLikelyCaptchaHint } from './hints';
import type { FillableElement, ProfileFieldKey } from './types';
import {
  formatDateDdMmYyyy,
  normalizeText,
  splitMobileNumber
} from './utils';

export interface ResolvedProfileValue {
  key: ProfileFieldKey | null;
  value: string;
  shouldSkip: boolean;
}

function getAutocompleteProfileKey(
  autocompleteRaw: string | null
): ProfileFieldKey | null {
  const autocomplete = normalizeText(autocompleteRaw ?? '');
  if (!autocomplete) {
    return null;
  }

  if (autocomplete.includes('name')) {
    if (autocomplete.includes('given')) {
      return 'firstName';
    }
    if (autocomplete.includes('family')) {
      return 'lastName';
    }
    return 'fullName';
  }

  if (autocomplete.includes('email')) {
    return 'email';
  }

  if (autocomplete.includes('tel') || autocomplete.includes('phone')) {
    return 'mobile';
  }

  if (autocomplete.includes('address level2')) {
    return 'currentLocation';
  }

  return null;
}

export function inferProfileFieldKey(
  element: FillableElement,
  hint: string
): ProfileFieldKey | null {
  if (isLikelyCaptchaHint(hint)) {
    return 'captcha';
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === 'file') {
      return 'resumeFileName';
    }

    const byAutocomplete = getAutocompleteProfileKey(
      element.getAttribute('autocomplete')
    );
    if (byAutocomplete) {
      return byAutocomplete;
    }
  }

  if (
    hint.includes('country code') &&
    (hint.includes('mobile') || hint.includes('phone'))
  ) {
    return 'mobileCountryCode';
  }

  if (
    hint.includes('mobile number') ||
    hint.includes('phone number')
  ) {
    return 'mobileLocalNumber';
  }

  if (
    hint.includes('workexperience months') ||
    hint.includes('experience months') ||
    hint.includes('exp months') ||
    hint.includes('months of experience')
  ) {
    return 'experienceMonths';
  }

  if (
    hint.includes('workexperience years') ||
    hint.includes('experience in years') ||
    hint.includes('experience years') ||
    hint.includes('exp years') ||
    hint.includes('years of experience')
  ) {
    return 'experienceYears';
  }

  if (hint.includes('official notice period') && hint.includes('day')) {
    return 'noticePeriodDays';
  }

  if (hint.includes('how early can you join') && hint.includes('day')) {
    return 'earliestJoinDays';
  }

  if (hint.includes('lwd') || hint.includes('last working day')) {
    return 'lastWorkingDay';
  }

  if (hint.includes('serving np') || hint.includes('serving notice')) {
    return 'servingNoticePeriod';
  }

  if (hint.includes('through which platform') || hint.includes('learn about this job')) {
    return 'sourcePlatform';
  }

  if (hint.includes('current company') || hint.includes('present company')) {
    return 'currentCompany';
  }

  if (hint.includes('current designation') || hint.includes('current role')) {
    return 'currentDesignation';
  }

  if (hint.includes('highest qualification') || hint.includes('highest education')) {
    return 'highestQualification';
  }

  if (hint.includes('graduation year') || hint.includes('passing year')) {
    return 'graduationYear';
  }

  if (hint.includes('cgpa') || hint.includes('gpa')) {
    return 'cgpa';
  }

  if (hint.includes('about me') || hint.includes('about yourself')) {
    return 'professionalSummary';
  }

  for (const matcher of PROFILE_FIELD_PATTERNS) {
    if (matcher.patterns.some((pattern) => hint.includes(pattern))) {
      return matcher.key;
    }
  }

  if (hint.includes('name')) {
    return 'fullName';
  }

  return null;
}

export function profileValueByKey(
  key: ProfileFieldKey,
  profile: AutofillProfile
): string {
  const mobileParts = splitMobileNumber(profile.mobile);

  switch (key) {
    case 'fullName':
      return profile.fullName;
    case 'firstName':
      return profile.firstName;
    case 'middleName':
      return profile.middleName;
    case 'lastName':
      return profile.lastName;
    case 'headline':
      return profile.headline;
    case 'mobile':
      return profile.mobile;
    case 'mobileCountryCode':
      return mobileParts.countryCode;
    case 'mobileLocalNumber':
      return mobileParts.localNumber;
    case 'email':
      return profile.email;
    case 'gender':
      return profile.gender;
    case 'totalExperience':
      return profile.totalExperience;
    case 'experienceYears':
      return profile.experienceYears;
    case 'experienceMonths':
      return profile.experienceMonths;
    case 'expectedSalary':
      return profile.expectedSalary;
    case 'currentSalary':
      return profile.currentSalary;
    case 'preferredLocation':
      return profile.preferredLocation;
    case 'currentLocation':
      return profile.currentLocation;
    case 'nationality':
      return profile.nationality;
    case 'noticePeriod':
      return profile.noticePeriod;
    case 'noticePeriodDays':
      return profile.noticePeriodDays;
    case 'servingNoticePeriod':
      return profile.servingNoticePeriod;
    case 'earliestJoinDays':
      return profile.earliestJoinDays;
    case 'sourcePlatform':
      return profile.sourcePlatform;
    case 'lastWorkingDay': {
      if (profile.lastWorkingDay.trim()) {
        return profile.lastWorkingDay;
      }

      const noticeDays = Number.parseInt(profile.noticePeriodDays, 10);
      if (!Number.isFinite(noticeDays)) {
        return '';
      }

      const date = new Date();
      date.setDate(date.getDate() + noticeDays);
      return formatDateDdMmYyyy(date);
    }
    case 'currentCompany':
      return profile.currentCompany;
    case 'currentDesignation':
      return profile.currentDesignation;
    case 'highestQualification':
      return profile.highestQualification;
    case 'degree':
      return profile.degree;
    case 'collegeName':
      return profile.collegeName;
    case 'graduationYear':
      return profile.graduationYear;
    case 'cgpa':
      return profile.cgpa;
    case 'professionalSummary':
      return profile.professionalSummary;
    case 'certifications':
      return profile.certifications;
    case 'frontendSkills':
      return profile.frontendSkills;
    case 'backendSkills':
      return profile.backendSkills;
    case 'devopsSkills':
      return profile.devopsSkills;
    case 'cloudSkills':
      return profile.cloudSkills;
    case 'aiSkills':
      return profile.aiSkills;
    case 'github':
      return profile.github;
    case 'linkedin':
      return profile.linkedin;
    case 'portfolio':
      return profile.portfolio;
    case 'projectLinks':
      return profile.projectLinks;
    case 'leetcode':
      return profile.leetcode;
    case 'demoVideos':
      return profile.demoVideos;
    case 'skills':
      return profile.skills;
    case 'resumeFileName':
      return profile.resumeFileName;
    case 'captcha':
      return '';
    default:
      return '';
  }
}

export function resolveProfileOptionTargets(
  key: ProfileFieldKey,
  profile: AutofillProfile
): string[] {
  const directValue = profileValueByKey(key, profile);
  const values: string[] = directValue ? [directValue] : [];

  if (key === 'gender') {
    values.push('male', 'm');
  }

  if (key === 'mobileCountryCode') {
    const countryCode = splitMobileNumber(profile.mobile).countryCode;
    values.push(countryCode, countryCode.replace('+', ''));
  }

  if (key === 'noticePeriod' || key === 'noticePeriodDays') {
    values.push('2 months', '2 month', '60 days', '60 day', '60');
  }

  if (key === 'servingNoticePeriod') {
    values.push('yes', 'y');
  }

  if (key === 'sourcePlatform') {
    values.push('linkedin');
  }

  if (key === 'currentLocation') {
    values.push('new delhi', 'delhi ncr');
  }

  if (key === 'preferredLocation') {
    values.push('remote india', 'remote');
  }

  if (key === 'nationality') {
    values.push('india', 'indian');
  }

  return values.map(normalizeText).filter((value) => value.length > 0);
}

export function optionMatchScore(optionText: string, targets: string[]): number {
  if (!targets.length) {
    return -1;
  }

  const normalized = normalizeText(optionText);
  if (!normalized) {
    return -1;
  }

  for (const target of targets) {
    if (normalized === target) {
      return 3;
    }
  }

  for (const target of targets) {
    if (normalized.includes(target) || target.includes(normalized)) {
      return 2;
    }
  }

  for (const target of targets) {
    const targetWords = target.split(' ').filter(Boolean);
    if (targetWords.some((word) => normalized.includes(word))) {
      return 1;
    }
  }

  return -1;
}

export function pickMatchingSelectOption(
  select: HTMLSelectElement,
  targets: string[]
): HTMLOptionElement | undefined {
  let bestOption: HTMLOptionElement | undefined;
  let bestScore = -1;

  for (const option of Array.from(select.options)) {
    if (option.disabled) {
      continue;
    }

    const score = Math.max(
      optionMatchScore(option.textContent ?? '', targets),
      optionMatchScore(option.value, targets)
    );

    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  return bestScore > -1 ? bestOption : undefined;
}

export function pickMatchingRoleOption(
  options: HTMLElement[],
  targets: string[]
): HTMLElement | undefined {
  let bestOption: HTMLElement | undefined;
  let bestScore = -1;

  for (const option of options) {
    const score = optionMatchScore(option.textContent ?? '', targets);
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  if (bestOption) {
    return bestOption;
  }

  return options[0];
}

export function chooseRadioCandidate(
  candidates: HTMLInputElement[],
  key: ProfileFieldKey | null,
  profile: AutofillProfile
): HTMLInputElement | undefined {
  if (!key) {
    return candidates[0];
  }

  const targets = resolveProfileOptionTargets(key, profile);
  if (!targets.length) {
    return candidates[0];
  }

  let bestCandidate: HTMLInputElement | undefined;
  let bestScore = -1;

  for (const candidate of candidates) {
    const optionHint = collectHints(candidate);
    const score = optionMatchScore(optionHint, targets);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? candidates[0];
}

export function resolveProfileValueForElement(
  element: FillableElement,
  profile: AutofillProfile,
  fallbackValue: string
): ResolvedProfileValue {
  const hint = collectHints(element);
  const key = inferProfileFieldKey(element, hint);
  const fallbackLooksLikeTest =
    normalizeText(fallbackValue) === normalizeText(TEST_TEXT_VALUE);

  if (!key) {
    return {
      key: null,
      value: fallbackLooksLikeTest ? '' : fallbackValue,
      shouldSkip: fallbackLooksLikeTest
    };
  }

  if (key === 'captcha') {
    return { key, value: '', shouldSkip: true };
  }

  const candidate = profileValueByKey(key, profile).trim();
  if (!candidate) {
    if (
      key === 'middleName' ||
      key === 'github' ||
      key === 'portfolio' ||
      key === 'linkedin' ||
      key === 'projectLinks' ||
      key === 'leetcode' ||
      key === 'demoVideos'
    ) {
      if (key === 'middleName') {
        return { key, value: '', shouldSkip: false };
      }
      return { key, value: '', shouldSkip: true };
    }

    return {
      key,
      value: fallbackLooksLikeTest ? '' : fallbackValue,
      shouldSkip: fallbackLooksLikeTest
    };
  }

  return { key, value: candidate, shouldSkip: false };
}
